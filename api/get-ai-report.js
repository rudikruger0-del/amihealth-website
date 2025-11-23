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

  return res.status(200).json({
    status: data.ai_status,
    results: data.ai_results,
    pdf_path: data.ai_pdf_path || null,
  });
}
