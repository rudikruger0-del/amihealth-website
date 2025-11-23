// api/create-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// Service-role client (SERVER ONLY)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  }
);

export default async function handler(req, res) {
  console.log("🔥 [create-report] HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // --- read body manually (Vercel edge-safe) ---
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

    const { email, title, files, name, age, sex } = body;

    if (!email || !files?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0]; // e.g. "1763906458667_Z_TALJAARD.pdf"

    // --- 1) Insert report row ---
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;
    console.log("✅ Created report row:", reportId, "file:", filePath);

    // --- 2) Signed URL for Supabase PDF ---
    const { data: signed, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(filePath, 60 * 60); // 1 hour

    if (signErr || !signed?.signedUrl) {
      console.error("❌ Signed URL error:", signErr);
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: "Could not create signed URL", details: signErr },
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Failed to prepare file for AI" });
    }

    const fileUrl = signed.signedUrl;
    console.log("🔗 Signed file URL for AI:", fileUrl);

    // --- 3) Call Hugging Face JSON endpoint ---
    let aiJson = null;
    try {
      const hfResp = await fetch(
        "https://amihealth-ami-blood-ai.hf.space/analyze-json",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: reportId,
            file_url: fileUrl,
            file_path: filePath,
            email,
            title: title || "Untitled Report",
            name: name || "Unknown",
            age: age || 0,
            sex: sex || "Unknown",
          }),
        }
      );

      const text = await hfResp.text();
      try {
        aiJson = JSON.parse(text);
      } catch {
        aiJson = { status: "error", error: "AI response not valid JSON", raw: text };
      }

      if (!hfResp.ok && !aiJson.error) {
        aiJson.error = `HF HTTP ${hfResp.status}`;
      }
    } catch (err) {
      console.error("❌ Error calling Hugging Face:", err);
      aiJson = { status: "error", error: "Failed to call Hugging Face", details: String(err) };
    }

    console.log("🤖 AI JSON:", aiJson);

    const finalStatus =
      aiJson && !aiJson.error && aiJson.status === "ok" ? "completed" : "failed";

    // --- 4) Update DB with AI result ---
    const { error: updateErr } = await supabase
      .from("reports")
      .update({
        ai_status: finalStatus,
        ai_results: aiJson,
      })
      .eq("id", reportId);

    if (updateErr) {
      console.error("❌ Supabase update error:", updateErr);
    }

    // --- 5) Send response back to browser ---
    return res.status(200).json({
      success: true,
      id: reportId,
      status: finalStatus,
      ai: aiJson,
    });
  } catch (err) {
    console.error("💥 Unhandled server error:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
