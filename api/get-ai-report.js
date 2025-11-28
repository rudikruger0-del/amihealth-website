// /api/get-ai-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Get report ID
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    // --- IMPORTANT ---
    // When RLS is enabled, ANON cannot read ANY rows.
    // Service role can bypass RLS securely.
    const SUPABASE_URL =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;

    const SERVICE_ROLE =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error("❌ Missing Supabase environment variables");
      return res.status(500).json({ error: "Server misconfiguration" });
    }

    // Create Supabase client WITH SERVICE ROLE KEY (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch report by ID
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("❌ Supabase error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({
      ok: true,
      report: data,
    });

  } catch (err) {
    console.error("❌ API crashed:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}
