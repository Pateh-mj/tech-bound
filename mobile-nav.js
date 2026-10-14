(() => {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function wire(topbar, isAdmin) {
    if (!topbar) return;
    const nav = topbar.querySelector(".topnav");
    if (!nav) return;

    let btn = topbar.querySelector(".nav-toggle") || document.getElementById("navToggle");
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

    // Always visible control on small screens via CSS; ensure not disabled
    btn.hidden = false;
    btn.style.visibility = "visible";

    const close = () => {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰";
      document.body.classList.remove("nav-open");
    };
    const open = () => {
      nav.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "✕";
      document.body.classList.add("nav-open");
    };

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (nav.classList.contains("open")) close();
      else open();
    });

    nav.querySelectorAll("a, button[data-route], .nav-link").forEach((el) => {
      el.addEventListener("click", () => setTimeout(close, 0));
    });

    document.addEventListener("click", (e) => {
      if (!nav.classList.contains("open")) return;
      if (nav.contains(e.target) || btn.contains(e.target)) return;
      close();
    });

    const bp = isAdmin ? 900 : 760;
    window.addEventListener("resize", () => {
      if (window.innerWidth > bp) close();
    });
  }

  ready(() => {
    document.querySelectorAll(".topbar").forEach((bar) => {
      wire(bar, bar.classList.contains("admin-topbar"));
    });
  });
})();