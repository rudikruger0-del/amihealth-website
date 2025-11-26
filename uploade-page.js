// upload-page.js
import { supabase } from "./lib/supabaseClient.js";

const fileInput = document.getElementById("fileInput");
const titleInput = document.getElementById("titleInput");
const nameInput = document.getElementById("nameInput");
const ageInput = document.getElementById("ageInput");
const sexInput = document.getElementById("sexInput");
const uploadBtn = document.getElementById("uploadBtn");
const statusArea = document.getElementById("statusArea");
const userEmailText = document.getElementById("userEmailText");
const logoutLink = document.getElementById("logoutLink");

// ---- Auth guard using localStorage ----
const email = localStorage.getItem("user_email");
if (!email) {
  window.location.href = "/login.html";
} else {
  userEmailText.textContent = email;
}

// Logout
logoutLink.addEventListener("click", (e) => {
  e.preventDefault();
  localStorage.removeItem("user_email");
  window.location.href = "/login.html";
});

function setStatus(message, type = "") {
  statusArea.textContent = message || "";
  statusArea.classList.remove("ok", "err");
  if (type) statusArea.classList.add(type);
}

// ---- MAIN UPLOAD FLOW ----
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    setStatus("Please choose a file first.", "err");
    return;
  }

  uploadBtn.disabled = true;
  setStatus("Uploading report to server...");

  try {
    // Build multipart form-data request
    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);
    formData.append("title", titleInput.value || "");
    formData.append("name", nameInput.value || "");
    formData.append("age", ageInput.value || "");
    formData.append("sex", sexInput.value || "Unknown");

    // Send to backend API
    const resp = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const raw = await resp.text();
    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      setStatus("Server returned invalid response:\n" + raw, "err");
      uploadBtn.disabled = false;
      return;
    }

    if (!resp.ok || !data.ok) {
      setStatus(
        "Server error during upload:\n" +
          (data.error || resp.statusText || "Unknown error"),
        "err"
      );
      uploadBtn.disabled = false;
      return;
    }

    const reportId = data.report_id || data.id || "(unknown ID)";

    // SUCCESS
    setStatus(
      `✅ Upload complete!\nAI queued for Report ID: ${reportId}\nYou can view it later on the dashboard.`,
      "ok"
    );

    // Clear inputs (keep file to show what's uploaded)
    titleInput.value = "";
    nameInput.value = "";
    ageInput.value = "";
    sexInput.value = "Unknown";

  } catch (err) {
    console.error("Upload crash:", err);
    setStatus("Unexpected error: " + String(err), "err");
  } finally {
    uploadBtn.disabled = false;
  }
});
