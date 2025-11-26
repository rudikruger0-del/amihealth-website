// /api/run-ai.js
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs"
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// IMPORTANT: Your Railway AI endpoint DOES NOT have /run
// It accepts POST at the root ("/")
const AI_API_URL = "https://ami-blood-ai-docker-production.up.railway.app/";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || await new Promise((resolve) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => resolve(JSON.parse(raw)));
    });

    const { report_id, file_path } = body;

    if (!report_id || !file_path) {
      return res.status(400).json({ error: "Missing report_id or file_path" });
    }

    // ------------------------------------------
    // 1️⃣ Create a signed Supabase URL for the PDF
    // ------------------------------------------
    const { data: signed, error: signedErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(file_path, 600); // 10 min

    if (signedErr || !signed) {
      console.error("Signed URL error:", signedErr);
      return res.status(500).json({ error: "Failed to sign PDF URL" });
    }

    const signedUrl = signed.signedUrl;

    // Mark as running
    await supabase
      .from("reports")
      .update({ ai_status: "running" })
      .eq("id", report_id);

    // ------------------------------------------
    // 2️⃣ Send PDF URL to the Railway Flask AI server
    // ------------------------------------------
    const aiResponse = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_id,
        pdf_url: signedUrl,
      })
    }).catch((e) => {
      throw new Error("Railway fetch failed: " + e);
    });

    let aiJson;
    try {
      aiJson = await aiResponse.json();
    } catch (e) {
      console.error("AI JSON parse error:", e);
      throw new Error("AI returned non-JSON response");
    }

    console.log("AI Response received:", aiJson);

    // ------------------------------------------
    // 3️⃣ If AI responded with error
    // ------------------------------------------
    if (!aiResponse.ok || aiJson.error) {
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: aiJson.error || "AI failed" },
        })
        .eq("id", report_id);

      return res.status(500).json({ error: "AI failed", details: aiJson });
    }

    // ------------------------------------------
    // 4️⃣ Save results
    // ------------------------------------------
    await supabase
      .from("reports")
      .update({
        ai_status: "complete",
        ai_results: aiJson.results || aiJson,
      })
      .eq("id", report_id);

    return res.status(200).json({ ok: true, results: aiJson });

  } catch (err) {
    console.error("run-ai.js crash:", err);

    return res.status(500).json({
      error: "Server crash in run-ai",
      details: String(err),
    });
  }
}
