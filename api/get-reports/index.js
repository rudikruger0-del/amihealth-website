// /api/get-reports/index.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization || "";
  const jwt = authHeader.replace("Bearer ", "").trim();

  if (!jwt) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1️⃣ Resolve authenticated user
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser(jwt);

    if (authErr || !user) {
      return res.status(401).json({ error: "Invalid user" });
    }

    const userId = user.id;
    const email = user.email.toLowerCase();

    // 2️⃣ Strict ownership query
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .or(
        [
          `user_id.eq.${userId}`,
          `and(user_id.is.null,source_email.eq.${email})`,
        ].join(",")
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ get-reports error:", error);
      return res.status(500).json({ error: error.message });
    }

    // ✅ NORMALISE RESULTS (ONLY WHAT IS REQUIRED)
    const normalised = (data || []).map((r) => {
      if (typeof r.ai_results === "string") {
        try {
          r.ai_results = JSON.parse(r.ai_results);
        } catch {
          r.ai_results = {};
        }
      }

      const patient = r.ai_results?.patient || {};

      r.name = r.name || patient.name || null;
      r.age = r.age ?? patient.age ?? null;
      r.sex = r.sex || patient.sex || null;

      return r;
    });

    return res.status(200).json({ reports: normalised });

  } catch (err) {
    console.error("❌ get-reports crash:", err);
    return res.status(500).json({ error: "Server failure" });
  }
}
