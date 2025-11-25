// lib/supabaseClient.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "https://tbtytsfztuudygpbrkomn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE2OTc3NjMwMDAsImV4cCI6MjAxMzMzOTYwMH0.-qZz6DHV12HLXynJrb2St1iwicm9SzS16ImFub24lLCpYXQiOjE3"
);
