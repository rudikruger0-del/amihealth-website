// api/upload.js
export const config = {
  api: { bodyParser: false }, // important for file uploads
};

import { createClient } from "@supabase/supabase-js";

// Supabase admin client (for uploading)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  }
);

// Read raw stream into a buffer
async function readStream(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse JSON from request
    const bodyText = (await readStream(req)).toString();
    let body = {};
    try {
      body = JSON.parse(bodyText);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { fileName, fileBase64 } = body;

    if (!fileName || !fileBase64) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // Decode base64 file
    const fileBuffer = Buffer.from(fileBase64, "base64");

    // Upload to Supabase Storage
    const filePath = `uploads/${Date.now()}-${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(filePath, fileBuffer, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return res.status(500).json({ error: "Failed to upload file" });
    }

    // DONE
    return res.status(200).json({
      success: true,
      file_path: filePath,
    });
  } catch (err) {
    console.error("UPLOAD CRASH:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}
