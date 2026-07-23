import React, { useEffect, useMemo, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  calculateQuote,
  deleteSupplement,
  fetchSupplementPdf,
  getAdminPricing,
  getConfig,
  getSampleQuote,
  getSupplements,
  resetAdminPricing,
  saveQuote,
  updateAdminPricing,
  uploadSupplements
} from "./api.js";
import { normalizeDoorRowHeight, paginateIndivisibleRows } from "./invoiceLayout.js";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const preciseCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

const percentage = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2
});

const today = new Intl.DateTimeFormat("en-US", {
  month: "2-digit",
  day: "2-digit",
  year: "numeric"
}).format(new Date());

const ADD_ON_DRIVERS = ["SF", "Glass", "Slabs", "Each"];
const SPECIAL_REFERENCE_LISTS = new Set(["Styles"]);
const WORK_SCOPE_OPTIONS = [
  "Furnish new Prestige door(s)/window(s).",
  "Remove existing Door(s).",
  "Install Prestige door(s)/window(s).",
  "Complete all associated finish work."
];

const QUOTE_HEADER_IMAGE_URL = "/branding/quote-header.png";

const QUOTE_TERMS_NOTICE = "Applicable taxes, if any, are not included. This quote is valid for thirty (30) days. Production will commence upon Prestige’s receipt of a production deposit equal to fifty percent (50%) of the discounted price of all quoted door and window units, including selected add-ons and excluding installation. The remaining product balance is due prior to shipment.";

