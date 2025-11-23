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

  const { file_path } = req.body;

  if (!file_path) {
    return res.status(400).json({ error: "Missing file_path" });
  }

  const { data, error } = await supabase.storage
    .from("reports")
    .createSignedUrl(file_path, 60 * 30); // valid 30 minutes

  if (error) {
    return res.status(500).json({ error: "Failed to generate signed URL", details: error });
  }

  return res.status(200).json({ url: data.signedUrl });
}
