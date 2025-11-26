import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }
};

// Supabase Admin Client
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

      // 🔥 FIX: Convert arrays → single string values
      const cleanEmail = Array.isArray(fields.email) ? fields.email[0] : fields.email;
      const cleanTitle = Array.isArray(fields.title) ? fields.title[0] : fields.title;
      const cleanName = Array.isArray(fields.name) ? fields.name[0] : fields.name;
      const cleanAge = Array.isArray(fields.age) ? fields.age[0] : fields.age;
      const cleanSex = Array.isArray(fields.sex) ? fields.sex[0] : fields.sex;

      const file = files.file?.[0];
      if (!file) return res.status(400).json({ error: "Missing file" });

      const buffer = fs.readFileSync(file.filepath);
      const filename = `${Date.now()}-${file.originalFilename}`;
      const filePath = filename.replace(/\s+/g, "_"); // Safe filename

      // 1️⃣ Upload file to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, buffer, {
          contentType: file.mimetype || "application/octet-stream",
        });

      if (uploadErr) {
        console.error(uploadErr);
        return res.status(500).json({ error: "Storage upload failed" });
      }

      // 2️⃣ Insert DB row
      const { data, error: dbErr } = await supabase
        .from("reports")
        .insert({
          email: cleanEmail,
          title: cleanTitle || "",
          name: cleanName || "",
          age: cleanAge ? Number(cleanAge) : null,
          sex: cleanSex || "Unknown",
          file_path: filePath,
          ai_status: "processing"
        })
        .select()
        .single();

      if (dbErr) {
        console.error(dbErr);
        return res.status(500).json({ error: "DB insert failed" });
      }

      const reportId = data.id;

      // 3️⃣ TRIGGER AI ENGINE ON RAILWAY
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/run-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: reportId,
            file_path: filePath
          })
        });
      } catch (aiErr) {
        console.error("AI trigger failed:", aiErr);
      }

      // 4️⃣ Return success to frontend
      return res.status(200).json({
        ok: true,
        report_id: reportId
      });
    });

  } catch (e) {
    console.error("CRASH:", e);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
