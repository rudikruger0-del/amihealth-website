export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  console.log("[upload-prescription-template] typeof req.body:", typeof req.body);

  let body = req.body;

  if (body == null) {
    body = {};

    if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body);
      } catch (error) {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    }
  } else if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { file_base64 } = body;

  console.log(
    "[upload-prescription-template] file_base64 exists:",
    Boolean(file_base64)
  );

  if (!file_base64) {
    return res.status(400).json({ error: "Missing file_base64" });
  }

  const workerUrl = process.env.AMI_WORKER_URL;

  const workerResponse = await fetch(
    `${workerUrl}/action/upload_prescription_template`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ pdf_base64: file_base64 }),
    }
  );

  console.log(
    "[upload-prescription-template] worker response status:",
    workerResponse.status
  );

  const data = await workerResponse.json();
  return res.status(workerResponse.status).json(data);
}
