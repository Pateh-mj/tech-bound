(() => {
  "use strict";

  const CONFIG = window.TECH_UNBOUND_CONFIG || {};
  const hasConfig = Boolean(
    CONFIG.supabaseUrl && CONFIG.supabaseAnonKey &&
    /^https:\/\/.+\.supabase\.co\/?$/.test(CONFIG.supabaseUrl)
  );
  const client = hasConfig && window.supabase
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
    : null;

  const $ = (id) => document.getElementById(id);

  const MISSIONS = {
    inspect: {
      title: "ORION / RECON BRIEFING",
      hint: "Type `help` to view safe commands",
      intro: [
        ["system", "ORION AUTH NODE // TRAINING ENVIRONMENT"],
        ["system", "Case file: OR-014. A fictional internal demo service is behaving unexpectedly."],
        ["accent", "Your task: learn how to inspect a target carefully before attempting a test."],
        ["good", "Scope confirmed: fictional UI only. No network targets or real accounts are connected."],
        ["system", "Available commands: help, brief, services, complete"]
      ]
    },
    validate: {
      title: "ORION / INPUT VALIDATION",
      hint: "Try the mock form with a test input",
      intro: [
        ["system", "MISSION 02 // INPUT VALIDATION"],
        ["system", "The mock sign-in form below represents a deliberately weak demo endpoint."],
        ["warn", "Use only the fictional test values shown here. Never enter real credentials."],
        ["accent", "Test account: demo | Expected lesson: client-side checks are not an access-control boundary."],
        ["system", "Commands: help, login demo <value>, complete"]
      ]
    },
    token: {
      title: "ORION / CLIENT-SIDE CLUE",
      hint: "Investigate the clue; try `hint` or `find flag`",
      intro: [
        ["system", "MISSION 03 // CLIENT-SIDE EXPOSURE"],
        ["system", "A developer left a training marker in this public client bundle."],
        ["accent", "This illustrates why secrets must not be embedded in frontend JavaScript."],
        ["system", "Commands: help, hint, find flag, complete"]
      ]
    }
  };

  const state = {
    visitorId: getVisitorId(),
    profile: readLocal("tu_profile", null),
    selectedMission: "inspect",
    completed: new Set(readLocal("tu_completed", []))
  };

  function getVisitorId() {
    let id = localStorage.getItem("tu_visitor_id");
    if (!id) {
      id = (crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : "tu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 18);
      localStorage.setItem("tu_visitor_id", id);
    }
    return id;
  }
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
  function safeText(value, max = 240) {
    return String(value || "").trim().slice(0, max);
  }
  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  function initials(text) {
    const parts = safeText(text, 60).split(/[\s_-]+/).filter(Boolean);
    return (parts.length > 1
      ? parts[0][0] + parts[1][0]
      : (parts[0] || "?").slice(0, 2)).toUpperCase();
  }
  function track(eventType, category = null, detail = null) {
    const record = {
      visitor_id: state.visitorId,
      event_type: safeText(eventType, 60),
      category: safeText(category, 80) || null,
      detail: safeText(detail, 160) || null
    };
    if (client) {
      client.from("activity_events").insert(record).then(({ error }) => {
        if (error) console.warn("Activity event could not be saved:", error.message);
      });
    } else {
      const local = readLocal("tu_events", []);
      local.push({ ...record, created_at: new Date().toISOString() });
      writeLocal("tu_events", local.slice(-200));
    }
  }

  function line(text, kind = "system") {
    const el = document.createElement("p");
    el.className = `terminal-line ${kind}`;
    el.textContent = text;
    $("terminalContent").appendChild(el);
  }

  function markComplete(id) {
    if (state.completed.has(id)) return;
    state.completed.add(id);
    writeLocal("tu_completed", [...state.completed]);
    const btn = document.querySelector(`.mission[data-mission="${id}"]`);
    if (btn) btn.classList.add("completed");
    const check = $("check-" + id);
    if (check) check.textContent = "✓";
    if (client) {
      client.from("lab_completions")
        .upsert({ visitor_id: state.visitorId, mission_id: id }, { onConflict: "visitor_id,mission_id" })
        .then(({ error }) => { if (error) console.warn(error.message); });
    }
    track("lab_mission_completed", id, null);
    toast("Mission complete. Nice investigation.");
  }

  function renderMission(id, shouldTrack = true) {
    state.selectedMission = id;
    document.querySelectorAll(".mission").forEach((b) =>
      b.classList.toggle("active", b.dataset.mission === id)
    );
    $("terminalTitle").textContent = MISSIONS[id].title;
    $("terminalHint").textContent = MISSIONS[id].hint;
    $("terminalContent").innerHTML = "";
    MISSIONS[id].intro.forEach(([kind, text]) => line(text, kind));

    if (id === "validate") {
      const note = document.createElement("div");
      note.className = "terminal-line";
      note.innerHTML =
        '<div style="margin:12px 0;padding:13px;border:1px solid #28465c;border-radius:7px;background:#0b1b2a">' +
        '<div style="color:#54d7e7;margin-bottom:7px">MOCK LOGIN FORM</div>' +
        '<div style="color:#8296aa;font-size:10px;margin-bottom:8px">Demo account: <code>demo</code> · This form is simulated.</div>' +
        '<input id="mockUser" placeholder="username (try demo)" style="width:100%;box-sizing:border-box;background:#071421;color:#e9f1f8;border:1px solid #294258;border-radius:5px;padding:9px;margin-bottom:7px">' +
        '<input id="mockPass" placeholder="training input only" type="text" style="width:100%;box-sizing:border-box;background:#071421;color:#e9f1f8;border:1px solid #294258;border-radius:5px;padding:9px;margin-bottom:8px">' +
        '<button id="mockLogin" class="button button-primary button-small" type="button">TEST MOCK LOGIN</button>' +
        '<div id="mockResult" style="margin-top:8px;color:#8296aa"></div></div>';
      $("terminalContent").appendChild(note);
      $("mockLogin").addEventListener("click", () => {
        const user = safeText($("mockUser").value, 40);
        const pass = safeText($("mockPass").value, 40);
        const result = $("mockResult");
        if (user.toLowerCase() === "demo" && pass.toLowerCase().includes("orion")) {
          result.textContent =
            "SIMULATION: weak client-side condition matched. Access control must be enforced server-side in real systems.";
          result.style.color = "#ffc66b";
          track("lab_attempt", "validate", "mock_condition_matched");
          line("Mock condition matched. Lesson: client-side checks can be inspected and bypassed.", "warn");
          markComplete("validate");
        } else {
          result.textContent =
            "SIMULATION: no match. Inspect the mission briefing and think about where validation happens.";
          track("lab_attempt", "validate", "mock_condition_not_matched");
        }
      });
    }

    if (shouldTrack) track("lab_mission_opened", id, null);
  }

  function handleCommand() {
    const raw = safeText($("terminalInput").value, 120);
    if (!raw) return;
    $("terminalInput").value = "";
    line("> " + raw, "accent");
    const cmd = raw.toLowerCase().trim();
    const id = state.selectedMission;

    if (cmd === "help") {
      line("Safe commands: help, brief, services, hint, find flag, login demo <value>, complete", "system");
    } else if (cmd === "brief") {
      line("ORION is a fictional demo identity service. Scope is restricted to this page.", "system");
    } else if (cmd === "services" && id === "inspect") {
      line("SIMULATED SERVICES: web-portal [demo], identity-api [mock], audit-feed [training data]", "good");
      line("No packets were sent. This is a static fictional inventory.", "system");
    } else if (cmd === "complete" || cmd === "complete mission") {
      if (id === "inspect") {
        markComplete(id);
        line("Recon briefing completed. Good testing starts with scope and observation.", "good");
      } else if (id === "validate") {
        line("To complete this mission, test the mock form with username `demo` and a training input containing `orion`.", "warn");
      } else if (id === "token") {
        line("Find the training flag using the `find flag` command, then complete the mission.", "warn");
      }
    } else if ((cmd === "hint" || cmd === "find flag") && id === "token") {
      line("TRAINING FLAG: TU{CLIENT_SIDE_IS_NOT_A_SECRET_STORE}", "flag");
      line("Lesson: any value shipped to a browser can be inspected. Keep real secrets server-side.", "good");
      markComplete("token");
    } else if (cmd === "hint") {
      line(
        id === "validate"
          ? "Try the fictional demo account and consider whether the browser should decide access."
          : "Try `services` to inspect the fictional service list.",
        "system"
      );
    } else if (cmd.startsWith("login demo ") && id === "validate") {
      line("Use the on-screen mock form for this mission; it evaluates only a fictional condition.", "warn");
    } else if (cmd === "services") {
      line("This mission does not expose a service list. Switch to Recon briefing.", "warn");
    } else {
      line("No such training command. Type `help` for the available commands.", "system");
    }
    $("terminalContent").scrollTop = $("terminalContent").scrollHeight;
  }

  function restoreUI() {
    if (state.profile) $("avatarInitials").textContent = initials(state.profile.callsign);
    for (const id of state.completed) {
      const b = document.querySelector(`.mission[data-mission="${id}"]`);
      const c = $("check-" + id);
      if (b) b.classList.add("completed");
      if (c) c.textContent = "✓";
    }
    const label = $("connectionLabel");
    if (label) {
      label.textContent = client ? "SHARED DATABASE" : "LOCAL MODE";
      label.parentElement.classList.toggle("connected", Boolean(client));
    }
    renderMission("inspect", false);
    track("lab_page_opened", null, "lab.html");
  }

  $("terminalSubmit").addEventListener("click", handleCommand);
  $("terminalInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleCommand();
  });
  document.querySelectorAll(".mission").forEach((btn) =>
    btn.addEventListener("click", () => renderMission(btn.dataset.mission))
  );

  restoreUI();
})();