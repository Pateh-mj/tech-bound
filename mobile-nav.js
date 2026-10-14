(() => {
  "use strict";

  function closeNav(nav, btn) {
    if (!nav || !btn) return;
    nav.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "☰";
    document.body.classList.remove("nav-open");
  }

  function openNav(nav, btn) {
    nav.classList.add("open");
    btn.setAttribute("aria-expanded", "true");
    btn.textContent = "✕";
    document.body.classList.add("nav-open");
  }

  function initPublicNav() {
    const topbar = document.querySelector(".topbar:not(.admin-topbar)");
    const nav = topbar && topbar.querySelector(".topnav");
    if (!topbar || !nav) return;

    let btn = topbar.querySelector(".nav-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-toggle";
      btn.setAttribute("aria-label", "Open menu");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
      const actions = topbar.querySelector(".top-actions");
      if (actions) topbar.insertBefore(btn, actions);
      else topbar.appendChild(btn);
    }

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (nav.classList.contains("open")) closeNav(nav, btn);
      else openNav(nav, btn);
    };

    nav.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => closeNav(nav, btn));
    });

    document.addEventListener("click", (e) => {
      if (!nav.classList.contains("open")) return;
      if (nav.contains(e.target) || btn.contains(e.target)) return;
      closeNav(nav, btn);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) closeNav(nav, btn);
    });
  }

  function initAdminNav() {
    const topbar = document.querySelector(".admin-topbar");
    const nav = topbar && topbar.querySelector(".topnav");
    if (!topbar || !nav) return;

    let btn = topbar.querySelector(".nav-toggle");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-toggle";
      btn.setAttribute("aria-label", "Open menu");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
      const actions = topbar.querySelector(".top-actions");
      if (actions) topbar.insertBefore(btn, actions);
      else topbar.appendChild(btn);
    }

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (nav.classList.contains("open")) closeNav(nav, btn);
      else openNav(nav, btn);
    };

    // Panel buttons (dashboard) — close menu after choosing a section
    nav.querySelectorAll("[data-route], a.nav-link, button.nav-link").forEach((el) => {
      el.addEventListener("click", () => {
        // Defer so panel switch runs first
        setTimeout(() => closeNav(nav, btn), 0);
      });
    });

    document.addEventListener("click", (e) => {
      if (!nav.classList.contains("open")) return;
      if (nav.contains(e.target) || btn.contains(e.target)) return;
      closeNav(nav, btn);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeNav(nav, btn);
    });
  }

  function boot() {
    initPublicNav();
    initAdminNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();