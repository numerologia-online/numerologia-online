/* Нумерология Онлайн: авторизация внутри Telegram Mini App.
 * Никаких Telegram Login popup, переходов в Safari или отдельной регистрации.
 * Доверяем имени и Telegram ID только после проверки подписанного initData на сервере.
 * Платные права / платежи не реализованы: это только личный кабинет.
 */
(() => {
  "use strict";
  const CHECK_URL = "https://numerologia-online-auth-server.vercel.app/api/miniapp";
  const PROFILE_URL = "https://xn--c1adkkdfjbp1a4l.online/api/profile.php";
  // Opens the Main Mini App directly when it is enabled in BotFather.
  const BIRTH_PREFIX = "num-online-birth-v1:";
  const BROWSER_BIRTH_KEY = BIRTH_PREFIX + "browser";
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
  const browserNote = document.querySelector("#account-browser-note");
  const verifiedIcon = document.querySelector("#account-verified");
  const identityLabel = document.querySelector("#account-identity-label");
  const app = window.Telegram && window.Telegram.WebApp;
  if (!dialog || !accountButton || !loginView || !profileView || !status) return;

  let user = null;
  let loading = false;
  let mini = false;
  let profileBusy = false;
  let birthRevision = 0;
  let birthNoteText = "Дата пока хранится только на этом устройстве.";

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
    setAccountButton("Личный кабинет");
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
    birthRevision += 1;
    birthNoteText = "Нажмите «Сохранить», чтобы дата появилась на других устройствах.";
    birthNote.textContent = birthNoteText;
  });

  function showProfile() {
    if (!user) return;
    loginView.hidden = true;
    profileView.hidden = false;
    title.textContent = user.name;
    if (avatarLetter) avatarLetter.textContent = String(user.name || "П").trim().charAt(0).toUpperCase();
    warning.textContent = "Вход подтверждён через Telegram.";
    warning.hidden = false;
    if (verifiedIcon) verifiedIcon.hidden = false;
    if (browserNote) browserNote.hidden = true;
    if (identityLabel) identityLabel.textContent = "Вы вошли как";
    showAccountPanel(null);
    birthInput.value = birthForDisplay(localStorage.getItem(BIRTH_PREFIX + user.id));
    birthInput.removeAttribute("aria-invalid");
    birthNote.textContent = birthNoteText;
    setAccountButton("Личный кабинет", true);
    accountButton.disabled = false;
  }


  // Website cabinet without Telegram: personal date stays only in this browser.
  // No guest access to paid files or simulated server identity.
  const accountOverview = document.querySelector("#account-overview");
  const accountPanels = [...dialog.querySelectorAll("[data-account-content]")];
  function showAccountPanel(key) {
    if (accountOverview) accountOverview.hidden = Boolean(key);
    for (const panel of accountPanels) panel.hidden = panel.dataset.accountContent !== key;
    dialog.scrollTop = 0;
  }
  dialog.querySelectorAll("[data-account-panel]").forEach(button => {
    button.addEventListener("click", () => showAccountPanel(button.dataset.accountPanel));
  });
  dialog.querySelectorAll("[data-account-back]").forEach(button => {
    button.addEventListener("click", () => showAccountPanel(null));
  });

  function showBrowserCabinet() {
    user = null;
    loginView.hidden = true;
    profileView.hidden = false;
    if (identityLabel) identityLabel.textContent = "Ваш кабинет";
    title.textContent = "На этом устройстве";
    if (avatarLetter) avatarLetter.textContent = "♡";
    if (verifiedIcon) verifiedIcon.hidden = true;
    if (warning) warning.hidden = true;
    if (browserNote) browserNote.hidden = false;
    try { birthInput.value = birthForDisplay(localStorage.getItem(BROWSER_BIRTH_KEY)); }
    catch (_) { birthInput.value = ""; }
    birthNoteText = "Дату можно сохранить в этом браузере. На других устройствах она пока не появится.";
    birthNote.textContent = birthNoteText;
    birthInput.removeAttribute("aria-invalid");
    showAccountPanel(null);
    setAccountButton("Личный кабинет");
  }

  document.querySelector("#account-show-offer")?.addEventListener("click", async () => {
    try {
      const { openSharedOffer } = await import("./shared-offer.js?v=1");
      await openSharedOffer({
        product: "полный разбор", title: "Откройте полный разбор",
        oncePrice: 990, memberPrice: 490, clubMonthly: 490
      });
    } catch (error) {
      console.error("Окно с тарифами", error);
      alert("Не удалось открыть варианты доступа. Попробуйте ещё раз.");
    }
  });

  // The existing Vercel sign-in remains unchanged. Profile actions are
  // independently authorized using Telegram's signed Mini App initData.
  async function requestProfile(action, birthDate) {
    const raw = getInitData();
    if (!raw) throw new Error("Откройте личный кабинет через Telegram.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const payload = { action, init_data: raw };
      if (birthDate !== undefined) payload.birth_date = birthDate;
      const res = await fetch(PROFILE_URL, {
        method: "POST",
        mode: "cors",
        cache: "no-store",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data?.ok !== true) {
        if (data?.error === "AUTH_EXPIRED") {
          throw new Error("Сессия Telegram устарела. Закройте и снова откройте мини-приложение.");
        }
        throw new Error("Не удалось подключиться к серверу. Повторите попытку.");
      }
      if (data.user?.id && String(data.user.id) !== String(user?.id)) {
        throw new Error("Не совпадают данные Telegram. Откройте мини-приложение заново.");
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadBirthFromServer(verifiedId) {
    const revision = birthRevision;
    birthNoteText = "Проверяем данные личного кабинета...";
    birthNote.textContent = birthNoteText;
    try {
      const data = await requestProfile("get");
      if (user?.id !== verifiedId || revision !== birthRevision) return;
      if (typeof data.birth_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)) {
        localStorage.setItem(BIRTH_PREFIX + verifiedId, data.birth_date);
        birthInput.value = birthForDisplay(data.birth_date);
        birthNoteText = "✓ Дата сохранена в вашем личном кабинете.";
      } else if (localStorage.getItem(BIRTH_PREFIX + verifiedId)) {
        birthNoteText = "Дата пока только на этом устройстве. Нажмите «Сохранить», чтобы перенести её в кабинет.";
      } else {
        birthNoteText = "Укажите дату рождения и нажмите «Сохранить».";
      }
    } catch (_) {
      if (user?.id !== verifiedId || revision !== birthRevision) return;
      birthNoteText = "Сервер сейчас недоступен. Вход работает, но сохранение даты на сервер нужно повторить.";
    }
    birthNote.textContent = birthNoteText;
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
      void loadBirthFromServer(user.id);
      // No modal on success. The site welcomes the user and keeps the
      // current Mini App page open. The cabinet opens only on request.
    } catch (err) {
      // Keep the site usable when authentication is temporarily unreachable.
      // Show the error only if the visitor manually opens the cabinet.
      setMessage("Автоматический вход не удался: " + (err?.message || "Нет соединения с сервером."), !!raw);
      setAccountButton("Личный кабинет");
    } finally {
      loading = false;
    }
  }

  accountButton.addEventListener("click", () => {
    // The ordinary website opens its cabinet without Telegram redirect.
    if (!mini) {
      showBrowserCabinet();
      if (!dialog.open) dialog.showModal();
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
  dialog.addEventListener("close", () => showAccountPanel(null));
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  retry.addEventListener("click", () => {
    if (mini) identify();
  });
  document.querySelector("#account-birth-save").addEventListener("click", async () => {
    if ((!user && mini) || profileBusy) return;
    const iso = birthToISO(birthInput.value);
    if (!iso) {
      birthInput.setAttribute("aria-invalid", "true");
      birthNote.textContent = "Проверьте дату. Нужен формат ДД.ММ.ГГГГ, например 09.09.1986.";
      birthInput.focus();
      return;
    }
    if (!mini) {
      try {
        localStorage.setItem(BROWSER_BIRTH_KEY, iso);
        birthNote.textContent = "✓ Дата сохранена на этом устройстве. Для переноса на другой телефон потребуется вход в аккаунт.";
        birthInput.blur();
      } catch (_) {
        birthNote.textContent = "Не удалось сохранить дату в этом браузере.";
      }
      return;
    }
    profileBusy = true;
    birthRevision += 1;
    const verifiedId = user.id;
    birthNoteText = "Сохраняем дату рождения...";
    birthNote.textContent = birthNoteText;
    try {
      await requestProfile("save", iso);
      if (user?.id !== verifiedId) return;
      localStorage.setItem(BIRTH_PREFIX + verifiedId, iso);
      birthInput.value = birthForDisplay(iso);
      birthInput.removeAttribute("aria-invalid");
      birthInput.blur();
      birthNoteText = "✓ Дата рождения сохранена в личном кабинете.";
    } catch (err) {
      birthNoteText = err?.message || "Дата не сохранена. Проверьте соединение и попробуйте снова.";
    } finally {
      profileBusy = false;
      birthNote.textContent = birthNoteText;
    }
  });
  document.querySelector("#account-birth-delete").addEventListener("click", async () => {
    if ((!user && mini) || profileBusy) return;
    if (!mini) {
      try {
        localStorage.removeItem(BROWSER_BIRTH_KEY);
        birthInput.value = "";
        birthNote.textContent = "Дата удалена с этого устройства.";
      } catch (_) {
        birthNote.textContent = "Не удалось удалить дату из браузера.";
      }
      return;
    }
    profileBusy = true;
    birthRevision += 1;
    const verifiedId = user.id;
    birthNoteText = "Удаляем дату рождения...";
    birthNote.textContent = birthNoteText;
    try {
      await requestProfile("clear");
      if (user?.id !== verifiedId) return;
      localStorage.removeItem(BIRTH_PREFIX + verifiedId);
      birthInput.value = "";
      birthInput.removeAttribute("aria-invalid");
      birthNoteText = "Дата удалена из личного кабинета и с этого устройства.";
    } catch (err) {
      birthNoteText = err?.message || "Дата не удалена. Попробуйте снова.";
    } finally {
      profileBusy = false;
      birthNote.textContent = birthNoteText;
    }
  });

  mini = isTelegramEnvironment();
  if (mini) {
    document.querySelector(".account-telegram-link").hidden = true;
    try { app?.ready(); app?.expand(); } catch (_) {}
    identify();
  } else {
    setAccountButton("Личный кабинет");
  }
})();