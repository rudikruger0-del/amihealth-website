// /api/me/index.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read JWT from Authorization header
  const authHeader = req.headers.authorization || "";
  const jwt = authHeader.replace("Bearer ", "").trim();

  if (!jwt) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // Resolve authenticated user
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(jwt);

    if (authErr || !user) {
      return res.status(401).json({ error: "Invalid user" });
    }

    // Fetch clinician profile
    const { data: clinician, error } = await supabase
      .from("clinicians")
      .select("full_name, practice_number")
      .eq("id", user.id)
      .single();

    if (error || !clinician) {
      return res.status(200).json({
        clinician_name: null,
        practice_number: null,
      });
    }

    return res.status(200).json({
      clinician_name: clinician.full_name,
      practice_number: clinician.practice_number,
    });

  } catch (err) {
    console.error("❌ /api/me error:", err);
    return res.status(500).json({ error: "Server failure" });
  }
}
