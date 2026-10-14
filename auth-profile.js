/* Нумерология Онлайн: авторизация внутри Telegram Mini App.
 * Никаких Telegram Login popup, переходов в Safari или отдельной регистрации.
 * Доверяем имени и Telegram ID только после проверки подписанного initData на сервере.
 * Платные права / платежи не реализованы: это только личный кабинет.
 */
(() => {
  "use strict";
  const CHECK_URL = "https://numerologia-online-auth-server.vercel.app/api/miniapp";
  // Opens the Main Mini App directly when it is enabled in BotFather.
  const MAIN_APP_URL = "https://t.me/Numerologiaonline_bot?startapp";
  const BIRTH_PREFIX = "num-online-birth-v1:";
  const dialog = document.querySelector("#account-dialog");
  const accountButton = document.querySelector("[data-account-open='profile']");
  const loginView = document.querySelector("#account-login");
  const profileView = document.querySelector("#account-profile");
  const status = document.querySelector("#account-status");
  const retry = document.querySelector("#account-retry");
  const title = document.querySelector("#account-person-name");
  const avatarLetter = document.querySelector("#account-avatar-letter");
  const buttonCheck = document.querySelector("#auth-button-check");
  const buttonLabel = document.querySelector("#auth-button-label");
  const birthInput = document.querySelector("#account-birth");
  const birthNote = document.querySelector("#account-birth-note");
  const warning = document.querySelector("#account-preview-warning");
  const app = window.Telegram && window.Telegram.WebApp;
  if (!dialog || !accountButton || !loginView || !profileView || !status) return;

  let user = null;
  let loading = false;
  let mini = false;

  // Do not display personal names or greeting text on the site header.
  // Telegram-verification only adds a subtle check next to "Личный кабинет".
  function setAccountButton(label, verified = false) {
    if (buttonLabel) buttonLabel.textContent = label;
    if (buttonCheck) buttonCheck.hidden = !verified;
  }

  // The iOS keyboard shrinks the visual viewport but does not always shrink
  // dialog's vh/dvh layout viewport. Use the actual visible area while typing.
  const visualViewport = window.visualViewport;
  function updateKeyboardDialog() {
    if (!dialog.open || document.activeElement !== birthInput) return;
    const visibleHeight = visualViewport?.height || window.innerHeight;
    const visibleTop = visualViewport?.offsetTop || 0;
    if (!Number.isFinite(visibleHeight) || visibleHeight <= 0) return;
    dialog.style.setProperty("--account-view-height", visibleHeight + "px");
    dialog.style.setProperty("--account-view-top", visibleTop + "px");
    dialog.classList.add("account-dialog--editing");

    // Scroll only the cabinet, never the whole site behind the modal.
    const inputRect = birthInput.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const safeBottom = dialogRect.bottom - 74;
    const safeTop = dialogRect.top + 16;
    if (inputRect.bottom > safeBottom) {
      dialog.scrollTop += inputRect.bottom - safeBottom;
    } else if (inputRect.top < safeTop) {
      dialog.scrollTop -= safeTop - inputRect.top;
    }
  }
  function resetKeyboardDialog() {
    dialog.classList.remove("account-dialog--editing");
    dialog.style.removeProperty("--account-view-height");
    dialog.style.removeProperty("--account-view-top");
  }
  birthInput.addEventListener("focus", () => updateKeyboardDialog());
  birthInput.addEventListener("blur", resetKeyboardDialog);
  dialog.addEventListener("close", resetKeyboardDialog);
  if (visualViewport) {
    visualViewport.addEventListener("resize", updateKeyboardDialog);
    visualViewport.addEventListener("scroll", updateKeyboardDialog);
  }

  function getInitData() {
    if (app && typeof app.initData === "string" && app.initData) return app.initData;
    // Telegram normally sets WebApp.initData, but its signed launch data may
    // also be present in the URL fragment (not the main application's hash).
    const fragment = String(location.hash || "").replace(/^#/, "");
    if (!fragment.includes("tgWebAppData=")) return "";
    try { return new URLSearchParams(fragment).get("tgWebAppData") || ""; }
    catch (_) { return ""; }
  }

  function isTelegramEnvironment() {
    return !!(getInitData() ||
      window.TelegramWebviewProxy ||
      window.webkit?.messageHandlers?.TelegramWebviewProxy ||
      /(?:^|[&#?])tgWebApp(?:Version|Platform|Data)=/.test(location.href));
  }

  function setMessage(message, canRetry) {
    user = null;
    loginView.hidden = false;
    profileView.hidden = true;
    status.textContent = message;
    status.hidden = false;
    retry.hidden = !canRetry;
    setAccountButton(mini ? "Личный кабинет" : "Войти через Telegram");
    accountButton.disabled = false;
  }

  // Keep dates in ISO format in existing localStorage records, but display
  // DD.MM.YYYY to users and never summon the native iOS calendar.
  function birthForDisplay(value) {
    const stored = String(value || "");
    const iso = stored.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return iso[3] + "." + iso[2] + "." + iso[1];
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(stored)) return stored;
    return "";
  }

  function formatBirthTyping(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    return [
      digits.slice(0, 2),
      digits.length > 2 ? digits.slice(2, 4) : "",
      digits.length > 4 ? digits.slice(4) : ""
    ].filter(Boolean).join(".");
  }

  function birthToISO(value) {
    const match = String(value || "").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match) return null;
    const d = Number(match[1]), m = Number(match[2]), y = Number(match[3]);
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const parsed = new Date(Date.UTC(y, m - 1, d));
    if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 ||
        parsed.getUTCDate() !== d || parsed.getTime() > Date.now()) return null;
    return match[3] + "-" + match[2] + "-" + match[1];
  }

  birthInput.addEventListener("input", () => {
    const formatted = formatBirthTyping(birthInput.value);
    if (birthInput.value !== formatted) birthInput.value = formatted;
    birthInput.removeAttribute("aria-invalid");
    birthNote.textContent = "Дата хранится только на этом устройстве.";
  });

  function showProfile() {
    if (!user) return;
    loginView.hidden = true;
    profileView.hidden = false;
    title.textContent = user.name;
    if (avatarLetter) avatarLetter.textContent = String(user.name || "П").trim().charAt(0).toUpperCase();
    warning.textContent = "Вход подтверждён через Telegram.";
    warning.hidden = false;
    birthInput.value = birthForDisplay(localStorage.getItem(BIRTH_PREFIX + user.id));
    birthInput.removeAttribute("aria-invalid");
    birthNote.textContent = "Дата хранится только на этом устройстве.";
    setAccountButton("Личный кабинет", true);
    accountButton.disabled = false;
  }

  async function identify() {
    if (loading) return;
    loading = true;
    setAccountButton("Подключаем...");
    accountButton.disabled = true;
    const raw = getInitData();
    try {
      if (!raw) {
        throw new Error("Telegram не передал данные о пользователе. Возможно, кнопку бота нужно настроить как полноценное мини-приложение.");
      }
      const res = await fetch(CHECK_URL, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ init_data: raw })
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true || !data?.user?.id) {
        throw new Error("Проверка Telegram не пройдена (" + String(data?.error || res.status).slice(0, 36) + ").");
      }
      user = {
        id: String(data.user.id),
        name: String(data.user.name || "Пользователь").slice(0, 80)
      };
      showProfile();
      // No modal on success. The site welcomes the user and keeps the
      // current Mini App page open. The cabinet opens only on request.
    } catch (err) {
      setMessage("Автоматический вход не удался: " + (err?.message || "Нет соединения с сервером."), !!raw);
      if (!dialog.open) dialog.showModal();
    } finally {
      loading = false;
    }
  }

  accountButton.addEventListener("click", () => {
    // Outside Telegram: go straight to the Main Mini App deep link in one tap.
    // No intermediate dialog, OAuth popup or extra confirmation on our side.
    if (!mini) {
      window.location.assign(MAIN_APP_URL);
      return;
    }
    if (user) showProfile();
    else if (!loading) {
      loginView.hidden = false;
      profileView.hidden = true;
    }
    if (!dialog.open) dialog.showModal();
  });
  document.querySelector("#account-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  retry.addEventListener("click", () => {
    if (mini) identify();
  });
  document.querySelector("#account-birth-save").addEventListener("click", () => {
    if (!user) return;
    const iso = birthToISO(birthInput.value);
    if (!iso) {
      birthInput.setAttribute("aria-invalid", "true");
      birthNote.textContent = "Проверьте дату. Нужен формат ДД.ММ.ГГГГ, например 09.09.1986.";
      birthInput.focus();
      return;
    }
    localStorage.setItem(BIRTH_PREFIX + user.id, iso);
    birthInput.value = birthForDisplay(iso);
    birthInput.removeAttribute("aria-invalid");
    birthInput.blur();
    birthNote.textContent = "✓ Дата рождения сохранена на этом устройстве.";
  });
  document.querySelector("#account-birth-delete").addEventListener("click", () => {
    if (!user) return;
    localStorage.removeItem(BIRTH_PREFIX + user.id);
    birthInput.value = "";
    birthInput.removeAttribute("aria-invalid");
    birthNote.textContent = "Дата удалена с этого устройства.";
  });

  mini = isTelegramEnvironment();
  if (mini) {
    document.querySelector(".account-telegram-link").hidden = true;
    try { app?.ready(); app?.expand(); } catch (_) {}
    identify();
  } else {
    setAccountButton("Войти через Telegram");
  }
})();