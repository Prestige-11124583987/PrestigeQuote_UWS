import { makeStoredPricingRecord, resolveStoredPricing } from "./pricingStorage.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

const PRICING_STORAGE_KEY = "prestige.quoteTool.pricing.v1";
const SUPPLEMENT_DB_NAME = "prestige-quote-tool";
const SUPPLEMENT_STORE_NAME = "invoice-supplements";
const SUPPLEMENT_DB_VERSION = 1;

async function readJson(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fallbackMessage);
  return data;
}

function readStoredPricingRecord() {
  try {
    const raw = window.localStorage.getItem(PRICING_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Could not read browser pricing:", error);
    return null;
  }
}

function readStoredPricing() {
  return readStoredPricingRecord()?.pricing || null;
}

function clearStoredPricing() {
  try {
    window.localStorage.removeItem(PRICING_STORAGE_KEY);
  } catch (error) {
    console.warn("Could not clear browser pricing:", error);
  }
}

function saveStoredPricing(pricing) {
  try {
    const record = makeStoredPricingRecord(pricing);
    window.localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    throw new Error("Could not save pricing in this browser. Check browser storage settings.");
  }
}

async function getRepositoryPricing() {
  const res = await fetch(`${API_BASE}/api/admin/pricing`, { cache: "no-store" });
  return readJson(res, "Could not load repository pricing.");
}

async function getEffectivePricing() {
  const repositoryPricing = await getRepositoryPricing();
  const storedRecord = readStoredPricingRecord();
  const effectivePricing = resolveStoredPricing(repositoryPricing, storedRecord);

  if (effectivePricing === repositoryPricing && storedRecord) {
    // A repository pricing change invalidates the old full-browser copy. This
    // prevents stale local discounts and prices from overriding a new deploy.
    clearStoredPricing();
  }

  return effectivePricing;
}

function sanitizePricingForClient(data) {
  const publicStyles = Object.fromEntries(
    Object.entries(data?.styles || {}).map(([name, style]) => [
      name,
      { pricePerSf: Number(style?.pricePerSf || 0) }
    ])
  );

  const publicAddOns = (data?.addOns || [])
    .filter((addOn) => addOn.active !== false)
    .map((addOn) => ({
    name: addOn.name,
    active: true,
    units: addOn.units,
    driver: addOn.driver,
    prices: Object.fromEntries(
      Object.entries(addOn.prices || {}).map(([style, price]) => [
        style,
        Number(price || 0)
      ])
    )
  }));

  return {
    metadata: {
      discountPolicy: data?.metadata?.discountPolicy,
      installDiscountPolicy: data?.metadata?.installDiscountPolicy,
      sourceRevision: data?.metadata?.sourceRevision
    },
    referenceLists: data?.referenceLists || {},
    publicPricing: {
      styles: publicStyles,
      addOns: publicAddOns
    },
    addOns: publicAddOns.map((addOn) => ({
      name: addOn.name,
      units: addOn.units,
      driver: addOn.driver
    }))
  };
}

function quoteRequestBody(quote) {
  const pricingOverride = readStoredPricing();
  return pricingOverride ? { quote, pricingOverride } : quote;
}

export async function getConfig() {
  const pricing = await getEffectivePricing();
  return sanitizePricingForClient(pricing);
}

export async function getSampleQuote() {
  const res = await fetch(`${API_BASE}/api/sample-quote`);
  return readJson(res, "Could not load sample quote.");
}

export async function calculateQuote(quote) {
  const res = await fetch(`${API_BASE}/api/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quoteRequestBody(quote))
  });
  return readJson(res, "Quote calculation failed.");
}

export async function saveQuote(quote) {
  const res = await fetch(`${API_BASE}/api/quotes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(quoteRequestBody(quote))
  });
  return readJson(res, "Quote save failed.");
}

export async function getAdminPricing() {
  return getEffectivePricing();
}

