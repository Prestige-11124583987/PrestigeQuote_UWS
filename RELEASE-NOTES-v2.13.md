# Release Notes — Prestige Internal Quote Tool v2.13

## Purpose of This Release

v2.13 is a repository consistency release. It preserves the quote behavior delivered in v2.12 while correcting stale and incomplete version information across the codebase.

## Current Customer-Facing Quote Layout

- The document title is **Quote**.
- Summary cards show:
  - Package Retail Price — Door(s) & Installation
  - Total Savings — Door & Install Discounts
  - Total Package Price — Door(s) + Installation
  - Production Deposit — Due Today
- The approved quote terms notice appears below the summary cards and above the specifications table at 8-point size.
- Door/window pricing and installation are shown on separate total lines.
- Door discount cells show the positive discount percentage above the dollars saved in parentheses.
- Zero values display as a dash where applicable.

## Current Calculation Rules

- Base door/window price plus all selected add-ons equals the undiscounted door-unit retail price.
- The selected door discount applies to the entire door-unit retail price.
- Installation is priced and discounted separately.
- The production deposit equals 50% of discounted door/window units, including add-ons and excluding installation.

## Current Editing Model

- Repository-wide defaults are maintained in `EDIT-PRICING-HERE.json`.
- Salespeople can make browser-local changes through Pricing & Options.
- Browser-local overrides can be removed using **Discard Browser Edits & Use Repository Defaults**.
- No browser cache clearing is required.

## Version Files Updated

- `package.json`: `2.13.0`
- `VERSION`: `2.13.0`
- `README.md`: v2.13
- `TEAM-PACKAGE-INSTRUCTIONS.txt`: v2.13
- `CHANGES.md`: complete structured release history
