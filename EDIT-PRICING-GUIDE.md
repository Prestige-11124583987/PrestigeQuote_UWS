# Edit Default Pricing Without Touching Code

All repository-wide default pricing and dropdown options are in:

`EDIT-PRICING-HERE.json`

You do not need to edit anything inside `client` or `server`.

## Make a Change in GitHub

1. Open `EDIT-PRICING-HERE.json` in the repository.
2. Click the pencil icon.
3. Change only the names, numbers, or list items you need.
4. Keep the quotation marks and commas in place.
5. Click **Commit changes**.
6. Render will deploy the new defaults automatically if Auto-Deploy is enabled.

## Discounts

Enter discounts as whole percentages:

- `18` means 18%
- `22` means 22%
- Do not enter `0.18`

Example:

```json
"discountPercentages": {
  "Retail": {
    "Low": 18,
    "High": 22
  }
}
```

## Base Prices

Edit the selling price per square foot here:

```json
"basePricesPerSquareFoot": {
  "Traditional": 225,
  "Slim Line": 210
}
```

## Add-Ons

Each add-on has:

- `name`: customer-facing name
- `active`: `true` shows the add-on; `false` hides it from new quotes
- `chargeBy`: `SF`, `Glass`, `Slabs`, or `Each`
- `unitLabel`: wording shown in the pricing editor
- `pricesByStyle`: selling price for each style

Example:

```json
{
  "name": "Impact Glass",
  "active": false,
  "chargeBy": "Glass",
  "unitLabel": "/ SF of Glass",
  "pricesByStyle": {
    "Traditional": 40,
    "Slim Line": 40,
    "Interior Partitions": 0
  }
}
```

You can also turn add-ons on and off directly inside **Pricing & Options**. Browser changes affect only that device until the repository file is edited and redeployed.

## Installation

Edit installation prices under `installationPrices`.

## Dropdowns

Edit selectable choices under `dropdownOptions`. Keep each item in quotation marks and separate items with commas.

## Browser-Only Changes

Salespeople can still make temporary changes in **Pricing & Options**. Those changes affect only that browser.

To remove them, open **Pricing & Options** and click:

**Discard Browser Edits & Use Repository Defaults**

This removes the local override immediately. Clearing browser cache is not required.
