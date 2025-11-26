// api/get-ai-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    // Fetch report by the REAL Supabase ID (uuid)
    const { data: rpt, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !rpt) {
      return res.status(404).json({ error: "Report not found" });
    }

    // Fix ai_results if it was stored as a STRING instead of JSON
    let aiJson = null;
    try {
      if (typeof rpt.ai_results === "string") {
        // Remove ```json formatting if present
        const cleaned = rpt.ai_results
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();

        aiJson = JSON.parse(cleaned);
      } else {
        aiJson = rpt.ai_results;
      }
    } catch (err) {
      aiJson = null;
    }

    // Fix CBC JSON
    let cbcJson = null;
    try {
      cbcJson =
        typeof rpt.cbc_json === "string"
          ? JSON.parse(rpt.cbc_json)
          : rpt.cbc_json;
    } catch {
      cbcJson = null;
    }

    return res.status(200).json({
      ok: true,
      report: {
        id: rpt.id,
        name: rpt.name || "",
        age: rpt.age || "",
        sex: rpt.sex || "",
        created_at: rpt.created_at,
        file_path: rpt.file_path,
        ai_status: rpt.ai_status,
        ai_results: aiJson,
        cbc_json: cbcJson,
      },
    });
  } catch (err) {
    console.error("get-ai-report failure:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
