// api/get-ai-report.js
import { supabase } from "./supabaseClient.js";

export default async function handler(req, res) {
  const id = req.query.id;

  if (!id) {
    return res.status(400).json({ error: "Missing report ID" });
  }

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Report not found" });
  }

  // RETURN FULL REPORT OBJECT LIKE report.html EXPECTS
  return res.status(200).json({ report: data });
}
