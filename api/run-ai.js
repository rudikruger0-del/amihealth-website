import { supabase } from "./supabaseClient.js";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const { reportId, file_path } = req.body;

    // 1. Get public URL for the PDF
    const { data: publicUrl } = await supabase.storage
      .from("reports")
      .getPublicUrl(file_path);

    if (!publicUrl || !publicUrl.publicUrl) {
      return res.status(400).json({ error: "Could not fetch PDF URL" });
    }

    // 2. Send to HuggingFace
    const aiResponse = await fetch(
      "https://amihealth-AMI-BLOOD-AI.hf.space/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_url: publicUrl.publicUrl }),
      }
    );

    const aiJson = await aiResponse.json();

    // 3. Save AI results into Supabase
    await supabase
      .from("reports")
      .update({
        ai_status: "completed",
        ai_results: aiJson,
      })
      .eq("id", reportId);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);

    return res.status(500).json({ error: "AI processing failed" });
  }
}
