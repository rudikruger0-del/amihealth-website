// /api/run-ai.js
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 Correct endpoint based on your logs:
const AI_API_URL = "https://ami-blood-ai-docker-production.up.railway.app/run/predict-upload";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      req.body ||
      (await new Promise((resolve) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => resolve(JSON.parse(raw)));
      }));

    const { report_id, file_path } = body;

    if (!report_id || !file_path) {
      return res.status(400).json({ error: "Missing report_id or file_path" });
    }

    // 1️⃣ Create signed URL for PDF
    const { data: signed, error: signedErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(file_path, 600);

    if (signedErr || !signed) {
      console.error("Signed URL error:", signedErr);
      return res.status(500).json({ error: "Failed to sign PDF URL" });
    }

    const signedUrl = signed.signedUrl;

    // Mark as running
    await supabase.from("reports").update({
      ai_status: "running"
    }).eq("id", report_id);

    // 2️⃣ Send PDF to your AI
    const aiResponse = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_id,
        pdf_url: signedUrl,
      }),
    });

    let aiJson;
    try {
      aiJson = await aiResponse.json();
    } catch (err) {
      console.error("AI returned non-JSON:", err);
      throw new Error("Invalid AI response");
    }

    console.log("AI Response:", aiJson);

    // AI error?
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

    // 3️⃣ Save AI results
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
