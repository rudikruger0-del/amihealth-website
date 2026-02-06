// api/generate-prescription-draft.js

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
    // ----------------------------
    // Auth
    // ----------------------------
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

    // ----------------------------
    // Resolve clinician_id
    // ----------------------------
    const { data: clinician, error: clinicianError } = await supabase
      .from("clinicians")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (clinicianError || !clinician) {
      return res.status(400).json({ error: "Clinician not found" });
    }

    // ----------------------------
    // Input
    // ----------------------------
    const { report_id } = req.body;
    if (!report_id) {
      return res.status(400).json({ error: "Missing report_id" });
    }

    // ----------------------------
    // Call worker
    // ----------------------------
    const workerRes = await fetch(
      `${process.env.AMI_WORKER_URL}/action/generate_prescription_draft`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_id,
          clinician_id: clinician.id, // ✅ THIS IS THE FIX
        }),
      }
    );

    const data = await workerRes.json();

    if (!workerRes.ok) {
      return res.status(500).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

