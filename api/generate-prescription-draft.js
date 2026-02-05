// api/generate-prescription-draft.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ----------------------------
    // Auth: reuse existing pattern
    // ----------------------------
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const token = authHeader.replace("Bearer ", "");

    // ----------------------------
    // Input
    // ----------------------------
    const { report_id } = req.body;
    if (!report_id) {
      return res.status(400).json({ error: "Missing report_id" });
    }

    // ----------------------------
    // Call ami-worker
    // ----------------------------
    const workerUrl = process.env.AMI_WORKER_URL;
    if (!workerUrl) {
      return res.status(500).json({ error: "Worker URL not configured" });
    }

    const workerRes = await fetch(`${workerUrl}/action/generate_prescription_draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        report_id
      })
    });

    if (!workerRes.ok) {
      const text = await workerRes.text();
      return res.status(500).json({
        error: "Worker error",
        details: text
      });
    }

    const data = await workerRes.json();

    return res.status(200).json(data);

  } catch (err) {
    console.error("generate-prescription-draft error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
