import assert from "node:assert/strict";
import fs from "node:fs";
import { pricingData } from "../server/pricingData.js";

const appSource = fs.readFileSync(new URL("../client/src/App.jsx", import.meta.url), "utf8");

assert.match(appSource, /"QUOTE"/);
assert.match(appSource, /Printable Quote/);
assert.doesNotMatch(appSource, /"INVOICE"|INVOICE — CONTINUED|INVOICE - CONTINUED/);
assert.doesNotMatch(appSource, /Internal margin panel|Manufacturer Cost|Cost \/ Prestige Price|<span>Cost<\/span>|>Markup</);

function assertNoInternalPricingKeys(value, path = "pricingData") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.equal(/cost|margin|markup/i.test(key), false, `Unexpected internal pricing key at ${path}.${key}`);
    assertNoInternalPricingKeys(child, `${path}.${key}`);
  }
}

assertNoInternalPricingKeys(pricingData);

assert.match(appSource, /className="add-unit-button"/);
assert.match(appSource, /className="secondary small-button duplicate-unit-button"/);
assert.match(appSource, /<details id="pricing-controls"/);
assert.doesNotMatch(appSource, /<details id="pricing-controls"[^>]*open/);
assert.match(appSource, /Furnish new Prestige door\(s\)\/window\(s\)\./);
assert.match(appSource, /drawInstallationLine/);
assert.match(appSource, /drawDoorTotalLine/);
assert.match(appSource, /total-package-metric/);
assert.match(appSource, /production-deposit-metric/);
assert.doesNotMatch(appSource, /Installation included:/);
assert.match(appSource, /formatDiscountPercent\(unit\.discountRate\)/);
assert.match(appSource, /formatAccountingDiscount\(unit\.lineDiscountAmount\)/);
assert.match(appSource, /formatDiscountPercent\(result\.totals\.installationDiscountRate\)/);
assert.doesNotMatch(appSource, /unit\.totalSf \? `\$\{unit\.totalSf\} SF`/);

const additionalSpecsSource = appSource.match(/function formatAdditionalSpecs\(unit\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.doesNotMatch(additionalSpecsSource, /unit\.buildType/);


assert.match(appSource, /Discard Browser Edits & Use Repository Defaults/);
assert.match(appSource, /Turn this add-on on or off for new quotes/);
assert.match(appSource, /className="addon-active-toggle"/);
assert.match(appSource, /updateAddOnField\(index, "active", e\.target\.checked\)/);
assert.match(appSource, /EDIT-PRICING-HERE\.json/);
assert.match(appSource, /Applicable taxes, if any, are not included\. This quote is valid for thirty \(30\) days\./);
assert.match(appSource, /The remaining product balance is due prior to shipment\./);

assert.match(appSource, /Door\(s\) & Installation/);
assert.match(appSource, /Total Savings/);
assert.match(appSource, /Door & Install Discounts/);
assert.match(appSource, /Door\(s\) \+ Installation/);
assert.match(appSource, /Due Today/);
assert.doesNotMatch(appSource, /Before Discounts|Total Discounts|Door Units \+ Installation|After All Discounts|Discounted Door Units Only/);
assert.match(appSource, /page\.drawText\("DOORS \/ WINDOWS"/);
assert.match(appSource, /const labels = \["RETAIL", "DISCOUNT", "TOTAL"\]/);
assert.match(appSource, /const noticeFontSize = 8/);
assert.match(appSource, /quote-terms-notice-top/);

const previewNoticeIndex = appSource.indexOf('className="quote-terms-notice quote-terms-notice-top"');
const previewTableIndex = appSource.indexOf('className="compact-invoice-table"');
assert.ok(previewNoticeIndex > -1 && previewNoticeIndex < previewTableIndex, "Terms notice should appear before the specifications table in the preview.");

const pdfNoticeIndex = appSource.indexOf('const noticeFontSize = 8');
const pdfTableIndex = appSource.indexOf('const tableBottom = drawLineItemsTable', pdfNoticeIndex);
assert.ok(pdfNoticeIndex > -1 && pdfNoticeIndex < pdfTableIndex, "Terms notice should be drawn before the specifications table in the PDF.");

console.log("UI policy test passed.");
