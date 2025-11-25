// api/upload.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw request body
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    const { email, title, file_path, name, age, sex } = JSON.parse(raw || "{}");

    if (!email || !file_path) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Insert the report row
    const { data, error } = await supabase
      .from("reports")
      .insert({
        email,
        title: title || "Untitled Report",
        file_path,
        created_at: new Date().toISOString(),
        ai_status: "processing",
        name: name || null,
        age: age || null,
        sex: sex || null,
      })
      .select()
      .single();

    if (error) {
      console.error("INSERT ERROR:", error);
      return res.status(500).json({ error: "Insert failed" });
    }

    // Return success
    return res.status(200).json({
      success: true,
      id: data.id,
      message: "Report saved, AI will process next",
    });

  } catch (err) {
    console.error("UPLOAD CRASH:", err);
    return res.status(500).json({ error: "Server crash" });
  }
}
