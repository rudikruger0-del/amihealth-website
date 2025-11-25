document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const titleInput = document.getElementById("title");
  const nameInput = document.getElementById("patientName");
  const ageInput = document.getElementById("age");
  const sexInput = document.getElementById("sex");
  const status = document.getElementById("status");
  const userEmail = localStorage.getItem("user_email");

  if (!userEmail) {
    window.location.href = "/login";
    return;
  }

  document.getElementById("userEmail").textContent = userEmail;

  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("user_email");
    window.location.href = "/login";
  };

  uploadBtn.onclick = async () => {
    const file = fileInput.files[0];
    if (!file) {
      status.textContent = "Please select a file.";
      return;
    }

    status.textContent = "Uploading to server...";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", userEmail);
    formData.append("title", titleInput.value || "");
    formData.append("name", nameInput.value || "");
    formData.append("age", ageInput.value || "");
    formData.append("sex", sexInput.value || "Unknown");

    try {
      const resp = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const json = await resp.json();

      if (!resp.ok) {
        status.textContent = "Server error: " + JSON.stringify(json, null, 2);
        return;
      }

      status.textContent = "Uploaded! AI is processing your report.";
    } catch (err) {
      status.textContent = "Upload failed: " + err.message;
    }
  };
});
