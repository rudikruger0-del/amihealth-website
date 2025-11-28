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
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    }
  );

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("email", email)
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
