# Prestige Internal Quote Tool — Change Log

## v2.16 — Add-On Visibility and Revised Pricing Defaults

- Added an **On / Off** toggle for every add-on inside **Pricing & Options**.
- Inactive add-ons are hidden from unit inputs and the Price Guide without deleting their names or prices.
- Inactive add-ons are excluded from calculations and customer-facing specifications, even if an older quote payload still marks one as selected.
- Added repository-wide `active: true/false` support in `EDIT-PRICING-HERE.json`.
- Carried over the revised base prices, add-on names, add-on prices, discount percentages, installation prices, and dropdown options supplied for this release.
- Set Retail discounts to 15% / 20%, Builder discounts to 30% / 35%, and Distributor discounts to 40% / 45%.
- Added the approved `01-Door-Order-Process-and-Product-Warranty.pdf` to the company-wide supplement folder.
- Added automated add-on visibility, revised-pricing, approved-supplement, and repository-policy checks.
- Updated all active repository version references to **v2.16 / 2.16.0**.

## v2.15 - Replaceable Quote Letterhead and Release Audit

- Added `public/branding/quote-header.png` as the single replaceable Quote letterhead image.
- Added the header image to the browser Quote preview and every generated Quote page, including continuation pages.
- Preserved the image aspect ratio and prevented cropping.
- Added a text fallback if the branding image is missing or unreadable.
- Added no-store cache handling for branding assets so GitHub replacements appear after redeployment.
- Bundled `pdf-lib` in the application and removed the external CDN dependency.
- Adjusted PDF header spacing without changing the quote calculations or indivisible-row rules.
- Removed the unapproved retyped v2.14 supplement PDFs while preserving the company-wide supplement folder and loading workflow.
- Added automated branding and supplement-safety tests.
- Updated all active repository version references to **v2.15 / 2.15.0**.

## v2.14 — Company-Wide Quote Supplements

- Added two professionally reformatted, company-branded quote supplements:
  - `01-Ordering-Process.pdf`
  - `02-Limited-Product-Warranty.pdf`
- Rebuilt both documents on the same Prestige letterhead, typography, color palette, and page-number format used by the generated Quote.
- Removed Mark Maciel's name, personal email address, direct telephone number, and mobile number from the ordering-process document.
- Rewrote and typeset the ordering process into a clean one-page customer document.
- Cleaned and reformatted the product warranty into a readable two-page document while preserving its substantive warranty terms.
- Changed the app so PDFs committed to `invoice-supplements/` are loaded as company-wide supplements for every salesperson.
- Company-wide supplements are automatically appended behind every generated Quote in filename order.
- Preserved optional browser-only PDF uploads for quote-specific or salesperson-specific attachments.
- Added non-removable **Company-wide / Included** labels in the Quote Supplements panel.
- Added `SUPPLEMENT-GUIDE.md` with non-coder instructions for adding, replacing, removing, and ordering shared PDFs through GitHub.
- Added automated checks for the shared supplement folder, PDF files, API loading, and UI lock behavior.
- Updated all repository version references and release documentation to **v2.14 / 2.14.0**.

## v2.13 — Release Consistency and Documentation

- Updated the repository release number everywhere to **v2.13**.
- Updated `package.json` from the stale internal version `0.3.2` to **2.13.0**.
- Added a root-level `VERSION` file containing `2.13.0`.
- Added `RELEASE-NOTES-v2.13.md` with a complete release summary.
- Updated `README.md` to reflect the current quote layout, browser-local pricing behavior, calculation rules, and deployment configuration.
- Updated `TEAM-PACKAGE-INSTRUCTIONS.txt`, which was incorrectly still labeled v2.7.
- Standardized the change-log structure so the newest release is always listed first.
- No pricing formulas or customer-facing quote calculations were changed in this release.

## v2.12 — Summary Wording and Quote Terms Placement

