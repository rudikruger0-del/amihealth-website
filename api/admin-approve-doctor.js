export const config = { runtime: "nodejs" };

import { createClient } from "@supabase/supabase-js";

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

  if (data.user.email !== ADMIN_EMAIL) return { error: "Not admin" };
  return { user: data.user };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { error: adminErr } = await requireAdmin(req);
  if (adminErr) return res.status(401).json({ error: adminErr });

  let raw = "";
  await new Promise(resolve => {
    req.on("data", chunk => raw += chunk);
    req.on("end", resolve);
  });

  const body = JSON.parse(raw || "{}");
  const { id } = body;
  if (!id) return res.status(400).json({ error: "Missing id" });

  // Load pending doctor
  const { data: doc, error: docErr } = await db
    .from("pending_doctors")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (docErr || !doc) return res.status(404).json({ error: "Pending doctor not found" });

  // Create user with THEIR chosen password
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: doc.email,
    password: doc.password,
    email_confirm: true,
  });

  if (createErr || !created?.user) {
    console.error("auth.admin.createUser error:", createErr);
    return res.status(500).json({ error: "Failed to create auth user" });
  }

  // Update pending doctor row
  await db
    .from("pending_doctors")
    .update({
      status: "approved",
      created_user_id: created.user.id,
      password: null, // remove password for security
    })
    .eq("id", id);

  return res.status(200).json({
    ok: true,
    email: doc.email,
    user_id: created.user.id,
    message: "Doctor approved. They can now log in with their chosen password."
  });
}
