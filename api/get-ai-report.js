// /api/get-ai-report.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const { createClient } = await import("@supabase/supabase-js");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("❌ Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  // SAFE: read-only ANON key
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("DB error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({
      ok: true,
      report: data,
    });
  } catch (e) {
    console.error("SERVER ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
}
