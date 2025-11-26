import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "nodejs",
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const { report_id, file_path } = req.body;
    if (!report_id || !file_path)
      return res.status(400).json({ error: "Missing params" });

    // Build public PDF URL
    const pdf_url =
      `${process.env.SUPABASE_URL}/storage/v1/object/public/reports/${file_path}`;

    // Call your AI engine on Railway
    const aiResp = await fetch(
      "https://ami-blood-ai-docker-production.up.railway.app/run",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_url,
          report_id,
        }),
      }
    );

    const aiData = await aiResp.json();

    if (!aiResp.ok) {
      console.error("AI ERROR:", aiData);
      return res.status(500).json({ error: "AI service failed" });
    }

    // Update Supabase with AI results
    await supabase
      .from("reports")
      .update({
        ai_status: "done",
        ai_results: aiData.ai_results || {}
      })
      .eq("id", report_id);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("RUN-AI CRASH:", err);
    return res.status(500).json({ error: "SERVER CRASH" });
  }
}
