// /api/admin-get-pending.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ""; // optional env

const db = createClient(SUPABASE_URL, SERVICE_ROLE);
const auth = createClient(SUPABASE_URL, ANON_KEY);

async function requireAdmin(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { error: "Missing token" };

  const { data, error } = await auth.auth.getUser(token);
  if (error || !data?.user) return { error: "Invalid token" };

  const email = data.user.email;
  if (!email) return { error: "No email on user" };

  const allowedEmail = ADMIN_EMAIL || email; // fallback if env not set
  if (email !== allowedEmail) return { error: "Not admin" };

  return { user: data.user };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { error: adminErr } = await requireAdmin(req);
    if (adminErr) {
      return res.status(401).json({ error: adminErr });
    }

    const { data, error } = await db
      .from("pending_doctors")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("pending_doctors error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    return res.status(200).json({ ok: true, pending: data || [] });
  } catch (err) {
    console.error("admin-get-pending crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
