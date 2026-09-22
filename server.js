require("dotenv").config();

const express = require("express");
const multer = require("multer");

const PORT = process.env.PORT || 8793;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-5";

const app = express();
app.use(express.static(__dirname));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error("Only PNG, JPEG, WEBP, or GIF screenshots are supported."));
    }
    cb(null, true);
  }
});

const ODDS_FIELD_SCHEMA = {
  w1: "Decimal odds for the home team to win the match (1X2 market).",
  draw: "Decimal odds for a draw (1X2 market).",
  w2: "Decimal odds for the away team to win the match (1X2 market).",
  over15: "Decimal odds for Over 1.5 total goals.",
  under15: "Decimal odds for Under 1.5 total goals.",
  over25: "Decimal odds for Over 2.5 total goals.",
  under25: "Decimal odds for Under 2.5 total goals.",
  over35: "Decimal odds for Over 3.5 total goals.",
  under35: "Decimal odds for Under 3.5 total goals.",
  bttsYes: "Decimal odds for Both Teams To Score - Yes.",
  bttsNo: "Decimal odds for Both Teams To Score - No."
};

function buildTool() {
  const properties = {
    home: { type: "string", description: "Home team name, if visible in the screenshot." },
    away: { type: "string", description: "Away team name, if visible in the screenshot." }
  };
  Object.entries(ODDS_FIELD_SCHEMA).forEach(([key, description]) => {
    properties[key] = { type: "number", description };
  });

  return {
    name: "record_odds",
    description:
      "Record the betting odds markets found in the screenshot, one entry per match. Only include fields whose value is actually visible in the image; omit anything not shown rather than guessing.",
    input_schema: {
      type: "object",
      properties: {
        matches: {
          type: "array",
          items: { type: "object", properties, required: ["home", "away"] }
        }
      },
      required: ["matches"]
    }
  };
}

app.post("/api/extract", (req, res) => {
  upload.single("screenshot")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({
        error:
          "ANTHROPIC_API_KEY is not set on the server. Copy .env.example to .env and add your key from console.anthropic.com."
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No screenshot uploaded." });
    }

    try {
      const base64 = req.file.buffer.toString("base64");
      const tool = buildTool();

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 2048,
          tools: [tool],
          tool_choice: { type: "tool", name: "record_odds" },
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: req.file.mimetype, data: base64 }
                },
                {
                  type: "text",
                  text:
                    "This is a screenshot of a sports betting odds page. Extract every match and market visible " +
                    "(match result 1X2, Over/Under 1.5/2.5/3.5 total goals, Both Teams To Score Yes/No) into the " +
                    "record_odds tool. Use decimal odds exactly as shown. If a market isn't visible, omit that field."
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(response.status).json({ error: `Anthropic API error: ${errText}` });
      }

      const data = await response.json();
      const toolUse = (data.content || []).find((block) => block.type === "tool_use");
      if (!toolUse) {
        return res.status(502).json({ error: "Model did not return structured odds data." });
      }

      res.json({ matches: toolUse.input.matches || [] });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Odds to Excel running at http://localhost:${PORT}`);
  if (!ANTHROPIC_API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY is not set — screenshot upload will fail until it is.");
  }
});
