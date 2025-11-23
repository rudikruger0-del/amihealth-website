// api/create-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";

// Supabase client (service role)
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
  console.log("🔥 create-report endpoint HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body (Vercel Node runtime)
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

    const filePath = files[0]; // first uploaded PDF

    // 1️⃣ Insert basic record in Supabase
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
      console.error("Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;
    console.log("✅ Report inserted with id:", reportId);

    // 2️⃣ Download the PDF from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("reports")
      .download(filePath);

    if (downloadErr) {
      console.error("Supabase download error:", downloadErr);
      // Mark as failed
      await supabase
        .from("reports")
        .update({ ai_status: "failed", ai_result: { error: "Storage download failed" } })
        .eq("id", reportId);
      return res.status(500).json({ error: "Failed to download file from storage" });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log("📄 Downloaded PDF size (bytes):", fileBuffer.length);

    // 3️⃣ Send PDF to Hugging Face AMI backend
    const formData = new FormData();
    formData.append("file", fileBuffer, {
      filename: filePath,
      contentType: "application/pdf"
    });
    // You can later pass real name/age/sex if you collect it
    formData.append("name", "Unknown");
    formData.append("age", "0");
    formData.append("sex", "Unknown");

    const hfUrl = "https://amihealth-ami-blood-ai.hf.space/analyze";
    console.log("🌐 Calling Hugging Face:", hfUrl);

    const aiResponse = await fetch(hfUrl, {
      method: "POST",
      body: formData
    });

    let aiJson;
    try {
      aiJson = await aiResponse.json();
    } catch (e) {
      console.error("AI JSON parse error:", e);
      aiJson = { status: "error", error: "Invalid AI response" };
    }

    console.log("🤖 AI result:", aiJson);

    // 4️⃣ Update Supabase with AI result
    await supabase
      .from("reports")
      .update({
        ai_status: aiJson && aiJson.status === "ok" ? "completed" : "failed",
        ai_result: aiJson
      })
      .eq("id", reportId);

    // 5️⃣ Respond to frontend
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson
    });
  } catch (err) {
    console.error("Server Error in create-report:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
