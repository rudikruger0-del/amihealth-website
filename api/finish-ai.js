// api/finish-ai.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (body += chunk));
      req.on("end", resolve);
    });

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { id, ai_results } = data;

    if (!id || !ai_results) {
      return res.status(400).json({ error: "Missing id or ai_results" });
    }

    const { error } = await supabase
      .from("reports")
      .update({
        ai_status: "completed",
        ai_results
      })
      .eq("id", id);

    if (error) {
      console.error("Update error:", error);
      return res.status(500).json({ error: "Failed to update report" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("finish-ai crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
