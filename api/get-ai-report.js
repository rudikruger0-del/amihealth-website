// /api/get-ai-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Read ID safely
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    // Check env
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anon) {
      console.error("❌ Missing Supabase environment variables");
      return res.status(500).json({ error: "Server env error" });
    }

    const supabase = createClient(url, anon);

    // Fetch row
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase GET error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({ ok: true, report: data });

  } catch (err) {
    console.error("❌ API Crash:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}

