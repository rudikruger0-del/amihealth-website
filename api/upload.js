export const config = {
  api: { bodyParser: false }
};

import { createClient } from "@supabase/supabase-js";
import Busboy from "busboy";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let filename = null;
    const fields = {};

    busboy.on("file", (field, file, info) => {
      filename = info.filename;
      const chunks = [];

      file.on("data", (c) => chunks.push(c));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("finish", async () => {
      if (!fileBuffer)
        return res.status(400).json({ error: "Missing file" });

      const filePath = `${Date.now()}-${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from("reports")
        .upload(filePath, fileBuffer, {
          contentType: "application/pdf"
        });

      if (uploadErr)
        return res.status(500).json({ error: "Upload failed", detail: uploadErr });

      const insert = await supabase.from("reports").insert({
        email: fields.email,
        title: fields.title || "",
        name: fields.name || "",
        age: fields.age ? Number(fields.age) : null,
        sex: fields.sex || "Unknown",
        file_path: filePath,
        ai_status: "queued"
      });

      if (insert.error)
        return res.status(500).json({ error: "Insert failed", detail: insert.error });

      return res.json({ success: true });
    });

    req.pipe(busboy);
  } catch (err) {
    return res.status(500).json({ error: "Server error", detail: err });
  }
}
