// /api/get-reports/index.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = new URL(req.url, "http://localhost").searchParams.get("email");

  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1️⃣ Resolve the user by email (Auth table)
    const { data: userData, error: userError } =
      await supabase.auth.admin.getUserByEmail(email);

    if (userError || !userData?.user) {
      return res.status(200).json({ reports: [] });
    }

    const userId = userData.user.id;

    // 2️⃣ STRICT ownership query
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

    return res.status(200).json({ reports: data });
  } catch (err) {
    console.error("❌ get-reports crash:", err);
    return res.status(500).json({ error: "Server failure" });
  }
}
