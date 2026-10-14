/* Telegram-кабинет: настоящий серверно подтверждённый тестовый вход.
 * Здесь нет прав на платные материалы, базы пользователей или сохранённых PDF.
 * ID token проверяется на Vercel по публичной подписи Telegram (без секретов бота).
 */
(() => {
  "use strict";
  const CLIENT_ID = 8814989076;
  const VERIFY_URL = "https://numerologia-online-auth-server.vercel.app/api/verify";
  const SESSION_KEY = "num-online-tg-verified-v1";
  const BIRTH_PREFIX = "num-online-birth-v1:";
  const dialog = document.querySelector("#account-dialog");
  if (!dialog) return;

  const loginView = document.querySelector("#account-login");
  const profileView = document.querySelector("#account-profile");
  const status = document.querySelector("#account-status");
  const loginButton = document.querySelector("#account-telegram-login");
  const birthInput = document.querySelector("#account-birth");
  const birthNote = document.querySelector("#account-birth-note");
  const title = document.querySelector("#account-person-name");
  const previewWarning = document.querySelector("#account-preview-warning");
  const signout = document.querySelector("#account-logout");
  const signup = document.querySelector('[data-account-open="register"]');
  const signin = document.querySelector('[data-account-open="login"]');
  const saveDate = document.querySelector("#account-birth-save");
  let user = null;
  let preview = false;
  let sdkPromise = null;

  const note = (value) => {
    status.textContent = value || "";
    status.hidden = !value;
  };

  function syncHeader() {
    signup.hidden = !!user;
    signin.textContent = user ? "Личный кабинет" : "Войти";
  }

  function openProfile(isPreview = false) {
    preview = isPreview;
    loginView.hidden = true;
    profileView.hidden = false;
    title.textContent = isPreview ? "Гостевой просмотр" : user.name;
    previewWarning.hidden = false;
    previewWarning.textContent = isPreview
      ? "Это предпросмотр, не регистрация. Дата не сохраняется."
      : "Вход подтверждён Telegram. Это первая версия кабинета, без платных доступов.";
    signout.hidden = isPreview;
    birthInput.disabled = isPreview;
    saveDate.disabled = isPreview;
    document.querySelector("#account-birth-delete").disabled = isPreview;
    birthInput.value = isPreview ? "" : (localStorage.getItem(BIRTH_PREFIX + user.id) || "");
    birthNote.textContent = isPreview
      ? "В режиме просмотра дата не сохраняется."
      : "Дата хранится только в этом браузере, а не на сервере.";
  }

  function openLogin() {
    preview = false;
    loginView.hidden = false;
    profileView.hidden = true;
    note("");
  }

  function openDialog() {
    if (user) openProfile();
    else openLogin();
    if (!dialog.open) dialog.showModal();
  }

  async function loadSdk() {
    if (window.Telegram?.Login?.auth) return window.Telegram.Login;
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = "https://oauth.telegram.org/js/telegram-login.js";
      tag.async = true;
      tag.onload = () => window.Telegram?.Login?.auth
        ? resolve(window.Telegram.Login)
        : reject(new Error("Telegram не загрузил модуль входа."));
      tag.onerror = () => reject(new Error("Не удалось подключиться к Telegram."));
      document.head.appendChild(tag);
    }).catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }

  async function verifyTelegram(token, nonce) {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: token, nonce })
    });
    let data;
    try { data = await response.json(); } catch (_) {
      throw new Error("Сервер Telegram-авторизации пока не отвечает.");
    }
    if (!response.ok || !data?.ok || !data.user?.id) {
      const code = String(data?.error || "UNKNOWN").slice(0, 35);
      throw new Error("Не удалось завершить проверку входа (" + code + ").");
    }
    return { id: String(data.user.id), name: String(data.user.name || "Пользователь").slice(0, 80) };
  }

  async function authenticate() {
    if (!window.isSecureContext || !window.crypto?.getRandomValues) {
      note("Откройте сайт по защищённому HTTPS-адресу.");
      return;
    }
    // Запуск login popup должен происходить непосредственно после нажатия кнопки.
    loginButton.disabled = true;
    note("Открываем Telegram...");
    try {
      const sdk = await loadSdk();
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const nonce = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      sdk.auth({ client_id: CLIENT_ID, scope: ["profile"], lang: "ru", nonce }, async result => {
        try {
          if (!result?.id_token) {
            note(result?.error ? "Telegram: " + String(result.error).slice(0, 140) : "Вход отменён.");
            return;
          }
          note("Проверяем подтверждение Telegram...");
          const verified = await verifyTelegram(result.id_token, nonce);
          // В браузере хранится только кратковременный токен Telegram.
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.id_token, nonce }));
          user = verified;
          syncHeader();
          openProfile();
          if (!dialog.open) dialog.showModal();
          note("");
        } catch (err) {
          note(err?.message || "Не удалось завершить вход.");
        } finally {
          loginButton.disabled = false;
        }
      });
    } catch (err) {
      note(err?.message || "Telegram временно недоступен.");
      loginButton.disabled = false;
    }
  }

  async function restoreSession() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!saved?.token || !saved?.nonce) return;
      const verified = await verifyTelegram(saved.token, saved.nonce);
      user = verified;
      syncHeader();
      if (dialog.open && !preview) openProfile();
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
      user = null;
      syncHeader();
    }
  }

  document.querySelectorAll("[data-account-open]").forEach(button =>
    button.addEventListener("click", openDialog)
  );
  document.querySelector("#account-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  loginButton.addEventListener("click", authenticate);
  document.querySelector("#account-preview").addEventListener("click", () => openProfile(true));
  document.querySelector("#account-back").addEventListener("click", openLogin);
  saveDate.addEventListener("click", () => {
    if (!user || preview) return;
    if (!birthInput.value) { birthNote.textContent = "Укажите дату рождения."; return; }
    localStorage.setItem(BIRTH_PREFIX + user.id, birthInput.value);
    birthNote.textContent = "Дата сохранена только в вашем браузере.";
  });
  document.querySelector("#account-birth-delete").addEventListener("click", () => {
    if (!user || preview) return;
    localStorage.removeItem(BIRTH_PREFIX + user.id);
    birthInput.value = "";
    birthNote.textContent = "Дата удалена с этого устройства.";
  });
  signout.addEventListener("click", () => {
    user = null;
    sessionStorage.removeItem(SESSION_KEY);
    syncHeader();
    openLogin();
  });
  restoreSession();
})();