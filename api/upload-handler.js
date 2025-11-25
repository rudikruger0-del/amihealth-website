document.getElementById("uploadBtn").addEventListener("click", async () => {
  const status = document.getElementById("status");
  status.textContent = "Uploading to server...";

  const fileInput = document.getElementById("fileInput");
  const titleInput = document.getElementById("reportTitle");
  const patientNameInput = document.getElementById("patientName");
  const ageInput = document.getElementById("ageInput");
  const sexInput = document.getElementById("sexInput");

  const user = JSON.parse(localStorage.getItem("amihealth-auth-session"))?.user;
  const email = user?.email;

  if (!email) {
    status.textContent = "Not logged in.";
    return;
  }

  if (!fileInput.files.length) {
    status.textContent = "Please select a file.";
    return;
  }

  const file = fileInput.files[0];

  const formData = new FormData();
  formData.append("email", email);
  formData.append("title", titleInput.value);
  formData.append("name", patientNameInput.value);
  formData.append("age", ageInput.value);
  formData.append("sex", sexInput.value);
  formData.append("file", file);

  try {
    const resp = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const json = await resp.json();

    if (!resp.ok) {
      status.textContent = "Server error:\n" + JSON.stringify(json, null, 2);
      return;
    }

    status.textContent = "Upload complete! Report ID: " + json.id;

  } catch (e) {
    console.error(e);
    status.textContent = "Unexpected error: " + e.toString();
  }
});
