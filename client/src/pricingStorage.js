export function pricingRevision(pricing) {
  return String(pricing?.metadata?.sourceRevision || "");
}

export function makeStoredPricingRecord(pricing) {
  return {
    sourceRevision: pricingRevision(pricing),
    pricing
  };
}

export function isCurrentStoredPricing(serverPricing, storedRecord) {
  const serverRevision = pricingRevision(serverPricing);
  return Boolean(
    serverRevision &&
    storedRecord?.pricing &&
    storedRecord?.sourceRevision === serverRevision
  );
}

export function resolveStoredPricing(serverPricing, storedRecord) {
  return isCurrentStoredPricing(serverPricing, storedRecord)
    ? storedRecord.pricing
    : serverPricing;
}
