export const config = {
  api: {
    bodyParser: false, // Required for raw file streams
  },
};

import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const busboy = Busboy({ headers: req.headers });
    let fileBuffer = null;
    let filename = null;

    let fields = {};

    busboy.on("file", (name, file, info) => {
      filename = info.filename;
      const buffers = [];

      file.on("data", (data) => buffers.push(data));
      file.on("end", () => {
        fileBuffer = Buffer.concat(buffers);
      });
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", async () => {
      if (!fileBuffer || !filename) {
        return res.status(400).json({ error: "Missing file" });
      }

      const email = fields.email || null;
      const title = fields.title || "Untitled";
      const name = fields.name || null;
      const age = fields.age ? parseInt(fields.age) : null;
      const sex = fields.sex || null;

      const filePath = `${Date.now()}-${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        return res.status(500).json({ error: "Upload failed" });
      }

      const { data: report, error: insertErr } = await supabase
        .from("reports")
        .insert({
          email,
          title,
          file_path: filePath,
          name,
          age,
          sex,
          ai_status: "processing",
        })
        .select()
        .single();

      if (insertErr) {
        console.error("Insert error:", insertErr);
        return res.status(500).json({ error: "Insert failed" });
      }

      return res.status(200).json({ success: true, id: report.id });
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("Crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
