// /api/run-ai.js
import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs"
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 Your Railway AI endpoint (change if needed)
const AI_API_URL = "https://ami-blood-ai-docker-production.up.railway.app/run";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { report_id, file_path } = await req.body
      ? req.body
      : new Promise((resolve) => {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => resolve(JSON.parse(body)));
        });

    if (!report_id || !file_path) {
      return res.status(400).json({ error: "Missing report_id or file_path" });
    }

    // ------------------------------------------
    // 1️⃣ Get a signed URL for the PDF
    // ------------------------------------------
    const { data: signed, error: signedErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(file_path, 60 * 10); // valid 10 minutes

    if (signedErr || !signed) {
      console.error("Signed URL error:", signedErr);
      return res.status(500).json({ error: "Failed to sign PDF URL" });
    }

    const signedUrl = signed.signedUrl;

    // Mark status = running
    await supabase
      .from("reports")
      .update({ ai_status: "running" })
      .eq("id", report_id);

    // ------------------------------------------
    // 2️⃣ Send PDF to your AI engine on Railway
    // ------------------------------------------
    const aiResponse = await fetch(AI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_id,
        pdf_url: signedUrl,
      }),
    });

    const aiJson = await aiResponse.json();
    console.log("AI Response:", aiJson);

    // If AI failed
    if (!aiResponse.ok || aiJson.error) {
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: aiJson.error || "AI failed" },
        })
        .eq("id", report_id);

      return res.status(500).json({ error: "AI processing failed" });
    }

    // ------------------------------------------
    // 3️⃣ Save AI results back into Supabase
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
    return res.status(500).json({ error: "Server crash", details: String(err) });
  }
}
