import assert from "node:assert/strict";
import {
  isCurrentStoredPricing,
  makeStoredPricingRecord,
  resolveStoredPricing
} from "../client/src/pricingStorage.js";

const repositoryPricingV1 = {
  metadata: { sourceRevision: "repo-v1" },
  discounts: { Retail: { Low: 0.18 } }
};

const localPricingV1 = {
  metadata: { sourceRevision: "repo-v1" },
  discounts: { Retail: { Low: 0.2 } }
};

const matchingRecord = makeStoredPricingRecord(localPricingV1);
assert.equal(isCurrentStoredPricing(repositoryPricingV1, matchingRecord), true);
assert.equal(resolveStoredPricing(repositoryPricingV1, matchingRecord), localPricingV1);

const repositoryPricingV2 = {
  metadata: { sourceRevision: "repo-v2" },
  discounts: { Retail: { Low: 0.25 } }
};

assert.equal(isCurrentStoredPricing(repositoryPricingV2, matchingRecord), false);
assert.equal(resolveStoredPricing(repositoryPricingV2, matchingRecord), repositoryPricingV2);

const legacyFullPricingObject = {
  metadata: {},
  discounts: { Retail: { Low: 0.18 } }
};
assert.equal(resolveStoredPricing(repositoryPricingV2, legacyFullPricingObject), repositoryPricingV2);

console.log("Pricing storage revision tests passed.");
