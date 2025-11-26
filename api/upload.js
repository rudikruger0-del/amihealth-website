// /api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }, // required for formidable
};

// Supabase admin client (SERVICE ROLE KEY)
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

    // Wrap formidable in a Promise so we can use async/await
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // --- Normalise fields to plain strings ---
    const clean = (v) => (Array.isArray(v) ? v[0] : v);

    const email = clean(fields.email);
    const title = clean(fields.title) || "Untitled report";
    const name = clean(fields.name) || null;
    const ageRaw = clean(fields.age);
    const sex = clean(fields.sex) || "Unknown";

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    // --- Get the uploaded file ---
    let file = files.file;
    if (Array.isArray(file)) file = file[0];

    if (!file) {
      return res.status(400).json({ error: "Missing file" });
    }

    // ------------------------------
    // 1️⃣ Upload file to Supabase storage
    // ------------------------------
    const buffer = fs.readFileSync(file.filepath);
    const safeName = file.originalFilename.replace(/\s+/g, "_");
    const filename = `${Date.now()}_${safeName}`;
    const filePath = filename; // no folders, just flat in "reports" bucket

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(filePath, buffer, {
        contentType: file.mimetype || "application/pdf",
      });

    if (uploadErr) {
      console.error("Storage upload failed:", uploadErr);
      return res.status(500).json({ error: "Storage upload failed" });
    }

    // ------------------------------
    // 2️⃣ Insert DB record in reports table
    // ------------------------------
    const age =
      ageRaw && `${ageRaw}`.trim() !== ""
        ? Number(`${ageRaw}`.trim())
        : null;

    const { data, error: dbErr } = await supabase
      .from("reports")
      .insert({
        email,
        title,
        name,
        age,
        sex,
        file_path: filePath,
        ai_status: "queued", // Python worker will process this
      })
      .select()
      .single();

    if (dbErr) {
      console.error("DB insert failed:", dbErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = data.id;

    // ⚠️ IMPORTANT:
    // No more /api/run-ai call here.
    // The Railway worker polls for ai_status = 'queued' and does:
    //  - download PDF
    //  - extract text with PyMuPDF
    //  - call OpenAI
    //  - update ai_results + cbc_json + ai_status = 'completed' / 'failed'

    return res.status(200).json({
      ok: true,
      report_id: reportId,
      file_path: filePath,
      message: "Report uploaded and queued for AI.",
    });
  } catch (e) {
    console.error("UPLOAD SERVER_CRASH:", e);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
