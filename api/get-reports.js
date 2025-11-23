export const config = { runtime: "nodejs" };
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const email = req.query.email;
  if (!email) return res.status(400).json({ error: "Missing email" });

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error });

  res.status(200).json({ reports: data });
}
