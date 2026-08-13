import assert from "node:assert/strict";
import fs from "node:fs";
import { pricingData } from "../server/pricingData.js";

const editable = JSON.parse(
  fs.readFileSync(new URL("../EDIT-PRICING-HERE.json", import.meta.url), "utf8")
);

assert.deepEqual(editable.basePricesPerSquareFoot, {
  Traditional: 225,
  "Slim Line": 210,
  "Interior Partitions": 120
});

assert.deepEqual(editable.discountPercentages, {
  Retail: 15,
  Builder: 35,
  "UNIVERSAL WINDOW SOLUTIONS": 40
});

assert.deepEqual(editable.installationPrices, {
  "New Build": 1500,
  Retrofit: 2500,
  Window: 850,
  "Distance Fee": 500
});

const expectedAddOns = {
  "Level I Customization": ["SF", "/ SF", 26.84, 26.84, 0],
  "Level II Customization": ["SF", "/ SF", 53.3, 53.3, 0],
  "Level III Customization": ["SF", "/ SF", 84.3, 84.3, 0],
  "Magnetic Screen": ["Slabs", "/ Slab(s)", 160, 160, 0],
  "Simulated Divided Lites (SDL)": ["SF", "/ SF", 0, 0, 5.56],
  "True Divided Lites (TDL)": ["SF", "/ SF", 0, 6, 11.14],
  "Impact Glass": ["Impact", "/ SF of Unit (Glass Override if entered)", 40, 40, 40],
  "Arctic Glass Treatment": ["Glass", "/ SF of Glass", 37.8, 37.8, 0],
  "Low E (FREE)": ["Glass", "/ SF of Glass", 0, 0, 0],
  "Marine Coating": ["SF", "/ SF", 13.8, 13.8, 0],
  "VerdiGreen Paint": ["SF", "/ SF", 11.16, 11.16, 0],
  "EP56 Steel": ["SF", "/ SF", 0, 0, 5],
  "EP57 Steel (Thermal Break)": ["SF", "/ SF", 0, 0, 0],
  "Thermal Break 2.0": ["SF", "/ SF", 96.6, 92.9, 40.6],
  "Deadbolt (w/ Pull Handle)": ["Each", "/ Door(s)", 40, 40, 40],
  "Operable Handle": ["Each", "/ Door(s)", 250, 250, 80],
  "Stained Glass": ["Glass", "/ SF of Glass", 12, 12, 12]
};

assert.equal(editable.addOns.length, Object.keys(expectedAddOns).length);
for (const addOn of editable.addOns) {
  const expected = expectedAddOns[addOn.name];
  assert.ok(expected, `Unexpected add-on: ${addOn.name}`);
  assert.equal(addOn.chargeBy, expected[0]);
  assert.equal(addOn.unitLabel, expected[1]);
  assert.deepEqual(addOn.pricesByStyle, {
    Traditional: expected[2],
    "Slim Line": expected[3],
    "Interior Partitions": expected[4]
  });
}

assert.equal(pricingData.discounts.Retail, 0.15);
assert.equal(pricingData.discounts.Builder, 0.35);
assert.equal(pricingData.discounts["UNIVERSAL WINDOW SOLUTIONS"], 0.4);
assert.equal(pricingData.styles.Traditional.pricePerSf, 225);
assert.equal(pricingData.styles["Slim Line"].pricePerSf, 210);
assert.equal(pricingData.styles["Interior Partitions"].pricePerSf, 120);
assert.deepEqual(
  pricingData.addOns.map((addOn) => [addOn.name, addOn.active]),
  editable.addOns.map((addOn) => [addOn.name, addOn.active !== false])
);

assert.deepEqual(editable.dropdownOptions.Styles, [
  "Traditional",
  "Slim Line",
  "Interior Partitions",
  "[TBD]"
]);
assert.deepEqual(editable.dropdownOptions["Customer Type"], [
  "Retail",
  "Builder",
  "UNIVERSAL WINDOW SOLUTIONS"
]);
assert.equal("Discount Tier" in editable.dropdownOptions, false);
assert.equal(editable.addOns.some((addOn) => /Switchable E-Glass/i.test(addOn.name)), false);

console.log("Editable repository pricing file test passed.");
