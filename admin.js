(() => {
  "use strict";

  /* =========================================================================
     TECH//UNBOUND Admin Control Center
     Single-file "router + components" pattern (login view vs dashboard views)
     ========================================================================= */

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

  const ROUTES = {
    login: "login",
    overview: "overview",
    directory: "directory",
    interests: "interests",
    activity: "activity",
    challenges: "challenges"
  };
  const DASHBOARD_ROUTES = new Set([
    ROUTES.overview, ROUTES.directory, ROUTES.interests,
    ROUTES.activity, ROUTES.challenges
  ]);

  const state = {
    user: null,
    route: ROUTES.login,
    directory: [],
    interests: [],
    activity: [],
    challenges: null,
    lastRefresh: null,
    loading: false,
    bootstrapped: false
  };

  // ---------- Utilities ----------
  function toast(message) {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function formatTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    } catch {
      return String(iso);
    }
  }

  function shortId(id) {
    if (!id) return "—";
    return id.length > 12 ? id.slice(0, 8) + "…" : id;
  }

  function setLoading(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.dataset.originalText = btn.dataset.originalText || btn.innerHTML;
    if (on) btn.innerHTML = "Working…";
    else btn.innerHTML = btn.dataset.originalText;
  }

  // ---------- Router (hash-based, React-like) ----------
  function parseHash() {
    const raw = (location.hash || "").replace(/^#/, "").trim().toLowerCase();
    if (!raw || raw === ROUTES.login) return ROUTES.login;
    if (DASHBOARD_ROUTES.has(raw)) return raw;
    return ROUTES.overview;
  }

  function navigate(route, { replace = false } = {}) {
    const next = DASHBOARD_ROUTES.has(route) || route === ROUTES.login
      ? route
      : ROUTES.overview;
    const hash = "#" + next;
    if (replace) {
      history.replaceState(null, "", hash);
    } else if (location.hash !== hash) {
      location.hash = hash;
      // hashchange handler will call renderRoute
      return;
    }
    // Always render when hash already matches or we used replaceState
    renderRoute(next);
  }

  function renderRoute(route) {
    state.route = route;

    const loginView = $("loginGate");
    const dashView = $("adminShell");

    if (!state.user) {
      // Force login view
      loginView.hidden = false;
      dashView.hidden = true;
      document.body.classList.add("view-login");
      document.body.classList.remove("view-dashboard");
      document.title = "TECH//UNBOUND — Admin Sign In";
      // Focus email once login is visible
      requestAnimationFrame(() => {
        const email = $("adminEmail");
        if (email && !email.value) email.focus();
      });
      return;
    }

    // Authenticated → dashboard
    loginView.hidden = true;
    dashView.hidden = false;
    document.body.classList.remove("view-login");
    document.body.classList.add("view-dashboard");
    document.title = "TECH//UNBOUND — Admin · " + route.charAt(0).toUpperCase() + route.slice(1);

    // Nav active state
    document.querySelectorAll("[data-route]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.route === route);
    });

    // Panel visibility
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      const id = panel.id.replace("panel-", "");
      panel.classList.toggle("active", id === route);
    });

    $("adminEmailLabel").textContent = (state.user.email || "ADMIN").toUpperCase();
  }

  function onHashChange() {
    const route = parseHash();

    if (!state.user) {
      if (route !== ROUTES.login) navigate(ROUTES.login, { replace: true });
      else renderRoute(ROUTES.login);
      return;
    }

    // Logged in: never stay on login
    if (route === ROUTES.login) {
      navigate(ROUTES.overview, { replace: true });
      return;
    }

    renderRoute(route);
  }

  // ---------- Auth component ----------
  async function checkAdminStatus() {
    if (!client) return false;
    try {
      const { data, error } = await client.rpc("is_admin");
      if (error) {
        console.warn("is_admin:", error.message);
        return false;
      }
      return Boolean(data);
    } catch (err) {
      console.warn(err);
      return false;
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
    setLoading(btn, true);
    $("loginError").textContent = "";

    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        $("loginError").textContent = error.message || "Sign-in failed.";
        return;
      }

      const isAdmin = await checkAdminStatus();
      if (!isAdmin) {
        await client.auth.signOut();
        $("loginError").textContent =
          "Signed in, but this account is not authorised. Add the user to admin_users in Supabase.";
        return;
      }

      state.user = data.user;
      $("adminPassword").value = "";
      navigate(ROUTES.overview, { replace: true });
      toast("Administrator session started.");
      // Load data after first paint
      refreshAll();
    } catch (err) {
      $("loginError").textContent = err.message || "Unexpected error during sign-in.";
    } finally {
      setLoading(btn, false);
    }
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    state.user = null;
    state.directory = [];
    state.interests = [];
    state.activity = [];
    state.challenges = null;
    navigate(ROUTES.login, { replace: true });
    toast("Signed out.");
  }

  async function bootstrapAuth() {
    if (!client) {
      state.user = null;
      navigate(ROUTES.login, { replace: true });
      $("loginError").textContent = "Supabase is not configured.";
      return;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
      state.user = null;
      navigate(ROUTES.login, { replace: true });
      return;
    }

    const isAdmin = await checkAdminStatus();
    if (!isAdmin) {
      await client.auth.signOut();
      state.user = null;
      navigate(ROUTES.login, { replace: true });
      $("loginError").textContent = "Your account is no longer authorised as an administrator.";
      return;
    }

    state.user = session.user;
    const target = DASHBOARD_ROUTES.has(parseHash()) ? parseHash() : ROUTES.overview;
    navigate(target, { replace: true });
    refreshAll();
  }

  // ---------- Data components ----------
  async function loadDirectory() {
    const body = $("directoryBody");
    if (!client || !state.user) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">Not signed in.</td></tr>`;
      return;
    }
    body.innerHTML = `<tr><td colspan="6" class="empty-state">Loading directory…</td></tr>`;

    try {
      const { data, error } = await client.rpc("admin_participant_directory");
      if (error) throw error;
      const rows = typeof data === "string" ? JSON.parse(data) : (data || []);
      state.directory = Array.isArray(rows) ? rows : [];
      renderDirectory();
    } catch (err) {
      console.error(err);
      body.innerHTML = `<tr><td colspan="6" class="empty-state">Could not load directory.<br><span class="mono">${escapeHTML(err.message || "RPC error")}</span></td></tr>`;
    }
  }

  function renderDirectory() {
    const q = ($("directorySearch").value || "").trim().toLowerCase();
    let rows = state.directory;

    if (q) {
      rows = rows.filter((p) => {
        const blob = [
          p.callsign, p.display_name, p.institution,
          p.skill_level, ...(p.interests || [])
        ].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }

    const body = $("directoryBody");
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">${q ? "No matching participants." : "No profiles yet."}</td></tr>`;
      $("directoryMeta").textContent = "";
      return;
    }

    body.innerHTML = rows.map((p) => {
      const interests = (p.interests || []).slice(0, 4);
      const visClass = p.is_public ? "public" : "private";
      const visLabel = p.is_public ? "PUBLIC" : "PRIVATE";
      return `<tr>
        <td>
          <div class="dir-callsign">${escapeHTML(p.callsign || "—")}</div>
          <div class="dir-sub mono">${escapeHTML(shortId(p.visitor_id))}</div>
        </td>
        <td>
          <div>${escapeHTML(p.display_name || "—")}</div>
          <div class="dir-sub">${escapeHTML(p.institution || "")}</div>
        </td>
        <td>${escapeHTML(p.skill_level || "—")}</td>
        <td><div class="dir-tags">${interests.map(i => `<span>${escapeHTML(i)}</span>`).join("") || "<span>—</span>"}</div></td>
        <td><span class="dir-visibility ${visClass}">${visLabel}</span></td>
        <td class="mono" style="font-size:10px;color:var(--subtle)">${formatTime(p.updated_at)}</td>
      </tr>`;
    }).join("");

    $("directoryMeta").textContent = `Showing ${rows.length} of ${state.directory.length} profiles`;
  }

  async function loadInterests() {
    const el = $("interestChartFull");
    const overview = $("overviewInterests");
    if (!client || !state.user) {
      el.innerHTML = overview.innerHTML = `<div class="empty-state">Not signed in.</div>`;
      return;
    }

    try {
      const { data, error } = await client.rpc("admin_interest_analytics");
      if (error) throw error;
      const rows = typeof data === "string" ? JSON.parse(data) : (data || []);
      state.interests = Array.isArray(rows) ? rows : [];
      renderInterestChart(el, state.interests);
      renderInterestChart(overview, state.interests.slice(0, 5));
    } catch (err) {
      console.error(err);
      el.innerHTML = overview.innerHTML =
        `<div class="empty-state">Interest data unavailable.<br><span class="mono">${escapeHTML(err.message || "")}</span></div>`;
    }
  }

  function renderInterestChart(container, rows) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">No interest data yet.</div>`;
      return;
    }
    const max = Math.max(...rows.map(r => Number(r.count) || 0), 1);
    container.innerHTML = rows.map(r => `
      <div class="bar-row">
        <span class="bar-label">${escapeHTML(r.interest)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(3, (Number(r.count) / max) * 100)}%"></div></div>
        <span class="bar-count">${Number(r.count) || 0}</span>
      </div>
    `).join("");
  }

  async function loadActivity() {
    const el = $("activityTimeline");
    if (!client || !state.user) {
      el.innerHTML = `<div class="empty-state">Not signed in.</div>`;
      return;
    }
    el.innerHTML = `<div class="empty-state">Loading activity…</div>`;

    try {
      const { data, error } = await client.rpc("admin_activity_timeline", { limit_count: 250 });
      if (error) throw error;
      const rows = typeof data === "string" ? JSON.parse(data) : (data || []);
      state.activity = Array.isArray(rows) ? rows : [];
      renderActivity();
    } catch (err) {
      console.error(err);
      el.innerHTML = `<div class="empty-state">Activity stream unavailable.<br><span class="mono">${escapeHTML(err.message || "")}</span></div>`;
    }
  }

  function renderActivity() {
    const filter = $("activityFilter").value;
    let rows = state.activity;
    if (filter !== "all") rows = rows.filter(r => r.event_type === filter);

    const el = $("activityTimeline");
    if (!rows.length) {
      el.innerHTML = `<div class="empty-state">${filter === "all" ? "No activity recorded yet." : "No events of this type."}</div>`;
      return;
    }

    el.innerHTML = rows.map(r => {
      const detailParts = [r.category, r.detail].filter(Boolean).join(" · ");
      return `<div class="timeline-item">
        <div class="timeline-time">${formatTime(r.created_at)}</div>
        <div class="timeline-body">
          <div class="timeline-type">${escapeHTML(r.event_type)}</div>
          ${detailParts ? `<div class="timeline-detail">${escapeHTML(detailParts)}</div>` : ""}
          <div class="timeline-visitor">${escapeHTML(shortId(r.visitor_id))}</div>
        </div>
      </div>`;
    }).join("");
  }

  async function loadChallenges() {
    if (!client || !state.user) {
      $("chalTotal").textContent = "—";
      $("chalUnique").textContent = "—";
      $("challengeBars").innerHTML = `<div class="empty-state">Not signed in.</div>`;
      $("overviewMissions").innerHTML = `<div class="empty-state">Not signed in.</div>`;
      return;
    }

    try {
      const { data, error } = await client.rpc("admin_challenge_stats");
      if (error) throw error;
      const m = typeof data === "string" ? JSON.parse(data) : (data || {});
      state.challenges = m;

      $("chalTotal").textContent = Number(m.total_completions || 0).toLocaleString();
      $("chalUnique").textContent = Number(m.unique_participants || 0).toLocaleString();
      $("statCompletions").textContent = Number(m.total_completions || 0).toLocaleString();
      $("statLabbers").textContent = Number(m.unique_participants || 0).toLocaleString();

      renderMissionBars($("challengeBars"), m.by_mission || []);
      renderMissionBars($("overviewMissions"), m.by_mission || []);
    } catch (err) {
      console.error(err);
      $("challengeBars").innerHTML = $("overviewMissions").innerHTML =
        `<div class="empty-state">Challenge stats unavailable.<br><span class="mono">${escapeHTML(err.message || "")}</span></div>`;
    }
  }

  function renderMissionBars(container, rows) {
    if (!container) return;
    if (!rows.length) {
      container.innerHTML = `<div class="empty-state">No completions yet.</div>`;
      return;
    }
    const labels = {
      inspect: "01 · Know Your Target",
      validate: "02 · Test the Input",
      token: "03 · Track Down the Flag"
    };
    const max = Math.max(...rows.map(r => Number(r.count) || 0), 1);
    container.innerHTML = rows.map(r => `
      <div class="mission-bar-row">
        <span class="mission-bar-label">${escapeHTML(labels[r.mission_id] || r.mission_id)}</span>
        <div class="mission-bar-track">
          <div class="mission-bar-fill" style="width:${Math.max(4, (Number(r.count) / max) * 100)}%"></div>
        </div>
        <span class="mission-bar-count">${Number(r.count) || 0}</span>
      </div>
    `).join("");
  }

  function loadOverviewCounts() {
    if (state.directory.length) {
      $("statProfiles").textContent = state.directory.length.toLocaleString();
      $("statPublic").textContent = state.directory.filter(p => p.is_public).length.toLocaleString();
    } else {
      $("statProfiles").textContent = "—";
      $("statPublic").textContent = "—";
    }
  }

  async function refreshAll() {
    if (!state.user) return;
    $("lastRefresh").textContent = "Refreshing…";
    await Promise.all([
      loadDirectory(),
      loadInterests(),
      loadActivity(),
      loadChallenges()
    ]);
    loadOverviewCounts();
    state.lastRefresh = new Date();
    $("lastRefresh").textContent = "Last refresh · " + formatTime(state.lastRefresh.toISOString());
  }

  // ---------- Wire UI ----------
  function bindEvents() {
    $("loginButton").addEventListener("click", signIn);
    $("adminPassword").addEventListener("keydown", (e) => {
      if (e.key === "Enter") signIn();
    });
    $("adminEmail").addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("adminPassword").focus();
    });
    $("logoutButton").addEventListener("click", signOut);

    // Nav uses data-route + hash (component-style routing)
    document.querySelectorAll("[data-route]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.user) return;
        navigate(btn.dataset.route);
      });
    });

    $("refreshAll").addEventListener("click", () => {
      refreshAll().then(() => toast("Dashboard refreshed."));
    });
    $("refreshDirectory").addEventListener("click", loadDirectory);
    $("refreshInterests").addEventListener("click", loadInterests);
    $("refreshActivity").addEventListener("click", loadActivity);
    $("refreshChallenges").addEventListener("click", loadChallenges);

    $("directorySearch").addEventListener("input", renderDirectory);
    $("activityFilter").addEventListener("change", renderActivity);

    window.addEventListener("hashchange", onHashChange);

    if (client) {
      client.auth.onAuthStateChange(async (event) => {
        if (event === "SIGNED_OUT") {
          state.user = null;
          navigate(ROUTES.login, { replace: true });
        }
      });
    }
  }

  // ---------- Boot ----------
  function boot() {
    // Hide both views until auth is resolved to avoid flash
    $("loginGate").hidden = true;
    $("adminShell").hidden = true;

    bindEvents();
    bootstrapAuth()
      .catch((err) => {
        console.error("Auth bootstrap failed:", err);
        state.user = null;
        renderRoute(ROUTES.login);
        const errEl = $("loginError");
        if (errEl) errEl.textContent = "Could not start admin session. Check config.js and the console.";
      })
      .finally(() => {
        state.bootstrapped = true;
        // Safety net: if neither view is visible, force login
        if ($("loginGate").hidden && $("adminShell").hidden) {
          state.user = null;
          renderRoute(ROUTES.login);
        }
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();