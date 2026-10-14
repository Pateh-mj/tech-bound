(() => {
  "use strict";

  const CONFIG = window.TECH_UNBOUND_CONFIG || {};
  const hasConfig = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey &&
    /^https:\/\/.+\.supabase\.co\/?$/.test(CONFIG.supabaseUrl));
  const client = hasConfig && window.supabase
    ? window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey)
    : null;

  const $ = (id) => document.getElementById(id);
  const DISCIPLINES = [
    {id:"Networking",icon:"⌁",title:"Networking & Infrastructure",desc:"Routing, switching, protocols, wireless, network design.",meta:"CONNECTIVITY / NETOPS",href:"networking.html"},
    {id:"Cybersecurity",icon:"⌑",title:"Cybersecurity & Pentesting",desc:"Threat modelling, ethical hacking, defence, digital forensics.",meta:"DEFENCE / OFFENCE",href:"cybersecurity.html"},
    {id:"Software Development",icon:"⌘",title:"Software Development",desc:"Programming, APIs, backend services, databases and architecture.",meta:"BUILD / SHIP",href:"software-development.html"},
    {id:"Frontend & UI/UX",icon:"◈",title:"Frontend & UI/UX",desc:"Interfaces, accessibility, interaction design and web experiences.",meta:"EXPERIENCE / DESIGN",href:"frontend-uiux.html"},
    {id:"AI & Data",icon:"⠿",title:"AI, Data & Automation",desc:"Machine learning, analytics, scripting and intelligent workflows.",meta:"INSIGHT / AUTOMATE",href:"ai-data.html"},
    {id:"Cloud & DevOps",icon:"☁",title:"Cloud & DevOps",desc:"Cloud platforms, CI/CD, containers, observability and reliability.",meta:"DEPLOY / OPERATE",href:"cloud-devops.html"},
    {id:"Electronics & IoT",icon:"⌬",title:"Electronics & IoT",desc:"Circuits, embedded systems, sensors, robotics and connected devices.",meta:"HARDWARE / SIGNAL",href:"electronics-iot.html"},
    {id:"Product & Innovation",icon:"✳",title:"Product & Innovation",desc:"Product thinking, research, entrepreneurship and emerging tech.",meta:"IDEATE / EXPERIMENT",href:"product-innovation.html"}
  ];
  const MISSIONS = {
    inspect: {title:"ORION / RECON BRIEFING",hint:"Type `help` to view safe commands",intro:[
      ["system","ORION AUTH NODE // TRAINING ENVIRONMENT"],
      ["system","Case file: OR-014. A fictional internal demo service is behaving unexpectedly."],
      ["accent","Your task: learn how to inspect a target carefully before attempting a test."],
      ["good","Scope confirmed: fictional UI only. No network targets or real accounts are connected."],
      ["system","Available commands: help, brief, services, complete"]
    ]},
    validate: {title:"ORION / INPUT VALIDATION",hint:"Try the mock form with a test input",intro:[
      ["system","MISSION 02 // INPUT VALIDATION"],
      ["system","The mock sign-in form below represents a deliberately weak demo endpoint."],
      ["warn","Use only the fictional test values shown here. Never enter real credentials."],
      ["accent","Test account: demo | Expected lesson: client-side checks are not an access-control boundary."],
      ["system","Commands: help, login demo <value>, complete"]
    ]},
    token: {title:"ORION / CLIENT-SIDE CLUE",hint:"Investigate the clue; try `hint` or `find flag`",intro:[
      ["system","MISSION 03 // CLIENT-SIDE EXPOSURE"],
      ["system","A developer left a training marker in this public client bundle."],
      ["accent","This illustrates why secrets must not be embedded in frontend JavaScript."],
      ["system","Commands: help, hint, find flag, complete"]
    ]}
  };

  const state = {
    visitorId: getVisitorId(),
    profile: readLocal("tu_profile", null),
    interests: readLocal("tu_interests", []),
    selectedMission: "inspect",
    completed: new Set(readLocal("tu_completed", [])),
    eventQueue: [],
    lastMission: null,
    terminalHistory: []
  };

  function getVisitorId() {
    let id = localStorage.getItem("tu_visitor_id");
    if (!id) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : "tu-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 18);
      localStorage.setItem("tu_visitor_id", id);
    }
    return id;
  }
  function readLocal(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  }
  function writeLocal(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }
  function safeText(value, max=240) { return String(value || "").trim().slice(0, max); }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function toast(message) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3000);
  }
  function initials(text) {
    const parts = safeText(text, 60).split(/[\s_-]+/).filter(Boolean);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || "?").slice(0,2)).toUpperCase();
  }
  function track(eventType, category=null, detail=null) {
    const record = {visitor_id:state.visitorId,event_type:safeText(eventType,60),category:safeText(category,80)||null,detail:safeText(detail,160)||null};
    // Persist only non-sensitive event metadata. Raw terminal input is never logged.
    if (client) {
      client.from("activity_events").insert(record).then(({error}) => {
        if (error) console.warn("Activity event could not be saved:", error.message);
      });
    } else {
      const local = readLocal("tu_events", []);
      local.push({...record, created_at:new Date().toISOString()});
      writeLocal("tu_events", local.slice(-200));
    }
  }
  function setConnection() {
    const label = $("connectionLabel");
    label.textContent = client ? "SHARED DATABASE" : "LOCAL MODE";
    label.parentElement.classList.toggle("connected", Boolean(client));
    if (!client) label.title = "Configure config.js and Supabase to enable shared data.";
  }

  function renderDisciplines() {
    $("disciplineGrid").innerHTML = DISCIPLINES.map(d => {
      const selected = state.interests.includes(d.id);
      return `<div class="discipline-card ${selected?"selected":""}" data-interest-card="${escapeHTML(d.id)}">
        <a class="discipline-hub-link" href="${escapeHTML(d.href)}" data-hub-link="${escapeHTML(d.id)}">
          <span class="discipline-icon">${d.icon}</span>
          <h3>${escapeHTML(d.title)}</h3>
          <p>${escapeHTML(d.desc)}</p>
          <span class="discipline-meta">${escapeHTML(d.meta)} · OPEN HUB ↗</span>
        </a>
        <button type="button" class="discipline-toggle" data-interest="${escapeHTML(d.id)}" aria-pressed="${selected}">
          ${selected ? "✓ Selected" : "+ Interest"}
        </button>
      </div>`;
    }).join("");
    $("interestCount").textContent = `${state.interests.length} interest${state.interests.length===1?"":"s"} selected`;
  }
  $("disciplineGrid").addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-interest]");
    if (!toggle) return;
    event.preventDefault();
    event.stopPropagation();
    const id = toggle.dataset.interest;
    state.interests = state.interests.includes(id) ? state.interests.filter(x=>x!==id) : [...state.interests,id];
    writeLocal("tu_interests",state.interests); renderDisciplines();
    track("interest_toggled", id, state.interests.includes(id) ? "selected" : "deselected");
  });
  $("disciplineGrid").addEventListener("click", (event) => {
    const link = event.target.closest("[data-hub-link]");
    if (!link) return;
    track("discipline_hub_opened", link.dataset.hubLink, null);
  });
  $("saveInterests").addEventListener("click", async () => {
    writeLocal("tu_interests",state.interests);
    if (client && state.profile) {
      const {error} = await client.from("team_profiles").upsert(profilePayload(),{onConflict:"visitor_id"});
      if (error) { toast("Saved on this device. Shared profile update failed; check Supabase setup."); console.error(error); }
      else toast("Interests saved to the shared network.");
    } else if (client) toast("Interests saved locally. Create a profile to share them with the network.");
    else toast("Interests saved on this device. Configure Supabase for shared analytics.");
    track("interests_saved", null, `${state.interests.length}_selected`);
    refreshMetrics();
  });

  function profilePayload() {
    const p = state.profile || {};
    return {
      visitor_id:state.visitorId,
      callsign:safeText(p.callsign,28),
      display_name:safeText(p.displayName,60)||null,
      institution:safeText(p.institution,100)||null,
      skill_level:safeText(p.skillLevel,40)||"Curious beginner",
      goals:safeText(p.goals,240)||null,
      interests:state.interests,
      is_public:Boolean(p.isPublic),
      updated_at:new Date().toISOString()
    };
  }
  function openProfile() {
    const p = state.profile || {};
    $("callsign").value = p.callsign || "";
    $("displayName").value = p.displayName || "";
    $("institution").value = p.institution || "";
    $("skillLevel").value = p.skillLevel || "Curious beginner";
    $("goals").value = p.goals || "";
    $("shareProfile").checked = p.isPublic !== false;
    $("profileError").textContent = "";
    $("profileDialog").showModal();
  }
  function closeProfile() { $("profileDialog").close(); }
  $("profileButton").addEventListener("click",openProfile);
  $("createProfileButton").addEventListener("click",openProfile);
  $("closeProfile").addEventListener("click",closeProfile);
  $("cancelProfile").addEventListener("click",closeProfile);

  $("profileForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const callsign = safeText($("callsign").value,28);
    if (callsign.length < 2) { $("profileError").textContent = "Please choose a callsign with at least 2 characters."; return; }
    state.profile = {
      callsign, displayName:safeText($("displayName").value,60),
      institution:safeText($("institution").value,100),
      skillLevel:$("skillLevel").value, goals:safeText($("goals").value,240),
      isPublic:$("shareProfile").checked
    };
    writeLocal("tu_profile",state.profile);
    $("avatarInitials").textContent = initials(state.profile.callsign);
    track("profile_saved",null,state.profile.isPublic?"public_opt_in":"private_profile");
    if (client) {
      const {error} = await client.from("team_profiles").upsert(profilePayload(),{onConflict:"visitor_id"});
      if (error) {
        $("profileError").textContent = "Saved locally, but shared save failed. Check schema and Supabase configuration.";
        console.error(error); return;
      }
    }
    closeProfile();
    toast(client ? "Profile saved to the shared network." : "Profile saved on this device.");
    renderCommunity(); refreshMetrics();
  });

  async function renderCommunity() {
    const container = $("communityList");
    if (!client) {
      const p = state.profile;
      if (p && p.isPublic) {
        container.innerHTML = profileCard({...p,interests:state.interests},true);
      } else {
        container.innerHTML = '<div class="empty-state">Community profiles appear here after Supabase is configured.<br><br><span class="mono">LOCAL MODE</span> — your own profile is not shared across devices.</div>';
      }
      return;
    }
    container.innerHTML = '<div class="empty-state">Loading community nodes…</div>';
    const {data,error} = await client.from("team_profiles")
      .select("visitor_id,callsign,display_name,institution,skill_level,goals,interests,is_public,updated_at")
      .eq("is_public",true).order("updated_at",{ascending:false}).limit(30);
    if (error) {
      container.innerHTML = '<div class="empty-state">Could not load community profiles. Verify schema.sql and Supabase permissions.</div>';
      console.error(error); return;
    }
    if (!data || !data.length) {
      container.innerHTML = '<div class="empty-state">No public nodes yet. Be the first to introduce yourself.</div>'; return;
    }
    container.innerHTML = data.map(p=>profileCard(p,p.visitor_id===state.visitorId)).join("");
  }
  function profileCard(p,isSelf=false) {
    const interests = (p.interests || []).slice(0,3);
    return `<article class="community-person"><div class="person-avatar">${escapeHTML(initials(p.callsign))}</div><div class="person-main">
      <div class="person-title"><strong>${escapeHTML(p.callsign || "Anonymous node")}</strong>${isSelf?'<span>YOUR NODE</span>':""}</div>
      <p>${escapeHTML([p.display_name,p.institution].filter(Boolean).join(" · ") || p.goals || "Curious technologist")}</p>
      <div class="person-tags">${interests.map(i=>`<span>${escapeHTML(i)}</span>`).join("") || "<span>Exploring</span>"}</div></div>
      <div class="person-level">${escapeHTML(p.skill_level || "Curious")}</div></article>`;
  }
  $("communityRefresh").addEventListener("click",renderCommunity);

  function line(text,kind="system") {
    const el = document.createElement("p"); el.className = `terminal-line ${kind}`;
    el.textContent = text; $("terminalContent").appendChild(el);
  }
  function renderMission(id, shouldTrack=true) {
    state.selectedMission = id;
    document.querySelectorAll(".mission").forEach(b=>b.classList.toggle("active",b.dataset.mission===id));
    $("terminalTitle").textContent = MISSIONS[id].title;
    $("terminalHint").textContent = MISSIONS[id].hint;
    $("terminalContent").innerHTML = "";
    MISSIONS[id].intro.forEach(([kind,text])=>line(text,kind));
    if (id==="validate") {
      const note=document.createElement("div"); note.className="terminal-line";
      note.innerHTML='<div style="margin:12px 0;padding:13px;border:1px solid #28465c;border-radius:7px;background:#0b1b2a"><div style="color:#54d7e7;margin-bottom:7px">MOCK LOGIN FORM</div><div style="color:#8296aa;font-size:10px;margin-bottom:8px">Demo account: <code>demo</code> · This form is simulated.</div><input id="mockUser" placeholder="username (try demo)" style="width:100%;box-sizing:border-box;background:#071421;color:#e9f1f8;border:1px solid #294258;border-radius:5px;padding:9px;margin-bottom:7px"><input id="mockPass" placeholder="training input only" type="text" style="width:100%;box-sizing:border-box;background:#071421;color:#e9f1f8;border:1px solid #294258;border-radius:5px;padding:9px;margin-bottom:8px"><button id="mockLogin" class="button button-primary button-small" type="button">TEST MOCK LOGIN</button><div id="mockResult" style="margin-top:8px;color:#8296aa"></div></div>';
      $("terminalContent").appendChild(note);
      $("mockLogin").addEventListener("click",()=>{
        const user=safeText($("mockUser").value,40);
        const pass=safeText($("mockPass").value,40);
        // Intentional simulation: no real authentication or remote request.
        const result=$("mockResult");
        if (user.toLowerCase()==="demo" && pass.toLowerCase().includes("orion")) {
          result.textContent="SIMULATION: weak client-side condition matched. Access control must be enforced server-side in real systems.";
          result.style.color="#ffc66b"; track("lab_attempt","validate","mock_condition_matched");
          line("Mock condition matched. Lesson: client-side checks can be inspected and bypassed.","warn");
          markComplete("validate");
        } else {
          result.textContent="SIMULATION: no match. Inspect the mission briefing and think about where validation happens.";
          track("lab_attempt","validate","mock_condition_not_matched");
        }
      });
    }
    if (shouldTrack) track("lab_mission_opened",id,null);
  }
  function markComplete(id) {
    if (state.completed.has(id)) return;
    state.completed.add(id); writeLocal("tu_completed",[...state.completed]);
    const btn=document.querySelector(`.mission[data-mission="${id}"]`);
    if(btn) btn.classList.add("completed");
    const check=$("check-"+id); if(check) check.textContent="✓";
    if(client) {
      client.from("lab_completions").upsert({visitor_id:state.visitorId,mission_id:id},{onConflict:"visitor_id,mission_id"}).then(({error})=>{if(error)console.warn(error.message);});
    }
    track("lab_mission_completed",id,null);
    toast("Mission complete. Nice investigation.");
    refreshMetrics();
  }
  function handleCommand() {
    const raw=safeText($("terminalInput").value,120);
    if(!raw) return;
    $("terminalInput").value="";
    line("> "+raw,"accent");
    const cmd=raw.toLowerCase().trim();
    const id=state.selectedMission;
    if (cmd==="help") {
      line("Safe commands: help, brief, services, hint, find flag, login demo <value>, complete","system");
    } else if (cmd==="brief") {
      line("ORION is a fictional demo identity service. Scope is restricted to this page.","system");
    } else if (cmd==="services" && id==="inspect") {
      line("SIMULATED SERVICES: web-portal [demo], identity-api [mock], audit-feed [training data]","good");
      line("No packets were sent. This is a static fictional inventory.","system");
    } else if (cmd==="complete" || cmd==="complete mission") {
      if(id==="inspect") {
        markComplete(id); line("Recon briefing completed. Good testing starts with scope and observation.","good");
      } else if(id==="validate") {
        line("To complete this mission, test the mock form with username `demo` and a training input containing `orion`.","warn");
      } else if(id==="token") {
        line("Find the training flag using the `find flag` command, then complete the mission.","warn");
      }
    } else if ((cmd==="hint" || cmd==="find flag") && id==="token") {
      line("TRAINING FLAG: TU{CLIENT_SIDE_IS_NOT_A_SECRET_STORE}","flag");
      line("Lesson: any value shipped to a browser can be inspected. Keep real secrets server-side.","good");
      markComplete("token");
    } else if (cmd==="hint") {
      line(id==="validate"?"Try the fictional demo account and consider whether the browser should decide access.":"Try `services` to inspect the fictional service list.","system");
    } else if (cmd.startsWith("login demo ") && id==="validate") {
      line("Use the on-screen mock form for this mission; it evaluates only a fictional condition.","warn");
    } else if (cmd==="services") {
      line("This mission does not expose a service list. Switch to Recon briefing.","warn");
    } else {
      line("No such training command. Type `help` for the available commands.","system");
    }
    $("terminalContent").scrollTop=$("terminalContent").scrollHeight;
  }
  $("terminalSubmit").addEventListener("click",handleCommand);
  $("terminalInput").addEventListener("keydown",e=>{if(e.key==="Enter")handleCommand();});
  document.querySelectorAll(".mission").forEach(btn=>btn.addEventListener("click",()=>renderMission(btn.dataset.mission)));
  $("rangeButton").addEventListener("click",()=>{ window.location.href = "lab.html"; });
  $("exploreButton").addEventListener("click",()=>{document.querySelector("#disciplines").scrollIntoView({behavior:"smooth"});track("explore_network_clicked");});
  document.querySelectorAll("[data-view-link]").forEach(a=>a.addEventListener("click",()=>{
    document.querySelectorAll(".nav-link").forEach(n=>n.classList.toggle("active",n===a));
    track("section_navigation",a.dataset.viewLink,null);
  }));

  async function refreshMetrics() {
    if (!client) {
      const events=readLocal("tu_events",[]);
      $("statVisitors").textContent=state.profile? "01":"—";
      $("statSignals").textContent=state.interests.length;
      $("statMissions").textContent=state.completed.size;
      $("chartMode").textContent="LOCAL ONLY";
      renderLocalChart();
      return;
    }
    const {data,error}=await client.rpc("public_team_metrics");
    if(error) {
      console.warn("Metrics unavailable:",error.message);
      $("chartMode").textContent="SETUP REQUIRED";
      return;
    }
    const m=typeof data==="string"?JSON.parse(data):data;
    $("statVisitors").textContent=Number(m.profiles||0).toLocaleString();
    $("statSignals").textContent=Number(m.interest_signals||0).toLocaleString();
    $("statMissions").textContent=Number(m.missions||0).toLocaleString();
    $("chartMode").textContent="SHARED AGGREGATES";
    renderChart(m.interest_distribution||[]);
  }
  function renderLocalChart() {
    const counts={}; state.interests.forEach(i=>counts[i]=(counts[i]||0)+1);
    renderChart(Object.entries(counts).map(([interest,count])=>({interest,count})));
  }
  function renderChart(rows) {
    const el=$("interestChart");
    if(!rows.length){el.innerHTML='<div class="empty-state">No interest selections yet. Choose a discipline above to start the signal map.</div>';return;}
    const max=Math.max(...rows.map(r=>Number(r.count)||0),1);
    el.innerHTML=rows.slice(0,8).map(r=>`<div class="bar-row"><span class="bar-label">${escapeHTML(r.interest)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(3,Number(r.count)/max*100)}%"></div></div><span class="bar-count">${Number(r.count)||0}</span></div>`).join("");
  }
  $("refreshAnalytics").addEventListener("click",()=>{refreshMetrics();track("analytics_refresh");toast("Refreshing aggregate signals.");});

  function restoreUI() {
    if(state.profile) $("avatarInitials").textContent=initials(state.profile.callsign);
    for(const id of state.completed) {
      const b=document.querySelector(`.mission[data-mission="${id}"]`);
      const c=$("check-"+id); if(b)b.classList.add("completed"); if(c)c.textContent="✓";
    }
    renderDisciplines(); renderMission("inspect",false); renderCommunity(); refreshMetrics(); setConnection();
    track("site_opened",null,"landing");
  }
  restoreUI();
})();