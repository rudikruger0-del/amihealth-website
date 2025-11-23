{
  "name": "amihealth-website",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@supabase/supabase-js": "2.39.1",
    "bcryptjs": "2.4.3",
    "node-fetch": "3.3.2",
    "form-data": "4.0.0"
  }
}
// lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

// TODO: REPLACE THESE WITH YOUR REAL VALUES
const SUPABASE_URL = "https://tbyttsfztuudyqbrkonm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieXR0c2Z6dHV1ZHlxYnJrb25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzA1MzgsImV4cCI6MjA3OTAwNjUzOH0.7T0S4_kkoWosdbmjlwtfSYzBcyipcPg1Fm8kIMa43uo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
