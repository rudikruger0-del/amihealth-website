import { supabase } from "../lib/supabaseClient.js";

console.log("upload.js loaded");

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/login.html";
});

document.addEventListener("DOMContentLoaded", async () => {
  const user = (await supabase.auth.getUser()).data.user;

  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  document.getElementById("userEmail").textContent = user.email;
});

document.getElementById("uploadBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.textContent = "Uploading...";

  const fileInput = document.getElementById("fileInput");
  const title = document.getElementById("reportTitle").value;
  const name = document.getElementById("patientName").value;
  const age = document.getElementById("ageInput").value;
  const sex = document.getElementById("sexInput").value;

  const user = (await supabase.auth.getUser()).data.user;
  if (!user) {
    status.textContent = "Not logged in!";
    return;
  }

  if (!fileInput.files.length) {
    status.textContent = "Please select a file.";
    return;
  }

  const file = fileInput.files[0];
  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  // Upload file to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("reports")
    .upload(filePath, file);

  if (uploadError) {
    status.textContent = "Upload failed: " + uploadError.message;
    return;
  }

  // Now create a report and trigger the AI
  const response = await fetch("/api/create-report", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      title,
      files: [filePath],
      name,
      age,
      sex,
    }),
  });

  const json = await response.json();

  if (!json.success) {
    status.textContent = "Error: " + json.error;
    return;
  }

  status.textContent = "Uploaded! AI is processing... Report ID: " + json.id;
});
