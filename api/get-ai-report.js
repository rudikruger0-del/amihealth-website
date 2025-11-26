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
      return res.status(400).json({ error: "Missing report ID" });
    }

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("get-ai-report error:", error);
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({
      report: {
        id: data.id,
        email: data.email,
        file_path: data.file_path,
        created_at: data.created_at,
        name: data.name,
        age: data.age,
        sex: data.sex,

        // AI output
        ai_results: data.ai_results || null,
        cbc_json: data.cbc_json || {},

        // status
        ai_status: data.ai_status,
      },
    });
  } catch (err) {
    console.error("get-ai-report crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
