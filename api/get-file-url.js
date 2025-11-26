// /api/get-file-url.js — supports GET ?path=... and POST {file_path}
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    let filePath = null;

    if (req.method === "GET") {
      const url = new URL(req.url, "http://localhost");
      filePath =
        url.searchParams.get("path") || url.searchParams.get("file_path");
    } else if (req.method === "POST") {
      let raw = "";
      await new Promise((resolve) => {
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", resolve);
      });

      try {
        const body = JSON.parse(raw || "{}");
        filePath = body.file_path || body.path;
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }
    } else {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!filePath) {
      return res.status(400).json({ error: "Missing file path" });
    }

    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(filePath, 60 * 10); // 10 min

    if (error || !data?.signedUrl) {
      console.error("get-file-url signedUrl error:", error);
      return res.status(500).json({ error: "Failed to create signed URL" });
    }

    return res.status(200).json({ url: data.signedUrl });
  } catch (err) {
    console.error("get-file-url crash:", err);
    return res.status(500).json({ error: "Server-side failure" });
  }
}
