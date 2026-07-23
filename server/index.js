import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { pricingData as defaultPricingData } from "./pricingData.js";
import {
  calculateQuote,
  makeSampleQuote,
  sanitizePricingForClient
} from "./pricingEngine.js";

const app = express();
const port = process.env.PORT || 5174;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = process.env.DATA_DIR || path.join("/tmp", "prestige-estimator");
const localPricingPath = process.env.PRICING_DATA_PATH ||
  (process.env.NODE_ENV === "production"
    ? path.join(dataDirectory, "pricingData.local.json")
    : path.join(__dirname, "pricingData.local.json"));
const repositorySupplementsDirectory = path.join(__dirname, "..", "invoice-supplements");
const supplementsDirectory = process.env.SUPPLEMENTS_DIR ||
  path.join(dataDirectory, "invoice-supplements");

const quoteStore = [];
const DEFAULT_PRICING_REVISION = crypto
  .createHash("sha256")
  .update(JSON.stringify(defaultPricingData))
  .digest("hex")
  .slice(0, 16);

app.use(cors());
app.use(express.json({ limit: "60mb" }));

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

ensureDirectory(path.dirname(localPricingPath));
ensureDirectory(repositorySupplementsDirectory);
ensureDirectory(supplementsDirectory);

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}

function unique(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    if (value === undefined || value === null || value === "") continue;
    const key = String(value).trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    output.push(value);
  }
  return output;
}

function validDriver(driver) {
  return ["SF", "Glass", "Slabs", "Each"].includes(driver) ? driver : "SF";
}

function normalizePricingData(input) {
  const data = deepClone(input || defaultPricingData);
  data.metadata = data.metadata || defaultPricingData.metadata || {};
  data.referenceLists = data.referenceLists || {};
  data.styles = data.styles || {};
  data.addOns = Array.isArray(data.addOns) ? data.addOns : [];
  data.discounts = data.discounts || {};
  data.install = data.install || {};

  const referenceStyles = (data.referenceLists.Styles || [])
    .filter((styleName) => styleName && styleName !== "[TBD]")
    .map((styleName) => String(styleName).trim())
    .filter(Boolean);

  const styleNames = unique([...Object.keys(data.styles || {}), ...referenceStyles]);

  for (const styleName of styleNames) {
    const style = data.styles[styleName] || {};
    data.styles[styleName] = {
      pricePerSf: money(number(style.pricePerSf))
    };
  }

  data.referenceLists.Styles = unique(styleNames);

  data.addOns = data.addOns
    .filter((addOn) => addOn && String(addOn.name || "").trim())
    .map((addOn) => {
      const normalized = {
        name: String(addOn.name || "Untitled Add-on").trim(),
        active: addOn.active !== false,
        driver: validDriver(addOn.driver),
        units: addOn.units || addOn.driver || "SF",
        prices: {}
      };

      for (const styleName of styleNames) {
        normalized.prices[styleName] = money(number(addOn.prices?.[styleName]));
      }

      return normalized;
    });

  const customerTypes = unique([
    ...(data.referenceLists["Customer Type"] || []),
    ...Object.keys(data.discounts || {})
  ]);
  const discountTiers = unique([
    ...(data.referenceLists["Discount Tier"] || []),
    ...Object.values(data.discounts || {}).flatMap((tiers) => Object.keys(tiers || {}))
  ]);

  data.referenceLists["Customer Type"] = customerTypes;
  data.referenceLists["Discount Tier"] = discountTiers;

  for (const customerType of customerTypes) {
    data.discounts[customerType] = data.discounts[customerType] || {};
    for (const tier of discountTiers) {
      data.discounts[customerType][tier] = number(data.discounts[customerType]?.[tier], 0);
    }
  }

  const buildTypes = unique(data.referenceLists["Build Types"] || []);
  data.referenceLists["Build Types"] = buildTypes;
  for (const buildType of buildTypes) {
    data.install[buildType] = money(number(data.install[buildType], 0));
  }

  for (const [listName, values] of Object.entries(data.referenceLists)) {
    data.referenceLists[listName] = unique(values);
  }

  data.metadata.sourceRevision = DEFAULT_PRICING_REVISION;
  return data;
}

function loadPricingData() {
  try {
    if (fs.existsSync(localPricingPath)) {
      return normalizePricingData(JSON.parse(fs.readFileSync(localPricingPath, "utf8")));
    }
  } catch (error) {
    console.warn(`Could not read ${localPricingPath}:`, error.message);
  }

  return normalizePricingData(defaultPricingData);
}

function savePricingData(data) {
  const normalized = normalizePricingData(data);
  ensureDirectory(path.dirname(localPricingPath));
  fs.writeFileSync(localPricingPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return normalized;
}

function safePdfName(input) {
  const base = path.basename(String(input || "supplement.pdf"));
  const cleaned = base
    .replace(/[^a-zA-Z0-9._()\- ]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const withExtension = cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
  return withExtension || "supplement.pdf";
}

function supplementPath(name, directory = supplementsDirectory) {
  const safeName = safePdfName(name);
  const resolved = path.resolve(directory, safeName);
  const root = path.resolve(directory);
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid supplement filename.");
  }
  return { safeName, resolved };
}

function listSupplementDirectory(directory, storage) {
  ensureDirectory(directory);
  return fs.readdirSync(directory)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .map((name) => {
      const stats = fs.statSync(path.join(directory, name));
      return {
        name,
        sizeBytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
        storage,
        url: `/api/supplements/${encodeURIComponent(name)}`
      };
    });
}

function listSupplements() {
  const shared = listSupplementDirectory(repositorySupplementsDirectory, "repository");
  const temporary = listSupplementDirectory(supplementsDirectory, "server");
  const byName = new Map();

  // Repository files are the company-wide defaults. A temporary server file
  // with the same name may override one during local development only.
  for (const item of shared) byName.set(item.name.toLowerCase(), item);
  for (const item of temporary) byName.set(item.name.toLowerCase(), item);

  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );
}

