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
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const busboy = Busboy({ headers: req.headers });

    let fileBuffer = null;
    let filename = null;
    const fields = {};

    busboy.on("file", (_name, file, info) => {
      filename = info.filename;
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
          return res.status(400).json({ error: "No file received" });
        }

        const { email, title, patient, age, sex } = fields;

        const safeTitle = title || "Untitled";
        const filePath = `${Date.now()}-${filename}`;

        // Upload file
        const { error: storageError } = await supabase.storage
          .from("reports")
          .upload(filePath, fileBuffer, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (storageError) {
          return res.status(500).json({ error: "Storage upload failed", details: storageError });
        }

        // Insert into DB
        const { data, error: dbError } = await supabase
          .from("reports")
          .insert({
            email,
            title: safeTitle,
            file_path: filePath,
            name: patient || null,
            age: age ? parseInt(age) : null,
            sex: sex || null,
            ai_status: "processing",
          })
          .select()
          .single();

        if (dbError) {
          return res.status(500).json({ error: "Database insert failed", details: dbError });
        }

        return res.status(200).json({ success: true, id: data.id });
      } catch (err) {
        return res.status(500).json({ error: "Upload handler crashed", details: err.message });
      }
    });

    req.pipe(busboy);
  } catch (error) {
    return res.status(500).json({ error: "Fatal server error", details: error.message });
  }
}
