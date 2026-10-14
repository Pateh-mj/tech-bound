(() => {
  "use strict";

  // Read identity from the page so one script serves every hub.
  const body = document.body;
  const DISCIPLINE_ID = body.dataset.discipline || "Cybersecurity";
  const DISCIPLINE_LABEL = body.dataset.disciplineLabel || DISCIPLINE_ID;

  const CONFIG = window.TECH_UNBOUND_CONFIG || {};
  const hasConfig = Boolean(
    CONFIG.supabaseUrl && CONFIG.supabaseAnonKey &&
    /^https:\/\/.+\.supabase\.co\/?$/.test(CONFIG.supabaseUrl)
  );
  const client = hasConfig && window.supabase
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
    : null;

  const $ = (id) => document.getElementById(id);

  function readLocal(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  function toast(message) {
    const el = $("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  function initials(text) {
    const parts = String(text || "").trim().split(/[\s_-]+/).filter(Boolean);
    return (parts.length > 1
      ? parts[0][0] + parts[1][0]
      : (parts[0] || "?").slice(0, 2)).toUpperCase();
  }
  function formatTime(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return String(iso);
    }
  }

  let interests = readLocal("tu_interests", []);

  function updateInterestUI() {
    const selected = interests.includes(DISCIPLINE_ID);
    const btn = $("toggleInterest");
    const status = $("interestStatus");
    if (btn) {
      btn.textContent = selected
        ? "Remove from my interests"
        : "Add to my interests";
      btn.classList.toggle("button-primary", !selected);
      btn.classList.toggle("button-quiet", selected);
    }
    if (status) {
      status.textContent = selected
        ? `${DISCIPLINE_LABEL} is in your interest list on this device.`
        : "Interest not selected on this device yet.";
    }
  }

  const toggleBtn = $("toggleInterest");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (interests.includes(DISCIPLINE_ID)) {
        interests = interests.filter((x) => x !== DISCIPLINE_ID);
        toast(`Removed ${DISCIPLINE_LABEL} from your interests.`);
      } else {
        interests = [...interests, DISCIPLINE_ID];
        toast(`${DISCIPLINE_LABEL} added to your interests.`);
      }
      writeLocal("tu_interests", interests);
      updateInterestUI();

      const profile = readLocal("tu_profile", null);
      const visitorId = localStorage.getItem("tu_visitor_id");
      if (client && profile && visitorId) {
        client.from("team_profiles").upsert({
          visitor_id: visitorId,
          callsign: profile.callsign,
          display_name: profile.displayName || null,
          institution: profile.institution || null,
          skill_level: profile.skillLevel || "Curious beginner",
          goals: profile.goals || null,
          interests,
          is_public: profile.isPublic !== false,
          updated_at: new Date().toISOString()
        }, { onConflict: "visitor_id" }).then(({ error }) => {
          if (error) console.warn(error.message);
        });
      }
    });
  }

  function renderPeople(rows) {
    const list = $("peopleList");
    if (!list) return;
    if (!rows.length) {
      list.innerHTML =
        `<div class="empty-state">No public profiles have selected ${escapeHTML(DISCIPLINE_LABEL)} yet. Be the first — add the interest above, then save a public profile on the home page.</div>`;
      return;
    }
    list.innerHTML = rows.map((p) => {
      const tags = (p.interests || []).slice(0, 3);
      return `<article class="community-person">
        <div class="person-avatar">${escapeHTML(initials(p.callsign))}</div>
        <div class="person-main">
          <div class="person-title"><strong>${escapeHTML(p.callsign || "Anonymous")}</strong></div>
          <p>${escapeHTML([p.display_name, p.institution].filter(Boolean).join(" · ") || p.goals || "Curious technologist")}</p>
          <div class="person-tags">${tags.map((i) => `<span>${escapeHTML(i)}</span>`).join("")}</div>
        </div>
        <div class="person-level">${escapeHTML(p.skill_level || "Curious")}</div>
      </article>`;
    }).join("");
  }

  function renderLeaderboard(rows) {
    const body = $("leaderboardBody");
    const meta = $("boardMeta");
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="empty-state">No public explorers for ${escapeHTML(DISCIPLINE_LABEL)} yet. Complete lab missions and keep your profile public to appear here.</td></tr>`;
      if (meta) meta.textContent = "";
      return;
    }
    body.innerHTML = rows.map((p, i) => {
      const missions = Number(p.mission_count || 0);
      const bar = Math.min(100, missions * 33);
      return `<tr>
        <td class="mono" style="color:var(--cyan)">${String(i + 1).padStart(2, "0")}</td>
        <td>
          <div class="dir-callsign">${escapeHTML(p.callsign || "—")}</div>
          <div class="dir-sub">${escapeHTML(p.display_name || p.institution || "")}</div>
        </td>
        <td>${escapeHTML(p.skill_level || "—")}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;min-width:120px">
            <div class="mission-bar-track" style="flex:1;height:6px">
              <div class="mission-bar-fill" style="width:${Math.max(missions ? 8 : 0, bar)}%"></div>
            </div>
            <span class="mono" style="color:var(--cyan);font-size:11px">${missions}/3</span>
          </div>
        </td>
        <td><span class="dir-visibility public">PUBLIC</span></td>
        <td class="mono" style="font-size:10px;color:var(--subtle)">${formatTime(p.updated_at)}</td>
      </tr>`;
    }).join("");
    if (meta) {
      meta.textContent = `${rows.length} public explorer${rows.length === 1 ? "" : "s"} · ranked by lab missions completed (transparent engagement, not a grade)`;
    }
  }

  async function loadSectorData() {
    const list = $("peopleList");
    const body = $("leaderboardBody");

    if (!client) {
      const profile = readLocal("tu_profile", null);
      const completed = readLocal("tu_completed", []);
      const localInterests = readLocal("tu_interests", []);
      if (profile && profile.isPublic !== false && localInterests.includes(DISCIPLINE_ID)) {
        const row = {
          callsign: profile.callsign,
          display_name: profile.displayName,
          institution: profile.institution,
          skill_level: profile.skillLevel,
          goals: profile.goals,
          interests: localInterests,
          updated_at: new Date().toISOString(),
          mission_count: completed.length
        };
        renderPeople([row]);
        renderLeaderboard([row]);
      } else {
        if (list) {
          list.innerHTML =
            '<div class="empty-state">Connect Supabase to see the sector board across devices.<br><br><span class="mono">LOCAL MODE</span></div>';
        }
        if (body) {
          body.innerHTML =
            '<tr><td colspan="6" class="empty-state">Sector board needs shared data (Supabase) to rank explorers across the community.</td></tr>';
        }
      }
      return;
    }

    if (list) list.innerHTML = '<div class="empty-state">Loading explorers…</div>';
    if (body) body.innerHTML = '<tr><td colspan="6" class="empty-state">Loading sector board…</td></tr>';

    try {
      let enriched = [];
      const { data: boardData, error: boardErr } = await client.rpc(
        "public_sector_board",
        { interest_name: DISCIPLINE_ID }
      );

      if (!boardErr && boardData) {
        enriched = typeof boardData === "string" ? JSON.parse(boardData) : boardData;
        if (!Array.isArray(enriched)) enriched = [];
      } else {
        const { data: profiles, error } = await client
          .from("team_profiles")
          .select("visitor_id,callsign,display_name,institution,skill_level,goals,interests,is_public,updated_at")
          .eq("is_public", true)
          .contains("interests", [DISCIPLINE_ID])
          .order("updated_at", { ascending: false })
          .limit(40);
        if (error) throw error;
        enriched = (profiles || []).map((p) => ({ ...p, mission_count: 0 }));
      }

      renderPeople(enriched);
      renderLeaderboard(enriched);
    } catch (err) {
      console.error(err);
      if (list) {
        list.innerHTML =
          `<div class="empty-state">Could not load explorers.<br><span class="mono">${escapeHTML(err.message || "")}</span></div>`;
      }
      if (body) {
        body.innerHTML =
          `<tr><td colspan="6" class="empty-state">Sector board unavailable.<br><span class="mono">${escapeHTML(err.message || "")}</span></td></tr>`;
      }
    }
  }

  const label = $("connectionLabel");
  if (label) {
    label.textContent = client ? "SHARED DATABASE" : "LOCAL MODE";
    label.parentElement.classList.toggle("connected", Boolean(client));
  }

  $("refreshPeople")?.addEventListener("click", loadSectorData);
  $("refreshBoard")?.addEventListener("click", loadSectorData);

  updateInterestUI();
  loadSectorData();
})();