// api/get-ai-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ error: "Missing report id" });
    }

    // Get report row
    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !report) {
      return res.status(404).json({ error: "Report not found" });
    }

    // 🔥 Build consistent JSON for frontend
    return res.status(200).json({
      ok: true,
      report: {
        id: report.id,
        name: report.name,
        age: report.age,
        sex: report.sex,
        created_at: report.created_at,
        file_path: report.file_path,
        ai_status: report.ai_status,
        ai_results: report.ai_results || null,
        cbc_json: report.cbc_json || null
      },
      pdf_path: report.file_path
    });

  } catch (err) {
    console.error("get-ai-report crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
