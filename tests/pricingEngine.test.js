import assert from "node:assert/strict";
import { pricingData } from "../server/pricingData.js";
import { calculateQuote, makeSampleQuote } from "../server/pricingEngine.js";

const blankQuote = makeSampleQuote();
const blankResult = calculateQuote(blankQuote, pricingData);
assert.equal(blankResult.units.length, 0);
assert.equal(blankResult.totals.quoteTotal, 0);

const quote = {
  quoteNumber: "EST-0001",
  preparedFor: { company: "", contact: "" },
  preparedBy: { name: "", email: "", phone: "" },
  customerType: "Distributor",
  discountTier: "Low",
  installationDiscountRate: 0.15,
  productionDepositRate: 0.5,
  workScope: [
    "Furnish new Prestige door(s)/window(s).",
    "Install Prestige door(s)/window(s)."
  ],
  units: [
    {
      id: 1,
      name: "Unit 1",
      style: "Traditional",
      buildType: "New Build",
      slabs: 1,
      heightIn: 120,
      widthIn: 48,
      glassSf: 25,
      quantity: 1,
      swing: "LH Outswing",
      accessibility: "Standard",
      color: "Aged Bronze Patina",
      glassTexture: "Clear",
      glassColor: "Clear ",
      addOns: {
        "Impact Glass": true,
        "Deadbolt (w/ Pull Handle)": true
      }
    },
    {
      id: 2,
      name: "Unit 2",
      style: "Traditional",
      buildType: "New Build",
      slabs: 1,
      heightIn: 120,
      widthIn: 32,
      glassSf: 15,
      quantity: 1,
      glassTexture: "Clear",
      glassColor: "Clear ",
      addOns: {
        "Impact Glass": true
      }
    }
  ]
};

const result = calculateQuote(quote, pricingData);

assert.equal(result.units[0].unitRetailPrice, 10040);
assert.equal(result.units[0].discountRate, 0.4);
assert.equal(result.units[0].unitPrice, 6024);
assert.equal(result.units[0].lineMaterialRevenue, 6024);

assert.equal(result.units[1].unitRetailPrice, 6600);
assert.equal(result.units[1].unitPrice, 3960);

assert.equal(result.totals.materialSubtotal, 9984);
assert.equal(result.totals.installationGross, 3000);
assert.equal(result.totals.installationDiscountAmount, 450);
assert.equal(result.totals.installationNet, 2550);
assert.equal(result.totals.quoteTotal, 12534);
assert.equal(result.totals.productionDepositBasis, 9984);
assert.equal(result.totals.productionDepositDue, 4992);
assert.deepEqual(result.workScope, [
  "Furnish new Prestige door(s)/window(s).",
  "Install Prestige door(s)/window(s)."
]);
assert.equal("lineInstallationGross" in result.units[0], false);
assert.equal("linePackagePrice" in result.units[0], false);

assert.equal("internal" in result, false);
assert.equal("lineCost" in result.units[0], false);
assert.equal("marginDollars" in result.units[0], false);

// Regression test: the percentage discount must apply to the entire door unit,
// including every selected add-on—not merely to the base door price.
const fullDoorUnitDiscountData = {
  styles: { Test: { pricePerSf: 100 } },
  addOns: [
    {
      name: "Test Add-on",
      driver: "Each",
      units: "Each",
      prices: { Test: 50 }
    }
  ],
  discounts: { Retail: { Low: 0.2 } },
  install: { "New Build": 0 }
};

const fullDoorUnitDiscountQuote = {
  customerType: "Retail",
  discountTier: "Low",
  installationDiscountRate: 0,
  productionDepositRate: 0.5,
  workScope: [
    "Furnish new Prestige door(s)/window(s).",
    "Install Prestige door(s)/window(s)."
  ],
  units: [
    {
      id: 1,
      name: "Discount Regression Door",
      style: "Test",
      buildType: "New Build",
      widthIn: 12,
      heightIn: 12,
      quantity: 1,
      addOns: { "Test Add-on": true }
    }
  ]
};

const fullDoorUnitDiscountResult = calculateQuote(
  fullDoorUnitDiscountQuote,
  fullDoorUnitDiscountData
);
assert.equal(fullDoorUnitDiscountResult.units[0].unitRetailPrice, 150);
assert.equal(fullDoorUnitDiscountResult.units[0].unitDiscountAmount, 30);
assert.equal(fullDoorUnitDiscountResult.units[0].unitPrice, 120);
assert.equal(fullDoorUnitDiscountResult.totals.productionDepositBasis, 120);
assert.equal(fullDoorUnitDiscountResult.totals.productionDepositDue, 60);

console.log("Pricing engine test passed.");
