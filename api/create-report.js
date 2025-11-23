// api/create-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";

// Supabase (service role) – make sure these env vars are set in Vercel
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
  console.log("🔥 create-report endpoint HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Manually read raw JSON body (Vercel)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { email, title, files } = data;

    if (!email || !files || !files.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0]; // only first file for now
    console.log("📄 Received filePath from frontend:", filePath);

    // 1️⃣ Insert basic record into Supabase
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing",
        ai_results: null, // <— IMPORTANT: matches Supabase column name
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;
    console.log("✅ Report row created with id:", reportId);

    // 2️⃣ Download raw file bytes from Supabase storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("reports")
      .download(filePath);

    if (downloadErr) {
      console.error("Supabase download error:", downloadErr);
      // Mark as failed
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: "Failed to download file from storage" },
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Failed to download file" });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log("📄 Downloaded file size (bytes):", fileBuffer.length);

    // 3️⃣ Send PDF/image to Hugging Face AMI backend
    let aiJson;
    try {
      const formData = new FormData();
      formData.append("file", fileBuffer, filePath);
      formData.append("name", email || "Unknown");
      formData.append("age", "0");
      formData.append("sex", "Unknown");

      const aiResponse = await fetch(
        "https://amihealth-ami-blood-ai.hf.space/analyze",
        {
          method: "POST",
          body: formData,
        }
      );

      const text = await aiResponse.text();
      try {
        aiJson = JSON.parse(text);
      } catch {
        aiJson = {
          error: "AI did not return valid JSON",
          raw: text,
          status: aiResponse.status,
        };
      }
    } catch (e) {
      console.error("AI call error:", e);
      aiJson = { error: "Failed to call AI backend" };
    }

    console.log("🤖 AI Response JSON:", aiJson);

    // Decide status
    const finalStatus = aiJson && !aiJson.error ? "completed" : "failed";

    // 4️⃣ Update record with AI result (NOTE: ai_results)
    await supabase
      .from("reports")
      .update({
        ai_status: finalStatus,
        ai_results: aiJson,
      })
      .eq("id", reportId);

    // 5️⃣ Reply to frontend
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson,
    });
  } catch (err) {
    console.error("Server Error in create-report:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
