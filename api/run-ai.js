// api/run-ai.js
import { supabase } from "../lib/supabaseClient.js";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const { reportId, file_path } = req.body;

    if (!reportId || !file_path) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 1️⃣ GET SIGNED URL (because bucket is private)
    const { data: signedUrlData, error: signedErr } =
      await supabase.storage.from("reports")
        .createSignedUrl(file_path, 3600); // 1 hour

    if (signedErr || !signedUrlData?.signedUrl) {
      console.error("Signed URL error:", signedErr);
      return res.status(400).json({ error: "Could not generate signed URL" });
    }

    const signedUrl = signedUrlData.signedUrl;

    // 2️⃣ SEND FILE TO YOUR HUGGINGFACE SPACE
    const aiResponse = await fetch(
      "https://amihealth-ami-blood-ai.hf.space/run/predict", 
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_url: signedUrl }),
      }
    );

    if (!aiResponse.ok) {
      console.error("HF ERROR:", await aiResponse.text());
      return res.status(500).json({ error: "HuggingFace request failed" });
    }

    const aiJson = await aiResponse.json();

    // 3️⃣ Save AI result
    await supabase
      .from("reports")
      .update({
        ai_status: "completed",
        ai_results: aiJson,
      })
      .eq("id", reportId);

    return res.status(200).json({ success: true, aiJson });

  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({ error: "AI processing crashed" });
  }
}
