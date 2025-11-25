// api/upload.js
import { supabase } from "../lib/supabaseClient.js";

window.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const statusEl = document.getElementById("status");

  uploadBtn.addEventListener("click", async () => {
    statusEl.textContent = "";
    const email = localStorage.getItem("user_email");

    if (!email) {
      statusEl.textContent = "Not logged in.";
      return (window.location.href = "/login.html");
    }

    const fileInput = document.getElementById("fileInput");
    const files = fileInput.files;

    if (!files.length) {
      statusEl.textContent = "Please select at least one file.";
      return;
    }

    statusEl.textContent = "Uploading to Supabase Storage…";

    // Upload each file
    const uploadedPaths = [];
    for (const file of files) {
      const path = `${email}/${Date.now()}_${file.name}`;

      const { data, error } = await supabase.storage
        .from("reports")
        .upload(path, file);

      if (error) {
        console.error(error);
        statusEl.textContent = "Upload failed.";
        return;
      }

      uploadedPaths.push(path);
    }

    statusEl.textContent = "Creating report record…";

    // Create report row + trigger AI
    const body = {
      email,
      title: document.getElementById("reportTitle").value || null,
      files: uploadedPaths,
      name: document.getElementById("patientName").value || null,
      age: document.getElementById("ageInput").value || null,
      sex: document.getElementById("sexInput").value || "Unknown",
    };

    const resp = await fetch("/api/create-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await resp.json();

    if (!resp.ok) {
      statusEl.textContent = "Failed to create report: " + (result.error || "");
      return;
    }

    statusEl.textContent = "AI processing started… Redirecting…";

    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1500);
  });
});
