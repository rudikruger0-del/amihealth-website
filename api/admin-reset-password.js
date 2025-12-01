export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth check
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Invalid admin" });
  }

  if (userData.user.email !== ADMIN_EMAIL) {
    return res.status(401).json({ error: "Not admin" });
  }

  // Parse body
  const raw = await new Promise(resolve => {
    let r = "";
    req.on("data", c => r += c);
    req.on("end", () => resolve(r));
  });

  let body;
  try { body = JSON.parse(raw); }
  catch { return res.status(400).json({ error: "Invalid JSON" }); }

  const { email } = body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  // Generate reset link
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email
  });

  if (error) {
    console.error("generateLink error:", error);
    return res.status(500).json({ error: error.message });
  }

  // Send email through Supabase magic link system
  // If your SMTP is configured, Supabase sends automatically.
  // Otherwise, send the link manually.

  return res.status(200).json({
    ok: true,
    message: "Reset link generated",
    link: data?.action_link // You can log this if needed
  });
}
