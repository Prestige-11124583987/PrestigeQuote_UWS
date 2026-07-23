import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const deployment = fs.readFileSync(path.join(root, "DEPLOYMENT.md"), "utf8");
const teamInstructions = fs.readFileSync(path.join(root, "TEAM-PACKAGE-INSTRUCTIONS.txt"), "utf8");
const changes = fs.readFileSync(path.join(root, "CHANGES.md"), "utf8");

assert.equal(packageJson.version, "2.16.0");
assert.equal(version, "2.16.0");
assert.match(readme, /Prestige Internal Quote Tool v2\.16/);
assert.match(readme, /RELEASE-NOTES-v2\.16\.md/);
assert.match(deployment, /v2\.16/);
assert.match(teamInstructions, /v2\.16/);
assert.match(changes, /## v2\.16 — Add-On Visibility and Revised Pricing Defaults/);
assert.equal(fs.existsSync(path.join(root, "RELEASE-NOTES-v2.16.md")), true);
assert.equal(fs.existsSync(path.join(root, "CODE-REVIEW-v2.16.md")), true);
assert.equal(fs.existsSync(path.join(root, "public", "branding", "quote-header.png")), true);
assert.equal(
  fs.existsSync(path.join(root, "invoice-supplements", "01-Door-Order-Process-and-Product-Warranty.pdf")),
  true
);

console.log("Repository release audit passed.");
