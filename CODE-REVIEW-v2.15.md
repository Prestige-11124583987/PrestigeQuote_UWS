# Code Review - v2.15

## Reviewed

- Door and add-on discount basis
- Installation as a separate quote line
- Production deposit basis and display
- Door-row pagination and no-split behavior
- Browser-local pricing persistence and repository reset
- Browser-local optional supplements
- Company-wide repository supplement loading
- Replaceable Quote header in browser preview and generated PDFs
- Continuation-page header behavior
- Static asset caching on Render
- Release/version documentation

## Corrections Made

- Bundled `pdf-lib` instead of depending on a third-party CDN.
- Added a replaceable, no-crop header image with a text fallback.
- Added no-store cache handling for branding assets.
- Removed unapproved retyped v2.14 supplement PDFs.
- Removed obsolete cost-price CSS left behind after cost and margin fields were removed.
- Updated all active release metadata to v2.15 / 2.15.0.

## Verification

- All seven automated test suites pass.
- Server and client utility JavaScript passes Node syntax checks.
- React JSX passes TypeScript parser validation.
- `EDIT-PRICING-HERE.json` parses successfully.
- `quote-header.png` is a valid 1800 x 450 PNG.

## Build Note

The complete Vite production build could not be executed in the review environment because package installation timed out. Render will perform the actual dependency installation and production build during deployment.
