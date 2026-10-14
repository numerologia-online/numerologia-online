/* Нумерология Онлайн: авторизация внутри Telegram Mini App.
 * Никаких Telegram Login popup, переходов в Safari или отдельной регистрации.
 * Доверяем имени и Telegram ID только после проверки подписанного initData на сервере.
 * Платные права / платежи не реализованы: это только личный кабинет.
 */
(() => {
  "use strict";
  const CHECK_URL = "https://numerologia-online-auth-server.vercel.app/api/miniapp";
  const BIRTH_PREFIX = "num-online-birth-v1:";
  const dialog = document.querySelector("#account-dialog");
  const accountButton = document.querySelector("[data-account-open='profile']");
  const loginView = document.querySelector("#account-login");
  const profileView = document.querySelector("#account-profile");
  const status = document.querySelector("#account-status");
  const retry = document.querySelector("#account-retry");
  const title = document.querySelector("#account-person-name");
  const birthInput = document.querySelector("#account-birth");
  const birthNote = document.querySelector("#account-birth-note");
  const warning = document.querySelector("#account-preview-warning");
  const app = window.Telegram && window.Telegram.WebApp;
  if (!dialog || !accountButton || !loginView || !profileView || !status) return;

  let user = null;
  let loading = false;
  let mini = false;

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
    accountButton.textContent = mini ? "Личный кабинет" : "Открыть в Telegram";
    accountButton.disabled = false;
  }

  function showProfile() {
    if (!user) return;
    loginView.hidden = true;
    profileView.hidden = false;
    title.textContent = user.name;
    warning.textContent = "Вход подтверждён Telegram. Покупки и платные доступы пока не подключены.";
    warning.hidden = false;
    birthInput.value = localStorage.getItem(BIRTH_PREFIX + user.id) || "";
    birthNote.textContent = "Дата рождения хранится только в этом браузере.";
    accountButton.textContent = "Мой кабинет";
    accountButton.disabled = false;
  }

  async function identify() {
    if (loading) return;
    loading = true;
    accountButton.textContent = "Подключаем...";
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
      if (!dialog.open) dialog.showModal();
    } catch (err) {
      setMessage("Автоматический вход не удался: " + (err?.message || "Нет соединения с сервером."), !!raw);
      if (!dialog.open) dialog.showModal();
    } finally {
      loading = false;
    }
  }

  accountButton.addEventListener("click", () => {
    if (user) showProfile();
    else if (mini && !loading) {
      loginView.hidden = false;
      profileView.hidden = true;
    } else {
      setMessage("Для автоматического входа откройте сайт кнопкой нашего Telegram-бота.", false);
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
    if (!birthInput.value) {
      birthNote.textContent = "Укажите дату рождения.";
      return;
    }
    localStorage.setItem(BIRTH_PREFIX + user.id, birthInput.value);
    birthNote.textContent = "Дата сохранена на этом устройстве.";
  });
  document.querySelector("#account-birth-delete").addEventListener("click", () => {
    if (!user) return;
    localStorage.removeItem(BIRTH_PREFIX + user.id);
    birthInput.value = "";
    birthNote.textContent = "Дата удалена с этого устройства.";
  });

  mini = isTelegramEnvironment();
  if (mini) {
    document.querySelector(".account-telegram-link").hidden = true;
    try { app?.ready(); app?.expand(); } catch (_) {}
    identify();
  } else {
    accountButton.textContent = "Открыть в Telegram";
  }
})();