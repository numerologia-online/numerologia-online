/* Личный кабинет: лёгкий тестовый этап без серверного хранения.
 * Сначала задайте публичный client_id из BotFather. Никогда не указывайте Client Secret или Bot Token.
 * Для платных разделов обязательна отдельная серверная проверка прав доступа. */
(() => {
  "use strict";
  const TELEGRAM_CLIENT_ID = 8814989076; // Публичный Client ID из BotFather > Login Widget
  const SESSION_KEY = "num-online-tg-session-v1";
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
  let user = null;
  let isPreview = false;
  let sdkPromise = null;

  function setStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function decode64(value) {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - padded.length % 4) % 4));
    return Uint8Array.from(binary, ch => ch.charCodeAt(0));
  }

  function parseJwtPart(value) {
    return JSON.parse(new TextDecoder().decode(decode64(value)));
  }

  async function verifyTelegramIdToken(token, nonce) {
    if (!Number.isSafeInteger(TELEGRAM_CLIENT_ID) || TELEGRAM_CLIENT_ID <= 0) {
      throw new Error("Telegram ещё не настроен.");
    }
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw new Error("Telegram вернул некорректный ответ.");
    const header = parseJwtPart(parts[0]);
    const payload = parseJwtPart(parts[1]);
    if (header.alg !== "RS256" || !header.kid) {
      throw new Error("Неподдерживаемый способ подписи Telegram.");
    }
    const response = await fetch("https://oauth.telegram.org/.well-known/jwks.json", {
      method: "GET", cache: "no-store", mode: "cors"
    });
    if (!response.ok) throw new Error("Не удалось проверить подпись Telegram.");
    const jwks = await response.json();
    const jwk = (jwks.keys || []).find(key => key.kid === header.kid && (!key.alg || key.alg === "RS256") && key.kty === "RSA");
    if (!jwk) throw new Error("Ключ проверки Telegram недоступен.");
    const publicKey = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", publicKey, decode64(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
    const now = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!valid || payload.iss !== "https://oauth.telegram.org" ||
        !audience.map(String).includes(String(TELEGRAM_CLIENT_ID)) ||
        (!Number.isSafeInteger(payload.id) || payload.id <= 0) || typeof payload.exp !== "number" || payload.exp <= now ||
        typeof payload.iat !== "number" || payload.iat > now + 60 ||
        (nonce && payload.nonce !== nonce)) {
      throw new Error("Подтверждение Telegram не прошло проверку.");
    }
    return {
      id: String(payload.id),
      name: String(payload.name || payload.given_name || payload.preferred_username || "Пользователь").slice(0, 80)
    };
  }

  function syncHeader() {
    if (user) {
      signup.hidden = true;
      signin.textContent = "Личный кабинет";
    } else {
      signup.hidden = false;
      signin.textContent = "Войти";
    }
  }

  function openProfile(preview = false) {
    isPreview = preview;
    loginView.hidden = true;
    profileView.hidden = false;
    title.textContent = preview ? "Гостевой просмотр" : user.name;
    previewWarning.hidden = !preview;
    signout.hidden = preview;
    birthInput.disabled = preview;
    document.querySelector("#account-birth-save").disabled = preview;
    birthInput.value = preview ? "" : (localStorage.getItem(BIRTH_PREFIX + user.id) || "");
    birthNote.textContent = preview
      ? "В режиме просмотра данные не сохраняются."
      : "Дата хранится только в этом браузере. Сайт не загружает её на сервер.";
  }

  function showLogin() {
    isPreview = false;
    loginView.hidden = false;
    profileView.hidden = true;
    setStatus(!TELEGRAM_CLIENT_ID
      ? "Для настоящего входа осталось подключить публичный Client ID нашего бота в BotFather. Пока можно посмотреть кабинет."
      : "");
  }

  async function loadSdk() {
    if (window.Telegram?.Login?.auth) return window.Telegram.Login;
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://oauth.telegram.org/js/telegram-login.js";
      script.async = true;
      script.onload = () => window.Telegram?.Login?.auth
        ? resolve(window.Telegram.Login)
        : reject(new Error("Не удалось запустить модуль Telegram."));
      script.onerror = () => reject(new Error("Telegram сейчас недоступен. Повторите попытку позднее."));
      document.head.appendChild(script);
    }).catch(error => { sdkPromise = null; throw error; });
    return sdkPromise;
  }

  async function authenticate() {
    if (!TELEGRAM_CLIENT_ID) {
      setStatus("Нужен публичный Client ID бота из BotFather → Login Widget. Секреты не нужны.");
      return;
    }
    if (!window.isSecureContext || !crypto?.subtle) {
      setStatus("Для входа откройте сайт по защищённому HTTPS-адресу.");
      return;
    }
    loginButton.disabled = true;
    setStatus("Подключаем Telegram...");
    try {
      const sdk = await loadSdk();
      const bytes = crypto.getRandomValues(new Uint8Array(24));
      const nonce = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
      sdk.auth({ client_id: TELEGRAM_CLIENT_ID, scope: ["profile"], lang: "ru", nonce }, async result => {
        try {
          if (!result?.id_token) {
            setStatus(result?.error ? "Telegram: " + String(result.error).slice(0, 140) : "Вход отменён.");
            return;
          }
          const verified = await verifyTelegramIdToken(result.id_token, nonce);
          user = verified;
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.id_token, nonce }));
          syncHeader();
          setStatus("");
          openProfile();
        } catch (error) {
          setStatus(error.message || "Не удалось подтвердить вход.");
        } finally {
          loginButton.disabled = false;
        }
      });
    } catch (error) {
      setStatus(error.message || "Не удалось подключиться к Telegram.");
      loginButton.disabled = false;
    }
  }

  async function restoreSession() {
    try {
      if (!TELEGRAM_CLIENT_ID) return;
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (!session?.token || !session?.nonce) return;
      user = await verifyTelegramIdToken(session.token, session.nonce);
      syncHeader();
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
      user = null;
      syncHeader();
    }
  }

  document.querySelectorAll("[data-account-open]").forEach(button => {
    button.addEventListener("click", () => {
      if (user) openProfile();
      else showLogin();
      dialog.showModal();
      if (TELEGRAM_CLIENT_ID && !user) loadSdk().catch(error => setStatus(error.message));
    });
  });
  document.querySelector("#account-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  loginButton.addEventListener("click", authenticate);
  document.querySelector("#account-preview").addEventListener("click", () => openProfile(true));
  document.querySelector("#account-back").addEventListener("click", showLogin);
  document.querySelector("#account-birth-save").addEventListener("click", () => {
    if (!user || isPreview) return;
    if (!birthInput.value) {
      birthNote.textContent = "Сначала выберите дату рождения.";
      return;
    }
    localStorage.setItem(BIRTH_PREFIX + user.id, birthInput.value);
    birthNote.textContent = "Сохранено на этом устройстве. На сервер ничего не отправлено.";
  });
  document.querySelector("#account-birth-delete").addEventListener("click", () => {
    if (!user || isPreview) return;
    localStorage.removeItem(BIRTH_PREFIX + user.id);
    birthInput.value = "";
    birthNote.textContent = "Дата удалена с этого устройства.";
  });
  signout.addEventListener("click", () => {
    user = null;
    sessionStorage.removeItem(SESSION_KEY);
    syncHeader();
    showLogin();
  });
  restoreSession();
})();
