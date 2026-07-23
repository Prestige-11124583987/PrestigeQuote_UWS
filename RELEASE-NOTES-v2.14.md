# Release Notes — Prestige Internal Quote Tool v2.14

> **Superseded by v2.15:** The two retyped supplement PDFs described below were removed because their source wording had not been approved as verbatim. Do not use the v2.14 supplement files.

## Overview

v2.14 adds true company-wide quote supplements and delivers professionally reformatted Ordering Process and Limited Product Warranty documents using the same Prestige letterhead and visual system as the Quote output.

## Shared Quote Documents

The repository now includes:

- `invoice-supplements/01-Ordering-Process.pdf`
- `invoice-supplements/02-Limited-Product-Warranty.pdf`

Both PDFs use:

- The Prestige olive-and-gunmetal color system
- The same typographic letterhead used by the Quote
- The Winter Garden address, PrestigeIronDoors.com, and (855) 767-2837
- Clean section bars, tables, spacing, and page numbering

The Ordering Process is a clean one-page document. The Limited Product Warranty is a readable two-page document.

Mark Maciel's personal name, email address, direct number, and mobile number have been removed.

## Application Behavior

- PDFs committed to `invoice-supplements/` load automatically for every user.
- Shared PDFs append behind every Quote in filename order.
- Shared files are labeled **Company-wide** and **Included** in the app and cannot be removed from the browser interface.
- Optional browser-only supplement uploads remain available.
- The free Render instance remains supported; no persistent disk is required for shared repository PDFs.

## Non-Coder Maintenance

`SUPPLEMENT-GUIDE.md` explains how to add, replace, remove, and reorder shared PDFs directly in GitHub.

## Version Consistency

- `package.json`: `2.14.0`
- `VERSION`: `2.14.0`
- `README.md`: v2.14
- `TEAM-PACKAGE-INSTRUCTIONS.txt`: v2.14
- `DEPLOYMENT.md`: v2.14 verification instructions
