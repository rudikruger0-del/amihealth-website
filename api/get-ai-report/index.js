export default async function handler(req, res) {
  try {
    const reportId = req.query.id;

    if (!reportId) {
      return res.status(400).json({ ok: false, error: "Missing report ID" });
    }

    // Fetch the report from Supabase
    const supabaseResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/reports?id=eq.${reportId}`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
      }
    );

    const rows = await supabaseResponse.json();

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: "Report not found" });
    }

    let report = rows[0];

    // FIX: Convert ai_results string → JSON
    if (typeof report.ai_results === "string") {
      try {
        report.ai_results = JSON.parse(report.ai_results);
      } catch {
        report.ai_results = {};
      }
    }

    // FIX: Convert cbc_json string → JSON
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

  } catch (error) {
    console.error("GET AI REPORT ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: error.message,
    });
  }
}
