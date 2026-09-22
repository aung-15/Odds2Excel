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
