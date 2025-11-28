// /api/create-report.js — SECURE, INTERNAL-ONLY ENDPOINT
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

// INTERNAL SERVER-TO-SERVER AUTH TOKEN
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

// SERVICE-ROLE Supabase client (backend only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  console.log("🔥 [create-report] HIT");

  // 1) BLOCK all non-POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 2) INTERNAL TOKEN CHECK
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || token !== INTERNAL_KEY) {
    console.warn("⛔ Unauthorized attempt to call create-report");
    return res.status(401).json({ error: "Not authorized" });
  }

  try {
    // 3) Parse POST body manually (Vercel)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let body = {};
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { user_id, file_path, title, name, age, sex } = body;

    if (!user_id || !file_path) {
      return res.status(400).json({ error: "Missing user_id or file_path" });
    }

    // 4) Fetch the user email (secure)
    const { data: user } = await supabase
      .from("users")
      .select("email")
      .eq("id", user_id)
      .single();

    if (!user) {
      return res.status(400).json({ error: "Invalid user_id" });
    }

    const email = user.email;

    // 5) Insert the report row
    const { data: row, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        user_id,
        title: title || "Untitled Report",
        file_path,
        name: name || null,
        age: age || null,
        sex: sex || null,
        ai_status: "processing",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    return res.status(200).json({
      ok: true,
      id: row.id,
      email,
      message: "Report created and queued for AI.",
    });

  } catch (err) {
    console.error("💥 create-report crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
