// api/get-file-url.js
export const config = { runtime: "nodejs" };

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    const { file_path } = JSON.parse(raw || "{}");

    if (!file_path) {
      return res.status(400).json({ error: "Missing file_path" });
    }

    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(file_path, 60 * 10); // 10 min

    if (error || !data?.signedUrl) {
      console.error("❌ get-file-url error:", error);
      return res.status(500).json({ error: "Failed to create signed URL" });
    }

    return res.status(200).json({ url: data.signedUrl });
  } catch (err) {
    console.error("💥 get-file-url crash:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
