// api/create-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

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
    // ---- Read raw POST body (Vercel)
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
    if (!email || !files || !files.length) {
      return res.status(400).json({ error: "Missing fields (email/files)" });
    }

    const filePath = files[0];

    // 1️⃣ Insert DB Row
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing",
        name: name || null,
        age: age || null,
        sex: sex || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;
    console.log("✅ Created report row:", reportId, "file:", filePath);

    // 2️⃣ Create signed URL for private bucket
    const { data: signed, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(filePath, 1800); // 30 minutes

    if (signErr || !signed?.signedUrl) {
      console.error("❌ Signed URL error:", signErr);

      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: {
            error: "Could not create signed URL",
            details: signErr || null,
          },
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Failed to prepare file for AI" });
    }

    const fileUrl = signed.signedUrl;
    console.log("🔗 Signed URL:", fileUrl);

    // 3️⃣ Send to Hugging Face /run/predict
    let aiJson = null;

    try {
      const hfHeaders = {
        "Content-Type": "application/json",
      };

      // add HF token if your space is private
      if (process.env.HF_API_TOKEN) {
        hfHeaders.Authorization = `Bearer ${process.env.HF_API_TOKEN}`;
      }

      const hfResp = await fetch(
        "https://amihealth-ami-blood-ai.hf.space/run/predict",
        {
          method: "POST",
          headers: hfHeaders,
          body: JSON.stringify({ pdf_url: fileUrl }),
        }
      );

      const text = await hfResp.text();

      try {
        aiJson = JSON.parse(text);
      } catch {
        aiJson = { error: "HF returned non-JSON", raw: text };
      }

      if (!hfResp.ok) {
        aiJson.error = aiJson.error || `HF HTTP ${hfResp.status}`;
      }
    } catch (err) {
      console.error("❌ HF call failed:", err);
      aiJson = { error: "HuggingFace request failed", details: String(err) };
    }

    console.log("🤖 AI Result:", aiJson);

    const finalStatus = aiJson && !aiJson.error ? "completed" : "failed";

    // 4️⃣ Save AI results in Supabase
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

    // 5️⃣ Respond
    return res.status(200).json({
      success: true,
      id: reportId,
      status: finalStatus,
      ai: aiJson,
    });
  } catch (err) {
    console.error("💥 Server crash:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
