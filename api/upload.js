// api/upload-report.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable Next.js body parser:
export const config2 = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse multipart form (PDF + metadata)
    const form = formidable({ multiples: false });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) =>
        err ? reject(err) : resolve({ fields, files })
      );
    });

    const { user_id, email, name, age, sex, title } = fields;

    if (!user_id || !email) {
      return res.status(400).json({ error: "Missing user info" });
    }

    const file = files.file;
    if (!file) return res.status(400).json({ error: "Missing file" });

    // Read PDF/Image
    const fileBuffer = fs.readFileSync(file.filepath);

    // Create SAFE filename
    const extension = file.originalFilename.split(".").pop();
    const safeName =
      `${Date.now()}_${crypto.randomUUID()}.${extension}`.replace(/\s+/g, "_");

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("reports")
      .upload(safeName, fileBuffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      return res.status(500).json({ error: "Upload failed" });
    }

    // Create new report row
    const { data: insertData, error: insertError } = await supabase
      .from("reports")
      .insert({
        user_id,
        email,
        name: name || null,
        age: age || null,
        sex: sex || null,
        title: title || "Untitled Report",
        file_path: safeName, // 🔥 EXACT MATCH FOR STORAGE
        ai_status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Database insert failed:", insertError);
      return res.status(500).json({ error: "Database insert failed" });
    }

    // Trigger AI worker
    await fetch(`${process.env.WORKER_URL}/run-ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: insertData.id,
        file_path: safeName,
        email,
      }),
    }).catch((err) => console.error("AI trigger failed:", err));

    return res.status(200).json({
      ok: true,
      id: insertData.id,
      file_path: safeName,
      message: "Report uploaded successfully. AI processing started.",
    });
  } catch (err) {
    console.error("Upload crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
