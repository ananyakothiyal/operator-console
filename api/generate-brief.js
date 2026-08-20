// api/generate-brief.js
// Vercel serverless function. Runs server-side only — your API keys never
// reach the browser. Reads ANTHROPIC_API_KEY, NOTION_TOKEN, and
// NOTION_DATABASE_ID from environment variables (set these in the Vercel
// dashboard, never in this file).

const MODES = {
  digest: {
    label: "Leadership digest",
    system:
      "You are an internal briefing assistant at InstaLILY, an AI company building 'InstaWorkers' and 'Lily', an AI Forward Deployed Engineer, for the physical goods economy: industrial distribution, healthcare, supply chain, manufacturing, and automotive. Turn messy raw input into a tight, decision-ready brief for company leadership. Respond in plain text using exactly this structure, each label alone on its own capitalized line:\n\nSITUATION\n(1-2 sentences of context)\n\nSIGNAL\n(3-5 short bullet points, most important first, each starting with a dash)\n\nSO WHAT\n(1-2 sentences on why this matters)\n\nRECOMMENDED ACTION\n(one clear, specific next step)\n\nKeep the whole thing under 150 words. Be direct. Cut anything not decision-relevant. No markdown asterisks.",
  },
  board: {
    label: "Board update",
    system:
      "You are an internal briefing assistant at InstaLILY, an AI company building 'InstaWorkers' and 'Lily', an AI Forward Deployed Engineer, for the physical goods economy. Turn messy raw input into a crisp board-ready update. Respond in plain text using exactly this structure, each label alone on its own capitalized line:\n\nHEADLINE\n(one line, the single most important takeaway)\n\nPROGRESS\n(2-3 short bullets of what moved or shipped, each starting with a dash)\n\nRISKS\n(1-2 short bullets of what could go wrong, each starting with a dash)\n\nASK\n(what, if anything, the board should weigh in on or approve)\n\nKeep the whole thing under 150 words. Be precise and unemotional. No markdown asterisks.",
  },
  townhall: {
    label: "Town hall talking points",
    system:
      "You are an internal communications assistant at InstaLILY, an AI company building 'InstaWorkers' and 'Lily', an AI Forward Deployed Engineer, for the physical goods economy. Turn messy raw input into short, energizing town hall talking points for the whole company, not just leadership. Respond in plain text using exactly this structure, each label alone on its own capitalized line:\n\nTHE HEADLINE\n(one line, what happened, in plain language)\n\nWHY IT MATTERS\n(1-2 sentences connecting it to the company's mission or momentum)\n\nTHE NUMBER\n(one concrete stat if one exists in the input, otherwise the clearest fact available)\n\nWHAT'S NEXT\n(1 sentence, forward-looking)\n\nKeep the whole thing under 120 words. Warm but not corporate. No markdown asterisks.",
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional access gate. If ACCESS_PASSCODE is set in your Vercel env vars,
  // every request must include the matching x-access-passcode header. If
  // it's not set, the app stays open to anyone with the link (original
  // behavior) — this is opt-in, not a breaking change.
  if (process.env.ACCESS_PASSCODE) {
    const provided = req.headers["x-access-passcode"];
    if (provided !== process.env.ACCESS_PASSCODE) {
      return res.status(401).json({ error: "Incorrect or missing access code." });
    }
  }

  const { mode, input } = req.body || {};

  if (!mode || !MODES[mode]) {
    return res.status(400).json({ error: "Invalid or missing 'mode'." });
  }
  if (!input || !String(input).trim()) {
    return res.status(400).json({ error: "Missing 'input' text." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY." });
  }

  try {
    // 1. Generate the brief with Claude
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: MODES[mode].system,
        messages: [{ role: "user", content: String(input) }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      throw new Error(`Claude API error (${claudeResponse.status}): ${errText}`);
    }

    const claudeData = await claudeResponse.json();
    const briefText = (claudeData.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!briefText) {
      throw new Error("Claude returned no text content.");
    }

    // 2. Push the brief into Notion, if credentials are configured.
    // This step is optional — the brief still returns to the browser
    // even if Notion isn't set up yet.
    let notionUrl = null;
    if (process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID) {
      try {
        const notionResponse = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify({
            parent: { database_id: process.env.NOTION_DATABASE_ID },
            properties: {
              Name: {
                title: [
                  {
                    text: {
                      content: `${MODES[mode].label} — ${new Date().toLocaleString()}`,
                    },
                  },
                ],
              },
              Mode: {
                select: { name: MODES[mode].label },
              },
            },
            children: briefText
              .split("\n")
              .filter((line) => line.trim().length > 0)
              .slice(0, 90) // Notion caps blocks per request; keep this well under it
              .map((line) => ({
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: line.slice(0, 2000) } }],
                },
              })),
          }),
        });

        if (notionResponse.ok) {
          const notionData = await notionResponse.json();
          notionUrl = notionData.url || null;
        } else {
          const errText = await notionResponse.text();
          console.error("Notion push failed:", errText);
        }
      } catch (notionErr) {
        console.error("Notion push threw an error:", notionErr);
      }
    }

    return res.status(200).json({ brief: briefText, notionUrl });
  } catch (err) {
    console.error("generate-brief error:", err);
    return res.status(500).json({ error: err.message || "Unknown server error." });
  }
}
