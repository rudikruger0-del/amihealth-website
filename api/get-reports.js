export const config = { runtime: "nodejs" };
import { createClient } from "@supabase/supabase-js";

// Supabase client (service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    }
  }
);

// GET /api/get-reports?email=someone@example.com
export default async function handler(req, res) {
  console.log("📥 get-reports HIT", req.method);

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.query.email;
  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("email", email)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Failed to load reports" });
    }

    // Normalise for frontend
    const mapped = data.map((item) => ({
      id: item.id,
      title: item.title || "Untitled",
      file_path: item.file_path,
      created_at: item.created_at,
      status: item.ai_status || "pending",
      ai_result: item.ai_result || null
    }));

    return res.status(200).json(mapped);
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
