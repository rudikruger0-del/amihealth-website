// /api/get-file-url.js
import { createClient } from "@supabase/supabase-js";

export const config = { runtime: "nodejs" };

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {

  try {
    const path = req.query.path;

    if (!path) {
      return res.status(400).json({ error: "Missing path" });
    }

    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(path, 300); // 5 minutes

    if (error) {
      console.error("Signed URL error:", error);
      return res.status(500).json({ error: "Failed to generate URL" });
    }

    return res.status(200).json({ url: data.signedUrl });

  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
