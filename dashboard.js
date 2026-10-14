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

  const ROUTES = ["overview", "directory", "interests", "activity", "challenges"];

  const state = {
    user: null,
    directory: [],
    interests: [],
    activity: [],
    challenges: null
  };

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

  // ---------- Auth gate ----------
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

  async function requireAdmin() {
    if (!client) {
      window.location.replace("admin.html");
      return false;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user) {
      window.location.replace("admin.html");
      return false;
    }
    if (!(await isAdmin())) {
      await client.auth.signOut();
      window.location.replace("admin.html");
      return false;
    }
    state.user = session.user;
    $("adminEmailLabel").textContent = (session.user.email || "ADMIN").toUpperCase();
    return true;
  }

  async function signOut() {
    if (client) await client.auth.signOut();
    window.location.replace("admin.html");
  }

  // ---------- Panel routing (in-page) ----------
  function showPanel(route) {
    if (!ROUTES.includes(route)) route = "overview";
    document.querySelectorAll("[data-route]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.route === route);
    });
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === "panel-" + route);
    });
    history.replaceState(null, "", "#" + route);
  }

  // ---------- Data ----------
  async function loadDirectory() {
    const body = $("directoryBody");
    body.innerHTML = `<tr><td colspan="6" class="empty-state">Loading directory…</td></tr>`;
    try {
      const { data, error } = await client.rpc("admin_participant_directory");
      if (error) throw error;
      const rows = typeof data === "string" ? JSON.parse(data) : (data || []);
      state.directory = Array.isArray(rows) ? rows : [];
      renderDirectory();
    } catch (err) {
      console.error(err);
      body.innerHTML = `<tr><td colspan="6" class="empty-state">Could not load directory.<br><span class="mono">${escapeHTML(err.message || "")}</span></td></tr>`;
    }
  }

  function renderDirectory() {
    const q = ($("directorySearch").value || "").trim().toLowerCase();
    let rows = state.directory;
    if (q) {
      rows = rows.filter((p) => {
        const blob = [p.callsign, p.display_name, p.institution, p.skill_level, ...(p.interests || [])]
          .join(" ").toLowerCase();
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
    $("lastRefresh").textContent = "Refreshing…";
    await Promise.all([loadDirectory(), loadInterests(), loadActivity(), loadChallenges()]);
    loadOverviewCounts();
    $("lastRefresh").textContent = "Last refresh · " + formatTime(new Date().toISOString());
  }

  // ---------- Boot ----------
  async function boot() {
    const ok = await requireAdmin();
    if (!ok) return;

    document.querySelectorAll("[data-route]").forEach((btn) => {
      btn.addEventListener("click", () => showPanel(btn.dataset.route));
    });
    $("logoutButton").addEventListener("click", signOut);
    $("refreshAll").addEventListener("click", () => refreshAll().then(() => toast("Dashboard refreshed.")));
    $("refreshDirectory").addEventListener("click", loadDirectory);
    $("refreshInterests").addEventListener("click", loadInterests);
    $("refreshActivity").addEventListener("click", loadActivity);
    $("refreshChallenges").addEventListener("click", loadChallenges);
    $("directorySearch").addEventListener("input", renderDirectory);
    $("activityFilter").addEventListener("change", renderActivity);

    if (client) {
      client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") window.location.replace("admin.html");
      });
    }

    const hash = (location.hash || "").replace(/^#/, "");
    showPanel(ROUTES.includes(hash) ? hash : "overview");
    refreshAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();