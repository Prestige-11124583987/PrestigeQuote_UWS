# Company-Wide Quote Supplement Guide

The `invoice-supplements/` folder controls approved PDFs that every salesperson receives behind each generated Quote.

## Approval Rule

Only upload final approved documents. Do not retype, rewrite, summarize, or otherwise alter legal or warranty language unless the revised language has been explicitly approved.

The approved combined `01-Door-Order-Process-and-Product-Warranty.pdf` ships in v2.16 and appends behind every Quote.

## Add a Shared PDF

1. Open the GitHub repository.
2. Open `invoice-supplements`.
3. Choose **Add file -> Upload files**.
4. Upload the approved PDF.
5. Use a numbered filename such as `01-Ordering-Process.pdf`.
6. Commit the change.
7. Allow Render to redeploy, or choose **Manual Deploy -> Deploy latest commit**.

After deployment, the PDF appears as **Company-wide** and **Included** and appends behind every Quote.

## Replace or Remove

Replace a PDF with the exact same filename, or delete it from the folder, commit, and redeploy.

## Order

Files append alphabetically and numerically by filename. Use prefixes such as `01`, `02`, and `03`.

## Browser-Only PDFs

PDFs uploaded through the app are stored only in that browser. Use browser uploads for optional or quote-specific documents.
