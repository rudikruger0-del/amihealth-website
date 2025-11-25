export const config = {
  api: {
    bodyParser: false,
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
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let filename = null;
    let fields = {};

    busboy.on("file", (_name, file, info) => {
      filename = info.filename;
      const chunks = [];

      file.on("data", chunk => chunks.push(chunk));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", async () => {
      try {
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
          });

        if (uploadErr) {
          console.error("Upload error:", uploadErr);
          return res.status(500).json({ error: "Upload failed", details: uploadErr });
        }

        const { data, error: insertErr } = await supabase
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
          return res.status(500).json({ error: "Insert failed", details: insertErr });
        }

        return res.status(200).json({
          success: true,
          id: data.id,
        });

      } catch (err) {
        console.error("Finish error:", err);
        return res.status(500).json({ error: "Internal error", details: err.message });
      }
    });

    req.pipe(busboy);

  } catch (err) {
    console.error("Crash:", err);
    return res.status(500).json({ error: "Server crash", details: err.message });
  }
}
