// api/run-ai.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";
import os from "os";
import path from "path";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // --- read raw JSON body (Vercel style) ---
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const id = body.id || body.reportId;
    if (!id) {
      return res.status(400).json({ error: "Missing report id" });
    }

    // 1️⃣ Load report row
    const { data: report, error: repErr } = await supabase
      .from("reports")
      .select("*")
      .eq("id", id)
      .single();

    if (repErr || !report) {
      console.error("Report lookup error:", repErr);
      return res.status(404).json({ error: "Report not found" });
    }

    if (!report.file_path) {
      return res.status(400).json({ error: "Report has no file_path" });
    }

    // Mark as processing (in case it wasn't)
    await supabase
      .from("reports")
      .update({ ai_status: "processing" })
      .eq("id", id);

    // 2️⃣ Create signed URL for the PDF in private bucket
    const { data: signed, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(report.file_path, 60 * 20); // 20 min

    if (signErr || !signed?.signedUrl) {
      console.error("Signed URL error:", signErr);
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: "Could not create signed URL", details: signErr }
        })
        .eq("id", id);

      return res.status(500).json({ error: "Could not prepare file for AI" });
    }

    const fileUrl = signed.signedUrl;

    // 3️⃣ Download the PDF from Supabase
    const fileResp = await fetch(fileUrl);
    if (!fileResp.ok) {
      console.error("Download error:", fileResp.status, await fileResp.text());
      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_results: { error: "Could not download PDF from storage" }
        })
        .eq("id", id);
      return res.status(500).json({ error: "PDF download failed" });
    }

    const arrayBuffer = await fileResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write to a temp file so OpenAI Files API can read it
    const tmpPath = path.join(
      os.tmpdir(),
      `ami-report-${id}-${Date.now()}.pdf`
    );
    fs.writeFileSync(tmpPath, buffer);

    // 4️⃣ Upload PDF to OpenAI Files API
    const file = await openai.files.create({
      file: fs.createReadStream(tmpPath),
      purpose: "assistants"
    });

    // 5️⃣ Call GPT-5.1 multimodal to extract CBC + interpretation
    const response = await openai.responses.create({
      model: "gpt-5.1", // 👈 GPT-5 multimodal
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "You are a clinical pathology assistant. " +
                "You will receive a PDF of a blood report or CBC. " +
                "1) Extract the key CBC values (Hb, WBC, RBC, Platelets, Neutrophils, Lymphocytes, MCV, MCHC, etc). " +
                "2) Mark which ones are LOW or HIGH based on the reference ranges provided in the report. " +
                "3) Give a short, clinician-level interpretation. " +
                "4) If data is missing or unclear, say so. " +
                "Return ONLY valid JSON with this shape: " +
                "{ \"cbc_values\": {\"Hb\": {\"value\": number|null, \"unit\": string|null, \"flag\": \"low\"|\"high\"|\"normal\"|\"unknown\"}, ...}, " +
                "\"summary\": string, " +
                "\"impression\": string, " +
                "\"recommendations\": string }"
            },
            {
              // attach the file we just uploaded
              type: "input_file",
              file_id: file.id
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    // 6️⃣ Parse AI JSON output
    let aiJson = null;
    try {
      // responses.create → response.output[0].content[0].text (JSON string)
      const content = response.output?.[0]?.content?.[0]?.text;
      aiJson = content ? JSON.parse(content) : null;
    } catch (e) {
      console.error("AI JSON parse error:", e);
      aiJson = {
        error: "Model output was not valid JSON",
        raw: response
      };
    }

    const finalStatus = aiJson && !aiJson.error ? "completed" : "failed";

    // 7️⃣ Save back into Supabase
    const { error: updErr } = await supabase
      .from("reports")
      .update({
        ai_status: finalStatus,
        ai_results: aiJson
      })
      .eq("id", id);

    if (updErr) {
      console.error("Supabase update error:", updErr);
    }

    // Cleanup temp file (best-effort)
    try {
      fs.unlinkSync(tmpPath);
    } catch {}

    return res.status(200).json({
      ok: true,
      id,
      status: finalStatus,
      ai: aiJson
    });
  } catch (err) {
    console.error("run-ai crash:", err);
    return res.status(500).json({ error: "Server error in run-ai" });
  }
}
