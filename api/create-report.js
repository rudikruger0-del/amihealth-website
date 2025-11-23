export const config = {
  runtime: "nodejs" 
};
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

// Init Supabase client (service role)
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
  console.log("🔥 create-report endpoint HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read request body (Next.js raw stream)
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { email, title, files } = data;

    if (!email || !files?.length) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const filePath = files[0]; // first PDF uploaded

    // 1️⃣ Save basic record in Supabase
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "processing",
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;

    // 2️⃣ DOWNLOAD PDF FILE BYTES FROM SUPABASE STORAGE
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("reports")
      .download(filePath);

    if (downloadErr) {
      console.error("Supabase download error:", downloadErr);
      return res.status(500).json({ error: "Failed to download file" });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());

    console.log("📄 Downloaded PDF bytes:", fileBuffer.length);

    // 3️⃣ SEND TO HUGGINGFACE AMI BLOOD AI BACKEND
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), filePath);
    formData.append("name", "Unknown");
    formData.append("age", "0");
    formData.append("sex", "Unknown");

    const aiResponse = await fetch(
      "https://amihealth-ami-blood-ai.hf.space/analyze",
      {
        method: "POST",
        body: formData,
      }
    );

    let aiJson = null;
    try {
      aiJson = await aiResponse.json();
    } catch (e) {
      aiJson = { error: "Invalid AI response" };
    }

    console.log("🤖 AI Response:", aiJson);

    // 4️⃣ Update Supabase with AI result
    await supabase
      .from("reports")
      .update({
        ai_status: aiJson.error ? "failed" : "completed",
        ai_result: aiJson,
      })
      .eq("id", reportId);

    // 5️⃣ Respond to frontend
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson,
    });
  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
