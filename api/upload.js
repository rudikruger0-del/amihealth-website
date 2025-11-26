// /api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }, // required for formidable
};

// Supabase admin client (SERVICE_ROLE_KEY so we can write to DB + storage)
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

      // 🔹 Normalise all fields to simple strings
      const cleanEmail = Array.isArray(fields.email)
        ? fields.email[0]
        : fields.email;
      const cleanTitle = Array.isArray(fields.title)
        ? fields.title[0]
        : fields.title;
      const cleanName = Array.isArray(fields.name)
        ? fields.name[0]
        : fields.name;
      const cleanAge = Array.isArray(fields.age) ? fields.age[0] : fields.age;
      const cleanSex = Array.isArray(fields.sex) ? fields.sex[0] : fields.sex;

      if (!cleanEmail) {
        return res.status(400).json({ error: "Missing email" });
      }

      const file = files.file?.[0];
      if (!file) {
        return res.status(400).json({ error: "Missing file" });
      }

      // ------------------------------
      // 1️⃣ Upload file to Supabase storage
      // ------------------------------
      const buffer = fs.readFileSync(file.filepath);
      const filename = `${Date.now()}-${file.originalFilename}`;
      const filePath = filename.replace(/\s+/g, "_");

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
      const { data, error: dbErr } = await supabase
        .from("reports")
        .insert({
          email: cleanEmail,
          title: cleanTitle || "Untitled report",
          name: cleanName || null,
          age: cleanAge ? Number(cleanAge) : null,
          sex: cleanSex || "Unknown",
          file_path: filePath,
          ai_status: "queued", // or "processing" if you prefer
        })
        .select()
        .single();

      if (dbErr) {
        console.error("DB insert failed:", dbErr);
        return res.status(500).json({ error: "DB insert failed" });
      }

      const reportId = data.id;

      // ------------------------------
      // 3️⃣ Trigger AI processor (run-ai.js)
      // ------------------------------
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      try {
        await fetch(`${baseUrl}/api/run-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: reportId,
            file_path: filePath,
          }),
        });
      } catch (aiErr) {
        console.error("Failed to trigger AI:", aiErr);
        // We don't fail the upload for this – doctor can still see the PDF
      }

      // ------------------------------
      // 4️⃣ Respond to browser
      // ------------------------------
      return res.status(200).json({
        ok: true,
        report_id: reportId,
      });
    });
  } catch (e) {
    console.error("UPLOAD SERVER_CRASH:", e);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
