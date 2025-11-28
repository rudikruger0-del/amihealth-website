// /api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // IMPORTANT FIX — needed for Vercel:
    const form = formidable({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 30 * 1024 * 1024,
      uploadDir: "/tmp",          // ← FIX (Vercel-compatible temp dir)
      filename: (name, ext, part) => {
        return Date.now() + "_" + part.originalFilename;
      }
    });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const clean = (v) => (Array.isArray(v) ? v[0] : v);

    const email = clean(fields.email);
    const title = clean(fields.title) || "Untitled report";
    const name = clean(fields.name) || null;
    const ageRaw = clean(fields.age);
    const sex = clean(fields.sex) || "Unknown";

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    let file = files.file;
    if (Array.isArray(file)) file = file[0];
    if (!file) {
      return res.status(400).json({ error: "Missing file" });
    }

    // 1️⃣ Create DB row
    const { data: newRow, error: rowErr } = await supabase
      .from("reports")
      .insert({
        email,
        title,
        name,
        age: ageRaw ? Number(ageRaw) : null,
        sex,
        ai_status: "queued",
      })
      .select()
      .single();

    if (rowErr) {
      console.error("DB insert failed:", rowErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = newRow.id;

    // Read uploaded file
    const buffer = fs.readFileSync(file.filepath);

    // 2️⃣ SAVE FILE INTO PRIVATE BUCKET (correct path)
    const storagePath = `reports/${reportId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.mimetype || "application/pdf",
      });

    if (uploadErr) {
      console.error("Storage upload failed:", uploadErr);
      return res.status(500).json({ error: "Storage upload failed" });
    }

    // 3️⃣ Update DB row with file_path
    await supabase
      .from("reports")
      .update({ file_path: storagePath })
      .eq("id", reportId);

    res.status(200).json({
      ok: true,
      report_id: reportId,
      file_path: storagePath,
      message: "Report uploaded and queued for AI.",
    });

  } catch (e) {
    console.error("UPLOAD SERVER_CRASH:", e);
    return res.status(500).json({ error: "SERVER_CRASH", detail: e.message });
  }
}