function capitalizeFirst(value) {
  const text = String(value ?? "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function formatDiscountPercent(rate) {
  const normalized = Number(rate || 0);
  if (!normalized) return "-";
  return `${percentage.format(normalized * 100)}%`;
}

function formatAccountingDiscount(value, formatter = currency) {
  const amount = Math.abs(Number(value || 0));
  return amount ? `(${formatter.format(amount)})` : "-";
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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

function normalizeReferenceValue(listName, value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (listName === "Slabs") {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : trimmed;
  }
  return trimmed;
}

function blankUnit(id) {
  return {
    id,
    name: "",
    style: "",
    buildType: "",
    slabs: "",
    heightIn: "",
    widthIn: "",
    glassSf: "",
    quantity: "",
    swing: "",
    accessibility: "",
    color: "",
    glassTexture: "",
    glassColor: "",
    discountOverride: "",
    addOns: {}
  };
}

function updateUnit(quote, unitId, patch) {
  return {
    ...quote,
    units: quote.units.map((unit) =>
      unit.id === unitId ? { ...unit, ...patch } : unit
    )
  };
}

function toggleAddOn(quote, unitId, addOnName) {
  return {
    ...quote,
    units: quote.units.map((unit) => {
      if (unit.id !== unitId) return unit;
      return {
        ...unit,
        addOns: {
          ...(unit.addOns || {}),
          [addOnName]: !unit.addOns?.[addOnName]
        }
      };
    })
  };
}

function toggleWorkScope(quote, scopeItem) {
  const selected = new Set(quote.workScope || []);
  if (selected.has(scopeItem)) selected.delete(scopeItem);
  else selected.add(scopeItem);
  return { ...quote, workScope: WORK_SCOPE_OPTIONS.filter((item) => selected.has(item)) };
}

function duplicateUnit(quote, unitId, nextId) {
  const index = quote.units.findIndex((unit) => unit.id === unitId);
  if (index < 0) return quote;
  const source = quote.units[index];
  const duplicate = {
    ...source,
    id: nextId,
    name: source.name ? `${source.name} Copy` : `Unit ${nextId}`,
    addOns: { ...(source.addOns || {}) }
  };
  const units = [...quote.units];
  units.splice(index + 1, 0, duplicate);
  return { ...quote, units };
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function formatSelectOptionLabel(label, option) {
  if (label === "Door Type") {
    const n = Number(option);
    if (n === 1) return "Single Door";
    if (n === 2) return "Double Door";
    if (Number.isFinite(n) && n > 0) return `${n}-Door Unit`;
  }
  return option;
}

function SelectField({ label, value, options, onChange }) {
  return (
    <Field label={label}>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {options?.map((option) => (
          <option value={option} key={String(option)}>
            {formatSelectOptionLabel(label, option)}
          </option>
        ))}
      </select>
    </Field>
  );
}

function NumberField({ label, value, min = 0, step = "any", onChange }) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        step={step}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    </Field>
  );
}


function unitTotalSf(unit) {
  const override = Number(unit.totalSf || 0);
  if (override > 0) return override;

  const heightIn = Number(unit.heightIn || 0);
  const widthIn = Number(unit.widthIn || 0);
  if (heightIn > 0 && widthIn > 0) return (heightIn * widthIn) / 144;

  // Backward compatibility for older saved quotes that used feet.
  const heightFt = Number(unit.heightFt || 0);
  const widthFt = Number(unit.widthFt || 0);
  if (heightFt > 0 && widthFt > 0) return heightFt * widthFt;

  return 0;
}

function QuoteHeader({ quote, setQuote, config }) {
  return (
    <section className="card setup-card">
      <div className="section-header">
        <div>
          <h2>Quote Setup</h2>
          <p className="muted">Customer type and tier drive the default material discount.</p>
        </div>
      </div>

      <div className="setup-layout">
        <div>
          <h3>Client</h3>
          <div className="grid two compact-grid">
            <Field label="Company / Project">
              <input
                value={quote.preparedFor?.company || ""}
                onChange={(e) =>
                  setQuote({
                    ...quote,
                    preparedFor: { ...quote.preparedFor, company: e.target.value }
                  })
                }
              />
            </Field>
            <Field label="Contact">
              <input
                value={quote.preparedFor?.contact || ""}
                onChange={(e) =>
                  setQuote({
                    ...quote,
                    preparedFor: { ...quote.preparedFor, contact: e.target.value }
                  })
                }
              />
            </Field>
          </div>
        </div>

        <div>
          <h3>Prestige</h3>
          <div className="grid two compact-grid">
            <Field label="Quote #">
              <input
                value={quote.quoteNumber || ""}
                onChange={(e) => setQuote({ ...quote, quoteNumber: e.target.value })}
              />
            </Field>
            <Field label="Salesperson">
              <input
                value={quote.preparedBy?.name || ""}
                onChange={(e) =>
                  setQuote({
                    ...quote,
                    preparedBy: { ...quote.preparedBy, name: e.target.value }
                  })
                }
              />
            </Field>
            <Field label="Salesperson Email">
              <input
                value={quote.preparedBy?.email || ""}
                onChange={(e) =>
                  setQuote({
                    ...quote,
                    preparedBy: { ...quote.preparedBy, email: e.target.value }
                  })
                }
              />
            </Field>
            <Field label="Salesperson Phone">
              <input
                value={quote.preparedBy?.phone || ""}
                onChange={(e) =>
                  setQuote({
                    ...quote,
                    preparedBy: { ...quote.preparedBy, phone: e.target.value }
                  })
                }
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="grid four compact-grid">
        <SelectField
          label="Customer Type"
          value={quote.customerType}
          options={config?.referenceLists?.["Customer Type"]}
          onChange={(customerType) => setQuote({ ...quote, customerType })}
        />
        <SelectField
          label="Discount Tier"
          value={quote.discountTier}
          options={config?.referenceLists?.["Discount Tier"]}
          onChange={(discountTier) => setQuote({ ...quote, discountTier })}
        />
        <NumberField
          label="Install Discount %"
          value={(quote.installationDiscountRate ?? 0) * 100}
          step="1"
          onChange={(value) =>
            setQuote({
              ...quote,
              installationDiscountRate: Number(value || 0) / 100
            })
          }
        />
        <NumberField
          label="Production Deposit %"
          value={(quote.productionDepositRate ?? 0.5) * 100}
          step="1"
          onChange={(value) =>
            setQuote({
              ...quote,
              productionDepositRate: Number(value || 0) / 100
            })
          }
        />
      </div>

      <div className="divider" />

      <div className="work-scope-editor">
        <h3>Work Scope</h3>
        <p className="small muted">Select the scope items that should appear on this quote.</p>
        <div className="scope-option-grid">
          {WORK_SCOPE_OPTIONS.map((scopeItem) => (
            <label className="scope-option" key={scopeItem}>
              <input
                type="checkbox"
                checked={(quote.workScope || []).includes(scopeItem)}
                onChange={() => setQuote(toggleWorkScope(quote, scopeItem))}
              />
              <span>{scopeItem}</span>
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}

function UnitEditor({ unit, quote, setQuote, config, onDuplicate }) {
  const totalSf = unitTotalSf(unit);
  const availableAddOns = config?.addOns || [];

  return (
    <section className="card unit-card">
      <div className="unit-title">
        <h3>{capitalizeFirst(unit.name || `Unit ${unit.id}`)}</h3>
        <div className="unit-card-actions">
          <button
            type="button"
            className="secondary small-button duplicate-unit-button"
            onClick={() => onDuplicate(unit.id)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="danger secondary small-button"
            onClick={() =>
              setQuote({
                ...quote,
                units: quote.units.filter((candidate) => candidate.id !== unit.id)
              })
            }
          >
            Remove
          </button>
        </div>
      </div>

      <div className="grid four">
        <Field label="Unit Name">
          <input
            value={unit.name || ""}
            onChange={(e) =>
              setQuote(updateUnit(quote, unit.id, { name: e.target.value }))
            }
          />
        </Field>
        <SelectField
          label="Style"
          value={unit.style}
          options={config?.referenceLists?.Styles?.filter((item) => item !== "[TBD]")}
          onChange={(style) => setQuote(updateUnit(quote, unit.id, { style }))}
        />
        <SelectField
          label="Build Type"
          value={unit.buildType}
          options={config?.referenceLists?.["Build Types"]}
          onChange={(buildType) =>
            setQuote(updateUnit(quote, unit.id, { buildType }))
          }
        />
        <NumberField
          label="Quantity"
          value={unit.quantity}
          step="1"
          onChange={(quantity) =>
            setQuote(updateUnit(quote, unit.id, { quantity }))
          }
        />
        <NumberField
          label="Height (in)"
          value={unit.heightIn}
          step="1"
          onChange={(heightIn) =>
            setQuote(updateUnit(quote, unit.id, { heightIn }))
          }
        />
        <NumberField
          label="Width (in)"
          value={unit.widthIn}
          step="1"
          onChange={(widthIn) =>
            setQuote(updateUnit(quote, unit.id, { widthIn }))
          }
        />
        <NumberField
          label="Total SF Override"
          value={unit.totalSf || ""}
          onChange={(totalSf) =>
            setQuote(updateUnit(quote, unit.id, { totalSf }))
          }
        />
        <NumberField
          label="Glass Area SF"
          value={unit.glassSf}
          onChange={(glassSf) =>
            setQuote(updateUnit(quote, unit.id, { glassSf }))
          }
        />
        <SelectField
          label="Door Type"
          value={unit.slabs}
          options={config?.referenceLists?.Slabs || [1, 2]}
          onChange={(slabs) => setQuote(updateUnit(quote, unit.id, { slabs: Number(slabs) || slabs }))}
        />
        <SelectField
          label="Swing"
          value={unit.swing}
          options={config?.referenceLists?.Swing}
          onChange={(swing) => setQuote(updateUnit(quote, unit.id, { swing }))}
        />
        <SelectField
          label="Color"
          value={unit.color}
          options={config?.referenceLists?.Colors}
          onChange={(color) => setQuote(updateUnit(quote, unit.id, { color }))}
        />
        <SelectField
          label="Glass Texture"
          value={unit.glassTexture}
          options={config?.referenceLists?.["Glass Type"]}
          onChange={(glassTexture) =>
            setQuote(updateUnit(quote, unit.id, { glassTexture }))
          }
        />
        <SelectField
          label="Glass Color"
          value={unit.glassColor}
          options={config?.referenceLists?.["Glass Color"]}
          onChange={(glassColor) =>
            setQuote(updateUnit(quote, unit.id, { glassColor }))
          }
        />
        <SelectField
          label="Accessibility"
          value={unit.accessibility}
          options={config?.referenceLists?.Accessibility}
          onChange={(accessibility) =>
            setQuote(updateUnit(quote, unit.id, { accessibility }))
          }
        />
        <Field label="Unit Discount Override">
          <input
            placeholder="blank = default"
            value={
              unit.discountOverride === undefined || unit.discountOverride === null
                ? ""
                : unit.discountOverride
            }
            onChange={(e) => {
              const raw = e.target.value;
              const normalized =
                raw === "" ? "" : Number(raw) > 1 ? Number(raw) / 100 : Number(raw);
              setQuote(updateUnit(quote, unit.id, { discountOverride: normalized }));
            }}
          />
        </Field>
      </div>

      <p className="small muted">
        Calculated total SF: {totalSf.toFixed(2)}. Width and height are entered in inches; pricing converts them to SF behind the scenes. Add-ons are priced by their driver: SF, glass SF, door type, or each.
      </p>

      <div className="addon-grid">
        {availableAddOns.map((addOn) => (
          <label className="checkbox" key={addOn.name}>
            <input
              type="checkbox"
              checked={Boolean(unit.addOns?.[addOn.name])}
              onChange={() => setQuote(toggleAddOn(quote, unit.id, addOn.name))}
            />
            <span>{capitalizeFirst(addOn.name)}</span>
            <em>{addOn.driver}</em>
          </label>
        ))}
      </div>
    </section>
  );
}

function PricingGuide({ config }) {
  const publicPricing = config?.publicPricing;
  const styleNames = Object.keys(publicPricing?.styles || {});
  const [selectedStyle, setSelectedStyle] = useState(styleNames[0] || "Traditional");

  useEffect(() => {
    if (!styleNames.includes(selectedStyle) && styleNames[0]) {
      setSelectedStyle(styleNames[0]);
    }
  }, [selectedStyle, styleNames.join("|")]);

  if (!publicPricing) return null;

  return (
    <section className="card pricing-guide">
      <div className="section-header">
        <div>
          <h2>Prestige Price Guide</h2>
          <p className="muted">
            Quick reference for the current sell-side prices used by the quote engine.
          </p>
        </div>
        <label className="inline-control">
          View Add-On Prices For
          <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)}>
            {styleNames.map((style) => (
              <option value={style} key={style}>{style}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Style</th>
              <th>Prestige Price / SF</th>
            </tr>
          </thead>
          <tbody>
            {styleNames.map((style) => (
              <tr key={style}>
                <td>{style}</td>
                <td>{preciseCurrency.format(publicPricing.styles[style].pricePerSf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="pricing-details">
        <summary>Add-On Prestige Prices for {selectedStyle}</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Add-On</th>
                <th>Driver</th>
                <th>Prestige Price</th>
              </tr>
            </thead>
            <tbody>
              {publicPricing.addOns.map((addOn) => (
                <tr key={addOn.name}>
                  <td>{addOn.name}</td>
                  <td>{addOn.units || addOn.driver}</td>
                  <td>{preciseCurrency.format(addOn.prices?.[selectedStyle] || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function PricingAdminPanel({ onPricingSaved, setStatus }) {
  const [pricing, setPricing] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newStyle, setNewStyle] = useState({ name: "", pricePerSf: 0 });
  const [newAddOn, setNewAddOn] = useState({ name: "", driver: "SF", units: "/ SF" });
  const [newReferenceOptions, setNewReferenceOptions] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      try {
        const data = await getAdminPricing();
        if (!cancelled) {
          setPricing(data);
          setLoadError("");
        }
      } catch (error) {
        if (!cancelled) {
          setPricing(null);
          setLoadError(error.message);
        }
      }
    }

    loadPricing();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pricing) {
    return (
      <details id="pricing-controls" className="card internal pricing-admin pricing-disclosure">
        <summary className="pricing-summary">
          <span>Pricing & Options</span>
          <small>{loadError || "Loading pricing controls…"}</small>
        </summary>
      </details>
    );
  }

  const styleNames = Object.keys(pricing.styles || {});
  const customerTypes = pricing.referenceLists?.["Customer Type"] || Object.keys(pricing.discounts || {});
  const discountTiers = pricing.referenceLists?.["Discount Tier"] || ["Low", "High"];
  const buildTypes = pricing.referenceLists?.["Build Types"] || [];
  const editableReferenceLists = Object.keys(pricing.referenceLists || {}).filter(
    (listName) => !SPECIAL_REFERENCE_LISTS.has(listName)
  );

  function syncDependentTables(next) {
    next.referenceLists = next.referenceLists || {};
    next.styles = next.styles || {};
    next.addOns = next.addOns || [];
    next.discounts = next.discounts || {};
    next.install = next.install || {};

    const currentStyleNames = Object.keys(next.styles);
    next.referenceLists.Styles = unique([
      ...currentStyleNames,
      ...(next.referenceLists.Styles || []).filter((item) => item !== "[TBD]")
    ]);

    for (const styleName of currentStyleNames) {
      const style = next.styles[styleName] || {};
      next.styles[styleName] = {
        pricePerSf: round2(Number(style.pricePerSf || 0))
      };
    }

    next.addOns = next.addOns.map((addOn) => {
      const prices = {};
      for (const styleName of currentStyleNames) {
        prices[styleName] = round2(Number(addOn.prices?.[styleName] || 0));
      }
      return {
        name: String(addOn.name || "Untitled Add-on").trim(),
        active: addOn.active !== false,
        driver: ADD_ON_DRIVERS.includes(addOn.driver) ? addOn.driver : "SF",
        units: addOn.units || addOn.driver || "SF",
        prices
      };
    });

    const types = next.referenceLists["Customer Type"] || [];
    const tiers = next.referenceLists["Discount Tier"] || [];
    for (const customerType of types) {
      next.discounts[customerType] = next.discounts[customerType] || {};
      for (const tier of tiers) {
        next.discounts[customerType][tier] = Number(next.discounts[customerType]?.[tier] || 0);
      }
    }

    for (const buildType of next.referenceLists["Build Types"] || []) {
      next.install[buildType] = Number(next.install[buildType] || 0);
    }

    return next;
  }

  function mutatePricing(mutator) {
    setPricing((current) => {
      const next = structuredClone(current);
      mutator(next);
      return syncDependentTables(next);
    });
  }

  function updateStylePrice(styleName, rawValue) {
    mutatePricing((next) => {
      next.styles[styleName].pricePerSf = Number(rawValue || 0);
    });
  }

  function addStyle() {
    const name = String(newStyle.name || "").trim();
    if (!name) {
      setStatus("Enter a style name first.");
      return;
    }
    if (pricing.styles?.[name]) {
      setStatus(`Style already exists: ${name}`);
      return;
    }

    mutatePricing((next) => {
      next.styles[name] = {
        pricePerSf: round2(Number(newStyle.pricePerSf || 0))
      };
      next.referenceLists.Styles = unique([...(next.referenceLists.Styles || []), name]);
      for (const addOn of next.addOns || []) {
        addOn.prices = addOn.prices || {};
        addOn.prices[name] = 0;
      }
    });

    setNewStyle({ name: "", pricePerSf: 0 });
    setStatus(`Added style: ${name}. Click Save Pricing to keep it in this browser.`);
  }

  function removeStyle(styleName) {
    if (styleNames.length <= 1) {
      setStatus("You need at least one style.");
      return;
    }
    mutatePricing((next) => {
      delete next.styles[styleName];
      next.referenceLists.Styles = (next.referenceLists.Styles || []).filter((item) => item !== styleName);
      for (const addOn of next.addOns || []) {
        delete addOn.prices?.[styleName];
      }
    });
  }

  function updateAddOnField(index, field, rawValue) {
    mutatePricing((next) => {
      next.addOns[index][field] = rawValue;
    });
  }

  function updateAddOnPrice(index, styleName, rawValue) {
    mutatePricing((next) => {
      next.addOns[index].prices[styleName] = Number(rawValue || 0);
    });
  }

  function addAddOn() {
    const name = String(newAddOn.name || "").trim();
    if (!name) {
      setStatus("Enter an add-on name first.");
      return;
    }
    if ((pricing.addOns || []).some((addOn) => addOn.name.toLowerCase() === name.toLowerCase())) {
      setStatus(`Add-on already exists: ${name}`);
      return;
    }

    mutatePricing((next) => {
      const prices = {};
      for (const styleName of Object.keys(next.styles || {})) {
        prices[styleName] = 0;
      }
      next.addOns.push({
        name,
        active: true,
        driver: newAddOn.driver || "SF",
        units: newAddOn.units || newAddOn.driver || "SF",
        prices
      });
    });

    setNewAddOn({ name: "", driver: "SF", units: "/ SF" });
    setStatus(`Added add-on: ${name}. Click Save Pricing to keep it in this browser.`);
  }

  function removeAddOn(index) {
    mutatePricing((next) => {
      next.addOns.splice(index, 1);
    });
  }

  function addReferenceOption(listName) {
    const value = normalizeReferenceValue(listName, newReferenceOptions[listName]);
    if (value === "") {
      setStatus(`Enter a ${listName} option first.`);
      return;
    }

    mutatePricing((next) => {
      const list = next.referenceLists[listName] || [];
      const exists = list.some((item) => String(item).trim().toLowerCase() === String(value).trim().toLowerCase());
      if (!exists) next.referenceLists[listName] = [...list, value];
    });

    setNewReferenceOptions((current) => ({ ...current, [listName]: "" }));
    setStatus(`Added ${listName} option: ${value}. Click Save Pricing to keep it in this browser.`);
  }

  function removeReferenceOption(listName, value) {
    mutatePricing((next) => {
      next.referenceLists[listName] = (next.referenceLists[listName] || []).filter(
        (item) => String(item) !== String(value)
      );
    });
  }

  function updateInstallPrice(buildType, rawValue) {
    mutatePricing((next) => {
      next.install[buildType] = Number(rawValue || 0);
    });
  }

  function updateDiscount(customerType, tier, rawValue) {
    mutatePricing((next) => {
      next.discounts[customerType] = next.discounts[customerType] || {};
      next.discounts[customerType][tier] = Number(rawValue || 0) / 100;
    });
  }

  async function savePricingChanges() {
    setSaving(true);
    try {
      const saved = await updateAdminPricing(pricing);
      setPricing(saved);
      const publicConfig = await getConfig();
      onPricingSaved(publicConfig);
      setStatus("Saved in this browser. Pricing, styles, add-ons, discounts, install rules, and dropdowns are now active on this device.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPricingChanges() {
    setSaving(true);
    try {
      const reset = await resetAdminPricing();
      setPricing(reset);
      const publicConfig = await getConfig();
      onPricingSaved(publicConfig);
      setStatus("Browser-only pricing edits were removed. This device is now using the repository defaults from EDIT-PRICING-HERE.json.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <details id="pricing-controls" className="card internal pricing-admin pricing-disclosure">
      <summary className="pricing-summary">
        <span>Pricing & Options</span>
        <small>Sell prices, add-on visibility, names, discounts, installation pricing, and dropdown choices</small>
      </summary>
      <div className="pricing-admin-content">
      <div className="section-header">
        <div>
          <h2>Pricing & Options Editor</h2>
          <p className="muted">
            Temporary changes save only in this browser. To change the defaults for everyone, edit the root-level <code>EDIT-PRICING-HERE.json</code> file in GitHub and redeploy.
          </p>
        </div>
        <div className="button-row">
          <button type="button" className="secondary" onClick={resetPricingChanges} disabled={saving}>
            Discard Browser Edits & Use Repository Defaults
          </button>
          <button type="button" onClick={savePricingChanges} disabled={saving}>
            {saving ? "Saving…" : "Save Changes on This Browser"}
          </button>
        </div>
      </div>

      <h3>Base Style Pricing</h3>
      <div className="add-row">
        <Field label="New Style Name">
          <input value={newStyle.name} onChange={(e) => setNewStyle({ ...newStyle, name: e.target.value })} />
        </Field>
        <Field label="Selling Price / SF">
          <input type="number" step="0.01" value={newStyle.pricePerSf} onChange={(e) => setNewStyle({ ...newStyle, pricePerSf: e.target.value })} />
        </Field>
        <button type="button" onClick={addStyle}>Add Style</button>
      </div>

      <div className="table-wrap">
        <table className="editable-table">
          <thead>
            <tr>
              <th>Style</th>
              <th>Selling Price / SF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {styleNames.map((styleName) => {
              const style = pricing.styles[styleName];
              return (
                <tr key={styleName}>
                  <td>{styleName}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={style.pricePerSf ?? 0}
                      onChange={(e) => updateStylePrice(styleName, e.target.value)}
                    />
                  </td>
                  <td>
                    <button type="button" className="danger secondary small-button" onClick={() => removeStyle(styleName)}>
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3>Add-On Pricing</h3>
      <p className="small muted">
        Use the Active toggle to show or hide an add-on from new quotes without deleting its name or pricing. Rename add-ons or edit the selling price for each door style.
      </p>
      <div className="add-row">
        <Field label="New Add-on Name">
          <input value={newAddOn.name} onChange={(e) => setNewAddOn({ ...newAddOn, name: e.target.value })} />
        </Field>
        <Field label="Driver">
          <select value={newAddOn.driver} onChange={(e) => setNewAddOn({ ...newAddOn, driver: e.target.value })}>
            {ADD_ON_DRIVERS.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
          </select>
        </Field>
        <Field label="Units Label">
          <input value={newAddOn.units} onChange={(e) => setNewAddOn({ ...newAddOn, units: e.target.value })} />
        </Field>
        <button type="button" onClick={addAddOn}>Add Add-on</button>
      </div>

      <div className="table-wrap tall-table">
        <table className="editable-table compact">
          <thead>
            <tr>
              <th>Active</th>
              <th>Add-On</th>
              <th>Driver</th>
              <th>Units Label</th>
              {styleNames.map((styleName) => (
                <th key={styleName}>{styleName}<br /><span className="muted">Selling Price</span></th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pricing.addOns.map((addOn, index) => (
              <tr key={`${addOn.name}-${index}`} className={addOn.active === false ? "inactive-addon-row" : ""}>
                <td>
                  <label className="addon-active-toggle" title="Turn this add-on on or off for new quotes">
                    <input
                      type="checkbox"
                      checked={addOn.active !== false}
                      onChange={(e) => updateAddOnField(index, "active", e.target.checked)}
                    />
                    <span className="addon-toggle-track" aria-hidden="true"><span /></span>
                    <span className="addon-toggle-label">{addOn.active !== false ? "On" : "Off"}</span>
                  </label>
                </td>
                <td>
                  <input
                    value={addOn.name}
                    onChange={(e) => updateAddOnField(index, "name", e.target.value)}
                  />
                </td>
                <td>
                  <select value={addOn.driver} onChange={(e) => updateAddOnField(index, "driver", e.target.value)}>
                    {ADD_ON_DRIVERS.map((driver) => <option key={driver} value={driver}>{driver}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    value={addOn.units || ""}
                    onChange={(e) => updateAddOnField(index, "units", e.target.value)}
                  />
                </td>
                {styleNames.map((styleName) => (
                  <td key={styleName}>
                    <input
                      type="number"
                      step="0.01"
                      value={addOn.prices?.[styleName] ?? 0}
                      onChange={(e) => updateAddOnPrice(index, styleName, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button type="button" className="danger secondary small-button" onClick={() => removeAddOn(index)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Discount Rules</h3>
      <p className="small muted">
        Add customer types or discount tiers in Dropdown Options below. Then enter the default discount percentage here.
      </p>
      <div className="table-wrap">
        <table className="editable-table compact">
          <thead>
            <tr>
              <th>Customer Type</th>
              {discountTiers.map((tier) => <th key={tier}>{tier} Discount %</th>)}
            </tr>
          </thead>
          <tbody>
            {customerTypes.map((customerType) => (
              <tr key={customerType}>
                <td>{customerType}</td>
                {discountTiers.map((tier) => (
                  <td key={`${customerType}-${tier}`}>
                    <input
                      type="number"
                      step="0.1"
                      value={round2(Number(pricing.discounts?.[customerType]?.[tier] || 0) * 100)}
                      onChange={(e) => updateDiscount(customerType, tier, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Installation Pricing</h3>
      <p className="small muted">
        Build Type dropdown options pull from this table. Add new build types below under Dropdown options, then set the installation price here.
      </p>
      <div className="table-wrap narrow-table">
        <table className="editable-table">
          <thead>
            <tr>
              <th>Build Type</th>
              <th>Installation Price / Unit</th>
            </tr>
          </thead>
          <tbody>
            {buildTypes.map((buildType) => (
              <tr key={buildType}>
                <td>{buildType}</td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    value={pricing.install?.[buildType] || 0}
                    onChange={(e) => updateInstallPrice(buildType, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Dropdown Options</h3>
      <p className="small muted">
        These options appear throughout the quote builder. Styles and add-ons are managed in their dedicated sections above because they also need pricing inputs.
      </p>
      <div className="reference-grid">
        {editableReferenceLists.map((listName) => (
          <div className="reference-card" key={listName}>
            <h4>{listName}</h4>
            <div className="chip-list">
              {(pricing.referenceLists[listName] || []).map((option) => (
                <span className="chip" key={String(option)}>
                  {option}
                  <button type="button" onClick={() => removeReferenceOption(listName, option)} aria-label={`Remove ${option}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="inline-add">
              <input
                placeholder={`Add ${listName}`}
                value={newReferenceOptions[listName] || ""}
                onChange={(e) => setNewReferenceOptions((current) => ({ ...current, [listName]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addReferenceOption(listName);
                  }
                }}
              />
              <button type="button" className="secondary" onClick={() => addReferenceOption(listName)}>
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
    </details>
  );
}

function dash(value) {
  return value === undefined || value === null || value === "" ? "" : value;
}

function doorTypeLabel(slabs) {
  if (slabs === undefined || slabs === null || slabs === "") return "";
  const n = Number(slabs);
  if (n === 1) return "Single Door";
  if (n === 2) return "Double Door";
  if (Number.isFinite(n) && n > 0) return `${n}-Door Unit`;
  return String(slabs);
}

function formatUnitSummary(unit) {
  const parts = [
    unit.style,
    unit.dimensions,
    doorTypeLabel(unit.slabs)
  ];
  return parts.filter(Boolean).join(" • ");
}

function formatAdditionalSpecs(unit) {
  const specs = [
    unit.swing,
    unit.color,
    unit.glassTexture ? `${unit.glassTexture} glass` : "",
    unit.glassColor && unit.glassColor.trim() !== unit.glassTexture?.trim()
      ? `${unit.glassColor} glass color`
      : "",
    unit.accessibility && unit.accessibility !== "Standard" ? unit.accessibility : ""
  ];
  return specs.filter(Boolean).join(" • ");
}

function chunkItems(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function pdfMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function pdfAccountingDiscount(value) {
  const amount = Math.abs(Number(value || 0));
  return amount ? `(${pdfMoney(amount)})` : "-";
}

function safePdfText(value) {
  return String(value ?? "")
    .replace(/[•]/g, "-")
    .replace(/[×]/g, "x")
    .replace(/[–—]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[^\x20-\x7E]/g, "");
}

function wrapPdfText(text, font, size, maxWidth, maxLines = 3) {
  const words = safePdfText(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }

  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}...`;
  }
  return lines;
}

function drawRightText(page, text, xRight, y, options) {
  const safe = safePdfText(text);
  const width = options.font.widthOfTextAtSize(safe, options.size);
  page.drawText(safe, { ...options, x: xRight - width, y });
}

function drawMetricCard(
  page,
  label,
  value,
  x,
  y,
  width,
  fonts,
  colors,
  note = "",
  highlight = false,
  labelColor = null,
  valueText = null
) {
  page.drawRectangle({
    x,
    y,
    width,
    height: 56,
    color: highlight ? colors.olive : colors.soft,
    borderColor: highlight ? colors.olive : colors.border,
    borderWidth: 0.7
  });
  page.drawText(label.toUpperCase(), {
    x: x + 9,
    y: y + 38,
    size: 7,
    font: fonts.bold,
    color: highlight ? colors.white : (labelColor || colors.muted)
  });
  page.drawText(valueText || pdfMoney(value), {
    x: x + 9,
    y: y + 18,
    size: 15,
    font: fonts.bold,
    color: highlight ? colors.white : colors.ink
  });
  if (note) {
    page.drawText(safePdfText(note), {
      x: x + 9,
      y: y + 6,
      size: 5.7,
      font: fonts.regular,
      color: highlight ? colors.white : colors.muted
    });
  }
}

function drawFallbackBrandHeader(page, fonts, colors, compact = false) {
  const top = compact ? 748 : 750;
  page.drawText("PRESTIGE", {
    x: 38,
    y: top,
    size: compact ? 16 : 19,
    font: fonts.bold,
    color: colors.olive
  });
  page.drawText("IRON DOORS & GLAZING", {
    x: 38,
    y: top - 14,
    size: 7.2,
    font: fonts.bold,
    color: colors.ink
  });
  page.drawText("12525 Westfield Lakes Cir. | Winter Garden, FL 34787", {
    x: 38,
    y: top - 29,
    size: 6.5,
    font: fonts.regular,
    color: colors.muted
  });
  page.drawText("PrestigeIronDoors.com | (855) 767-2837", {
    x: 38,
    y: top - 40,
    size: 6.5,
    font: fonts.regular,
    color: colors.muted
  });
}

async function loadQuoteHeaderImage(pdfDoc) {
  try {
    const response = await fetch(QUOTE_HEADER_IMAGE_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`Header image returned ${response.status}.`);
    const bytes = await response.arrayBuffer();

    try {
      return await pdfDoc.embedPng(bytes);
    } catch (pngError) {
      return await pdfDoc.embedJpg(bytes);
    }
  } catch (error) {
    console.warn("Could not load the quote header image; using the text fallback.", error);
    return null;
  }
}

function drawInvoiceHeader(
  page,
  result,
  fonts,
  colors,
  pageNumber,
  totalPages,
  compact = false,
  headerImage = null
) {
  const imageTop = 760;
  const imageMaxWidth = compact ? 300 : 374;
  const imageMaxHeight = compact ? 66 : 83;

  if (headerImage) {
    const scale = Math.min(
      imageMaxWidth / headerImage.width,
      imageMaxHeight / headerImage.height
    );
    const width = headerImage.width * scale;
    const height = headerImage.height * scale;
    page.drawImage(headerImage, {
      x: 38,
      y: imageTop - height,
      width,
      height
    });
  } else {
    drawFallbackBrandHeader(page, fonts, colors, compact);
  }

  const metaTop = compact ? 748 : 750;
  drawRightText(page, compact ? "QUOTE - CONTINUED" : "QUOTE", 574, metaTop, {
    size: compact ? 11.5 : 15,
    font: fonts.bold,
    color: colors.ink
  });
  drawRightText(page, `Quote ${safePdfText(result.quoteNumber || "-")}`, 574, metaTop - 20, {
    size: 7.5,
    font: fonts.regular,
    color: colors.muted
  });
  drawRightText(page, today, 574, metaTop - 32, {
    size: 7.5,
    font: fonts.regular,
    color: colors.muted
  });
  drawRightText(page, `Quote page ${pageNumber} of ${totalPages}`, 574, metaTop - 44, {
    size: 6.5,
    font: fonts.regular,
    color: colors.muted
  });

  const dividerY = compact ? 684 : 672;
  page.drawLine({
    start: { x: 38, y: dividerY },
    end: { x: 574, y: dividerY },
    thickness: 1.2,
    color: colors.olive
  });
}

function drawCustomerBlock(page, result, fonts, colors) {
  const blockY = 610;
  page.drawRectangle({
    x: 38,
    y: blockY,
    width: 536,
    height: 50,
    color: colors.white,
    borderColor: colors.border,
    borderWidth: 0.7
  });

  const columns = [
    ["CUSTOMER / PROJECT", result.preparedFor?.company || "-"],
    ["CONTACT", result.preparedFor?.contact || "-"],
    ["PREPARED BY", result.preparedBy?.name || "-"]
  ];
  const widths = [215, 155, 166];
  let x = 38;
  columns.forEach(([label, value], index) => {
    if (index) {
      page.drawLine({
        start: { x, y: blockY },
        end: { x, y: blockY + 50 },
        thickness: 0.6,
        color: colors.border
      });
    }
    page.drawText(label, {
      x: x + 10,
      y: blockY + 31,
      size: 6.5,
      font: fonts.bold,
      color: colors.muted
    });
    const lines = wrapPdfText(value, fonts.bold, 9.5, widths[index] - 20, 2);
    lines.forEach((line, lineIndex) => page.drawText(line, {
      x: x + 10,
      y: blockY + 14 - lineIndex * 11,
      size: 9.5,
      font: fonts.bold,
      color: colors.ink
    }));
    x += widths[index];
  });
}

function buildDoorPdfDescription(unit) {
  const summary = [formatUnitSummary(unit), formatAdditionalSpecs(unit)]
    .filter(Boolean)
    .join(" | ");
  const addOns = unit.selectedAddOns?.length
    ? `Add-Ons: ${unit.selectedAddOns.map(capitalizeFirst).join(", ")}`
    : "";
  return [summary, addOns].filter(Boolean).join(" | ");
}

function createDoorRowLayout(unit, fonts, descriptionWidth) {
  const titleSize = 8.1;
  const titleLineHeight = 8.7;
  const descriptionSize = 6.1;
  const descriptionLineHeight = 7.1;
  const titleLines = wrapPdfText(
    capitalizeFirst(unit.name || "Door"),
    fonts.bold,
    titleSize,
    descriptionWidth,
    Number.POSITIVE_INFINITY
  );
  const description = buildDoorPdfDescription(unit);
  const descriptionLines = description
    ? wrapPdfText(description, fonts.regular, descriptionSize, descriptionWidth, Number.POSITIVE_INFINITY)
    : [];
  const measuredHeight =
    13 +
    titleLines.length * titleLineHeight +
    3 +
    descriptionLines.length * descriptionLineHeight +
    8;
  const rowHeight = normalizeDoorRowHeight(measuredHeight);

  return {
    unit,
    rowHeight,
    titleLines,
    descriptionLines,
    titleSize,
    titleLineHeight,
    descriptionSize,
    descriptionLineHeight
  };
}

function paginateDoorRows(units, fonts) {
  const descriptionWidth = 205 - 14;
  const rows = (units || []).map((unit) => createDoorRowLayout(unit, fonts, descriptionWidth));
  return paginateIndivisibleRows(rows, {
    firstPageCapacity: 360,
    continuationCapacity: 556,
    maxFirstPageRows: 5
  });
}

function drawLineItemsTable(page, rowLayouts, startY, fonts, colors, startIndex = 0) {
  const x = 38;
  const widths = [24, 205, 36, 80, 80, 111];
  const headers = ["#", "DOOR / SPECIFICATIONS", "QTY", "RETAIL", "DISCOUNT", "DOOR PRICE"];
  const headerHeight = 24;

  page.drawRectangle({ x, y: startY - headerHeight, width: 536, height: headerHeight, color: colors.ink });
  let cursorX = x;
  headers.forEach((header, index) => {
    const centered = index !== 1;
    const textWidth = fonts.bold.widthOfTextAtSize(header, 6.3);
    page.drawText(header, {
      x: centered ? cursorX + (widths[index] - textWidth) / 2 : cursorX + 7,
      y: startY - 15,
      size: 6.3,
      font: fonts.bold,
      color: colors.white
    });
    cursorX += widths[index];
  });

  let y = startY - headerHeight;
  rowLayouts.forEach((layout, index) => {
    const unit = layout.unit;
    const rowHeight = layout.rowHeight;
    const rowBottom = y - rowHeight;
    page.drawRectangle({
      x,
      y: rowBottom,
      width: 536,
      height: rowHeight,
      color: index % 2 ? colors.soft : colors.white,
      borderColor: colors.border,
      borderWidth: 0.45
    });

    let cx = x;
    widths.slice(0, -1).forEach((width) => {
      cx += width;
      page.drawLine({
        start: { x: cx, y: rowBottom },
        end: { x: cx, y },
        thickness: 0.35,
        color: colors.border
      });
    });

    const itemNumber = String(startIndex + index + 1);
    const itemWidth = fonts.bold.widthOfTextAtSize(itemNumber, 8);
    const numericBaseline = rowBottom + rowHeight / 2 - 3;
    page.drawText(itemNumber, {
      x: x + (widths[0] - itemWidth) / 2,
      y: numericBaseline,
      size: 8,
      font: fonts.bold,
      color: colors.ink
    });

    const descriptionX = x + widths[0] + 7;
    layout.titleLines.forEach((line, lineIndex) => page.drawText(line, {
      x: descriptionX,
      y: y - 13 - lineIndex * layout.titleLineHeight,
      size: layout.titleSize,
      font: fonts.bold,
      color: colors.ink
    }));
    const descriptionStartY = y - 13 - layout.titleLines.length * layout.titleLineHeight - 3;
    layout.descriptionLines.forEach((line, lineIndex) => page.drawText(line, {
      x: descriptionX,
      y: descriptionStartY - lineIndex * layout.descriptionLineHeight,
      size: layout.descriptionSize,
      font: fonts.regular,
      color: colors.muted
    }));

    const quantityStart = x + widths[0] + widths[1];
    const retailStart = quantityStart + widths[2];
    const discountStart = retailStart + widths[3];
    const priceStart = discountStart + widths[4];

    const centeredValue = (value, start, width, { font = fonts.regular, size = 7.2, yPosition = numericBaseline } = {}) => {
      const textWidth = font.widthOfTextAtSize(value, size);
      page.drawText(value, {
        x: start + (width - textWidth) / 2,
        y: yPosition,
        size,
        font,
        color: colors.ink
      });
    };

    centeredValue(String(unit.quantity || ""), quantityStart, widths[2], { size: 8 });
    centeredValue(pdfMoney(unit.lineRetailRevenue || 0), retailStart, widths[3]);
    centeredValue(pdfMoney(unit.lineMaterialRevenue || 0), priceStart, widths[5], { font: fonts.bold });

    if (Number(unit.discountRate || 0)) {
      centeredValue(formatDiscountPercent(unit.discountRate), discountStart, widths[4], {
        font: fonts.bold,
        size: 7.2,
        yPosition: numericBaseline + 5
      });
      centeredValue(pdfAccountingDiscount(unit.lineDiscountAmount), discountStart, widths[4], {
        size: 6.5,
        yPosition: numericBaseline - 7
      });
    } else {
      centeredValue("-", discountStart, widths[4], { font: fonts.bold, size: 8 });
    }

    y = rowBottom;
  });

  return y;
}

function drawDoorTotalLine(page, result, startY, fonts, colors) {
  const x = 38;
  const widths = [265, 80, 80, 111];
  const top = startY - 7;
  const height = 34;
  const bottom = top - height;

  page.drawRectangle({
    x,
    y: bottom,
    width: 536,
    height,
    color: colors.white,
    borderColor: colors.olive,
    borderWidth: 0.8
  });

  let cursorX = x;
  widths.slice(0, -1).forEach((width) => {
    cursorX += width;
    page.drawLine({
      start: { x: cursorX, y: bottom },
      end: { x: cursorX, y: top },
      thickness: 0.35,
      color: colors.border
    });
  });

  page.drawText("DOORS / WINDOWS", {
    x: x + 10,
    y: bottom + 11.5,
    size: 12,
    font: fonts.bold,
    color: colors.olive
  });

  const labels = ["RETAIL", "DISCOUNT", "TOTAL"];
  const values = [
    pdfMoney(result.totals.materialRetailSubtotal || 0),
    pdfAccountingDiscount(result.totals.materialDiscountAmount),
    pdfMoney(result.totals.materialSubtotal || 0)
  ];

  let valueX = x + widths[0];
  values.forEach((value, index) => {
    const width = widths[index + 1];
    const labelWidth = fonts.bold.widthOfTextAtSize(labels[index], 5.4);
    page.drawText(labels[index], {
      x: valueX + (width - labelWidth) / 2,
      y: bottom + 22,
      size: 5.4,
      font: fonts.bold,
      color: colors.muted
    });
    const font = index === 2 ? fonts.bold : fonts.regular;
    const size = index === 2 ? 7.4 : 7;
    const textWidth = font.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: valueX + (width - textWidth) / 2,
      y: bottom + 8,
      size,
      font,
      color: colors.ink
    });
    valueX += width;
  });

  return bottom;
}

function drawInstallationLine(page, result, startY, fonts, colors) {
  const x = 38;
  const widths = [265, 80, 80, 111];
  const top = startY - 7;
  const height = 34;
  const bottom = top - height;

  page.drawRectangle({
    x,
    y: bottom,
    width: 536,
    height,
    color: colors.soft,
    borderColor: colors.border,
    borderWidth: 0.6
  });

  let cursorX = x;
  widths.slice(0, -1).forEach((width) => {
    cursorX += width;
    page.drawLine({
      start: { x: cursorX, y: bottom },
      end: { x: cursorX, y: top },
      thickness: 0.35,
      color: colors.border
    });
  });

  page.drawText("INSTALLATION", {
    x: x + 10,
    y: bottom + 11.5,
    size: 9,
    font: fonts.bold,
    color: colors.ink
  });

  const labels = ["RETAIL", "DISCOUNT", "TOTAL"];
  const values = [
    pdfMoney(result.totals.installationGross || 0),
    formatDiscountPercent(result.totals.installationDiscountRate),
    pdfMoney(result.totals.installationNet || 0)
  ];

  let valueX = x + widths[0];
  values.forEach((value, index) => {
    const width = widths[index + 1];
    const labelWidth = fonts.bold.widthOfTextAtSize(labels[index], 5.4);
    page.drawText(labels[index], {
      x: valueX + (width - labelWidth) / 2,
      y: bottom + 22,
      size: 5.4,
      font: fonts.bold,
      color: colors.muted
    });
    const font = index === 2 ? fonts.bold : fonts.regular;
    const size = index === 2 ? 7.4 : 7;
    const textWidth = font.widthOfTextAtSize(value, size);
    page.drawText(value, {
      x: valueX + (width - textWidth) / 2,
      y: bottom + 8,
      size,
      font,
      color: colors.ink
    });
    valueX += width;
  });

  return bottom;
}

function drawWorkScope(page, result, startY, fonts, colors) {
  const scopeItems = (result.workScope || []).filter(Boolean);
  if (!scopeItems.length) return startY;

  const top = startY - 7;
  page.drawText("WORK SCOPE", {
    x: 38,
    y: top - 7,
    size: 6.5,
    font: fonts.bold,
    color: colors.olive
  });

  const columnWidth = 268;
  const rowHeight = 14;
  scopeItems.forEach((scopeItem, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 38 + column * columnWidth;
    const y = top - 22 - row * rowHeight;
    page.drawRectangle({
      x,
      y: y - 1,
      width: 6,
      height: 6,
      borderColor: colors.olive,
      borderWidth: 0.7
    });
    page.drawLine({
      start: { x: x + 1.2, y: y + 1.5 },
      end: { x: x + 2.7, y },
      thickness: 0.7,
      color: colors.olive
    });
    page.drawLine({
      start: { x: x + 2.7, y },
      end: { x: x + 5, y: y + 4 },
      thickness: 0.7,
      color: colors.olive
    });
    page.drawText(safePdfText(scopeItem), {
      x: x + 10,
      y: y - 1,
      size: 6,
      font: fonts.regular,
      color: colors.ink
    });
  });

  return top - 22 - Math.ceil(scopeItems.length / 2) * rowHeight;
}

async function buildCombinedInvoicePdf(result, supplements) {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };
  const colors = {
    olive: rgb(0.36, 0.37, 0.07),
    darkRed: rgb(0.45, 0.08, 0.08),
    ink: rgb(0.12, 0.14, 0.13),
    muted: rgb(0.35, 0.37, 0.35),
    border: rgb(0.78, 0.79, 0.75),
    soft: rgb(0.96, 0.96, 0.93),
    white: rgb(1, 1, 1)
  };

  const units = result.units || [];
  const invoicePages = paginateDoorRows(units, fonts);
  const firstPageRows = invoicePages[0]?.rows || [];
  const continuationPages = invoicePages.slice(1);
  const invoicePageCount = invoicePages.length;
  const headerImage = await loadQuoteHeaderImage(pdfDoc);

  const firstPage = pdfDoc.addPage([612, 792]);
  drawInvoiceHeader(firstPage, result, fonts, colors, 1, invoicePageCount, false, headerImage);
  drawCustomerBlock(firstPage, result, fonts, colors);

  const metrics = [
    ["Package Retail Price", result.totals.suggestedRetail, "Door(s) & Installation"],
    ["Total Savings", result.totals.totalDiscountAmount, "Door & Install Discounts"],
    ["Total Package Price", result.totals.quoteTotal, "Door(s) + Installation"],
    ["Production Deposit", result.totals.productionDepositDue, "Due Today"]
  ];
  const metricWidth = 130;
  metrics.forEach((metric, index) => {
    drawMetricCard(
      firstPage,
      metric[0],
      metric[1],
      38 + index * 135.3,
      543,
      metricWidth,
      fonts,
      colors,
      metric[2],
      index === 2,
      index === 3 ? colors.darkRed : null,
      index === 1 ? pdfAccountingDiscount(metric[1]) : null
    );
  });

  const noticeFontSize = 8;
  const noticeLineHeight = 9.5;
  const noticeTopY = 531;
  const noticeLines = wrapPdfText(QUOTE_TERMS_NOTICE, regular, noticeFontSize, 536, 6);
  noticeLines.forEach((line, index) => {
    firstPage.drawText(line, {
      x: 38,
      y: noticeTopY - index * noticeLineHeight,
      size: noticeFontSize,
      font: regular,
      color: colors.muted
    });
  });
  const noticeBottomY = noticeTopY - Math.max(0, noticeLines.length - 1) * noticeLineHeight - 4;
  const tableStartY = noticeBottomY - 12;

  const tableBottom = drawLineItemsTable(firstPage, firstPageRows, tableStartY, fonts, colors, 0);
  const doorTotalBottom = drawDoorTotalLine(firstPage, result, tableBottom, fonts, colors);
  const installationBottom = drawInstallationLine(firstPage, result, doorTotalBottom, fonts, colors);
  drawWorkScope(firstPage, result, installationBottom, fonts, colors);

  const contact = [result.preparedBy?.email, result.preparedBy?.phone].filter(Boolean).join(" | ");
  firstPage.drawLine({ start: { x: 38, y: 26 }, end: { x: 574, y: 26 }, thickness: 0.5, color: colors.border });
  if (contact) {
    drawRightText(firstPage, contact, 574, 12, {
      size: 5.6,
      font: regular,
      color: colors.muted
    });
  }

  continuationPages.forEach((invoicePage, index) => {
    const page = pdfDoc.addPage([612, 792]);
    drawInvoiceHeader(page, result, fonts, colors, index + 2, invoicePageCount, true, headerImage);
    page.drawText(`Additional doors for ${safePdfText(result.preparedFor?.company || "customer")}`, {
      x: 38,
      y: 670,
      size: 9,
      font: bold,
      color: colors.ink
    });
    drawLineItemsTable(page, invoicePage.rows, 650, fonts, colors, invoicePage.startIndex);
    page.drawLine({ start: { x: 38, y: 52 }, end: { x: 574, y: 52 }, thickness: 0.5, color: colors.border });
    page.drawText("Package totals and production deposit appear on quote page 1.", {
      x: 38,
      y: 37,
      size: 6.5,
      font: regular,
      color: colors.muted
    });
  });

  const skipped = [];
  for (const supplement of supplements || []) {
    try {
      const bytes = await fetchSupplementPdf(supplement);
      const source = await PDFDocument.load(bytes);
      const copiedPages = await pdfDoc.copyPages(source, source.getPageIndices());
      copiedPages.forEach((page) => pdfDoc.addPage(page));
    } catch (error) {
      skipped.push(`${supplement.name}: ${error.message}`);
    }
  }

  return { bytes: await pdfDoc.save(), skipped };
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function SupplementManager({ supplements, setSupplements, setStatus }) {
  const [uploading, setUploading] = useState(false);

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const invalid = files.find((file) => file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"));
    if (invalid) {
      setStatus(`${invalid.name} is not a PDF.`);
      return;
    }

    setUploading(true);
    try {
      const next = await uploadSupplements(files);
      setSupplements(next);
      setStatus(`${files.length} quote supplement${files.length === 1 ? "" : "s"} saved in this browser.`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setUploading(false);
    }
  }

  async function removeSupplement(name) {
    try {
      const next = await deleteSupplement(name);
      setSupplements(next);
      setStatus(`Removed ${name}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section id="invoice-supplements" className="card supplement-manager">
      <div className="section-header">
        <div>
          <h2>Quote Supplements</h2>
          <p className="muted">
            Company-wide PDFs committed to the repository are appended for every salesperson. Optional PDFs uploaded here are stored only in this browser. All supplements print in filename order, so use prefixes such as 01, 02, and 03 to control sequence.
          </p>
        </div>
        <label className="upload-button">
          {uploading ? "Uploading…" : "Upload PDFs"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={uploading}
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      <div
        className="supplement-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
      >
        Drop PDF pages or documents here
      </div>

      {supplements.length ? (
        <div className="supplement-list">
          {supplements.map((supplement, index) => (
            <div className="supplement-row" key={`${supplement.storage}:${supplement.name}`}>
              <span className="supplement-order">{index + 1}</span>
              <div>
                <strong>{supplement.name}</strong>
                <span>
                  {formatFileSize(supplement.sizeBytes)} · {supplement.storage === "repository" ? "Company-wide" : "This browser"}
                </span>
              </div>
              <a href={supplement.url} target="_blank" rel="noreferrer">Preview</a>
              {supplement.storage === "repository" ? (
                <span className="supplement-lock">Included</span>
              ) : (
                <button type="button" className="danger secondary small-button" onClick={() => removeSupplement(supplement.name)}>
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">No supplements are available. Add company-wide PDFs to the repository supplement folder or upload a browser-only PDF here.</p>
      )}
    </section>
  );
}

function QuoteBrandHeaderImage() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="invoice-branding-fallback" aria-label="Prestige Iron Doors and Glazing">
        <strong>PRESTIGE</strong>
        <span>IRON DOORS &amp; GLAZING</span>
        <small>12525 Westfield Lakes Cir. · Winter Garden, FL 34787 · (855) 767-2837</small>
      </div>
    );
  }

  return (
    <img
      className="invoice-branding-image"
      src={QUOTE_HEADER_IMAGE_URL}
      alt="Prestige Iron Doors, LLC letterhead"
      onError={() => setFailed(true)}
    />
  );
}

function InvoicePreviewPage({ result, units, pageNumber, totalPages, startIndex = 0, firstPage = false }) {
  return (
    <div className="invoice-preview-page">
      <div className="invoice-preview-header">
        <QuoteBrandHeaderImage />
        <div className="invoice-preview-meta">
          <b>{firstPage ? "QUOTE" : "QUOTE — CONTINUED"}</b>
          <span>Quote {result.quoteNumber || "—"}</span>
          <span>{today}</span>
          <small>Quote page {pageNumber} of {totalPages}</small>
        </div>
      </div>

      {firstPage ? (
        <>
          <div className="invoice-customer-strip">
            <div><span>Customer / Project</span><strong>{result.preparedFor?.company || "—"}</strong></div>
            <div><span>Contact</span><strong>{result.preparedFor?.contact || "—"}</strong></div>
            <div><span>Prepared By</span><strong>{result.preparedBy?.name || "—"}</strong></div>
          </div>
          <div className="invoice-metrics">
            <div><span>Package Retail Price</span><strong>{currency.format(result.totals.suggestedRetail || 0)}</strong><small>Door(s) &amp; Installation</small></div>
            <div><span>Total Savings</span><strong>{formatAccountingDiscount(result.totals.totalDiscountAmount)}</strong><small>Door &amp; Install Discounts</small></div>
            <div className="total-package-metric"><span>Total Package Price</span><strong>{currency.format(result.totals.quoteTotal || 0)}</strong><small>Door(s) + Installation</small></div>
            <div className="production-deposit-metric"><span>Production Deposit</span><strong>{currency.format(result.totals.productionDepositDue || 0)}</strong><small>Due Today</small></div>
          </div>
          <p className="quote-terms-notice quote-terms-notice-top">
            {QUOTE_TERMS_NOTICE}
          </p>
        </>
      ) : (
        <h3 className="continuation-title">Additional doors for {result.preparedFor?.company || "customer"}</h3>
      )}

      <table className="compact-invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Door / Specifications</th>
            <th>Qty</th>
            <th>Retail</th>
            <th>Discount</th>
            <th>Door Price</th>
          </tr>
        </thead>
        <tbody>
          {units.map((unit, index) => (
            <tr key={unit.id}>
              <td>{startIndex + index + 1}</td>
              <td>
                <strong>{capitalizeFirst(unit.name || `Door ${startIndex + index + 1}`)}</strong>
                <span>{formatUnitSummary(unit)}</span>
                {formatAdditionalSpecs(unit) ? <span>{formatAdditionalSpecs(unit)}</span> : null}
                {unit.selectedAddOns?.length ? <span>Add-Ons: {unit.selectedAddOns.map(capitalizeFirst).join(", ")}</span> : null}
              </td>
              <td>{unit.quantity}</td>
              <td>{currency.format(unit.lineRetailRevenue || 0)}</td>
              <td className="discount-cell">
                {Number(unit.discountRate || 0) ? (
                  <>
                    <strong>{formatDiscountPercent(unit.discountRate)}</strong>
                    <span>{formatAccountingDiscount(unit.lineDiscountAmount)}</span>
                  </>
                ) : "-"}
              </td>
              <td>{currency.format(unit.lineMaterialRevenue || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {firstPage ? (
        <>
          <div className="invoice-door-total-strip">
            <div>
              <span>Doors / Windows</span>
            </div>
            <div className="door-total-values">
              <span>Retail <strong>{currency.format(result.totals.materialRetailSubtotal || 0)}</strong></span>
              <span>Discount <strong>{formatAccountingDiscount(result.totals.materialDiscountAmount)}</strong></span>
              <span>Total <strong>{currency.format(result.totals.materialSubtotal || 0)}</strong></span>
            </div>
          </div>

          <div className="invoice-install-strip">
            <div>
              <span>Installation</span>
            </div>
            <div className="installation-values">
              <span>Retail <strong>{currency.format(result.totals.installationGross || 0)}</strong></span>
              <span>Discount <strong>{formatDiscountPercent(result.totals.installationDiscountRate)}</strong></span>
              <span>Total <strong>{currency.format(result.totals.installationNet || 0)}</strong></span>
            </div>
          </div>

          {(result.workScope || []).length ? (
            <div className="quote-work-scope">
              <h3>Work Scope</h3>
              <div>
                {result.workScope.map((scopeItem) => (
                  <p key={scopeItem}>✓ {scopeItem}</p>
                ))}
              </div>
            </div>
          ) : null}

        </>
      ) : (
        <p className="invoice-deposit-note">Package Totals and Production Deposit Appear on Quote Page 1.</p>
      )}
    </div>
  );
}

function QuoteOutput({ result, supplements, setStatus }) {
  const [generating, setGenerating] = useState(false);
  if (!result) return null;

  const units = result.units || [];
  const invoiceGroups = [units.slice(0, 5), ...chunkItems(units.slice(5), 8)];

  async function openCombinedPdf() {
    setGenerating(true);
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write("<p style='font-family:Arial;padding:24px'>Generating combined quote PDF…</p>");
    }

    try {
      const { bytes, skipped } = await buildCombinedInvoicePdf(result, supplements);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (previewWindow) {
        previewWindow.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `${result.quoteNumber || "Prestige-Quote"}.pdf`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120000);
      setStatus(skipped.length
        ? `PDF created, but ${skipped.length} supplement${skipped.length === 1 ? "" : "s"} could not be appended: ${skipped.join("; ")}`
        : `Combined quote PDF created with ${supplements.length} supplement${supplements.length === 1 ? "" : "s"}.`);
    } catch (error) {
      if (previewWindow) previewWindow.close();
      setStatus(error.message || "Could not generate the combined quote PDF.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="card quote-output compact-output">
      <div className="quote-toolbar no-print">
        <div>
          <h2>Printable Quote</h2>
          <p className="muted">
            Up to five doors fit on quote page 1. {supplements.length} uploaded supplement{supplements.length === 1 ? "" : "s"} will be appended automatically.
          </p>
        </div>
        <button type="button" onClick={openCombinedPdf} disabled={generating}>
          {generating ? "Building PDF…" : "Open Combined PDF"}
        </button>
      </div>

      <div className="invoice-preview-stack">
        {invoiceGroups.map((group, index) => (
          <InvoicePreviewPage
            key={index}
            result={result}
            units={group}
            pageNumber={index + 1}
            totalPages={invoiceGroups.length}
            startIndex={index === 0 ? 0 : 5 + (index - 1) * 8}
            firstPage={index === 0}
          />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);
  const [supplements, setSupplements] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function boot() {
      try {
        const [loadedConfig, sampleQuote, loadedSupplements] = await Promise.all([
          getConfig(),
          getSampleQuote(),
          getSupplements()
        ]);
        setConfig(loadedConfig);
        setQuote(sampleQuote);
        setSupplements(loadedSupplements);
      } catch (error) {
        setStatus(error.message);
      }
    }

    boot();
  }, []);

  useEffect(() => {
    if (!quote) return;

    const timeout = setTimeout(async () => {
      try {
        const calculated = await calculateQuote(quote);
        setResult(calculated);
        setStatus("");
      } catch (error) {
        setStatus(error.message);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [quote]);

  const nextUnitId = useMemo(() => {
    if (!quote?.units?.length) return 1;
    return Math.max(...quote.units.map((unit) => Number(unit.id) || 0)) + 1;
  }, [quote]);

  if (!config || !quote) {
    return <main className="app-shell">Loading estimator…</main>;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Prestige Estimator</p>
          <h1>Estimate Builder</h1>
          <p>
            Internal quote builder with browser-local pricing controls and combined quote PDFs.
          </p>
        </div>
        <div className="header-actions">
          <span className="internal-badge">Internal tool</span>
          <a className="header-link" href="#invoice-supplements">Supplements</a>
          <a className="header-link" href="#pricing-controls">Pricing & Options</a>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                const saved = await saveQuote(quote);
                setStatus(`Saved ${saved.id}`);
              } catch (error) {
                setStatus(error.message);
              }
            }}
          >
            Save Quote
          </button>
        </div>
      </header>

      {status ? <p className="status">{status}</p> : null}

      <PricingGuide config={config} />

      <QuoteHeader quote={quote} setQuote={setQuote} config={config} />

      <div className="unit-actions">
        <h2>Units</h2>
        <button
          type="button"
          className="add-unit-button"
          onClick={() =>
            setQuote({
              ...quote,
              units: [...quote.units, blankUnit(nextUnitId)]
            })
          }
        >
          + Add Unit
        </button>
      </div>

      {quote.units.map((unit) => (
        <UnitEditor
          key={unit.id}
          unit={unit}
          quote={quote}
          setQuote={setQuote}
          config={config}
          onDuplicate={(unitId) => setQuote(duplicateUnit(quote, unitId, nextUnitId))}
        />
      ))}

      <SupplementManager supplements={supplements} setSupplements={setSupplements} setStatus={setStatus} />
      <QuoteOutput result={result} supplements={supplements} setStatus={setStatus} />
      <PricingAdminPanel
        setStatus={setStatus}
        onPricingSaved={(newConfig) => {
          setConfig(newConfig);
          setQuote((current) => ({ ...current }));
        }}
      />
    </main>
  );
}
