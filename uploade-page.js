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

// ---- Auth guard using localStorage (same as dashboard) ----
const email = localStorage.getItem("user_email");
if (!email) {
  window.location.href = "/login.html";
} else {
  userEmailText.textContent = email;
}

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

// ---- Main upload flow ----
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];

  if (!file) {
    setStatus("Please choose a file first.", "err");
    return;
  }

  uploadBtn.disabled = true;
  setStatus("1/3 Uploading file to secure storage...");

  try {
    // 1️⃣ Upload to Supabase Storage (public front-end client)
    const filePath = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      setStatus("Upload failed: " + uploadError.message, "err");
      uploadBtn.disabled = false;
      return;
    }

    setStatus("2/3 File stored. Creating report & calling AI...");

    // 2️⃣ Call backend /api/create-report to insert row + run AI
    const payload = {
      email,
      title: titleInput.value || null,
      files: [filePath],
      name: nameInput.value || null,
      age: ageInput.value ? Number(ageInput.value) : null,
      sex: sexInput.value || null,
    };

    const resp = await fetch("/api/create-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { success: false, error: "Non-JSON response from server", raw };
    }

    if (!resp.ok || !data.success) {
      console.error("create-report failed:", resp.status, data || raw);
      setStatus(
        "Server error while creating report.\n" +
          (data.error || resp.statusText || "Unknown error"),
        "err"
      );
      uploadBtn.disabled = false;
      return;
    }

    // 3️⃣ Done
    const id = data.id || data.reportId || "(unknown id)";
    setStatus(
      `✅ 3/3 Report queued for AI.\nReport ID: ${id}\nYou’ll later be able to view the PDF and AI JSON on the dashboard.`,
      "ok"
    );

    // Optionally, clear inputs (keep file so the user sees what was sent)
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
