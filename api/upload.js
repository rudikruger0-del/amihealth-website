// /api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

// --- ENVIRONMENT SAFETY ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment");
}

// SERVER-SIDE ONLY: service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({ multiples: false });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const clean = (v) => (Array.isArray(v) ? v[0] : v);

    const email = clean(fields.email);
    const title = clean(fields.title) || "Untitled Report";
    const name = clean(fields.name) || null;
    const ageRaw = clean(fields.age);
    const sex = clean(fields.sex) || "Unknown";

    if (!email) {
      console.warn("Upload blocked: missing email");
      return res.status(400).json({ error: "Missing email" });
    }

    let file = files.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) {
      console.warn("Upload blocked: missing file");
      return res.status(400).json({ error: "Missing file" });
    }

    // --- 1) Create DB row with ai_status = 'pending' so worker can pick it up ---
    const { data: row, error: rowErr } = await supabase
      .from("reports")
      .insert({
        email,
        title,
        name,
        age: ageRaw ? Number(ageRaw) : null,
        sex,
        ai_status: "pending", // <-- worker watches for this
      })
      .select()
      .single();

    if (rowErr) {
      console.error("❌ DB insert failed:", rowErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = row.id;

    // --- 2) Upload PDF to bucket 'reports' at path '<id>.pdf' ---
    const buffer = fs.readFileSync(file.filepath);
    const storagePath = `${reportId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.mimetype || "application/pdf",
      });

    if (uploadErr) {
      console.error("❌ Storage upload failed:", uploadErr);

      // mark this report as failed so you can see it in the dashboard
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_error: "Storage upload failed",
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Upload failed" });
    }

    // --- 3) Save file_path so the worker knows where to fetch it ---
    const { error: pathErr } = await supabase
      .from("reports")
      .update({ file_path: storagePath })
      .eq("id", reportId);

    if (pathErr) {
      console.error("❌ file_path update failed:", pathErr);

      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_error: "Failed to update file_path",
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Failed to update file_path" });
    }

    // SUCCESS PATH
    console.log("✅ Upload OK, report queued:", reportId, storagePath);

    return res.status(200).json({
      ok: true,
      report_id: reportId,
      file_path: storagePath,
      message: "Report uploaded & queued for AI.",
    });
  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
