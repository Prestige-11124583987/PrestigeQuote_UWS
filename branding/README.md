# Quote Header Image

The Quote Tool uses `quote-header.png` as the company letterhead on every generated quote page and in the on-screen quote preview.

To replace it:

1. Replace `quote-header.png` in this folder.
2. Keep the filename exactly `quote-header.png`.
3. Commit and push the change to GitHub.
4. Let Render redeploy.

Recommended format:

- PNG
- Wide landscape layout (about 4:1 to 4.6:1)
- At least 1600 pixels wide
- White or transparent background

The app preserves the image's proportions and never crops it. If the file is missing or unreadable, the Quote Tool falls back to a text header so quote generation still works.
