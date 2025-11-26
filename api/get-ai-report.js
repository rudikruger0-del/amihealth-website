export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    const { id } = req.query;

    console.log("Incoming ID:", id);

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const { data: rpt, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !rpt) {
      return res.status(404).json({ error: "Report not found" });
    }

    // CLEAN AI JSON
    let ai = null;
    try {
      if (typeof rpt.ai_results === "string") {
        ai = JSON.parse(
          rpt.ai_results
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim()
        );
      } else {
        ai = rpt.ai_results;
      }
    } catch {
      ai = null;
    }

    // CLEAN CBC JSON
    let cbc = null;
    try {
      cbc = typeof rpt.cbc_json === "string"
        ? JSON.parse(rpt.cbc_json)
        : rpt.cbc_json;
    } catch {
      cbc = null;
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
        ai_results: ai,
        cbc_json: cbc,
      },
    });

  } catch (err) {
    console.error("get-ai-report error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
