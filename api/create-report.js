export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

// Native Node18+ fetch & FormData
// ✔ available automatically on Vercel
// No imports needed for fetch, FormData, Blob

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
  console.log("🔥 create-report HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse raw body (Vercel requirement)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "Invalid JSON received" });
    }

    const { email, title, files } = data;

    if (!email || !files?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0];

    // 1️⃣ Insert database record
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
      console.error("❌ DB Insert Error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;

    // 2️⃣ Download file from Supabase Storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("reports")
      .download(filePath);

    if (downloadErr) {
      console.error("❌ File download error:", downloadErr);
      return res.status(500).json({ error: "Failed to download file" });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    // 3️⃣ Send file to HuggingFace API (your AMI model)
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), filePath);
    formData.append("name", "Unknown");
    formData.append("age", "0");
    formData.append("sex", "Unknown");

    const aiResponse = await fetch(
      "https://amihealth-ami-blood-ai.hf.space/analyze",
      { method: "POST", body: formData }
    );

    let aiJson;
    try {
      aiJson = await aiResponse.json();
    } catch (e) {
      aiJson = { error: "Invalid AI response format" };
    }

    // 4️⃣ Update database with results
    const { error: updateErr } = await supabase
      .from("reports")
      .update({
        ai_status: aiJson.error ? "failed" : "completed",
        ai_results: aiJson, // <-- CORRECT COLUMN NAME
      })
      .eq("id", reportId);

    if (updateErr) {
      console.error("❌ DB Update Error:", updateErr);
      return res.status(500).json({ error: "Failed to update AI results" });
    }

    // 5️⃣ Success!
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson,
    });

  } catch (err) {
    console.error("🔥 SERVER ERROR:", err);
    return res.status(500).json({ error: "Server-side error" });
  }
}
