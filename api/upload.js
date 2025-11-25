export const config = {
  runtime: "nodejs",
};

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  }
);

export default async function handler(req, res) {
  console.log("🔥 /api/upload HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    const body = JSON.parse(raw || "{}");

    const { email, files, title, name, age, sex } = body;

    if (!email || !files || !files.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0];

    // 1️⃣ Insert new report entry
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing",
        name: name || null,
        age: age || null,
        sex: sex || null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("❌ insert error:", insertErr);
      return res.status(500).json({ error: "Insert failed" });
    }

    const signed = await supabase.storage
      .from("reports")
      .createSignedUrl(filePath, 3600);

    const signedUrl = signed?.data?.signedUrl;

    if (!signedUrl) {
      return res.status(500).json({ error: "Failed to sign file" });
    }

    // 2️⃣ Send to HuggingFace
    const aiResp = await fetch(
      "https://amihealth-ami-blood-ai.hf.space/run/predict",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_url: signedUrl }),
      }
    );

    const aiText = await aiResp.text();
    let aiJson = null;
    try {
      aiJson = JSON.parse(aiText);
    } catch {
      aiJson = { error: "Invalid JSON", raw: aiText };
    }

    const status = aiJson?.error ? "failed" : "completed";

    await supabase
      .from("reports")
      .update({ ai_status: status, ai_results: aiJson })
      .eq("id", inserted.id);

    return res.json({ success: true, id: inserted.id, status, ai: aiJson });

  } catch (err) {
    console.error("💥 upload crash:", err);
    return res.status(500).json({ error: "Server crash" });
  }
}
