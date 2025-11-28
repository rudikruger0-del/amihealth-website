export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  const { createClient } = await import("@supabase/supabase-js");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Create an auth client ONLY for verifying the user's session
  const authClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );

  // Get session from cookie
  const { data: sessionData } = await authClient.auth.getUser(req.headers.authorization?.replace("Bearer ", ""));
  const user = sessionData?.user;

  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const loggedInEmail = user.email;

  // Now use SERVICE ROLE for DB query
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("email", loggedInEmail)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ reports: data });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
