// api/upload.js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
import crypto from "crypto";

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
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(400).json({ error: "Form parsing failed" });
      }

      const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
      const name = Array.isArray(fields.name) ? fields.name[0] : fields.name;
      const age = Array.isArray(fields.age) ? fields.age[0] : fields.age;
      const sex = Array.isArray(fields.sex) ? fields.sex[0] : fields.sex;
      const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;

      if (!email) return res.status(400).json({ error: "Missing email" });

      const file = files.file?.[0];
      if (!file) return res.status(400).json({ error: "Missing file" });

      // 1️⃣ SAFE FILENAME
      const ext = file.originalFilename.split(".").pop();
      const safeName = `${Date.now()}_${crypto.randomUUID()}.${ext}`;

      // Upload to Supabase Storage
      const buffer = fs.readFileSync(file.filepath);
      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(safeName, buffer, {
          contentType: file.mimetype || "application/pdf",
          upsert: false,
        });

      if (uploadErr) {
        console.error("Storage upload failed:", uploadErr);
        return res.status(500).json({ error: "Storage upload failed" });
      }

      // 2️⃣ Save record in DB
      const { data: dbInsert, error: dbErr } = await supabase
        .from("reports")
        .insert({
          email,
          name,
          age: age ? Number(age) : null,
          sex,
          title: title || "Untitled Report",
          file_path: safeName,
          ai_status: "pending",
        })
        .select()
        .single();

      if (dbErr) {
        console.error("DB insert error:", dbErr);
        return res.status(500).json({ error: "DB insert failed" });
      }

      // 3️⃣ Trigger AI Worker
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/run-ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: dbInsert.id,
            file_path: safeName,
            email,
          }),
        });
      } catch (err) {
        console.error("AI trigger error:", err);
      }

      // 4️⃣ Respond
      return res.status(200).json({
        ok: true,
        report_id: dbInsert.id,
        file_path: safeName,
      });
    });
  } catch (e) {
    console.error("UPLOAD SERVER ERROR:", e);
    return res.status(500).json({ error: "Server error" });
  }
}

