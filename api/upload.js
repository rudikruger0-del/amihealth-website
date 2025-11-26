export const config = {
  api: { bodyParser: false },
};

// Use CommonJS require for Busboy (Vercel compatible)
const Busboy = require("busboy");

// ES import is fine for Supabase
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Missing service role key" });
  }

  try {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let filename = null;
    let fields = {};

    busboy.on("file", (field, file, info) => {
      filename = info.filename;
      const chunks = [];
      file.on("data", (chunk) => chunks.push(chunk));
      file.on("end", () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on("field", (name, val) => {
      fields[name] = val;
    });

    busboy.on("finish", async () => {
      if (!fileBuffer) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = `${Date.now()}-${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("reports")
        .upload(filePath, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        return res.status(500).json({ error: "Upload error" });
      }

      const { error: dbError } = await supabase.from("reports").insert({
        email: fields.email,
        title: fields.title || null,
        name: fields.name || null,
        age: fields.age ? parseInt(fields.age) : null,
        sex: fields.sex || null,
        file_path: filePath,
        ai_status: "processing",
      });

      if (dbError) {
        console.error(dbError);
        return res.status(500).json({ error: "DB insert error" });
      }

      return res.status(200).json({ ok: true });
    });

    req.pipe(busboy);
  } catch (err) {
    console.error("CRASH:", err);
    return res.status(500).json({ error: "Server crashed" });
  }
}
