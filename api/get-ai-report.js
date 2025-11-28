// /api/get-ai-report.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const { createClient } = await import("@supabase/supabase-js");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Fix: use Next.js query parsing
  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  // SAFETY FIX -> Use ANON KEY for GET endpoint
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .maybeSingle(); // safer than .single()

    if (error) {
      console.error("DB error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (!data) {
      return res.status(404).json({ error: "Report not found" });
    }

    // --- OPTIONAL: ENFORCE USER ACCESS ---
    // if (req.headers["x-user-email"] !== data.email) {
    //   return res.status(403).json({ error: "Not authorized." });
    // }

    return res.status(200).json({
      ok: true,
      report: data
    });

  } catch (e) {
    console.error("SERVER ERROR:", e);
    return res.status(500).json({ error: e.message });
  }
}
