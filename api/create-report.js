export const config = { runtime: "nodejs" };
import { createClient } from "@supabase/supabase-js";

// Supabase client (service role)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    }
  }
);

export default async function handler(req, res) {
  console.log("🔥 create-report endpoint HIT:", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body
    let raw = "";
    await new Promise(resolve => {
      req.on("data", chunk => (raw += chunk));
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

    const filePath = files[0]; // first uploaded file

    // 1️⃣ Insert into Supabase
    const { data: inserted, error: insertErr } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path: filePath,
        created_at: new Date().toISOString(),
        ai_status: "waiting"
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Supabase Insert Error:", insertErr);
      return res.status(500).json({ error: "Failed to save report" });
    }

    const reportId = inserted.id;

    // 2️⃣ TEMPORARY — skip AI request until your backend is online
    const aiJson = {
      message: "AI analysis pending — engine offline",
      status: "waiting",
      engine_ready: false
    };

    // 3️⃣ Save placeholder AI result
    await supabase
      .from("reports")
      .update({
        ai_status: "waiting",
        ai_result: aiJson
      })
      .eq("id", reportId);

    // 4️⃣ Success response to frontend
    return res.status(200).json({
      success: true,
      id: reportId,
      ai: aiJson
    });

  } catch (err) {
    console.error("Server Error:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
