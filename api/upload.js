// /api/upload.js  — PERMANENT, SAFE VERSION
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: { bodyParser: false }, // required for formidable
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple, safe filename cleaner
function slugifyName(name = "report.pdf") {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-]+/g, "_") // keep letters, numbers, dot, dash
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

      // Normalize all fields
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

      const rawFile = Array.isArray(files.file)
        ? files.file[0]
        : files.file;

      if (!rawFile) {
        return res.status(400).json({ error: "Missing file" });
      }

      // 1️⃣ Build a SAFE storage path
      const originalName = rawFile.originalFilename || "report.pdf";
      const safeName = slugifyName(originalName);
      const timestamp = Date.now();

      // Our canonical pattern: 1732671234567_safe-name.pdf
      const storagePath = `${timestamp}_${safeName}`;

      // 2️⃣ Upload to Supabase storage
      const buffer = fs.readFileSync(rawFile.filepath);

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(storagePath, buffer, {
          contentType: rawFile.mimetype || "application/pdf",
        });

      if (uploadErr) {
        console.error("Storage upload failed:", uploadErr);
        return res.status(500).json({ error: "Storage upload failed" });
      }

      // 🔒 Use the ACTUAL path Supabase stored, not our guess
      const finalPath = uploadData?.path || storagePath;

      // 3️⃣ Insert DB record (reports table)
      const { data: row, error: dbErr } = await supabase
        .from("reports")
        .insert({
          email: cleanEmail,
          title: cleanTitle || "Untitled report",
          name: cleanName || null,
          age: cleanAge ? Number(cleanAge) : null,
          sex: cleanSex || "Unknown",
          file_path: finalPath,        // 👉 ALWAYS matches storage now
          ai_status: "queued",
        })
        .select()
        .single();

      if (dbErr) {
        console.error("DB insert failed:", dbErr);
        return res.status(500).json({ error: "DB insert failed" });
      }

      const reportId = row.id;

      // 4️⃣ Trigger your AI worker (Railway / FastAPI, etc.)
      const baseUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      try {
        await fetch(`${baseUrl}/api/run-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report_id: reportId,
            file_path: finalPath,
          }),
        });
      } catch (aiErr) {
        console.error("Failed to trigger AI:", aiErr);
        // We don't fail the upload; doctor can still view the PDF
      }

      // 5️⃣ Respond to browser
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
