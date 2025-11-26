import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Poll every 10s
setInterval(checkReports, 10000);

async function checkReports() {
  try {
    // 1️⃣ Get next report waiting for AI
    const { data: jobs, error } = await supabase
      .from("reports")
      .select("*")
      .eq("ai_status", "processing")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Supabase query error:", error);
      return;
    }

    if (!jobs || jobs.length === 0) {
      console.log("No jobs waiting");
      return;
    }

    const job = jobs[0];
    console.log("🔥 Processing report:", job.id, job.file_path);

    // 2️⃣ Create signed URL
    const { data: signed, error: signErr } = await supabase.storage
      .from("reports")
      .createSignedUrl(job.file_path, 1800);

    if (signErr || !signed?.signedUrl) {
      console.error("Signed URL error:", signErr);
      await fail(job.id, "Cannot create signed URL");
      return;
    }

    const fileUrl = signed.signedUrl;

    // 3️⃣ Send to HuggingFace model
    const resp = await fetch("https://amihealth-ami-blood-ai.hf.space/run/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdf_url: fileUrl })
    });

    const text = await resp.text();
    let aiJson;

    try {
      aiJson = JSON.parse(text);
    } catch {
      aiJson = { error: "AI returned non-JSON", raw: text };
    }

    // 4️⃣ Save to Supabase
    const finalState = aiJson.error ? "failed" : "completed";

    await supabase
      .from("reports")
      .update({ ai_status: finalState, ai_results: aiJson })
      .eq("id", job.id);

    console.log("✅ AI updated:", job.id, finalState);

  } catch (err) {
    console.error("Worker crash:", err);
  }
}

async function fail(id, msg) {
  await supabase
    .from("reports")
    .update({ ai_status: "failed", ai_results: { error: msg } })
    .eq("id", id);
}