function resolveSupplementFile(name) {
  const temporary = supplementPath(name, supplementsDirectory);
  if (fs.existsSync(temporary.resolved)) return temporary;

  const repository = supplementPath(name, repositorySupplementsDirectory);
  if (fs.existsSync(repository.resolved)) return repository;

  return null;
}

let currentPricingData = normalizePricingData(defaultPricingData);

app.get("/api/config", (req, res) => {
  res.json(sanitizePricingForClient(currentPricingData));
});

app.get("/api/sample-quote", (req, res) => {
  res.json(makeSampleQuote());
});

function resolveCalculationPayload(body) {
  if (body && typeof body === "object" && body.quote) {
    return {
      quote: body.quote,
      pricing: body.pricingOverride
        ? normalizePricingData(body.pricingOverride)
        : currentPricingData
    };
  }

  return {
    quote: body,
    pricing: currentPricingData
  };
}

app.post("/api/calculate", (req, res) => {
  try {
    const { quote, pricing } = resolveCalculationPayload(req.body);
    res.json(calculateQuote(quote, pricing));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/quotes", (req, res) => {
  try {
    const { quote, pricing } = resolveCalculationPayload(req.body);
    const calculated = calculateQuote(quote, pricing);
    const savedQuote = {
      id: `quote_${Date.now()}`,
      createdAt: new Date().toISOString(),
      rawQuote: quote,
      calculated
    };
    quoteStore.push(savedQuote);
    res.status(201).json(savedQuote);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/api/quotes", (req, res) => {
  res.json(quoteStore);
});

app.get("/api/admin/pricing", (req, res) => {
  res.json(currentPricingData);
});

app.post("/api/admin/normalize-pricing", (req, res) => {
  try {
    res.json(normalizePricingData(req.body));
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not validate pricing." });
  }
});

app.put("/api/admin/pricing", (req, res) => {
  try {
    currentPricingData = savePricingData(req.body);
    res.json(currentPricingData);
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not save pricing." });
  }
});

app.post("/api/admin/reset-pricing", (req, res) => {
  try {
    if (fs.existsSync(localPricingPath)) fs.unlinkSync(localPricingPath);
    currentPricingData = normalizePricingData(defaultPricingData);
    res.json(currentPricingData);
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not reset pricing." });
  }
});

app.get("/api/supplements", (req, res) => {
  try {
    res.json(listSupplements());
  } catch (error) {
    res.status(500).json({ error: error.message || "Could not list quote supplements." });
  }
});

app.post("/api/supplements", (req, res) => {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) {
      return res.status(400).json({ error: "Select at least one PDF." });
    }
    if (files.length > 25) {
      return res.status(400).json({ error: "Upload no more than 25 PDFs at once." });
    }

    for (const file of files) {
      const { safeName, resolved } = supplementPath(file.name);
      const encoded = String(file.data || "").replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(encoded, "base64");
      if (!buffer.length || buffer.length > 25 * 1024 * 1024) {
        throw new Error(`${safeName} must be a PDF smaller than 25 MB.`);
      }
      if (buffer.subarray(0, 4).toString() !== "%PDF") {
        throw new Error(`${safeName} is not a valid PDF file.`);
      }
      fs.writeFileSync(resolved, buffer);
    }

    res.status(201).json(listSupplements());
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not upload quote supplements." });
  }
});

app.get("/api/supplements/:name", (req, res) => {
  try {
    const file = resolveSupplementFile(decodeURIComponent(req.params.name));
    if (!file) return res.status(404).json({ error: "Supplement not found." });
    res.type("application/pdf");
    res.sendFile(file.resolved);
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not read supplement." });
  }
});

app.delete("/api/supplements/:name", (req, res) => {
  try {
    const { resolved } = supplementPath(decodeURIComponent(req.params.name), supplementsDirectory);
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    res.json(listSupplements());
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not delete supplement." });
  }
});

const clientDistPath = path.join(__dirname, "..", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, {
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}branding${path.sep}`)) {
        // Branding files keep stable filenames so non-coders can replace them.
        // Force revalidation so a redeploy does not leave an old header cached.
        res.setHeader("Cache-Control", "no-store");
      }
    }
  }));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.listen(port, () => {
  console.log(`Prestige estimator app listening on port ${port}`);
  console.log(`Browser-local pricing enabled; repository pricing revision ${DEFAULT_PRICING_REVISION}.`);
  console.log(`Company-wide quote supplements: ${repositorySupplementsDirectory}`);
  console.log(`Temporary server data directory: ${dataDirectory}`);
});
