import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Missing auth token" });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const { report_id, prescription_text } = req.body || {};

    if (!report_id) {
      return res.status(400).json({ error: "Missing report_id" });
    }

    if (!prescription_text || !prescription_text.trim()) {
      return res.status(400).json({ error: "Missing prescription_text" });
    }

    const workerResponse = await fetch(
      `${process.env.AMI_WORKER_URL}/action/prescription_submit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_id,
          prescription_text,
        }),
      }
    );

    const payload = await workerResponse.json().catch(() => ({}));

    if (!workerResponse.ok) {
      return res.status(workerResponse.status).json({
        error:
          payload.error ||
          "Failed to finalize and sign prescription. Please try again.",
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error("prescription submit error", error);
    return res.status(500).json({
      error: "Internal server error while finalizing prescription",
    });
  }
}
