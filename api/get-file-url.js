// api/get-file-url.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Read raw body (Vercel requirement)
    let body = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (body += chunk));
      req.on("end", resolve);
    });

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { file_path } = parsed;

    if (!file_path) {
      return res.status(400).json({ error: "Missing file_path" });
    }

    // Generate signed URL (valid for 10 minutes)
    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(file_path, 600);

    if (error || !data?.signedUrl) {
      console.error("Signed URL error:", error);
      return res.status(500).json({ error: "Failed to generate signed URL" });
    }

    return res.status(200).json({ url: data.signedUrl });

  } catch (err) {
    console.error("get-file-url crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
