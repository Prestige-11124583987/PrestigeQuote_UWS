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
  customerType: "UNIVERSAL WINDOW SOLUTIONS",
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
  discounts: { Retail: 0.2 },
  install: { "New Build": 0 }
};

const fullDoorUnitDiscountQuote = {
  customerType: "Retail",
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

// Impact Glass defaults to total unit SF, but uses Glass Area SF when an override is entered.
const impactPricingData = {
  styles: { Test: { pricePerSf: 0 } },
  addOns: [
    { name: "Impact Glass", driver: "Impact", units: "/ SF of Unit", prices: { Test: 40 } }
  ],
  discounts: { Retail: 0 },
  install: { "New Build": 0 }
};

const impactDefault = calculateQuote({
  customerType: "Retail",
  units: [{
    id: 1, style: "Test", buildType: "New Build", widthIn: 48, heightIn: 96, quantity: 1,
    addOns: { "Impact Glass": true }
  }]
}, impactPricingData);
assert.equal(impactDefault.units[0].totalSf, 32);
assert.equal(impactDefault.units[0].unitRetailPrice, 1280);

const impactOverride = calculateQuote({
  customerType: "Retail",
  units: [{
    id: 1, style: "Test", buildType: "New Build", widthIn: 48, heightIn: 96, glassSf: 20, quantity: 1,
    addOns: { "Impact Glass": true }
  }]
}, impactPricingData);
assert.equal(impactOverride.units[0].unitRetailPrice, 800);

console.log("Pricing engine test passed.");
