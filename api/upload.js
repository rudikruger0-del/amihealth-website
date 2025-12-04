// /api/upload.js — BULLETPROOF VERSION

import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";
import crypto from "crypto";

export const config = { api: { bodyParser: false } };

// ENVIRONMENT
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
  console.error("❌ Missing Supabase environment variables");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ======================================================================
    // 1) AUTHENTICATE USER — MUST BE LOGGED IN
    // ======================================================================

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false }
    });

    const token = req.headers.authorization?.replace("Bearer ", "");
    const { data: userData } = await authClient.auth.getUser(token);
    const user = userData?.user;

    if (!user) {
      console.warn("⛔ Upload blocked — no valid session");
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userEmail = user.email;

    // ======================================================================
    // 2) PARSE MULTIPART FORM-DATA
    // ======================================================================

    const form = formidable({ multiples: false });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const clean = (v) => (Array.isArray(v) ? v[0] : v);

    const formEmail = clean(fields.email);
    const title = clean(fields.title) || "Untitled Report";
    const name = clean(fields.name) || null;
    const age = clean(fields.age) ? Number(clean(fields.age)) : null;
    const sex = clean(fields.sex) || "Unknown";

    if (!formEmail) {
      return res.status(400).json({ error: "Missing email" });
    }

    // ======================================================================
    // 3) SECURITY CHECK — USER MUST MATCH SESSION USER
    // ======================================================================

    if (formEmail !== userEmail) {
      console.warn("⛔ Impersonation attempt blocked:", formEmail);
      return res.status(403).json({
        error: "You cannot upload reports for another user."
      });
    }

    // ======================================================================
    // 4) VALIDATE FILE
    // ======================================================================

    let file = files.file;
    if (Array.isArray(file)) file = file[0];

    if (!file) {
      return res.status(400).json({ error: "Missing file" });
    }

    // ======================================================================
    // 5) CREATE SERVICE-ROLE SUPABASE CLIENT
    // ======================================================================

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ======================================================================
    // ⭐ BULLETPROOF FIX STARTS HERE ⭐
    // Upload FIRST — Create DB row ONLY after upload succeeds.
    // ======================================================================

    const buffer = fs.readFileSync(file.filepath);

    // Create a UUID for report ID before inserting
    const reportId = crypto.randomUUID();
    const storagePath = `${reportId}.pdf`;

    // ---- Upload PDF to storage BEFORE touching the database ----
    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(storagePath, buffer, {
        upsert: false,
        contentType: file.mimetype || "application/pdf"
      });

    if (uploadErr) {
      console.error("❌ Storage upload failed:", uploadErr);
      return res.status(500).json({ error: "Upload failed" });
    }

    // ======================================================================
    // DB ENTRY IS ONLY CREATED AFTER PDF EXISTS
    // Therefore file_path can NEVER be null.
    // ======================================================================

    const { data: row, error: rowErr } = await supabase
      .from("reports")
      .insert({
        id: reportId,
        email: userEmail,
        user_id: user.id,
        title,
        name,
        age,
        sex,
        file_path: storagePath, // ⭐ ALWAYS PRESENT
        ai_status: "pending"
      })
      .select()
      .single();

    if (rowErr) {
      console.error("❌ Error inserting report:", rowErr);

      // Roll back PDF if DB fails
      await supabase.storage.from("reports").remove([storagePath]);

      return res.status(500).json({ error: "DB insert failed" });
    }

    // ======================================================================
    // 9) SUCCESS
    // ======================================================================

    return res.status(200).json({
      ok: true,
      report_id: reportId,
      file_path: storagePath,
      message: "Report uploaded & queued for AI."
    });

  } catch (err) {
    console.error("❌ SERVER CRASH:", err);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
