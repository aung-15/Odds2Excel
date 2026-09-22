require("dotenv").config();

const express = require("express");
const { extractOddsFromImage, parseDataUrl } = require("./lib/extract-odds");

const PORT = process.env.PORT || 8793;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

app.post("/api/extract", async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: "No screenshot uploaded." });
    }
    const { mediaType, base64 } = parseDataUrl(image);
    const result = await extractOddsFromImage(ANTHROPIC_API_KEY, base64, mediaType);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Odds to Excel running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY is not set — screenshot upload will fail until it is.");
  }
});
