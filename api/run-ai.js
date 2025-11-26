// /api/run-ai.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import { runAI } from "../runAI.js"; // adjust path if runAI.js is elsewhere

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Manual body read (like your other APIs)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const reportId = body.id || body.report_id;
    if (!reportId) {
      return res.status(400).json({ error: "Missing report id" });
    }

    // 1️⃣ Load report from Supabase
    const { data: rpt, error: rptErr } = await supabase
      .from("reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (rptErr || !rpt) {
      console.error("Report lookup failed:", rptErr);
      return res.status(404).json({ error: "Report not found" });
    }

    const pdfBase64 = body.pdf_base64 || rpt.pdf_base64 || "";
    const extractedText = body.extracted_text || rpt.extracted_text || "";

    if (!extractedText && !pdfBase64) {
      return res.status(400).json({ error: "Missing extractedText/pdfBase64" });
    }

    // 2️⃣ Call AMI AI engine (runAI.js)
    const aiRaw = await runAI(pdfBase64, extractedText);

    // 3️⃣ Parse AI JSON safely
    let aiParsed = null;
    if (typeof aiRaw === "string") {
      try {
        aiParsed = JSON.parse(aiRaw);
      } catch {
        aiParsed = { raw: aiRaw };
      }
    } else {
      aiParsed = aiRaw;
    }

    const cbcJson = aiParsed?.cbc_values || null;

    // 4️⃣ Save back into Supabase
    const { error: updateErr } = await supabase
      .from("reports")
      .update({
        ai_status: "completed",
        ai_results: aiParsed,
        cbc_json: cbcJson
      })
      .eq("id", reportId);

    if (updateErr) {
      console.error("AI update failed:", updateErr);
      return res.status(500).json({ error: "Failed to save AI results" });
    }

    return res.status(200).json({
      ok: true,
      id: reportId,
      ai_results: aiParsed
    });
  } catch (err) {
    console.error("run-ai API crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
