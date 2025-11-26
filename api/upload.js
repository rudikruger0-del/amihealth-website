import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
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

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(400).json({ error: "Form parsing failed" });
      }

      const file = files.file?.[0];
      if (!file) return res.status(400).json({ error: "Missing file" });

      const buffer = fs.readFileSync(file.filepath);
      const filename = `${Date.now()}-${file.originalFilename}`;
      const filePath = filename.replace(/\s+/g, "_");

      // Upload to Supabase storage
      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, buffer, {
          contentType: file.mimetype || "application/octet-stream",
        });

      if (uploadErr) {
        console.error(uploadErr);
        return res.status(500).json({ error: "Storage upload failed" });
      }

      // Insert database record
      const { data, error: dbErr } = await supabase
        .from("reports")
        .insert({
          email: fields.email || null,
          title: fields.title || null,
          name: fields.name || null,
          age: fields.age ? Number(fields.age) : null,
          sex: fields.sex || null,
          file_path: filePath,
          ai_status: "processing",
        })
        .select()
        .single();

      if (dbErr) {
        console.error(dbErr);
        return res.status(500).json({ error: "DB insert failed" });
      }

      return res.status(200).json({
        ok: true,
        report_id: data.id
      });
    });
  } catch (e) {
    console.error("CRASH:", e);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
