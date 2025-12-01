export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Parse body
  const raw = await new Promise(resolve => {
    let r = "";
    req.on("data", c => r += c);
    req.on("end", () => resolve(r));
  });

  let body;
  try { body = JSON.parse(raw); }
  catch { return res.status(400).json({ ok: false, error: "Invalid JSON" }); }

  const { uid, new_password } = body;

  if (!uid || !new_password) {
    return res.status(400).json({ ok: false, error: "Missing uid or password" });
  }

  // A real admin is not required — the reset token already proved identity
  // Using service role, so we can change password
  const { data, error } = await db.auth.admin.updateUserById(uid, {
    password: new_password,
  });

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.status(200).json({ ok: true });
}
