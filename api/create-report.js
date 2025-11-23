// api/create-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// ---------- Supabase (service role) ----------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      }
    }
  }
);

export default async function handler(req, res) {
  console.log("🔥 [create-report] HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw JSON (Vercel)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch (err) {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { email, title, files } = body;
    if (!email || !files?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0];

    // 1) Insert record
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing"
      })
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;

    // 2) Signed URL
    const { data: signed, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(filePath, 60 * 30);

    if (signErr || !signed?.signedUrl) {
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: "Could not create signed URL", details: signErr }
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Failed to prepare file for AI" });
    }

    const fileUrl = signed.signedUrl;

    // 3) Call Hugging Face backend
    let aiJson;
    try {
      const hfResp = await fetch(
        "https://amihealth-ami-blood-ai.hf.space/analyze",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: reportId,
            file_url: fileUrl,
            email,
            title: title || "Untitled Report",
            file_path: filePath
          })
        }
      );

      const text = await hfResp.text();
      try {
        aiJson = JSON.parse(text);
      } catch {
        aiJson = { error: "AI returned invalid JSON", raw: text };
      }

      if (!hfResp.ok) {
        aiJson.error = aiJson.error || `HF HTTP ${hfResp.status}`;
      }
    } catch (err) {
      aiJson = { error: "Failed to call Hugging Face", details: String(err) };
    }

    const finalStatus = aiJson && !aiJson.error ? "completed" : "failed";

    // 4) Update DB
    await supabase
      .from("reports")
      .update({
        ai_status: finalStatus,
        ai_results: aiJson
      })
      .eq("id", reportId);

    return res.status(200).json({
      success: true,
      id: reportId,
      status: finalStatus,
      ai: aiJson
    });
  } catch (err) {
    console.error("💥 Unhandled server error:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
