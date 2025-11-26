// Disable body parser so Busboy can handle the stream
export const config = {
  api: { bodyParser: false },
};

import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";

// Create Supabase client (service role required for private bucket)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Main handler
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check env variables to avoid crashes
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Service role key missing on server" });
  }

  try {
    const busboy = new Busboy({ headers: req.headers });

    let fileBuffer = null;
    let filename = null;
    let fields = {};

    // Handle file upload
    busboy.on("file", (fieldname, file, info) => {
      filename = info.filename;
      const chunks = [];

      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    // Handle text fields
    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    // When upload finishes
    busboy.on("finish", async () => {
      try {
        if (!fileBuffer) {
          return res.status(400).json({ error: "Missing file" });
        }

        const filePath = `${Date.now()}-${filename}`;

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from("reports")
          .upload(filePath, fileBuffer, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadErr) {
          console.error(uploadErr);
          return res.status(500).json({ error: "Upload failed" });
        }

        // Insert into database
        const { error: dbErr } = await supabase.from("reports").insert({
          email: fields.email,
          title: fields.title || null,
          name: fields.name || null,
          age: fields.age ? parseInt(fields.age) : null,
          sex: fields.sex || null,
          file_path: filePath,
          ai_status: "processing",
        });

        if (dbErr) {
          console.error(dbErr);
          return res.status(500).json({ error: "DB insert failed" });
        }

        return res.status(200).json({ ok: true });
      } catch (err) {
        console.error("Internal crash:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("Crash:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}
