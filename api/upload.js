// api/upload.js
import { supabase } from "../lib/supabaseClient.js";

document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const statusEl = document.getElementById("status");

  // Logout handler
  logoutBtn.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.removeItem("user_email");
    window.location.href = "/login.html";
  });

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
      statusEl.textContent = "Select a file first.";
      return;
    }

    statusEl.textContent = "Uploading…";

    const uploaded = [];
    for (const file of files) {
      const path = `${email}/${Date.now()}_${file.name}`;

      const { data, error } = await supabase.storage
        .from("reports")
        .upload(path, file);

      if (error) {
        statusEl.textContent = "Upload failed.";
        console.error(error);
        return;
      }

      uploaded.push(path);
    }

    statusEl.textContent = "Saving report…";

    const body = {
      email,
      title: document.getElementById("reportTitle").value || null,
      files: uploaded,
      name: document.getElementById("patientName").value || null,
      age: document.getElementById("ageInput").value || null,
      sex: document.getElementById("sexInput").value || "Unknown"
    };

    const resp = await fetch("/api/create-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await resp.json();

    if (!resp.ok) {
      statusEl.textContent = "Error: " + result.error;
      return;
    }

    statusEl.textContent = "AI queued… Redirecting…";

    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 1500);
  });
});
