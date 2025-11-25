<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AMI — Dashboard</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />

  <style>
    :root {
      --bg:#030414;
      --card:#0b1020;
      --muted:#98a0b3;
      --accent:#00e0b8;
    }

    * { box-sizing:border-box; }
    body {
      margin:0;
      font-family:Inter, system-ui, sans-serif;
      background:radial-gradient(circle at top, #071a33, #02030f);
      color:#eaf6ff;
      min-height:100vh;
      display:flex;
      flex-direction:column;
    }

    header {
      padding:14px 24px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      max-width:1100px;
      margin:0 auto;
      width:100%;
    }

    .brand {
      display:flex;
      align-items:center;
      gap:10px;
      text-decoration:none;
      color:inherit;
    }

    .brand img {
      height:32px;
      width:auto;
    }

    .brand-title {
      font-weight:800;
      font-size:18px;
    }
    .brand-sub {
      font-size:11px;
      color:var(--muted);
    }

    nav {
      display:flex;
      gap:12px;
      align-items:center;
      font-size:14px;
    }

    nav a {
      color:var(--muted);
      text-decoration:none;
      padding:6px 10px;
      border-radius:999px;
    }

    nav a.active {
      background:rgba(0,224,184,0.12);
      color:#fff;
    }

    .login-pill {
      border:1px solid rgba(255,255,255,0.15);
      padding:6px 12px;
      border-radius:999px;
      text-decoration:none;
      color:#eaf6ff;
      font-size:13px;
    }

    main {
      flex:1;
      display:flex;
      justify-content:center;
      align-items:flex-start;
      padding:10px 16px 30px;
    }

    .container {
      width:100%;
      max-width:1100px;
      margin-top:10px;
      display:grid;
      grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);
      gap:18px;
    }

    @media (max-width:950px){
      .container{grid-template-columns:1fr}
    }

    .panel {
      background:rgba(11,16,32,0.96);
      border-radius:16px;
      border:1px solid rgba(255,255,255,0.08);
      box-shadow:0 18px 50px rgba(0,0,0,0.6);
      padding:20px 22px;
    }

    h1 {
      margin:0 0 8px;
      font-size:22px;
    }

    .muted {
      color:var(--muted);
      font-size:14px;
      margin:0 0 16px;
    }

    .btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:6px;
      padding:10px 16px;
      border-radius:999px;
      border:none;
      background:linear-gradient(90deg,#00e0b8,#00b7ff);
      color:#001821;
      font-weight:700;
      font-size:14px;
      cursor:pointer;
      box-shadow:0 0 18px rgba(0,255,220,0.3);
      text-decoration:none;
    }

    .btn.secondary {
      background:transparent;
      color:#eaf6ff;
      border:1px solid rgba(255,255,255,0.18);
      box-shadow:none;
    }

    .status {
      margin-top:10px;
      min-height:20px;
      font-size:13px;
      color:#ffb3b3;
      white-space:pre-wrap;
    }
  </style>
</head>

<body>

<header>
  <a class="brand" href="/index.html">
    <img src="/logo.png" alt="AMI Logo" />
    <div>
      <div class="brand-title">AMI Health</div>
      <div class="brand-sub">Artificial Medical Intelligence</div>
    </div>
  </a>

  <nav>
    <a href="/dashboard.html" class="active">Dashboard</a>
    <a href="/upload.html">Upload Report</a>
    <a class="login-pill" href="#" id="logoutLink">Logout</a>
  </nav>
</header>

<main>
  <div class="container">

    <!-- LEFT CARD -->
    <section class="panel">
      <h1>AMI Dashboard</h1>
      <p class="muted">
        Welcome back, <span id="userEmailText">Loading…</span>.  
        From here you can upload lab or scan reports for AI-assisted interpretation.
      </p>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
        <a class="btn" href="/upload.html">Upload new report</a>
        <button class="btn secondary" id="logoutBtn">Logout</button>
      </div>

      <div class="status" id="statusArea"></div>
    </section>

    <!-- RIGHT CARD -->
    <section class="panel">
      <h2 style="margin:0 0 8px;font-size:18px">Next steps</h2>
      <ol style="margin:8px 0 0 20px;font-size:13px;color:var(--muted);line-height:1.5">
        <li>Click <b>Upload new report</b> to upload a PDF or image.</li>
        <li>The file is safely stored in Supabase’s private <code>reports</code> bucket.</li>
        <li>AMI processes the report using multimodal AI.</li>
        <li>Interpretations are stored and will appear in advanced dashboards coming soon.</li>
      </ol>
    </section>

  </div>
</main>

<!-- ✔ FIXED AUTH, REAL SUPABASE LOGIN CHECK -->
<script type="module">
  import { supabase } from "./lib/supabaseClient.js";

  const userEmailText = document.getElementById("userEmailText");
  const logoutBtn = document.getElementById("logoutBtn");
  const logoutLink = document.getElementById("logoutLink");

  async function loadUser() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      window.location.href = "/login.html";
      return;
    }

    userEmailText.textContent = session.user.email;
  }

  loadUser();

  async function doLogout(e) {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = "/login.html";
  }

  logoutBtn.addEventListener("click", doLogout);
  logoutLink.addEventListener("click", doLogout);
</script>

</body>
</html>
