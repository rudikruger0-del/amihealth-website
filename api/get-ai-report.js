import { supabase } from "./supabaseClient.js";

export default async function handler(req, res) {
  const id = req.query.id;

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Report not found" });
  }

  // IMPORTANT: Frontend expects "report"
  return res.status(200).json({
    report: data
  });
}
