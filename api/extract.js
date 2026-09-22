const { extractOddsFromImage, parseDataUrl } = require("../lib/extract-odds");

// The GitHub Pages origin allowed to call this API cross-origin.
// Update this if you publish the static site under a different username or repo path.
const ALLOWED_ORIGIN = "https://aung-15.github.io";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { image } = req.body || {};
    if (!image) {
      return res.status(400).json({ error: "No screenshot uploaded." });
    }
    const { mediaType, base64 } = parseDataUrl(image);
    const result = await extractOddsFromImage(process.env.ANTHROPIC_API_KEY, base64, mediaType);
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};
