// api/upload.js

export const config = {
  api: {
    bodyParser: false, // Required for raw uploads
  },
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
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "Form parsing failed" });
      }

      const file = files.file;
      if (!file) return res.status(400).json({ error: "File missing" });

      const buffer = fs.readFileSync(file.filepath);

      const filePath = `${Date.now()}-${file.originalFilename}`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, buffer, {
          contentType: file.mimetype,
        });

      if (uploadErr) {
        console.error("Supabase upload error:", uploadErr);
        return res.status(500).json({ error: "Upload failed" });
      }

      // Insert DB row
      const { data, error: insertErr } = await supabase
        .from("reports")
        .insert({
          email: fields.email || null,
          title: fields.title || "Untitled",
          file_path: filePath,
          name: fields.name || null,
          age: fields.age ? parseInt(fields.age) : null,
          sex: fields.sex || null,
          ai_status: "processing",
        })
        .select()
        .single();

      if (insertErr) {
        console.error("Insert failed:", insertErr);
        return res.status(500).json({ error: "Insert failed" });
      }

      return res.status(200).json({
        success: true,
        id: data.id,
      });
    } catch (e) {
      console.error("Final crash:", e);
      return res.status(500).json({ error: "Server crashed" });
    }
  });
}
