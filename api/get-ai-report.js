// api/get-ai-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // ❗ FIX: Vercel Node functions do NOT support req.query
    const url = new URL(req.url, "http://localhost");
    const id = url.searchParams.get("id");

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    // Fetch report by Supabase UUID
    const { data: rpt, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !rpt) {
      return res.status(404).json({ error: "Report not found" });
    }

    // ---- Parse AI results safely ----
    let aiJson = null;
    try {
      if (typeof rpt.ai_results === "string") {
        const cleaned = rpt.ai_results
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        aiJson = JSON.parse(cleaned);
      } else {
        aiJson = rpt.ai_results;
      }
    } catch {
      aiJson = null;
    }

    // ---- Parse CBC JSON safely ----
    let cbcJson = null;
    try {
      cbcJson =
        typeof rpt.cbc_json === "string"
          ? JSON.parse(rpt.cbc_json)
          : rpt.cbc_json;
    } catch {
      cbcJson = null;
    }

    // ---- Return final structured report ----
    return res.status(200).json({
      ok: true,
      report: {
        id: rpt.id,
        title: rpt.title || "",
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
