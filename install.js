(() => {
  "use strict";
  const modal = document.getElementById("install-nudge");
  if (!modal) return;
  const action = document.getElementById("install-action");
  const close = document.getElementById("install-dismiss");
  const later = document.getElementById("install-later");
  const help = document.getElementById("install-help");
  const key = "numerologia-install-invite-v1";
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const installed = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let deferredPrompt = null;
  let visible = false;
  let instructionsVisible = false;
  let previousFocus = null;

  const readExpiry = () => {
    try {
      const value = localStorage.getItem(key);
      if (value === "installed") return Infinity;
      return Number(value || 0);
    } catch { return 0; }
  };
  const suppress = (days) => {
    try { localStorage.setItem(key, days === Infinity ? "installed" : String(Date.now() + days * 86400000)); }
    catch { /* Private browsing may disallow storage. */ }
  };
  const hide = (days = 21) => {
    suppress(days);
    modal.hidden = true;
    document.body.classList.remove("install-invite-open");
    visible = false;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({preventScroll:true});
  };
  const showHelp = () => {
    instructionsVisible = true;
    help.hidden = false;
    help.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = ios ? "Как добавить на iPhone" : "Как сохранить на телефон";
    help.append(heading);
    const addStep = text => {
      const p = document.createElement("p");
      p.textContent = text;
      help.append(p);
    };
    if (ios) {
      if (!safari) {
        addStep("1. Откройте эту страницу в Safari.");
        addStep("2. В Safari нажмите «Поделиться» (квадрат со стрелкой вверх).");
        addStep("3. Выберите «На экран Домой», затем «Добавить».");
      } else {
        addStep("1. Нажмите «Поделиться» (квадрат со стрелкой вверх).");
        addStep("2. Пролистайте меню и выберите «На экран Домой».");
        addStep("3. При необходимости включите «Открыть как веб-приложение» и нажмите «Добавить».");
      }
    } else {
      addStep("1. Откройте меню браузера (обычно ⋮).");
      addStep("2. Нажмите «Установить приложение» или «Добавить на главный экран».");
      addStep("3. Подтвердите добавление.");
    }
    action.textContent = "Понятно, спасибо ♡";
    action.focus({preventScroll:true});
  };
  const canShow = () =>
    !installed() &&
    Date.now() >= readExpiry() &&
    (!location.hash || location.hash === "#home") &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad/i.test(ua)) &&
    window.innerWidth <= 1100;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hide(Infinity);
  });

  const show = () => {
    if (!canShow() || visible) return;
    visible = true;
    instructionsVisible = false;
    help.hidden = true;
    action.textContent = "Сохранить на главный экран";
    previousFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("install-invite-open");
    close.focus({preventScroll:true});
  };
  action.addEventListener("click", async () => {
    if (instructionsVisible) { hide(); return; }
    if (deferredPrompt) {
      const prompt = deferredPrompt;
      deferredPrompt = null;
      try {
        await prompt.prompt();
        const result = await prompt.userChoice;
        hide(result.outcome === "accepted" ? Infinity : 21);
      } catch { showHelp(); }
      return;
    }
    showHelp();
  });
  close.addEventListener("click", () => hide());
  later.addEventListener("click", () => hide());
  modal.addEventListener("click", event => { if (event.target === modal) hide(); });
  document.addEventListener("keydown", event => {
    if (!visible) return;
    if (event.key === "Escape") { hide(); return; }
    if (event.key !== "Tab") return;
    const tabbable = [...modal.querySelectorAll("button:not([disabled])")].filter(el => el.offsetParent !== null);
    if (!tabbable.length) return;
    if (event.shiftKey && document.activeElement === tabbable[0]) {
      event.preventDefault(); tabbable[tabbable.length-1].focus();
    } else if (!event.shiftKey && document.activeElement === tabbable[tabbable.length-1]) {
      event.preventDefault(); tabbable[0].focus();
    }
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}), {once:true});
  }
  window.addEventListener("load", () => window.setTimeout(show, 1500), {once:true});
})();
