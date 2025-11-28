// /api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

// MUST USE SERVICE ROLE KEY (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    if (!email) return res.status(400).json({ error: "Missing email" });

    // Validate file
    let file = files.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) return res.status(400).json({ error: "Missing file" });

    // --- 1) Create DB row with correct ai_status for worker ---
    const { data: row, error: rowErr } = await supabase
      .from("reports")
      .insert({
        email,
        title,
        name,
        age: ageRaw ? Number(ageRaw) : null,
        sex,
        ai_status: "pending" // <-- FIXED (worker listens for this)
      })
      .select()
      .single();

    if (rowErr) {
      console.error("DB insert failed:", rowErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = row.id;

    // --- 2) Upload PDF ---
    const buffer = fs.readFileSync(file.filepath);
    const storagePath = `${reportId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.mimetype || "application/pdf"
      });

    if (uploadErr) {
      console.error("Upload failed:", uploadErr);
      return res.status(500).json({ error: "Upload failed" });
    }

    // --- 3) Save file_path (required for worker) ---
    const { error: pathErr } = await supabase
      .from("reports")
      .update({ file_path: storagePath })
      .eq("id", reportId);

    if (pathErr) {
      console.error("Path update failed:", pathErr);
      return res.status(500).json({ error: "Failed to update file_path" });
    }

    return res.json({
      ok: true,
      report_id: reportId,
      file_path: storagePath,
      message: "Report uploaded & queued for AI."
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
