// /api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }, // required
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
    const form = formidable({ multiples: false });

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
    if (!file) return res.status(400).json({ error: "Missing file" });

    // ----------------------------
    // 1) Create row first
    // ----------------------------
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
      console.error(rowErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = newRow.id;

    // ----------------------------
    // 2) Convert PDF → Blob (WORKS)
    // ----------------------------
    const buffer = fs.readFileSync(file.filepath);
    const blob = new Blob([buffer], { type: file.mimetype });

    // ----------------------------
    // 3) Upload using BLOB (the correct method)
    // ----------------------------
    const storagePath = `${reportId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(storagePath, blob, { upsert: true });

    if (uploadErr) {
      console.error(uploadErr);
      return res.status(500).json({ error: "Storage upload failed" });
    }

    // ----------------------------
    // 4) Save file_path
    // ----------------------------
    await supabase
      .from("reports")
      .update({ file_path: storagePath })
      .eq("id", reportId);

    return res.status(200).json({
      ok: true,
      report_id: reportId,
      file_path: storagePath,
      message: "Report uploaded & queued.",
    });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
