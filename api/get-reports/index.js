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
    // 1️⃣ Fetch unlinked email-ingested reports (SAFE)
    const { data: emailReports, error: emailErr } = await supabase
      .from("reports")
      .select("*")
      .eq("source_email", email)
      .is("user_id", null);

    if (emailErr) {
      console.error("❌ email reports error:", emailErr);
      return res.status(500).json({ error: emailErr.message });
    }

    // 2️⃣ If any of those reports are already linked, get the user_id
    const linkedUserId =
      emailReports?.find(r => r.user_id)?.user_id ?? null;

    let userReports = [];

    if (linkedUserId) {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", linkedUserId);

      if (error) {
        console.error("❌ user reports error:", error);
        return res.status(500).json({ error: error.message });
      }

      userReports = data;
    }

    // 3️⃣ Merge & sort (no duplicates)
    const seen = new Set();
    const merged = [...emailReports, ...userReports].filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    merged.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return res.status(200).json({ reports: merged });

  } catch (err) {
    console.error("❌ get-reports crash:", err);
    return res.status(500).json({ error: "Server failure" });
  }
}
