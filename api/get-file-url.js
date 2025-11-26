// api/get-file-url.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { path } = req.query; // <-- FIXED: frontend uses ?path=

    if (!path) {
      return res.status(400).json({ error: "Missing file path" });
    }

    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(path, 600);

    if (error || !data?.signedUrl) {
      return res.status(500).json({ error: "Unable to generate signed URL" });
    }

    return res.status(200).json({ url: data.signedUrl });
  } catch (err) {
    console.error("get-file-url ERROR:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
