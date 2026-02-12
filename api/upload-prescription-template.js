import formidable from "formidable";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

export const config = {
  api: {
    bodyParser: false, // Required for multipart
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const workerUrl = process.env.AMI_WORKER_URL;

  try {
    const form = formidable({
      multiples: false,
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(400).json({ error: "Invalid form data" });
      }

      const clinician_id = fields.clinician_id;
      const file = files.file;

      if (!clinician_id || !file) {
        return res.status(400).json({ error: "Missing fields" });
      }

      const formData = new FormData();
      formData.append("clinician_id", clinician_id);
      formData.append(
        "file",
        fs.createReadStream(file.filepath),
        file.originalFilename
      );

      const workerResponse = await fetch(
        `${workerUrl}/action/upload_prescription_template_file`,
        {
          method: "POST",
          headers: {
            Authorization: authHeader,
            ...formData.getHeaders(),
          },
          body: formData,
        }
      );

      const data = await workerResponse.json();

      return res.status(workerResponse.status).json(data);
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
}
