(() => {
  "use strict";
  function init() {
    const topbar = document.querySelector(".topbar");
    const nav = document.querySelector(".topnav");
    if (!topbar || !nav || topbar.querySelector(".nav-toggle")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-label", "Menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = "☰";

    // Place before top-actions or at end of topbar
    const actions = topbar.querySelector(".top-actions");
    if (actions) topbar.insertBefore(btn, actions);
    else topbar.appendChild(btn);

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.innerHTML = open ? "✕" : "☰";
    });

    nav.querySelectorAll("a.nav-link").forEach((a) => {
      a.addEventListener("click", () => {
        nav.classList.remove("open");
        btn.setAttribute("aria-expanded", "false");
        btn.innerHTML = "☰";
      });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();