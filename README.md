# Odds to Excel

Paste odds text, type odds in manually, or upload a screenshot of a betting page — build a clean
table and export it as a `.xlsx` file.

## Setup (once)

```bash
cd odds-to-excel
npm install
cp .env.example .env
```

Open `.env` and add your own Anthropic API key (get one at https://console.anthropic.com):

```
ANTHROPIC_API_KEY=sk-ant-...
```

The key is only used server-side to read screenshots you upload — it's never exposed to the browser.

## Run it

```bash
npm start
```

Then open http://localhost:8793.

- **Paste text** or **type odds manually** works with no API key and no server needed (you can also
  just open `index.html` directly).
- **Upload screenshot** requires the server above to be running with `ANTHROPIC_API_KEY` set — it
  sends the image to Claude's vision API, which reads the table in the screenshot and fills in the
  match fields for you. Double-check the extracted numbers against the original screenshot before
  exporting — always verify before relying on any odds data for a bet.

## Publishing it live (GitHub Pages + Vercel)

GitHub Pages only serves static files, so it can host the frontend (paste/manual entry work there
with zero setup) but can't run `server.js`. To also make screenshot upload work on the published
site, the backend is deployed separately to Vercel as a serverless function
(`api/extract.js`), which the page calls across origins.

**Frontend — GitHub Pages** (already enabled for this repo):
Live at https://aung-15.github.io/Odds2Excel/ — updates automatically on every push to `main`.

**Backend — Vercel** (one-time setup, done in your own accounts, not by Claude):
1. Go to https://vercel.com and sign in with your GitHub account.
2. Click **Add New → Project**, import the `Odds2Excel` repo.
3. Before deploying, add an environment variable: `ANTHROPIC_API_KEY` = your key from
   https://console.anthropic.com. (Enter this yourself in Vercel's dashboard — never share it with
   anyone else, including in chat.)
4. Deploy. Vercel will give you a URL like `https://odds2excel.vercel.app`.
5. Open [script.js](script.js) and update the `DEPLOYED_API_URL` constant near the top to
   `https://<your-vercel-project>.vercel.app/api/extract`, then commit and push — GitHub Pages
   will pick up the change automatically.
6. If you ever publish the page under a different GitHub username or repo name, also update
   `ALLOWED_ORIGIN` in [api/extract.js](api/extract.js) to match, and redeploy on Vercel.

Screenshots can be a few MB; Vercel's request body limit is raised to 10MB in `api/extract.js`,
but very large/high-DPI screenshots may still need to be cropped or compressed first.
