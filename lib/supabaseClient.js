// lib/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://tbyttsfztuudyqbrkonm.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRieXR0c2Z6dHV1ZHlxYnJrb25tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzA1MzgsImV4cCI6MjA3OTAwNjUzOH0.7T0S4_kkoWosdbmjlwtfSYzBcyipcPg1Fm8kIMa43uo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
