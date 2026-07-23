import fs from "node:fs";
import { fileURLToPath } from "node:url";

const editablePricingPath = fileURLToPath(
  new URL("../EDIT-PRICING-HERE.json", import.meta.url)
);

function readEditablePricing() {
  try {
    return JSON.parse(fs.readFileSync(editablePricingPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Could not read EDIT-PRICING-HERE.json: ${error.message}`
    );
  }
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function makeStyles(basePricesPerSquareFoot = {}) {
  return Object.fromEntries(
    Object.entries(basePricesPerSquareFoot).map(([name, pricePerSf]) => [
      name,
      { pricePerSf: number(pricePerSf) }
    ])
  );
}

function makeAddOns(addOns = []) {
  return addOns.map((addOn) => ({
    name: String(addOn?.name || "Untitled Add-on").trim(),
    active: addOn?.active !== false,
    units: String(addOn?.unitLabel || addOn?.chargeBy || "SF"),
    driver: String(addOn?.chargeBy || "SF"),
    prices: Object.fromEntries(
      Object.entries(addOn?.pricesByStyle || {}).map(([style, price]) => [
        style,
        number(price)
      ])
    )
  }));
}

function makeDiscounts(discountPercentages = {}) {
  return Object.fromEntries(
    Object.entries(discountPercentages).map(([customerType, tiers]) => [
      customerType,
      Object.fromEntries(
        Object.entries(tiers || {}).map(([tier, wholePercentage]) => [
          tier,
          number(wholePercentage) / 100
        ])
      )
    ])
  );
}

const editablePricing = readEditablePricing();

export const pricingData = {
  metadata: {
    sourceWorkbook: "EDIT-PRICING-HERE.json",
    notes: [
      "Customer-facing selling prices and quote options.",
      "Repository defaults are maintained in the root-level EDIT-PRICING-HERE.json file."
    ],
    discountPolicy: "Discount applies to total unit price: base price plus selected add-ons, before quantity.",
    installDiscountPolicy: "Installation discount is applied separately to installation revenue."
  },
  styles: makeStyles(editablePricing.basePricesPerSquareFoot),
  addOns: makeAddOns(editablePricing.addOns),
  discounts: makeDiscounts(editablePricing.discountPercentages),
  install: Object.fromEntries(
    Object.entries(editablePricing.installationPrices || {}).map(([name, price]) => [
      name,
      number(price)
    ])
  ),
  referenceLists: editablePricing.dropdownOptions || {}
};