export async function updateAdminPricing(pricing) {
  const res = await fetch(`${API_BASE}/api/admin/normalize-pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pricing)
  });
  const normalized = await readJson(res, "Could not validate pricing.");
  saveStoredPricing(normalized);
  return normalized;
}

export async function resetAdminPricing() {
  clearStoredPricing();

  const res = await fetch(`${API_BASE}/api/admin/pricing`, { cache: "no-store" });
  return readJson(res, "Could not reset pricing.");
}

function openSupplementDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("This browser does not support local PDF storage."));
      return;
    }

    const request = window.indexedDB.open(SUPPLEMENT_DB_NAME, SUPPLEMENT_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SUPPLEMENT_STORE_NAME)) {
        db.createObjectStore(SUPPLEMENT_STORE_NAME, { keyPath: "name" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open browser PDF storage."));
  });
}

async function withSupplementStore(mode, callback) {
  const db = await openSupplementDatabase();

  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(SUPPLEMENT_STORE_NAME, mode);
      const store = transaction.objectStore(SUPPLEMENT_STORE_NAME);
      let result;

      try {
        result = callback(store);
      } catch (error) {
        reject(error);
        return;
      }

      transaction.oncomplete = async () => {
        try {
          resolve(await result);
        } catch (error) {
          reject(error);
        }
      };
      transaction.onerror = () => reject(transaction.error || new Error("Browser PDF storage failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Browser PDF storage was cancelled."));
    });
  } finally {
    db.close();
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Browser storage request failed."));
  });
}

function supplementMetadata(record) {
  return {
    name: record.name,
    sizeBytes: record.sizeBytes,
    updatedAt: record.updatedAt,
    storage: "browser",
    blob: record.blob,
    url: URL.createObjectURL(record.blob)
  };
}

async function getBrowserSupplements() {
  const records = await withSupplementStore("readonly", (store) =>
    requestResult(store.getAll())
  );

  return (records || [])
    .sort((a, b) => a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    }))
    .map(supplementMetadata);
}

async function getRepositorySupplements() {
  const res = await fetch(`${API_BASE}/api/supplements`, { cache: "no-store" });
  const records = await readJson(res, "Could not load company-wide quote supplements.");

  return (records || []).map((record) => ({
    ...record,
    storage: "repository",
    locked: true,
    url: record.url?.startsWith("http") ? record.url : `${API_BASE}${record.url}`
  }));
}

export async function getSupplements() {
  const [repository, browser] = await Promise.all([
    getRepositorySupplements(),
    getBrowserSupplements()
  ]);

  return [...repository, ...browser].sort((a, b) => {
    const nameOrder = a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base"
    });
    if (nameOrder) return nameOrder;
    return a.storage === "repository" ? -1 : 1;
  });
}

export async function uploadSupplements(files) {
  if (!files?.length) return getSupplements();
  if (files.length > 25) throw new Error("Upload no more than 25 PDFs at once.");

  for (const file of files) {
    if (file.size > 25 * 1024 * 1024) {
      throw new Error(`${file.name} must be smaller than 25 MB.`);
    }

    const signature = await file.slice(0, 4).text();
    if (signature !== "%PDF") {
      throw new Error(`${file.name} is not a valid PDF file.`);
    }
  }

  await withSupplementStore("readwrite", (store) => {
    for (const file of files) {
      store.put({
        name: file.name,
        sizeBytes: file.size,
        updatedAt: new Date().toISOString(),
        blob: file
      });
    }
  });

  return getSupplements();
}

export async function deleteSupplement(name) {
  await withSupplementStore("readwrite", (store) => {
    store.delete(name);
  });
  return getSupplements();
}

export async function fetchSupplementPdf(supplement) {
  if (supplement?.blob instanceof Blob) {
    return supplement.blob.arrayBuffer();
  }

  const url = supplement.url?.startsWith("http") || supplement.url?.startsWith("blob:")
    ? supplement.url
    : `${API_BASE}${supplement.url}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${supplement.name}.`);
  return res.arrayBuffer();
}
