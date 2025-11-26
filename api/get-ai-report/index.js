export default async function handler(req, res) {
  try {
    const reportId = req.query.id;

    if (!reportId) {
      return res.status(400).json({ ok: false, error: "Missing report ID" });
    }

    // Fetch from Supabase REST
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );

    const rows = await response.json();
    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Report not found" });
    }

    let report = rows[0];

    // ------------------------------------------------------
    // 🧠 CLEAN + PARSE AI RESULTS (handles broken strings)
    // ------------------------------------------------------
    if (typeof report.ai_results === "string") {
      let cleaned = report.ai_results.trim();

      // Remove accidental "AI_ERROR:" prefix
      if (cleaned.startsWith("AI_ERROR")) {
        cleaned = cleaned.replace("AI_ERROR:", "").trim();
      }

      // Remove backticks from Python outputs
      cleaned = cleaned.replace(/```json/g, "").replace(/```/g, "");

      // Ensure JSON starts with { and ends with }
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");

      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }

      try {
        report.ai_results = JSON.parse(cleaned);
      } catch (err) {
        console.error("💥 AI_RESULTS INVALID JSON:", err);
        report.ai_results = {
          summary: ["AI output was invalid or incomplete."],
          interpretation: [],
          flagged_results: [],
          risk_assessment: {},
          recommendations: [],
          cbc_values: {},
          doctor_report: "AI report could not be parsed.",
        };
      }
    }

    // ------------------------------------------------------
    // 🧠 CLEAN CBC JSON (optional)
    // ------------------------------------------------------
    if (typeof report.cbc_json === "string") {
      try {
        report.cbc_json = JSON.parse(report.cbc_json);
      } catch {
        report.cbc_json = {};
      }
    }

    return res.status(200).json({
      ok: true,
      report,
    });

  } catch (err) {
    console.error("GET-AI-REPORT SERVER ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: err.message,
    });
  }
}
