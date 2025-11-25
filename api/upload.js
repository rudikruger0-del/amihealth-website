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

    busboy.on("file", (fieldname, file, { filename: fname }) => {
      filename = fname;
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
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
          res.status(400).json({ error: "Missing file" });
          return;
        }

        const email = fields.email || null;
        const title = fields.title || "Untitled";
        const name = fields.name || null;
        const age = fields.age ? parseInt(fields.age) : null;
        const sex = fields.sex || null;

        const filePath = `${Date.now()}-${filename}`;

        // Upload to Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from("reports")
          .upload(filePath, fileBuffer, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadErr) {
          console.error("Upload error:", uploadErr);
          res.status(500).json({ error: "Upload failed" });
          return;
        }

        // Insert DB row
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
          res.status(500).json({ error: "Insert failed" });
          return;
        }

        res.status(200).json({ success: true, id: report.id });
      } catch (e) {
        console.error("BUSBOY FINISH ERROR:", e);
        res.status(500).json({ error: "Server error (finish)" });
      }
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("CRASH:", err);
    res.status(500).json({ error: "Server crashed" });
  }
}
