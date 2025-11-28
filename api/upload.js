// /api/upload.js — FULLY SECURE VERSION
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("❌ Missing Supabase environment variables");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ---------------------------------------
    // 1) Authenticate the user (MUST BE LOGGED IN)
    // ---------------------------------------
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: false },
    });

    const token = req.headers.authorization?.replace("Bearer ", "");

    const { data: userData } = await authClient.auth.getUser(token);
    const user = userData?.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const userEmail = user.email;

    // ---------------------------------------
    // 2) Parse form data
    // ---------------------------------------
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
    const ageRaw = clean(fields.age);
    const sex = clean(fields.sex) || "Unknown";

    if (!formEmail) {
      return res.status(400).json({ error: "Missing email" });
    }

    // ---------------------------------------
    // 3) SECURITY: email must match session email
    // ---------------------------------------
    if (formEmail !== userEmail) {
      console.warn("⛔ Upload impersonation attempt blocked:", formEmail);
      return res.status(403).json({
        error: "You cannot upload reports for another user.",
      });
    }

    // ---------------------------------------
    // 4) Validate file input
    // ---------------------------------------
    let file = files.file;
    if (Array.isArray(file)) file = file[0];

    if (!file) {
      return res.status(400).json({ error: "Missing file" });
    }

    // ---------------------------------------
    // 5) Now create service-role Supabase client (after securing user)
    // ---------------------------------------
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---------------------------------------
    // 6) Create the pending report row
    // ---------------------------------------
    const { data: row, error: rowErr } = await supabase
      .from("reports")
      .insert({
        email: userEmail,
        title,
        name,
        age: ageRaw ? Number(ageRaw) : null,
        sex,
        ai_status: "pending",
        user_id: user.id,
      })
      .select()
      .single();

    if (rowErr) {
      console.error("❌ DB insert failed:", rowErr);
      return res.status(500).json({ error: "DB insert failed" });
    }

    const reportId = row.id;

    // ---------------------------------------
    // 7) Upload PDF securely to storage
    // ---------------------------------------
    const buffer = fs.readFileSync(file.filepath);
    const storagePath = `${reportId}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("reports")
      .upload(storagePath, buffer, {
        upsert: true,
        contentType: file.mimetype || "application/pdf",
      });

    if (uploadErr) {
      console.error("❌ Storage upload failed:", uploadErr);

      await supabase
        .from("reports")
        .update({
          ai_status: "failed",
          ai_error: "Storage upload failed",
        })
        .eq("id", reportId);

      return res.status(500).json({ error: "Upload failed" });
    }

    // ---------------------------------------
    // 8) Save file_path
    // ---------------------------------------
    await supabase
      .from("reports")
      .update({ file_path: storagePath })
      .eq("id", reportId);

    return res.status(200).json({
      ok: true,
      report_id: reportId,
      file_path: storagePath,
      message: "Report uploaded & queued for AI.",
    });

  } catch (err) {
    console.error("❌ UPLOAD ERROR:", err);
    return res.status(500).json({ error: "SERVER_CRASH" });
  }
}
