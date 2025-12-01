// /api/admin-approve-doctor.js
export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

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

  const allowedEmail = ADMIN_EMAIL || email;
  if (email !== allowedEmail) return { error: "Not admin" };

  return { user: data.user };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { error: adminErr } = await requireAdmin(req);
    if (adminErr) {
      return res.status(401).json({ error: adminErr });
    }

    let raw = "";
    await new Promise((resolve) => {
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", resolve);
    });

    let body;
    try {
      body = JSON.parse(raw || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }

    const { id } = body;
    if (!id) return res.status(400).json({ error: "Missing id" });

    // 1) Fetch pending doctor
    const { data: doc, error: docErr } = await db
      .from("pending_doctors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (docErr || !doc) {
      return res.status(404).json({ error: "Pending doctor not found" });
    }

    // 2) Create auth user with temp password
    const tempPassword = crypto.randomBytes(6).toString("base64").slice(0, 10);

    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: doc.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      console.error("auth.admin.createUser error:", createErr);
      return res.status(500).json({ error: "Failed to create auth user" });
    }

    // 3) Update pending_doctors row
    const { error: updErr } = await db
      .from("pending_doctors")
      .update({
        status: "approved",
        created_user_id: created.user.id,
        temp_password: tempPassword,
      })
      .eq("id", id);

    if (updErr) {
      console.error("pending_doctors update error:", updErr);
      return res.status(500).json({ error: "Failed to update pending doctor" });
    }

    return res.status(200).json({
      ok: true,
      user_id: created.user.id,
      email: doc.email,
      temp_password: tempPassword,
    });
  } catch (err) {
    console.error("admin-approve-doctor crash:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
