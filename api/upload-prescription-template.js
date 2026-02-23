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
    const { file_base64 } = req.body || {};

    if (!file_base64) {
      return res.status(400).json({ error: "Missing file_base64" });
    }

    const workerResponse = await fetch(
      `${workerUrl}/action/upload_prescription_template`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ file_base64 }),
      }
    );

    const data = await workerResponse.json();
    return res.status(workerResponse.status).json(data);
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ error: "Upload failed" });
  }
}
