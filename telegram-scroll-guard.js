/* Telegram Mini App swipe guard: scrolling content must not minimize the app.
 * Bot API 7.7+ supports disableVerticalSwipes(). No touchmove interception,
 * layout changes, or effect in Safari / other regular browsers.
 */
(() => {
  "use strict";

  function applyTelegramSwipeGuard() {
    const app = window.Telegram?.WebApp;
    if (!app) return;

    const isTelegramHost = Boolean(
      app.initData ||
      window.TelegramWebviewProxy ||
      window.webkit?.messageHandlers?.TelegramWebviewProxy ||
      /(?:^|[&#?])tgWebApp(?:Version|Platform|Data)=/.test(location.href)
    );
    if (!isTelegramHost) return;

    // Keeps normal page/PDF scrolling, but prevents Telegram's content swipe
    // from minimizing the web app. The Telegram header can still close it.
    try {
      if (typeof app.disableVerticalSwipes === "function" &&
          (typeof app.isVersionAtLeast !== "function" || app.isVersionAtLeast("7.7"))) {
        app.disableVerticalSwipes();
      }
    } catch (_) {
      // Old Telegram clients simply keep their original gesture behavior.
    }

    // Prevent scroll chaining at page boundaries without blocking any taps,
    // PDF page scrolling, text selection, or zoom.
    document.documentElement.style.overscrollBehaviorY = "none";
    if (document.body) document.body.style.overscrollBehaviorY = "none";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyTelegramSwipeGuard, { once: true });
  } else {
    applyTelegramSwipeGuard();
  }
})();
