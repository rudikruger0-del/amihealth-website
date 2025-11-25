// /api/upload.js
import { supabase } from "../lib/supabaseClient.js";

export default async function handler(req, res) {
  try {
    // Read raw body (important on Vercel)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (c) => (raw += c));
      req.on("end", resolve);
    });

    let body = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { email, title, name, age, sex, fileName, fileContent } = body;

    if (!email || !fileName || !fileContent) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const filePath = `${email}/${Date.now()}-${fileName}`;

    // Convert base64 → Blob
    const buffer = Buffer.from(fileContent, "base64");

    // Upload to Supabase storage
    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: false
      });

    if (uploadErr) {
      console.error("Upload failed:", uploadErr);
      return res.status(500).json({ error: "Upload failed" });
    }

    // Save DB row
    const { data: row, error: dbErr } = await supabase
      .from("reports")
      .insert({
        email,
        title,
        name,
        age,
        sex,
        file_path: filePath,
        ai_status: "processing",
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (dbErr) {
      console.error("Insert failed:", dbErr);
      return res.status(500).json({ error: "Insert failed" });
    }

    return res.status(200).json({
      success: true,
      message: "File uploaded & report created",
      reportId: row.id
    });

  } catch (err) {
    console.error("UPLOAD CRASH:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}
