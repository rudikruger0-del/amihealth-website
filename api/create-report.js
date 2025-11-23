export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";

// Supabase (service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    }
  }
);

export default async function handler(req, res) {
  console.log("🔥 create-report endpoint HIT");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ========== READ RAW BODY (REQUIRED FOR VERCEL) ==========
    let raw = "";
    await new Promise(resolve => {
      req.on("data", chunk => (raw += chunk));
      req.on("end", resolve);
    });

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { email, title, files } = body;
    if (!email || !files?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0];

    // ========== 1️⃣ INSERT NEW REPORT ==========
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
      console.error("❌ Insert error:", insertErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = inserted.id;

    // ========== 2️⃣ DOWNLOAD RAW PDF FROM SUPABASE ==========
    const { data: fileData, error: fileErr } = await supabase.storage
      .from("reports")
      .download(filePath);

    if (fileErr) {
      console.error("❌ File download error:", fileErr);
      return res.status(500).json({ error: "File download failed" });
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // ========== 3️⃣ SEND FILE TO AI ENGINE ==========
    const form = new FormData();
    form.append("file", buffer, filePath);
    form.append("name", "Unknown");
    form.append("age", "0");
    form.append("sex", "Unknown");

    let aiJson;
    try {
      const aiRes = await fetch("https://amihealth-ami-blood-ai.hf.space/analyze", {
        method: "POST",
        body: form
      });

      aiJson = await aiRes.json();
    } catch (e) {
      console.error("❌ AI request failed:", e);
      aiJson = { error: "AI engine did not respond" };
    }

    // ========== 4️⃣ UPDATE REPORT WITH AI RESULT ==========
    await supabase
      .from("reports")
      .update({
        ai_status: aiJson.error ? "failed" : "completed",
        ai_result: aiJson
      })
      .eq("id", reportId);

    // ========== 5️⃣ RETURN SUCCESS ==========
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson
    });

  } catch (err) {
    console.error("🔥 Server Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
