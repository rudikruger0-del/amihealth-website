"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("Unknown");
  const [userEmail, setUserEmail] = useState("");
  const [status, setStatus] = useState("");

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

    setStatus("Uploading…");

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

    // ❌ DO NOT CALL run-ai manually
    // Worker handles everything.

    // router.push(`/report?id=${data.report_id}`);
  };

  return (
    <main className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl">Upload Report</h1>

      <form onSubmit={handleUpload} className="flex flex-col gap-4">

        <input
          type="email"
          className="border p-2"
          placeholder="Your email"
          value={userEmail}
          onChange={(e) => setUserEmail(e.target.value)}
          required
        />

        <input
          type="file"
          className="border p-2"
          onChange={(e) => setFile(e.target.files[0])}
          required
        />

        <input
          type="text"
          className="border p-2"
          placeholder="Report Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="text"
          className="border p-2"
          placeholder="Patient Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          type="number"
          className="border p-2"
          placeholder="Age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />

        <select
          className="border p-2"
          value={sex}
          onChange={(e) => setSex(e.target.value)}
        >
          <option>Unknown</option>
          <option>Male</option>
          <option>Female</option>
        </select>

        <button
          type="submit"
          className="bg-blue-600 text-white p-2 rounded"
        >
          Upload & Queue AI
        </button>
      </form>

      <p>{status}</p>
    </main>
  );
}
