// upload-page.js
import { supabase } from "./lib/supabaseClient.js";

const fileInput = document.getElementById("fileInput");
const titleInput = document.getElementById("reportTitle");
const nameInput = document.getElementById("patientName");
const ageInput = document.getElementById("ageInput");
const sexInput = document.getElementById("sexInput");
const uploadBtn = document.getElementById("uploadBtn");
const statusEl = document.getElementById("status");
const userEmailEl = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

let currentEmail = null;

/* ----------------------------------
      STATUS HELPER
---------------------------------- */
function setStatus(msg, type = "") {
  statusEl.textContent = msg || "";
  statusEl.classList.remove("ok", "err");

  if (type) statusEl.classList.add(type);
}


/* ----------------------------------
      LOAD USER SESSION
---------------------------------- */
async function loadUser() {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error || !data?.user) {
      userEmailEl.textContent = "Not logged in";
      setStatus("Not logged in. Please log in again.", "err");
      uploadBtn.disabled = true;
      return;
    }

    currentEmail = data.user.email;
    userEmailEl.textContent = currentEmail;
    uploadBtn.disabled = false;
    setStatus("");
  } catch (err) {
    console.error("loadUser error:", err);
    userEmailEl.textContent = "Error";
    setStatus("Could not load user session. Please log in again.", "err");
    uploadBtn.disabled = true;
  }
}


/* ----------------------------------
            LOGOUT
---------------------------------- */
async function doLogout() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error("Logout error:", err);
  }
  window.location.href = "/login.html";
}

logoutBtn.addEventListener("click", doLogout);


/* ----------------------------------
        MAIN UPLOAD LOGIC
---------------------------------- */
async function doUpload() {
  if (!currentEmail) {
    setStatus("You are not logged in. Please log in again.", "err");
    return;
  }

  const file = fileInput.files[0];
  if (!file) {
    setStatus("Please select a file to upload.", "err");
    return;
  }

  // Build form-data payload
  const form = new FormData();
  form.append("file", file);
  form.append("email", currentEmail);
  form.append("title", titleInput.value.trim());
  form.append("name", nameInput.value.trim());
  form.append("age", ageInput.value ? ageInput.value : "");
  form.append("sex", sexInput.value);

  uploadBtn.disabled = true;
  setStatus("Uploading to server and queuing AI…");

  try {
    const resp = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });

    const text = await resp.text();
    let parsed;

    try {
      parsed = JSON.parse(text);
    } catch {
      setStatus("Server returned invalid response:\n" + text, "err");
      uploadBtn.disabled = false;
      return;
    }

    if (!resp.ok || !parsed.ok) {
      const msg = parsed?.error || text || `HTTP ${resp.status}`;
      setStatus("Server error: " + msg, "err");
      uploadBtn.disabled = false;
      return;
    }

    const reportId = parsed.report_id || parsed.id || "(unknown ID)";

    // SUCCESS
    setStatus(`✅ Upload complete. AI queued for Report ID: ${reportId}`, "ok");

    // 🔥 THIS LINE MAKES DASHBOARD UPDATE INSTANTLY
    localStorage.setItem("reports_updated", "1");

    // Clear inputs
    titleInput.value = "";
    nameInput.value = "";
    ageInput.value = "";
    sexInput.value = "Unknown";

  } catch (err) {
    console.error("Upload crash:", err);
    setStatus("Network error: " + String(err.message || err), "err");
  } finally {
    uploadBtn.disabled = false;
  }
}

uploadBtn.addEventListener("click", doUpload);


/* ----------------------------------
            INITIAL LOAD
---------------------------------- */
await loadUser();
