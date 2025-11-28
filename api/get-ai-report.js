// /api/get-ai-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1) Get report ID
    const id = req.query.id;
    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    // 2) Create temporary auth client using ANON KEY
    const auth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    // Get user session from Authorization header
    const token = req.headers.authorization?.replace("Bearer ", "");
    const { data: userData } = await auth.auth.getUser(token);

    const user = userData?.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // 3) Create service role client (for RLS bypass)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 4) Fetch report
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

    // 5) Critical security check
    if (data.email !== user.email && data.user_id !== user.id) {
      console.warn("⛔ Unauthorized access attempt detected");
      return res.status(403).json({ error: "Access denied" });
    }

    // 6) All good
    return res.status(200).json({
      ok: true,
      report: data,
    });

  } catch (err) {
    console.error("❌ API crashed:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}
