import { supabase } from "../lib/supabaseClient.js";
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    const { reportId, file_path } = req.body;

    console.log("🚀 run-ai.js called for report:", reportId);

    // 1. Generate a signed URL for the PDF (publicUrl won't work)
    const { data: signed } = await supabase.storage
      .from("reports")
      .createSignedUrl(file_path, 3600);

    if (!signed || !signed.signedUrl) {
      return res.status(400).json({ error: "Could not create signed URL" });
    }

    const pdfUrl = signed.signedUrl;

    // 2. Download the FILE from Supabase
    const fileResponse = await fetch(pdfUrl);
    const pdfBuffer = await fileResponse.arrayBuffer();

    // 3. Send PDF to HuggingFace Gradio endpoint
    const HF_ENDPOINT = "https://amihealth-ami-blood-ai.hf.space/run/predict";

    const hfResponse = await fetch(HF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          {
            name: file_path.split("/").pop(),
            data: Buffer.from(pdfBuffer).toString("base64"),
            is_file: true,
          }
        ]
      })
    });

    const aiResult = await hfResponse.json();

    console.log("AI Response:", aiResult);

    if (!aiResult || aiResult.error) {
      await supabase
        .from("reports")
        .update({ ai_status: "failed" })
        .eq("id", reportId);

      return res.status(500).json({ error: "AI failed", ai: aiResult });
    }

    // 4. Save AI results in Supabase
    await supabase
      .from("reports")
      .update({
        ai_status: "completed",
        ai_results: aiResult.data ? aiResult.data[0] : aiResult,
      })
      .eq("id", reportId);

    return res.status(200).json({ success: true, ai: aiResult });

  } catch (err) {
    console.error("❌ AI PROCESSING ERROR:", err);

    return res.status(500).json({ error: "AI processing failed" });
  }
}
