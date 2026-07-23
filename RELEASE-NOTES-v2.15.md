# Release Notes - Prestige Internal Quote Tool v2.15

## Replaceable Quote Letterhead

- Added the approved Prestige header image at `public/branding/quote-header.png`.
- The image now appears in the on-screen Quote preview and on every generated Quote page, including continuation pages.
- The image is scaled proportionally and is never cropped.
- Replacing the file with another PNG of the same name updates the header for everyone after the GitHub commit and Render redeploy.
- Branding assets are served with no-store cache headers so a replaced image is not hidden behind an old browser copy.
- Added a text fallback so Quote generation still works if the image is missing or unreadable.

## PDF Reliability

- Bundled `pdf-lib` with the application instead of loading it from a third-party CDN.
- The Quote PDF no longer depends on an external script being available in the salesperson's browser.
- Adjusted first-page and continuation-page header spacing while retaining the five-standard-door first-page target and indivisible door rows.

## Supplement Safety

- Preserved the company-wide `invoice-supplements/` workflow.
- Removed the two retyped v2.14 supplement PDFs because their source wording had not been approved as verbatim.
- The folder remains ready for final approved PDFs, which will append to every Quote in filename order.

## Repository Review

- Updated package, version, release notes, deployment instructions, team instructions, README, and change log to v2.15 / 2.15.0.
- Added automated branding checks for the PNG, PDF embedding, browser preview, fallback header, cache policy, and bundled PDF library.
- Updated supplement tests so unapproved documents cannot accidentally return.
