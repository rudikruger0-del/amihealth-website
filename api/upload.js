import { useState } from "react";
import { useRouter } from "next/router";

export default function UploadPage() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [status, setStatus] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setStatus("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", userEmail);
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

    // ❌ NO AI CALL — worker handles it automatically

    // Redirect to dashboard (optional)
    // router.push(`/report?id=${data.report_id}`);
  };

  return (
    <div className="upload-container">
      <h1>Upload Report</h1>

      <form onSubmit={handleUpload}>
        <input
          type="email"
          placeholder="Your email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          required
        />

        <input type="file" onChange={(e) => setFile(e.target.files[0])} />

        <input
          type="text"
          placeholder="Report Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="text"
          placeholder="Patient Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="number"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />

        <select value={sex} onChange={(e) => setSex(e.target.value)}>
          <option>Unknown</option>
          <option>Male</option>
          <option>Female</option>
        </select>

        <button type="submit">Upload & Queue AI</button>
      </form>

      <p>{status}</p>
    </div>
  );
}
