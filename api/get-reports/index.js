export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  const { createClient } = await import("@supabase/supabase-js");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = new URL(req.url, "http://localhost");
  const email = url.searchParams.get("email");

  if (!email) {
    return res.status(400).json({ error: "Missing email" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("email", email)  // ✅ FIXED — correct column name
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ reports: data });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
