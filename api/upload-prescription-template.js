export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const { clinician_id, file_base64 } = req.body;

  if (!clinician_id || !file_base64) {
    return res.status(400).json({ error: "Missing payload fields" });
  }

  const workerUrl = process.env.AMI_WORKER_URL;

  const r = await fetch(`${workerUrl}/action/upload_prescription_template`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader
    },
    body: JSON.stringify({
      clinician_id,
      file_base64
    })
  });

  const data = await r.json();
  return res.status(r.status).json(data);
}
