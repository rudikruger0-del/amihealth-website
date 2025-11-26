export const config = {
  api: { bodyParser: false },
};

import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Form parse error:", err);
      return res.status(500).json({ error: "FORMIDABLE_PARSE_FAILED" });
    }

    try {
      const file = files.file;
      if (!file) return res.status(400).json({ error: "Missing file" });

      // Read file
      const fileBuffer = fs.readFileSync(file.filepath);
      const filename = `${Date.now()}-${file.originalFilename}`;

      // Upload to Supabase storage
      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filename, fileBuffer, {
          contentType: file.mimetype || "application/pdf",
        });

      if (uploadErr) {
        console.error("UPLOAD ERROR:", uploadErr);
        return res.status(500).json({ error: "UPLOAD_FAILED" });
      }

      // Insert DB record
      const { data: insertData, error: dbErr } = await supabase
        .from("reports")
        .insert({
          email: fields.email,
          title: fields.title || null,
          name: fields.name || null,
          age: fields.age ? parseInt(fields.age) : null,
          sex: fields.sex || null,
          file_path: filename,
          ai_status: "queued",
        })
        .select()
        .single(); // IMPORTANT — returns inserted row including id

      if (dbErr) {
        console.error("DB INSERT ERROR:", dbErr);
        return res.status(500).json({ error: "DB_INSERT_FAILED" });
      }

      // Return correct report ID
      return res.status(200).json({
        ok: true,
        report_id: insertData.id,
      });
    } catch (e) {
      console.error("SERVER CRASH:", e);
      return res.status(500).json({ error: "SERVER_CRASH" });
    }
  });
}