- Applied the revised **Doors / Windows** and **Installation** total-line layout.
- Centered Retail, Discount, and Total labels programmatically rather than with spaces.
- Changed the Package Retail Price subtitle from **Before Discounts** to **Door(s) & Installation**.
- Changed **Total Discounts** to **Total Savings**.
- Changed the savings subtitle from **Door Units + Installation** to **Door & Install Discounts**.
- Changed the Total Package Price subtitle from **After All Discounts** to **Door(s) + Installation**.
- Changed the Production Deposit subtitle from **Discounted Door Units Only** to **Due Today**.
- Moved the approved quote terms notice directly below the summary cards and immediately above the specifications table.
- Set the quote terms notice to 8-point text in the generated PDF and 8px in the browser preview.
- Removed the duplicate terms notice from the bottom of the quote.

## v2.11 — Discount Presentation and Door Totals

- Shows each door discount percentage as a positive percentage above the dollar discount in accounting parentheses.
- Displays zero discounts as a dash.
- Shows only the positive installation discount percentage on the installation line.
- Uses accounting parentheses for Total Savings and the door-total discount.
- Colors the Production Deposit heading dark red.
- Removes total square footage and build/job type from customer-facing door specifications.
- Adds a distinct **Doors / Windows** total line before the separate Installation line.
- Tightens the standard fixed door-row height while keeping detailed rows indivisible and expandable when needed.

## v2.10 — Non-Coder Pricing File and Browser Reset

- Added root-level `EDIT-PRICING-HERE.json` for repository-wide pricing updates.
- Repository discounts use whole percentages such as `18` for 18%.
- Added `EDIT-PRICING-GUIDE.md` with GitHub editing instructions.
- Renamed the local reset action to **Discard Browser Edits & Use Repository Defaults**.
- Repository pricing requests bypass browser HTTP cache.
- Replaced the quote notice with the approved taxes, validity, deposit, and balance language.

## v2.9 — Repository Pricing Refresh

- Fixed repository pricing changes being ignored after a browser saved Pricing & Options.
- Repository pricing is fingerprinted automatically on each deployment.
- When repository pricing changes, stale browser pricing is cleared once so new defaults take effect.
- Browser-local edits continue to persist until repository pricing changes or the user resets them.

## v2.8 — Quote Workflow and Installation Presentation

- Changed **Add Unit** to a full-width, subtle red rounded button.
- Made **Pricing & Options** collapsed by default.
- Added a **Duplicate** button to each unit card.
- Added selectable Work Scope items.
- Capitalized section headings and customer-facing line-item labels.
- Highlighted **Total Package Price** in Prestige green.
- Removed installation from individual door rows.
- Added one separate **Installation** line.
- Kept the production deposit based only on discounted door/window units, excluding installation.

## v2.7 — Quote Naming and Sell-Price-Only Editor

- Changed customer-facing documents from Invoice to **Quote**.
- Removed cost, markup, and margin fields from the interface and pricing payload.
- Preserved browser-local editing of sell prices and add-on names.

## v2.6 — Door-Unit Discount Basis

- Clarified and tested that the door discount applies to the base door price plus all selected add-ons.
- Confirmed the production deposit uses the fully discounted door-unit price and excludes installation.

## v2.5 — Free Render Browser Storage

- Moved editable pricing and supplement PDFs to browser-local storage for use on Render's free instance.
- Removed the requirement for a Render persistent disk.

## v2.4 — Deployment Cleanup

- Cleaned deployment configuration and pinned Node 22.

## v2.3 — Standard Door Row Heights

- Made normal door rows a consistent fixed height.
- Allowed expansion only when a complete specification list requires additional space.

## v2.2 — Indivisible Door Blocks

- Prevented a door and its specifications from splitting across pages.
- Removed the four-line specification truncation.

## v2.1 — Installation in Package Totals

- Corrected line-item package calculations while keeping installation excluded from the production deposit basis.

## v2.0 — Internal Pricing and Supplement Workflow

- Removed password protection.
- Added editable pricing and add-on management.
- Added combined quote PDF generation with appended supplement PDFs.
- Added compact quote pagination and corrected production-deposit logic.
