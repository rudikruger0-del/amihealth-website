// Load Supabase JS from CDN
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.38.4/dist/umd/supabase.js";
script.onload = () => {
  window.supabase = supabase.createClient(
    "https://tbtytstzfutudyqbkronn.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJiYWNrbmQiLCJleHAiOjE5OTg4NjYwMDAsImlhdCI6MTY0ODg2NjAwMH0.MKXN1ndHysxsB8WS1bh1NvHUXGgM9Uch75H2fFxFmHQ"
  );
};
document.head.appendChild(script);
