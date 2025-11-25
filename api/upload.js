export const config = {
  api: { bodyParser: false },
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
      const chunks = [];
      file.on("data", (c) => chunks.push(c));
      file.on("end", () => (fileBuffer = Buffer.concat(chunks)));
    });

    busboy.on("field", (name, val) => {
      fields[name] = val;
    });

    busboy.on("finish", async () => {
      if (!fileBuffer) return res.status(400).json({ error: "Missing file" });

      const filePath = Date.now() + "-" + filename;

      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, fileBuffer, {
          contentType: "application/pdf",
        });

      if (uploadErr) return res.status(500).json({ error: "Upload failed" });

      const { error: dbErr } = await supabase.from("reports").insert({
        email: fields.email,
        title: fields.title || null,
        name: fields.name || null,
        age: fields.age ? parseInt(fields.age) : null,
        sex: fields.sex || null,
        file_path: filePath,
        ai_status: "processing",
      });

      if (dbErr) return res.status(500).json({ error: "DB insert failed" });

      res.status(200).json({ ok: true });
    });

    req.pipe(busboy);
  } catch (e) {
    res.status(500).json({ error: "Server crashed" });
  }
}
