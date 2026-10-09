(() => {
  "use strict";
  const modal = document.getElementById("install-nudge");
  if (!modal) return;
  const dismiss = document.getElementById("install-dismiss");
  const later = document.getElementById("install-later");
  const action = document.getElementById("install-action");
  const stepLabels = Array.from(modal.querySelectorAll(".install-step-label"));
  const key = "numerologia-install-invite-v3";
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const installed = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let promptEvent = null;
  let previousFocus = null;
  const expires = () => {
    try {
      const value = localStorage.getItem(key);
      return value === "installed" ? Infinity : Number(value || 0);
    } catch { return 0; }
  };
  const mute = days => {
    try { localStorage.setItem(key, days === Infinity ? "installed" : String(Date.now() + days * 86400000)); }
    catch { /* Storage can be disabled. */ }
  };
  function hide(days = 21) {
    mute(days);
    modal.hidden = true;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  }
  if (ios && !safari) {
    stepLabels[0].textContent = "Сначала открой сайт в Safari";
    stepLabels[1].textContent = "Нажми «Поделиться», затем «На экран Домой»";
    stepLabels[2].textContent = "Нажми «Добавить»";
  } else if (!ios) {
    stepLabels[0].textContent = "Открой меню браузера ⋮";
    stepLabels[1].textContent = "Выбери «Установить приложение»";
    stepLabels[2].textContent = "Подтверди «Установить»";
  }
  function refreshAction() {
    action.hidden = ios || !promptEvent;
  }
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    promptEvent = event;
    refreshAction();
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    hide(Infinity);
  });
  function show() {
    const mobile = navigator.maxTouchPoints > 0 || /Android|iPhone|iPad/i.test(ua);
    if (installed() || Date.now() < expires() || !mobile || innerWidth > 1100 || (location.hash && location.hash !== "#home")) return;
    previousFocus = document.activeElement;
    refreshAction();
    modal.hidden = false;
    dismiss.focus({ preventScroll: true });
  }
  action.addEventListener("click", async () => {
    if (!promptEvent) return;
    const event = promptEvent;
    promptEvent = null;
    refreshAction();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      hide(choice.outcome === "accepted" ? Infinity : 21);
    } catch { /* Visual instructions remain visible. */ }
  });
  dismiss.addEventListener("click", () => hide());
  later.addEventListener("click", () => hide());
  document.addEventListener("keydown", event => {
    if (modal.hidden) return;
    if (event.key === "Escape") hide();
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}), {once:true});
  }
  window.addEventListener("load", () => window.setTimeout(show, 1200), {once:true});
})();
