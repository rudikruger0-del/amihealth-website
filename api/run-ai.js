// api/run-ai.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  console.log("🔥 [run-ai] HIT");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 1) Read incoming JSON body
  let raw = "";
  await new Promise((resolve) => {
    req.on("data", (c) => (raw += c));
    req.on("end", resolve);
  });

  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const { id } = body;
  if (!id) return res.status(400).json({ error: "Missing report ID" });

  console.log("📄 Running AI for report:", id);

  // 2) Load report metadata from DB
  const { data: report, error: fetchErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !report) {
    console.error("❌ DB fetch error:", fetchErr);
    return res.status(500).json({ error: "Report not found" });
  }

  const filePath = report.file_path;

  // 3) Create signed URL to private PDF file
  const { data: signed, error: signErr } = await supabase.storage
    .from("reports")
    .createSignedUrl(filePath, 60 * 30); // 30 mins

  if (signErr || !signed?.signedUrl) {
    console.error("❌ Signed URL error:", signErr);
    await supabase
      .from("reports")
      .update({
        ai_status: "failed",
        ai_results: { error: "Could not create signed URL" },
      })
      .eq("id", id);
    return res.status(500).json({ error: "Cannot generate file URL" });
  }

  const pdfUrl = signed.signedUrl;
  console.log("✔ Signed URL:", pdfUrl);

  // 4) CALL OPENAI GPT-4.1 / GPT-5.1  
  // (Automatically extracts tables + CBC ranges + clinical meaning)
  let aiResponseJson = null;

  try {
    const prompt = `
You are AMI, a clinical pathology assistant AI.

You receive a **CBC blood report PDF**.

Your tasks:
1. Extract all CBC values.
2. Compare values to normal reference ranges.
3. Identify abnormalities.
4. Generate a clear medical interpretation.
5. Generate recommendations or next steps.
6. Output structured JSON in this EXACT format:

{
  "cbc": {
    "WBC": {"value": "...", "unit": "...", "flag": "high/low/normal"},
    "RBC": {...},
    ...
  },
  "summary": "Plain language summary of abnormalities",
  "interpretation": "Detailed clinical interpretation",
  "recommendations": "Next suggested steps"
}

Keep it strictly JSON. No extra text.
`;

    const completion = await openai.responses.create({
      model: "gpt-4.1",     // or "gpt-5.1" if available
      input: {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_file", url: pdfUrl }
        ]
      }
    });

    const textOutput = completion.output[0]?.content[0]?.text;
    try {
      aiResponseJson = JSON.parse(textOutput);
    } catch {
      aiResponseJson = { error: "OpenAI returned non-JSON", raw: textOutput };
    }

  } catch (err) {
    console.error("❌ OpenAI error:", err);
    aiResponseJson = { error: String(err) };
  }

  // Determine final status
  const finalStatus =
    aiResponseJson && !aiResponseJson.error ? "completed" : "failed";

  // 5) Save results to Supabase
  const { error: updateErr } = await supabase
    .from("reports")
    .update({
      ai_status: finalStatus,
      ai_results: aiResponseJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    console.error("❌ DB update error:", updateErr);
  }

  // 6) Response to front-end
  return res.status(200).json({
    ok: true,
    id,
    ai_status: finalStatus,
    ai_results: aiResponseJson,
  });
}
