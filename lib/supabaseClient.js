<!-- Supabase JS from CDN -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
  // Create global Supabase client
  window.supabase = supabase.createClient(
    "https://tbytts5fztuudyqbkrbnn.supabase.co",   // ✅ CORRECT PROJECT URL
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."       // your anon key
  );
</script>
