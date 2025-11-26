import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // required
  },
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
        console.error("Form error:", err);
        return res.status(500).json({ error: "Parsing failed" });
      }

      const file = files.file?.[0];
      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const fileBuffer = fs.readFileSync(file.filepath);
      const filePath = `${Date.now()}-${file.originalFilename}`;

      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, fileBuffer, {
          contentType: file.mimetype,
        });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        return res.status(500).json({ error: "Supabase upload failed" });
      }

      const { error: dbErr } = await supabase.from("reports").insert({
        email: fields.email?.[0] || null,
        title: fields.title?.[0] || null,
        name: fields.name?.[0] || null,
        age: fields.age?.[0] ? parseInt(fields.age[0]) : null,
        sex: fields.sex?.[0] || null,
        file_path: filePath,
        ai_status: "processing",
      });

      if (dbErr) {
        console.error("DB error:", dbErr);
        return res.status(500).json({ error: "DB insert failed" });
      }

      res.status(200).json({ ok: true, file: filePath });
    });
  } catch (e) {
    console.error("Crash:", e);
    res.status(500).json({ error: "Server crash" });
  }
}
