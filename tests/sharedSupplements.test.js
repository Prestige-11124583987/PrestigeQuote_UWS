import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supplementDirectory = path.join(root, "invoice-supplements");
const serverSource = fs.readFileSync(path.join(root, "server", "index.js"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "client", "src", "api.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "client", "src", "App.jsx"), "utf8");

assert.equal(fs.existsSync(supplementDirectory), true, "The shared supplement folder should exist.");

const sharedFiles = fs.readdirSync(supplementDirectory)
  .filter((name) => name.toLowerCase().endsWith(".pdf"));

assert.equal(
  sharedFiles.includes("01-Door-Order-Process-and-Product-Warranty.pdf"),
  true,
  "The approved combined ordering-process and warranty PDF should ship company-wide."
);

for (const name of sharedFiles) {
  const bytes = fs.readFileSync(path.join(supplementDirectory, name));
  assert.equal(bytes.subarray(0, 4).toString(), "%PDF", `${name} should be a valid PDF.`);
}

// v2.14's retyped PDFs were not approved as verbatim source documents and
// must not ship accidentally in the current repository.
assert.equal(sharedFiles.includes("01-Ordering-Process.pdf"), false);
assert.equal(sharedFiles.includes("02-Limited-Product-Warranty.pdf"), false);

assert.match(serverSource, /repositorySupplementsDirectory/);
assert.match(serverSource, /path\.join\(__dirname, "\.\.", "invoice-supplements"\)/);
assert.match(serverSource, /app\.get\("\/api\/supplements"/);
assert.match(apiSource, /getRepositorySupplements/);
assert.match(apiSource, /Could not load company-wide quote supplements/);
assert.match(appSource, /Company-wide/);
assert.match(appSource, /supplement\.storage === "repository"/);
assert.match(appSource, /className="supplement-lock">Included/);

console.log("Company-wide supplement test passed.");
