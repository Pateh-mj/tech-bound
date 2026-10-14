(() => {
  "use strict";

  const CONFIG = window.TECH_UNBOUND_CONFIG || {};
  const hasConfig = Boolean(
    CONFIG.supabaseUrl &&
    CONFIG.supabaseAnonKey &&
    /^https:\/\/.+\.supabase\.co\/?$/.test(CONFIG.supabaseUrl)
  );
  const client = hasConfig && window.supabase
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
    : null;

  const $ = (id) => document.getElementById(id);

  function toast(message) {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  async function isAdmin() {
    if (!client) return false;
    try {
      const { data, error } = await client.rpc("is_admin");
      if (error) return false;
      return Boolean(data);
    } catch {
      return false;
    }
  }

  async function redirectIfAlreadyAdmin() {
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) return;
    if (await isAdmin()) {
      window.location.replace("dashboard.html");
    }
  }

  async function signIn() {
    if (!client) {
      $("loginError").textContent =
        "Supabase is not configured. Set supabaseUrl and supabaseAnonKey in config.js.";
      return;
    }

    const email = ($("adminEmail").value || "").trim();
    const password = $("adminPassword").value || "";

    if (!email || !password) {
      $("loginError").textContent = "Enter both email and password.";
      return;
    }

    const btn = $("loginButton");
    btn.disabled = true;
    const original = btn.innerHTML;
    btn.innerHTML = "Working…";
    $("loginError").textContent = "";

    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        $("loginError").textContent = error.message || "Sign-in failed.";
        return;
      }

      if (!(await isAdmin())) {
        await client.auth.signOut();
        $("loginError").textContent =
          "Signed in, but this account is not authorised. Add the user to admin_users in Supabase.";
        return;
      }

      toast("Administrator session started.");
      window.location.href = "dashboard.html";
    } catch (err) {
      $("loginError").textContent = err.message || "Unexpected error during sign-in.";
    } finally {
      btn.disabled = false;
      btn.innerHTML = original;
    }
  }

  function boot() {
    $("loginButton").addEventListener("click", signIn);
    $("adminPassword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") signIn();
    });
    $("adminEmail").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("adminPassword").focus();
    });
    $("adminEmail").focus();
    redirectIfAlreadyAdmin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();