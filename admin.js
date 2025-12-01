import { supabase } from "./lib/supabaseClient.js";

const ADMIN_EMAIL = "rudikruger708@icloud.com";

const statusEl = document.getElementById("status");
const rowsEl = document.getElementById("rows");

let accessToken = null;

function setStatus(msg, type="info") {
  statusEl.textContent = msg;
  statusEl.className = "status " + (type === "ok" ? "ok" : type === "err" ? "err" : "");
}

// ----------------------------------------
// AUTH GUARD
// ----------------------------------------
async function requireAdmin() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    alert("Please log in first.");
    window.location.href = "/login.html";
    return null;
  }

  if (session.user.email !== ADMIN_EMAIL) {
    alert("Access denied.");
    window.location.href = "/login.html";
    return null;
  }

  accessToken = session.access_token;
  return session;
}

// ----------------------------------------
// LOAD PENDING DOCTORS
// ----------------------------------------
async function loadPending() {
  setStatus("Loading pending doctors…");
  rowsEl.innerHTML = `<tr><td colspan="6">Loading…</td></tr>`;

  const res = await fetch("/api/admin-get-pending", {
    headers: { Authorization: "Bearer " + accessToken },
  });

  const json = await res.json();

  if (!res.ok) {
    setStatus("Error loading doctors.", "err");
    return;
  }

  const list = json.pending || [];

  if (!list.length) {
    rowsEl.innerHTML = `<tr><td colspan="6">No pending requests.</td></tr>`;
    setStatus("No pending doctors.");
    return;
  }

  rowsEl.innerHTML = "";

  list.forEach(doc => {
    const tr = document.createElement("tr");
    const created = doc.created_at ? new Date(doc.created_at).toLocaleString() : "-";

    tr.innerHTML = `
      <td>${doc.title} ${doc.first_name} ${doc.last_name}</td>
      <td>${doc.email}</td>
      <td>${doc.mp_number}</td>
      <td>${doc.clinic_name}</td>
      <td>${created}</td>
      <td>
        <button class="btn-approve" data-id="${doc.id}">Approve</button>
        <button class="btn-reject" data-id="${doc.id}">Reject</button>
        <button class="btn-reset" data-email="${doc.email}">Reset Password</button>
      </td>
    `;

    rowsEl.appendChild(tr);
  });

  attachHandlers();
  setStatus("Loaded.");
}

// ----------------------------------------
// BUTTON HANDLERS
// ----------------------------------------
function attachHandlers() {
  document.querySelectorAll(".btn-approve").forEach(btn => {
    btn.onclick = () => approveDoctor(btn.dataset.id);
  });

  document.querySelectorAll(".btn-reject").forEach(btn => {
    btn.onclick = () => rejectDoctor(btn.dataset.id);
  });

  document.querySelectorAll(".btn-reset").forEach(btn => {
    btn.onclick = () => resetPassword(btn.dataset.email);
  });
}

// APPROVE DOCTOR
async function approveDoctor(id) {
  if (!confirm("Approve this doctor?")) return;

  setStatus("Approving…");

  const res = await fetch("/api/admin-approve-doctor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({ id }),
  });

  const json = await res.json();

  if (!res.ok || !json.ok) {
    setStatus("Failed: " + (json.error || ""), "err");
    return;
  }

  setStatus("Doctor approved.", "ok");
  loadPending();
}

// REJECT DOCTOR
async function rejectDoctor(id) {
  if (!confirm("Reject this doctor?")) return;

  setStatus("Rejecting…");

  const res = await fetch("/api/admin-reject-doctor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({ id }),
  });

  const json = await res.json();

  if (!res.ok || !json.ok) {
    setStatus("Failed: " + (json.error || ""), "err");
    return;
  }

  setStatus("Doctor rejected.", "ok");
  loadPending();
}

// RESET PASSWORD
async function resetPassword(email) {
  if (!confirm(`Send password reset email to ${email}?`)) return;

  setStatus("Sending reset email…");

  const res = await fetch("/api/admin-reset-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
    },
    body: JSON.stringify({ email }),
  });

  const json = await res.json();

  if (!res.ok || !json.ok) {
    setStatus("Failed: " + (json.error || ""), "err");
    return;
  }

  setStatus("Password reset email sent!", "ok");
}

// INIT
(async () => {
  const session = await requireAdmin();
  if (!session) return;
  loadPending();
})();
