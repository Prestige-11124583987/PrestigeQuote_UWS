# Code Review - v2.16

## Reviewed Areas

- Repository pricing conversion in `server/pricingData.js`.
- Browser pricing normalization in `server/index.js`.
- Public pricing sanitization in both server and client paths.
- Add-on pricing and selection logic in `server/pricingEngine.js`.
- Pricing & Options editor behavior in `client/src/App.jsx`.
- Browser-local pricing revision handling in `client/src/api.js` and `pricingStorage.js`.
- Company-wide supplement discovery and PDF validation.
- Quote header image loading and fallback behavior.

## Visibility Rule

An add-on is active unless its `active` value is explicitly `false`. Inactive add-ons remain editable in Pricing & Options but are excluded from unit inputs, the Price Guide, quote calculations, and printed specifications.

## Pricing Rule Preserved

The door-unit retail price remains the base door price plus every active selected add-on. The customer discount applies to that entire door-unit amount. Installation remains separate and is excluded from the production-deposit basis.

## Build Note

Automated Node tests and syntax checks pass. A full local Vite build requires installing npm dependencies; dependency installation was not available within the execution timeout, so Render remains the final production compilation check.
