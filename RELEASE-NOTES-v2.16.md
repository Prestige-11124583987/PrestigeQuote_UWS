# Release Notes - Prestige Internal Quote Tool v2.16

## Add-On On / Off Controls

- Every add-on now has an **On / Off** switch in the same Add-On Pricing table used to edit names and selling prices.
- Turning an add-on off preserves its pricing data but removes it from new unit inputs and the Price Guide.
- Inactive add-ons are ignored by the pricing engine and are not printed in customer-facing specifications.
- Newly created add-ons default to **On**.

## Repository Defaults

- `EDIT-PRICING-HERE.json` now supports an `active` Boolean for every add-on.
- Set `"active": true` to show an add-on company-wide after deployment.
- Set `"active": false` to hide it company-wide without deleting it.
- Browser-only On / Off changes continue to work through **Save Changes on This Browser**.

## Revised Pricing Carried Forward

- Base prices: Traditional $225/SF, Slim Line $210/SF, Interior Partitions $120/SF.
- Retail discounts: 15% Low / 20% High.
- Builder discounts: 30% Low / 35% High.
- Distributor discounts: 40% Low / 45% High.
- Carried forward all supplied add-on pricing, installation pricing, and dropdown lists, including Level II and III Customization, Deadbolt (w/ Pull Handle), and Electronic Glass.

## Company-Wide Supplement

- Added the approved `invoice-supplements/01-Door-Order-Process-and-Product-Warranty.pdf`.
- The file is loaded for every salesperson and automatically appended after every generated Quote.

## Validation

- Pricing-engine tests pass.
- Add-on visibility tests pass.
- Invoice pagination and indivisible-unit tests pass.
- Browser pricing revision tests pass.
- Repository pricing and supplement validation tests pass.
- Branding-header tests pass.
