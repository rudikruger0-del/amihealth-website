async function handleUpload(e) {
  e.preventDefault();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("email", user.email);
  formData.append("title", title);
  formData.append("name", name);
  formData.append("age", age);
  formData.append("sex", sex);

  setStatus("Uploading...");

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();

  if (!data.ok) {
    setStatus("Upload failed ❌");
    return;
  }

  setStatus("Upload complete ✓");
  setStatus("AI analysing this report…");

  // ⛔ STOP — DO NOT CALL run-ai ANYMORE
  // Worker runs the AI automatically.

  // You can automatically redirect to dashboard:
  // router.push(`/report?id=${data.report_id}`)
}
