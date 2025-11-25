// Load Supabase from CDN
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/esm/supabase.js";

// Create global client
export const supabase = createClient(
  "https://tbtytsfzutudyqbrkomn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjk5Nzc5MDI5LCJleHAiOjIwMTUxMzkwMjl9.fzZsISn1Jz1I6iRnRieXR0c2Z6dHVl2HLXynJrb2St1iwicm9sZSI6ImFub24ifQ=="
);

// Expose globally for inline JS
window.supabase = supabase;
