// /api/finish-ai.js — SECURE AI COMPLETION ENDPOINT
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1️⃣ Internal-only authorization
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token || token !== INTERNAL_KEY) {
    console.warn("⛔ Unauthorized attempt to call finish-ai");
    return res.status(401).json({ error: "Not authorized" });
  }

  try {
    // 2️⃣ Parse raw json
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { id, ai_results } = body;

    if (!id || !ai_results) {
      return res.status(400).json({ error: "Missing id or ai_results" });
    }

    // 3️⃣ Save results
    const { error } = await supabase
      .from("reports")
      .update({
        ai_status: ai_results?.error ? "failed" : "completed",
        ai_results,
      })
      .eq("id", id);

    if (error) {
      console.error("❌ Update error:", error);
      return res.status(500).json({ error: "Failed to update report" });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("💥 finish-ai crashed:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
