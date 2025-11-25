// Load Supabase from CDN dynamically
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
script.onload = () => {
  window.supabase = supabase.createClient(
    "https://tbyttsfztuudyqbrkonn.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjE0MzM0Mzc0LCJleHAiOjE5Mjk5MTAzNzR9.R71bb5w6CsonvZw0C-tCzpxon2UCnSF0ePrtQysB4iA"
  );
};
document.head.appendChild(script);
