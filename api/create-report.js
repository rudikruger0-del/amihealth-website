export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import FormData from "form-data";

// Init Supabase client (service role)
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
    // Read body
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

    if (!email || !files?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0];

    // 1️⃣ Save database record
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing",
      })
      .select()
      .single();

    if (insertErr) {
      console.error(insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;

    // 2️⃣ Download raw PDF
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("reports")
      .download(filePath);

    if (downloadErr) {
      console.error(downloadErr);
      return res.status(500).json({ error: "File download failed" });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    // 3️⃣ Send PDF to HuggingFace
    const formData = new FormData();
    formData.append("file", fileBuffer, filePath);
    formData.append("name", "Unknown");
    formData.append("age", "0");
    formData.append("sex", "Unknown");

    const aiResponse = await fetch(
      "https://amihealth-ami-blood-ai.hf.space/analyze",
      {
        method: "POST",
        body: formData,
      }
    );

    let aiJson;
    try {
      aiJson = await aiResponse.json();
    } catch {
      aiJson = { error: "Invalid AI response" };
    }

    // 4️⃣ Update database
    await supabase
      .from("reports")
      .update({
        ai_status: aiJson.error ? "failed" : "completed",
        ai_result: aiJson,
      })
      .eq("id", reportId);

    // 5️⃣ Return result
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
