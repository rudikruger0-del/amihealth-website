// api/get-reports.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  }
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = new URL(req.url, "http://localhost");
  const email = url.searchParams.get("email");

  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .contains("email", [email])     // 🔥 FIXED LINE — email column is ARRAY
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ get-reports error:", error);
      return res.status(500).json({ error: "Failed to load reports" });
    }

    return res.status(200).json({ reports: data || [] });
  } catch (err) {
    console.error("💥 get-reports crash:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
