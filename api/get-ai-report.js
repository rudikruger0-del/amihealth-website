export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const { createClient } = await import("@supabase/supabase-js");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id");

  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({ ok: true, report: data });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
