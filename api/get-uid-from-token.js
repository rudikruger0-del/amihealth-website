export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(SUPABASE_URL, SERVICE_ROLE);

export default async function handler(req, res) {
  const token = req.query.token;

  if (!token) {
    return res.status(400).json({ ok: false, error: "Missing token" });
  }

  const { data, error } = await db.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(400).json({ ok: false, error: "Invalid reset token" });
  }

  return res.status(200).json({ ok: true, uid: data.user.id });
}
