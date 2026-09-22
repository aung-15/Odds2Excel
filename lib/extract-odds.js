const MODEL = "claude-sonnet-5";

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

// Extracts structured odds data from a base64-encoded screenshot via Claude's vision API.
// Throws an Error with a message safe to surface to the caller.
async function extractOddsFromImage(apiKey, base64, mediaType) {
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Add it as an environment variable (locally in .env, " +
        "or in your hosting provider's dashboard) using a key from console.anthropic.com."
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      tools: [buildTool()],
      tool_choice: { type: "tool", name: "record_odds" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
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
    throw new Error(`Anthropic API error: ${errText}`);
  }

  const data = await response.json();
  const toolUse = (data.content || []).find((block) => block.type === "tool_use");
  if (!toolUse) {
    throw new Error("Model did not return structured odds data.");
  }

  return { matches: toolUse.input.matches || [] };
}

// Splits a "data:image/png;base64,AAAA..." string into its media type and raw base64 payload.
function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!match) {
    throw new Error("Expected a base64 data URL (e.g. data:image/png;base64,...).");
  }
  return { mediaType: match[1], base64: match[2] };
}

module.exports = { extractOddsFromImage, parseDataUrl };
