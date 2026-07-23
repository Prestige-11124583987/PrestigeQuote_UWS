# Free Render Deployment - v2.16

1. Upload all project files to the top level of the GitHub repository.
2. Connect the repository to a Render Web Service.
3. Select the Free instance.
4. Set Build Command to `npm install && npm run build`.
5. Set Start Command to `npm start`.
6. Add `NODE_ENV=production` and `NODE_VERSION=22.16.0`.
7. Do not add a persistent disk.
8. Deploy the latest commit.

Browser pricing edits and optional browser-uploaded PDFs remain device-specific. Approved PDFs committed to `invoice-supplements/` are company-wide.

## Replace the Quote Header

Replace `public/branding/quote-header.png` in GitHub, keep the filename unchanged, commit, and redeploy. No code changes are required. The production server disables caching for branding assets so the replacement appears after deployment.

## Updating Default Pricing

Edit `EDIT-PRICING-HERE.json` in GitHub and commit the change. Discounts are entered as whole percentages, such as `18` for 18%.

If a browser has local pricing saved, open **Pricing & Options** and click **Discard Browser Edits & Use Repository Defaults**. Clearing browser cache is not required.

## Verify the Deployed Release

Confirm:

- `VERSION` contains `2.16.0`.
- `package.json` contains version `2.16.0`.
- The Quote preview shows the image from `public/branding/quote-header.png`.
- A generated PDF shows the same image on page 1 and continuation pages.
- The Quote still generates with a text header if the image is temporarily renamed or removed.

## Verify Company-Wide Supplements

Only final approved PDFs should be placed in `invoice-supplements/`. After deployment, each approved file should appear as **Company-wide** and **Included** and append behind the Quote in filename order.

## Verify Add-On Visibility

Open **Pricing & Options** and confirm every add-on has an **On / Off** toggle. Turn one off, save changes on the browser, and confirm it disappears from the unit add-on checkboxes and Price Guide. Use **Discard Browser Edits & Use Repository Defaults** to restore the repository settings.

## Included Company-Wide PDF

Confirm `invoice-supplements/01-Door-Order-Process-and-Product-Warranty.pdf` appears as **Company-wide** and **Included**, then verify it appends after the generated Quote.
