// /api/get-file-url.js — SECURE VERSION
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    let filePath = null;

    // -----------------------------
    // 1) Read file path
    // -----------------------------
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

    // -----------------------------
    // 2) AUTHENTICATE USER
    // -----------------------------
    const auth = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      { auth: { persistSession: false } }
    );

    const token = req.headers.authorization?.replace("Bearer ", "");

    const { data: userData } = await auth.auth.getUser(token);
    const user = userData?.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // -----------------------------
    // 3) VALIDATE FILE BELONGS TO USER
    // -----------------------------
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: report, error: reportErr } = await supabase
      .from("reports")
      .select("email, user_id")
      .eq("file_path", filePath)
      .maybeSingle();

    if (reportErr) {
      return res.status(500).json({ error: "Database error" });
    }

    if (!report) {
      return res.status(404).json({ error: "File not associated with any report" });
    }

    // User DOES NOT own this report — deny!
    if (report.email !== user.email && report.user_id !== user.id) {
      console.warn("⛔ Unauthorized PDF download attempt detected");
      return res.status(403).json({ error: "Access denied" });
    }

    // -----------------------------
    // 4) CREATE SIGNED URL (SAFE)
    // -----------------------------
    const { data, error } = await supabase.storage
      .from("reports")
      .createSignedUrl(filePath, 600); // 10 minutes

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
