// api/upload.js (front-end script)
import { supabase } from "../lib/supabaseClient.js";

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.textContent = "";

  const fileInput = document.getElementById("fileInput");
  const title = document.getElementById("reportTitle").value.trim();
  const name = document.getElementById("patientName").value.trim();
  const age = document.getElementById("ageInput").value.trim();
  const sex = document.getElementById("sexInput").value.trim();

  const files = fileInput.files;

  if (!files || files.length === 0) {
    status.textContent = "Please select a file.";
    return;
  }

  // Check session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    status.textContent = "Not logged in.";
    return;
  }

  const email = session.user.email;

  status.textContent = "Uploading file...\n";

  const uploadedPaths = [];

  // Upload each file to Supabase Storage
  for (const file of files) {
    const storagePath = `${email}/${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("reports")
      .upload(storagePath, file);

    if (error) {
      status.textContent += `❌ Upload failed: ${error.message}`;
      return;
    }

    uploadedPaths.push(storagePath);
    status.textContent += `✔ Uploaded: ${file.name}\n`;
  }

  status.textContent += "Saving report...\n";

  // Call create-report backend route
  const response = await fetch("/api/create-report.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      title,
      name,
      age,
      sex,
      files: uploadedPaths
    })
  });

  const result = await response.json();

  if (!response.ok) {
    status.textContent += `❌ Error: ${result.error}`;
    return;
  }

  status.textContent += "🤖 AI connected. Processing...\n";
  status.textContent += "Redirecting...\n";

  setTimeout(() => {
    window.location.href = "/dashboard.html";
  }, 1500);
});

// Load user email
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.email) {
    document.getElementById("userEmail").textContent = session.user.email;
  }
})();

// Logout
document.getElementById("logoutBtn").addEventListener("click", async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});
