import assert from "node:assert/strict";
import { calculateQuote, sanitizePricingForClient } from "../server/pricingEngine.js";

const pricing = {
  metadata: { discountPolicy: "", installDiscountPolicy: "", sourceRevision: "test" },
  styles: { Test: { pricePerSf: 100 } },
  addOns: [
    { name: "Active Add-on", active: true, driver: "Each", units: "Each", prices: { Test: 25 } },
    { name: "Inactive Add-on", active: false, driver: "Each", units: "Each", prices: { Test: 75 } }
  ],
  discounts: { Retail: { Low: 0 } },
  install: { "New Build": 0 },
  referenceLists: { Styles: ["Test"], "Customer Type": ["Retail"], "Discount Tier": ["Low"], "Build Types": ["New Build"] }
};

const quote = {
  customerType: "Retail",
  discountTier: "Low",
  units: [{
    id: 1,
    name: "Visibility Test",
    style: "Test",
    buildType: "New Build",
    widthIn: 12,
    heightIn: 12,
    quantity: 1,
    addOns: { "Active Add-on": true, "Inactive Add-on": true }
  }]
};

const result = calculateQuote(quote, pricing);
assert.deepEqual(result.units[0].selectedAddOns, ["Active Add-on"]);
assert.equal(result.units[0].unitRetailPrice, 125);

const publicConfig = sanitizePricingForClient(pricing);
assert.deepEqual(publicConfig.addOns.map((addOn) => addOn.name), ["Active Add-on"]);
assert.deepEqual(publicConfig.publicPricing.addOns.map((addOn) => addOn.name), ["Active Add-on"]);

console.log("Add-on visibility test passed.");
