import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const headerPath = path.join(root, "public", "branding", "quote-header.png");
const appSource = fs.readFileSync(path.join(root, "client", "src", "App.jsx"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "client", "src", "styles.css"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server", "index.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

assert.equal(fs.existsSync(headerPath), true, "The replaceable quote header image should exist.");
const headerBytes = fs.readFileSync(headerPath);
assert.deepEqual([...headerBytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "The quote header should be a valid PNG.");

assert.match(appSource, /const QUOTE_HEADER_IMAGE_URL = "\/branding\/quote-header\.png"/);
assert.match(appSource, /fetch\(QUOTE_HEADER_IMAGE_URL, \{ cache: "no-store" \}\)/);
assert.match(appSource, /pdfDoc\.embedPng/);
assert.match(appSource, /page\.drawImage\(headerImage/);
assert.match(appSource, /drawFallbackBrandHeader/);
assert.match(appSource, /className="invoice-branding-image"/);
assert.match(cssSource, /object-fit: contain/);
assert.match(serverSource, /Cache-Control", "no-store"/);
assert.equal(indexSource.includes("cdn.jsdelivr.net/npm/pdf-lib"), false, "PDF generation should not rely on a CDN.");
assert.equal(packageJson.dependencies["pdf-lib"], "1.17.1");

console.log("Branding header test passed.");
