/* First-party email account UX on REG.RU. Does not alter Telegram login or paywalls. */
(() => {
  "use strict";
  const API = "/api/numi-account.php";
  const dialog = document.getElementById("account-dialog");
  const profile = document.getElementById("account-profile");
  const overview = document.getElementById("account-overview");
  const ownerButton = document.querySelector("[data-account-open='profile']");
  const browserNote = document.getElementById("account-browser-note");
  const name = document.getElementById("account-person-name");
  const avatar = document.getElementById("account-avatar-letter");
  const verifiedIcon = document.getElementById("account-verified");
  const identityLabel = document.getElementById("account-identity-label");
  const birthInput = document.getElementById("account-birth");
  const birthNote = document.getElementById("account-birth-note");
  const savedPanel = document.querySelector("[data-account-content='saved']");
  if (!dialog || !profile || !overview || !ownerButton) return;

  // Cabinet-only polish: the tariff comparison already contains the club benefits.
  // Keep pricing, offer flows and all purchase logic intact.
  dialog.querySelector("#account-show-offer")?.remove();

  // Reuse the exact public legal destinations from the website footer.
  // Show them below the dashboard tiles (not in the paid-content panels).
  if (!overview.querySelector("#numi-cabinet-documents")) {
    const legalLinks = [
      ["Политика конфиденциальности", "/privacy.html"],
      ["Публичная оферта", "/offer.html"],
      ["Стоимость и тарифы", "/prices.html"],
      ["Возврат денежных средств", "/refunds.html"],
      ["Условия пользования", "/terms.html"],
      ["Дисклеймер", "/disclaimer.html"],
      ["Контакты и реквизиты", "/contacts.html"],
      ["Настройки аналитики", "/analytics-settings.html"]
    ];
    const legalNav = document.createElement("nav");
    legalNav.id = "numi-cabinet-documents";
    legalNav.setAttribute("aria-label", "Документы и настройки сайта");
    const legalGrid = document.createElement("div");
    legalGrid.className = "numi-cabinet-documents-grid";
    const compactLabels = ["Политика", "Оферта", "Тарифы", "Возврат", "Правила", "Дисклеймер", "Реквизиты", "Аналитика"];
    for (const [index, [label, url]] of legalLinks.entries()) {
      const link = document.createElement("a");
      link.href = url;
      link.textContent = compactLabels[index];
      link.title = label;
      link.setAttribute("aria-label", label);
      legalGrid.append(link);
    }
    legalNav.append(legalGrid);
    overview.append(legalNav);
    const legalStyle = document.createElement("style");
    legalStyle.textContent = `
      #account-overview #numi-cabinet-documents {
        margin: 4px 0 0; padding: 0; border: 0;
        color: #718174;
      }
      #account-overview .numi-cabinet-documents-grid {
        display: flex; flex-wrap: wrap; justify-content: center;
        align-items: baseline; gap: 0 10px;
      }
      #account-overview .numi-cabinet-documents-grid a {
        display: inline; min-height: 0; padding: 0; margin: 0;
        color: #667b6b; font: 500 11px/1.25 system-ui, -apple-system, sans-serif;
        text-decoration: underline; text-underline-offset: 2px;
        white-space: nowrap;
      }
      #account-overview .numi-cabinet-documents-grid a:focus-visible {
        outline: 2px solid #2d8864; outline-offset: 2px;
      }
    `;
    dialog.append(legalStyle);
  }

  const signedTelegram = () => {
    const init = window.Telegram?.WebApp?.initData;
    if (typeof init === "string" && init) return init;
    const hash = String(location.hash || "").replace(/^#/, "");
    if (!hash.includes("tgWebAppData=")) return "";
    try { return new URLSearchParams(hash).get("tgWebAppData") || ""; }
    catch (_) { return ""; }
  };
  const isTelegram = () => Boolean(signedTelegram());
  let current = null;
  let busy = false;
  let selected = "login";
  let initialized = false;
  const params = new URLSearchParams(location.search);
  const resetToken = params.get("reset_token");
  const accountVerified = params.get("account_verified");
  if (resetToken || accountVerified) {
    params.delete("reset_token"); params.delete("account_verified");
    history.replaceState(null,"",location.pathname+(params.toString()?"?"+params:"")+location.hash);
  }

  async function request(action, payload={}, signal=null) {
    const res = await fetch(API, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action,...payload}), signal:signal||undefined
    });
    let json;
    try { json = await res.json(); } catch (_) { throw new Error("Нет ответа от сервера."); }
    if (!res.ok || json?.ok !== true) {
      const message={
        INVALID_EMAIL_OR_PASSWORD:"Укажите правильный email и пароль.",
        INVALID_EMAIL:"Проверьте адрес электронной почты.",
        EMAIL_ALREADY_REGISTERED:"Этот адрес уже зарегистрирован. Попробуйте войти.",
        INVALID_CREDENTIALS:"Email или пароль неверны.",
        EMAIL_NOT_VERIFIED:"Подтвердите почту по ссылке из письма.",
        EMAIL_DELIVERY_UNAVAILABLE:"Не удалось отправить письмо. Попробуйте позже.",
        TOO_MANY_ATTEMPTS:"Слишком много попыток. Попробуйте через 15 минут.",
        INVALID_OR_EXPIRED_LINK:"Ссылка недействительна или срок её действия закончился.",
        INVALID_RESET_REQUEST:"Проверьте новый пароль и ссылку.",
        TELEGRAM_INVALID:"Не удалось подтвердить Telegram. Откройте мини-приложение заново.",
        ACCOUNT_TEMPORARILY_UNAVAILABLE:"Вход временно недоступен, попробуйте позже.",
        EMAIL_ALREADY_VERIFIED:"Почта уже привязана.",
        IDENTITY_ALREADY_LINKED:"Этот Telegram уже привязан к другому аккаунту.",
        TELEGRAM_EMAIL_CONFLICT:"Для безопасности эти аккаунты нельзя объединить автоматически. Покупки не изменены.",
        REAL_FISCAL_CONTACT_REQUIRED:"Укажите корректный email для электронного чека. Регистрация не нужна.",
        REAL_FISCAL_CONTACT_MISMATCH:"Для повторной попытки укажите тот же email, что при первом пополнении."
      }[json?.error] || "Не удалось выполнить действие. Попробуйте ещё раз.";
      throw new Error(message);
    }
    return json;
  }

  const html = [
    '<section id="numi-account-entry" class="numi-account-entry" aria-label="Регистрация и вход">',
      '<div id="numi-account-guest">',
        '<h3>Сохраните свои покупки</h3>',
        '<p>Войдите или зарегистрируйтесь, чтобы возвращаться к разборам с любого устройства.</p>',
        '<a id="numi-bot-signin" class="numi-bot-signin" href="https://t.me/Numerologiaonline_bot?startapp" rel="noopener">🤖 Войти через наш бот</a>',
        '<p class="numi-bot-signin-note">Откроется наш бот с мини-приложением. Вход в кабинет через него происходит автоматически.</p>',
        '<p class="numi-bot-signin-divider"><span>или войдите по почте</span></p>',
        '<div class="numi-auth-tabs" role="group" aria-label="Выберите действие">',
          '<button type="button" data-numi-tab="login" class="is-active">Войти</button>',
          '<button type="button" data-numi-tab="register">Регистрация</button>',
        '</div>',
        '<form id="numi-email-form" novalidate>',
          '<label>Email<input name="email" type="email" inputmode="email" autocomplete="username" maxlength="191" required placeholder="Ваша почта"></label>',
          '<label>Пароль<input name="password" type="password" autocomplete="current-password" maxlength="200" required placeholder="Введите пароль"></label>',
          '<label id="numi-confirm-label" hidden>Повторите пароль<input name="password_confirm" type="password" autocomplete="new-password" maxlength="200" placeholder="Повторите пароль"></label>',
          '<button type="submit" class="numi-auth-submit">Войти в кабинет</button>',
        '</form>',
        '<form id="numi-reset-form" hidden>',
          '<label>Email для восстановления<input name="email" type="email" inputmode="email" autocomplete="email" required></label>',
          '<button type="submit" class="numi-auth-submit">Отправить ссылку</button>',
        '</form>',
        '<form id="numi-new-password-form" hidden>',
          '<label>Новый пароль<input name="password" type="password" autocomplete="new-password" maxlength="200" required></label>',
          '<label>Повторите новый пароль<input name="password_confirm" type="password" autocomplete="new-password" maxlength="200" required></label>',
          '<button type="submit" class="numi-auth-submit">Сохранить новый пароль</button>',
        '</form>',
        '<button id="numi-forgot" type="button" class="numi-auth-link">Забыли пароль?</button>',
        '<button id="numi-back-login" type="button" class="numi-auth-link" hidden>Вернуться ко входу</button>',
        '<button id="numi-resend" type="button" class="numi-auth-link" hidden>Отправить письмо ещё раз</button>',

      '</div>',
      '<div id="numi-account-signed" hidden>',
        '<p id="numi-account-email-label" class="numi-signed-email"></p>',
        '<p class="numi-account-privacy">Почта и Telegram нужны для входа и сохранения ваших покупок. Мы не отправляем рекламные письма и не пишем вам личные сообщения.</p>',
        '<p class="numi-account-privacy">Хотите видеть эти покупки и в Telegram? Откройте наш сайт из Telegram-бота и нажмите «У меня уже есть аккаунт с почтой».</p>',
        '<button type="button" id="numi-account-logout" class="numi-auth-link">Выйти из аккаунта</button>',
      '</div>',
      '<div id="numi-account-telegram" hidden>',
        '<div id="numi-telegram-link-prompt">',
          '<h3>♡ Пусть ваши покупки всегда будут с вами</h3>',
          '<p>Привяжите почту, чтобы видеть свои покупки и при входе через сайт.</p>',
          '<p><strong>Это необязательно.</strong> Если пользуетесь только Telegram, все покупки останутся доступны через него.</p>',
          '<p><strong>Вы уже регистрировались через почту?</strong> Выберите свой вариант:</p>',
          '<button type="button" id="numi-existing-email-open" class="numi-auth-submit">У меня уже есть аккаунт ♡</button>',
          '<button type="button" id="numi-set-email-open" class="numi-auth-link">Я впервые - добавить почту</button>',
          '<p class="numi-account-privacy">Почта и Telegram нужны для входа и сохранения ваших покупок. Мы не отправляем рекламные письма и не пишем вам личные сообщения.</p>',
        '</div>',
        '<p id="numi-telegram-email-linked" hidden>✓ Почта привязана. Теперь можно входить через Telegram или через сайт.</p>',
        '<form id="numi-set-email-form" hidden>',
          '<p>Это для тех, кто ещё не регистрировался через почту. Придумайте пароль для входа на сайт.</p>',
          '<label>Email<input name="email" type="email" inputmode="email" autocomplete="email" required></label>',
          '<label>Придумайте пароль<input name="password" type="password" autocomplete="new-password" maxlength="200" required></label>',
          '<label>Повторите пароль<input name="password_confirm" type="password" autocomplete="new-password" maxlength="200" required></label>',
          '<button type="submit" class="numi-auth-submit">Привязать почту</button>',
        '</form>',
        '<form id="numi-existing-email-form" hidden>',
          '<p>Введите почту и ваш прежний пароль от сайта. Новый аккаунт создавать не нужно - покупки объединим с Telegram.</p>',
          '<label>Email<input name="email" type="email" autocomplete="email" required></label>',
          '<label>Пароль от аккаунта<input name="password" type="password" autocomplete="current-password" required></label>',
          '<button class="numi-auth-submit" type="submit">Объединить аккаунты ♡</button>',
        '</form>',
      '</div>',
      '<p id="numi-account-message" class="numi-account-message" role="status" aria-live="polite" hidden></p>',
    '</section>'
  ].join("");
  const identity = overview.querySelector(".account-identity");
  if (!identity) return;
  identity.insertAdjacentHTML("afterend",html);
  // A single wallet balance in the account header, without any cart or separate store.
  const walletBadge=document.createElement("section");
  walletBadge.id="numi-wallet-account-badge";walletBadge.hidden=true;
  walletBadge.setAttribute("aria-label","Мой баланс");
  overview.querySelector(".account-identity")?.insertAdjacentElement("afterend",walletBadge);
  const walletStyle=document.createElement("style");
  walletStyle.textContent=[
    "#numi-wallet-account-badge{margin:12px 0 14px;padding:9px 16px;background:#f4f1f0;border:1px solid #e1d9d4;border-radius:15px;color:#343b39;font:14px/1.35 system-ui}",
    "#numi-wallet-account-badge .numi-wallet-main{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}",
    "#numi-wallet-account-badge .numi-wallet-total{display:block;font-size:24px;font-weight:750;line-height:1.2}",
    "#numi-wallet-account-badge .numi-wallet-caption{display:block;font-size:12px;color:#69716d}",
    "#numi-wallet-account-badge .numi-wallet-vpn-warning{display:block;margin:3px 0 0;color:#ed1c24;-webkit-text-stroke:.45px #164536;paint-order:stroke fill;text-shadow:0 0 .3px #164536;text-align:center;white-space:nowrap;letter-spacing:-.15px;font:800 clamp(10px,3vw,12.5px)/1.24 system-ui}",
    "#numi-wallet-account-badge button.numi-wallet-main-button{border:0;border-radius:10px;background:#343b39;color:white;padding:10px 15px;font:600 13px system-ui;cursor:pointer}",
    "#numi-wallet-account-badge .numi-wallet-links{display:flex;gap:12px;align-items:center;margin-top:6px;flex-wrap:wrap}",
    "#numi-wallet-account-badge button.numi-wallet-small{border:0;padding:3px 0;background:transparent;color:#606963;text-decoration:underline;font:12px system-ui;cursor:pointer}",
    "#numi-wallet-account-badge .numi-wallet-topup-form{margin-top:10px;display:flex;align-items:end;gap:8px;flex-wrap:wrap}",
    "#numi-wallet-account-badge .numi-wallet-topup-form label{font-size:12px;color:#5d6561}",
    "#numi-wallet-account-badge .numi-wallet-topup-form input[type=number]{display:block;width:140px;max-width:100%;margin-top:4px;padding:8px;border:1px solid #b7aaa2;border-radius:9px;background:white;color:#343b39;font:16px system-ui}",
    "#numi-wallet-account-badge .numi-wallet-payment-methods{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:0;padding:0;border:0}",
    "#numi-wallet-account-badge .numi-wallet-payment-methods label{display:flex;align-items:center;gap:4px;font-size:13px;color:#343b39}",
    "#numi-wallet-account-badge .numi-wallet-payment-methods input{margin:0;accent-color:#343b39}",
    "#numi-wallet-account-badge .numi-wallet-operations{margin:8px 0 0;padding:0;list-style:none;max-height:130px;overflow:auto;font-size:12px;color:#5c6561}",
    "#numi-wallet-account-badge .numi-wallet-operations li{padding:4px 0;border-bottom:1px solid #e3dfdd}",
    "#numi-wallet-account-badge .numi-wallet-feedback{font-size:12px;margin:8px 0 0;color:#5d6561}",
    "#numi-wallet-account-badge .numi-club-status{margin:4px 0 0;display:flex;flex-direction:column;gap:2px;align-items:center;text-align:center;color:#5b6961;font:12px/1.3 system-ui}",
    "#numi-wallet-account-badge .numi-wallet-links .numi-wallet-caption{flex:0 0 100%;text-align:center;line-height:1.25}",
    "#numi-wallet-account-badge .numi-club-status > span{display:block;max-width:100%;white-space:nowrap;letter-spacing:-.15px;font-size:clamp(9px,2.55vw,11px)}",
    "#numi-wallet-account-badge .numi-club-status > .numi-wallet-small{align-self:center;text-align:center}",
    "#numi-wallet-account-badge [hidden]{display:none!important}"
  ].join("");
  dialog.append(walletStyle);
  const topupStyle=document.createElement("style");
  topupStyle.textContent="#account-dialog .numi-wallet-topup-page[hidden]{display:none!important}\n#account-dialog .numi-wallet-topup-page{width:100%;box-sizing:border-box;padding:8px 0 28px;color:#234839;font:15px/1.5 system-ui}\n#account-dialog .numi-wallet-topup-back{border:1px solid #dcc8a0;border-radius:13px;background:#fff8eb;color:#8b672f;padding:10px 14px;min-height:46px;font:650 14px/1.3 system-ui;cursor:pointer;margin-bottom:23px}\n#account-dialog .numi-wallet-topup-page h3{margin:0 0 8px;color:#1a4937;font:normal clamp(29px,7vw,38px)/1.15 Georgia,serif}\n#account-dialog .numi-wallet-topup-intro{margin:0 0 22px;color:#607368;font-size:14px}\n#account-dialog .numi-wallet-vpn-banner{display:block;padding:17px 16px;margin:0 0 20px;border:2px solid #b68c46;border-radius:15px;background:#fff8e8;color:#593d16;text-align:center;font:750 clamp(17px,4.6vw,21px)/1.35 system-ui}\n#account-dialog .numi-wallet-topup-current{margin:0 0 24px;border:1px solid #dae2d9;background:#f0f5ee;border-radius:18px;padding:16px 18px}\n#account-dialog .numi-wallet-topup-current small{display:block;color:#697b70;font-size:12px}\n#account-dialog .numi-wallet-topup-current strong{font-size:25px;line-height:1.2;color:#204635}\n#account-dialog .numi-wallet-topup-form{display:grid;gap:20px;margin:0}\n#account-dialog .numi-wallet-topup-form>label{display:block;font-weight:650;font-size:15px;color:#274b3b}\n#account-dialog .numi-wallet-topup-form input[type=number]{display:block;width:100%;min-height:54px;box-sizing:border-box;margin-top:8px;padding:11px 14px;border:1px solid #b9c8b7;border-radius:14px;background:#fff;color:#253c32;font:18px system-ui}\n#account-dialog .numi-wallet-topup-form input[type=email]{display:block;box-sizing:border-box;width:100%;min-height:49px;margin:9px 0 0;padding:10px 12px;border:1px solid #bca274;border-radius:12px;background:#fff;color:#234839;font:16px system-ui;text-align:center}\n#account-dialog .numi-wallet-payment-methods{display:flex;gap:18px;flex-wrap:wrap;margin:0;padding:0;border:0}\n#account-dialog .numi-wallet-payment-methods label{display:flex;align-items:center;gap:7px;font-size:15px;color:#274b3b}\n#account-dialog .numi-wallet-payment-methods input{accent-color:#245c46;width:18px;height:18px}\n#account-dialog .numi-wallet-topup-form button.numi-wallet-main-button{display:block;width:100%;min-height:52px;border:0;border-radius:14px;background:#224e3c;color:white;font:700 16px system-ui;cursor:pointer}\n#account-dialog .numi-wallet-topup-form button:disabled{opacity:.6;cursor:wait}\n#account-dialog .numi-wallet-topup-feedback{margin:16px 0 0;color:#4b6256;font:14px/1.5 system-ui}\n@media(max-width:700px){#account-dialog.numi-wallet-topup-active{height:calc(100dvh - 22px)!important;max-height:calc(100dvh - 22px)!important;min-height:0!important;margin:auto!important;overflow-y:auto!important;box-sizing:border-box}}";
  dialog.append(topupStyle);
  const walletMain=document.createElement("div");walletMain.className="numi-wallet-main";
  const walletText=document.createElement("div");
  const walletCaption=document.createElement("small");walletCaption.className="numi-wallet-caption";walletCaption.textContent="Мой баланс";
  const walletAmount=document.createElement("strong");walletAmount.className="numi-wallet-total";walletAmount.textContent="0 ₽";
  walletText.append(walletCaption,walletAmount);
  const topupToggle=document.createElement("button");topupToggle.type="button";
  topupToggle.className="numi-wallet-main-button";topupToggle.textContent="Пополнить";
  walletMain.append(walletText,topupToggle);
  const walletForm=document.createElement("form");walletForm.className="numi-wallet-topup-form";
  const amountLabel=document.createElement("label");amountLabel.textContent="Сумма, ₽";
  const amountInput=document.createElement("input");amountInput.type="number";amountInput.min="1";amountInput.max="100000";
  amountInput.step="1";amountInput.required=true;amountInput.placeholder="Введите сумму";amountInput.inputMode="numeric";
  amountLabel.append(amountInput);
  const receiptLabel=document.createElement("label");
  receiptLabel.textContent="Введите почту для получения чека";
  receiptLabel.hidden=true;
  const receiptInput=document.createElement("input");
  receiptInput.type="email";receiptInput.autocomplete="email";
  receiptInput.inputMode="email";receiptInput.maxLength=254;
  receiptInput.placeholder="name@example.ru";
  receiptInput.setAttribute("aria-label","Email для отправки электронного чека");
  const receiptNote=document.createElement("small");
  receiptNote.textContent="Только для чека. Регистрация и подтверждение почты не нужны.";
  receiptNote.style.cssText="display:block;margin-top:5px;color:#697b70;font-weight:400;font-size:12px";
  receiptLabel.append(receiptInput,receiptNote);
  const methodGroup=document.createElement("fieldset");methodGroup.className="numi-wallet-payment-methods";methodGroup.hidden=true;
  const paymentMethods=[["bank_card","Картой"],["sbp","СБП"]];
  const methodRadios=paymentMethods.map(([value,label],index)=>{
    const choice=document.createElement("label"),input=document.createElement("input");
    input.type="radio";input.name="numi-wallet-payment-method";input.value=value;input.checked=index===0;
    choice.append(input,document.createTextNode(label));methodGroup.append(choice);
    return input;
  });
  let walletMode="test";
  const pay=document.createElement("button");pay.type="submit";pay.className="numi-wallet-main-button";pay.textContent="Продолжить";pay.disabled=true;
  walletForm.append(amountLabel,receiptLabel,methodGroup,pay);
  const walletLinks=document.createElement("div");walletLinks.className="numi-wallet-links";
  const ledgerToggle=document.createElement("button");ledgerToggle.type="button";ledgerToggle.className="numi-wallet-small";
  ledgerToggle.textContent="История операций";
  const testNote=document.createElement("small");testNote.className="numi-wallet-caption";
  testNote.textContent="Тестовый режим · без настоящих списаний";
  walletLinks.append(ledgerToggle,testNote);
  const vpnWarning=document.createElement("strong");
  vpnWarning.className="numi-wallet-vpn-warning";
  vpnWarning.textContent="Если окно оплаты зависает, отключите VPN.";
  vpnWarning.hidden=true;
  const clubLine=document.createElement("div");clubLine.className="numi-club-status";
  const clubText=document.createElement("span");clubText.textContent="Проверяем подписку…";
  const clubJoin=document.createElement("button");clubJoin.type="button";
  clubJoin.className="numi-wallet-small";clubJoin.textContent="Узнать преимущества клуба";clubJoin.hidden=true;
  clubJoin.addEventListener("click",()=>{
    // Inform first: show the existing club benefits and tariff comparison,
    // not the purchase flow.
    const pricesTile=overview.querySelector('[data-account-panel="prices"]');
    if(pricesTile){pricesTile.click();return;}
    walletFeedback.hidden=false;
    walletFeedback.textContent="Не удалось открыть преимущества клуба.";
  });
  clubLine.append(clubText,clubJoin);
  const ledger=document.createElement("ul");ledger.className="numi-wallet-operations";ledger.hidden=true;
  const walletFeedback=document.createElement("p");walletFeedback.className="numi-wallet-feedback";walletFeedback.hidden=true;
  walletBadge.append(walletMain,walletLinks,vpnWarning,clubLine,ledger,walletFeedback);
  // Show a dedicated cabinet screen: no nested expanding top-up window.
  const topupPage=document.createElement("section");
  topupPage.className="numi-wallet-topup-page";topupPage.hidden=true;
  topupPage.setAttribute("aria-labelledby","numi-wallet-topup-title");
  const topupBack=document.createElement("button");topupBack.type="button";
  topupBack.className="numi-wallet-topup-back";topupBack.textContent="← Назад в личный кабинет";
  const topupTitle=document.createElement("h3");topupTitle.id="numi-wallet-topup-title";
  topupTitle.textContent="Пополнение баланса";
  const topupIntro=document.createElement("p");topupIntro.className="numi-wallet-topup-intro";
  topupIntro.textContent="Введите сумму и выберите способ оплаты.";
  const vpnBanner=document.createElement("aside");vpnBanner.className="numi-wallet-vpn-banner";
  vpnBanner.hidden=true;vpnBanner.textContent="Если окно оплаты зависает, отключите VPN.";
  const topupCurrent=document.createElement("div");topupCurrent.className="numi-wallet-topup-current";
  const topupCurrentLabel=document.createElement("small");topupCurrentLabel.textContent="Текущий баланс";
  const topupCurrentAmount=document.createElement("strong");topupCurrentAmount.textContent="0 ₽";
  topupCurrent.append(topupCurrentLabel,topupCurrentAmount);
  const topupFeedback=document.createElement("p");topupFeedback.className="numi-wallet-topup-feedback";
  topupFeedback.setAttribute("role","status");topupFeedback.hidden=true;
  topupPage.append(topupBack,topupTitle,topupIntro,vpnBanner,topupCurrent,walletForm,topupFeedback);
  profile.append(topupPage);
  function showTopupPage(){
    // Keep the authenticated main Telegram WebView: no navigation that loses
    // its native bridge before the user taps Continue.
    overview.hidden=true;
    topupPage.hidden=false;
    dialog.classList.add("numi-wallet-topup-active");
    topupCurrentAmount.textContent=walletAmount.textContent;
    topupFeedback.hidden=true;
    topupFeedback.textContent="";
    dialog.scrollTop=0;
    scheduleDirectCheckoutPreparation();
  }
  function leaveTopupPage(){
    ++directPrepareSerial;
    directResetTimer();
    amountInput.blur();
    topupPage.hidden=true;overview.hidden=false;
    dialog.classList.remove("numi-wallet-topup-active");
    dialog.scrollTop=0;
  }
  topupToggle.addEventListener("click",showTopupPage);
  topupBack.addEventListener("click",leaveTopupPage);
  dialog.addEventListener("close",()=>{
    topupPage.hidden=true;
    dialog.classList.remove("numi-wallet-topup-active");
  });
  ledgerToggle.addEventListener("click",()=>{ledger.hidden=!ledger.hidden;});
  let walletReturnHandled=false;
  async function walletReturnedPayment(){
    if(walletReturnHandled)return;
    const params=new URLSearchParams(location.search);
    const topupId=params.get("wallet_topup");
    if(!topupId||!/^[a-f0-9-]{36}$/i.test(topupId))return;
    walletReturnHandled=true;
    try{
      const result=await request("wallet_sync",{topup_id:topupId});
      walletFeedback.hidden=false;
      walletFeedback.textContent=result.status==="credited"?"Пополнение подтверждено. Баланс обновлён.":
        result.status==="canceled"?"Пополнение отменено.":
        result.status==="pending_receipt"?"Оплата прошла, ожидаем подтверждения чека.":
        "Ожидаем подтверждения ЮKassa.";
      if(result.status==="credited"||result.status==="canceled"){
        for(let i=sessionStorage.length-1;i>=0;i--){
          const key=sessionStorage.key(i);if(key?.startsWith("numi-topup-request-"))sessionStorage.removeItem(key);
        }
      }
    }catch(_){walletFeedback.hidden=false;walletFeedback.textContent="Не удалось проверить пополнение. Без подтверждения ЮKassa зачисления нет.";}
    params.delete("wallet_topup");
    history.replaceState(null,"",location.pathname+(params.toString()?"?"+params:"")+location.hash);
  }
  // Prepare a durable YooKassa confirmation URL before the customer's click.
  // Payment remains in the current browser or Telegram WebView.
  // All payments stay on the existing server wallet_topup API and reuse the same
  // per-account idempotence key; preparation itself does not charge a card.
  let directPrepared=null, directPrepareSerial=0, directPrepareTimer=null;
  let directPending=null, directCompleted=null, directSyncBusy=false;
  const directFingerprint=choice=>[walletMode,choice.amount,choice.method,choice.email].join("|");
  function directChoice(){
    const amount=Number(amountInput.value);
    if(!Number.isInteger(amount)||amount<1||amount>100000)return null;
    const method=walletMode==="live"?(methodRadios.find(input=>input.checked)?.value||"bank_card"):"bank_card";
    const email=receiptInput.value.trim().toLowerCase();
    if(walletMode==="live"&&(!email||!receiptInput.checkValidity()))return null;
    return {amount,method,email};
  }
  function directPaymentUrl(raw){
    if(typeof raw!=="string")throw new Error("ЮKassa пока не вернула платёжную ссылку.");
    const url=new URL(raw);
    if(url.protocol!=="https:"||url.port||url.username||url.password||
      !["yookassa.ru","yoomoney.ru"].some(host=>url.hostname===host||url.hostname.endsWith("."+host)))
      throw new Error("ЮKassa вернула недопустимый адрес оплаты.");
    return url.href;
  }
  function directIntent(choice){
    const keyName="numi-topup-request-"+walletMode+"-"+choice.method+"-"+choice.amount;
    const emailName=keyName+"-receipt";
    let key=sessionStorage.getItem(keyName);
    if(!key||!/^[a-f0-9-]{36}$/i.test(key)){
      key=crypto.randomUUID();
      sessionStorage.setItem(keyName,key);
      if(walletMode==="live")sessionStorage.setItem(emailName,choice.email);
    }else if(walletMode==="live"&&sessionStorage.getItem(emailName)&&
      sessionStorage.getItem(emailName)!==choice.email){
      throw new Error("Для незавершённой оплаты укажите прежний email для чека.");
    }
    const payload={amount_rub:choice.amount,request_key:key};
    if(walletMode==="live"){
      payload.payment_method=choice.method;
      payload.receipt_email=choice.email;
    }
    return {payload,keyName,emailName};
  }
  function directMessage(value){
    topupFeedback.hidden=!value;
    topupFeedback.textContent=value||"";
  }
  function directResetTimer(){
    if(directPrepareTimer!==null){clearTimeout(directPrepareTimer);directPrepareTimer=null;}
  }
  function scheduleDirectCheckoutPreparation(){
    if(topupPage.hidden||!current)return;
    directResetTimer();
    const choice=directChoice();
    if(!choice){
      directPrepareSerial++;
      directPrepared=null;
      pay.textContent="Продолжить";
      pay.disabled=true;
      return;
    }
    const fingerprint=directFingerprint(choice);
    if(directCompleted===fingerprint){
      pay.textContent="Оплачено";pay.disabled=true;return;
    }
    if(directPrepared?.fingerprint===fingerprint){
      pay.textContent="Продолжить";pay.disabled=false;return;
    }
    const serial=++directPrepareSerial;
    directPrepared=null;
    pay.textContent="Готовим оплату…";
    pay.disabled=true;
    directMessage("Подготавливаем защищённую оплату ЮKassa…");
    directPrepareTimer=setTimeout(async()=>{
      directPrepareTimer=null;
      const abort=new AbortController();
      const timeout=setTimeout(()=>abort.abort(),28000);
      try{
        const intent=directIntent(choice);
        // A timed-out API call may still create a pending intent. The SAME
        // stable idempotence key is retained for all retry attempts.
        const result=await request("wallet_topup",intent.payload,abort.signal);
        if(serial!==directPrepareSerial||topupPage.hidden||directFingerprint(directChoice()||{})!==fingerprint)return;
        if(result.credited){
          directCompleted=fingerprint;
          sessionStorage.removeItem(intent.keyName);
          sessionStorage.removeItem(intent.emailName);
          pay.textContent="Оплачено";pay.disabled=true;
          directMessage("Баланс уже пополнен.");
          void refreshWalletBadge();return;
        }
        const href=directPaymentUrl(result.confirmation_url);
        if(typeof result.topup_id!=="string"||!/^[a-f0-9-]{36}$/i.test(result.topup_id))
          throw new Error("Не удалось проверить номер пополнения.");
        directPrepared={fingerprint,href,topupId:result.topup_id,...intent};
        pay.textContent="Продолжить";
        pay.disabled=false;
        directMessage("");
      }catch(error){
        if(serial!==directPrepareSerial||topupPage.hidden)return;
        pay.textContent="Повторить подготовку";
        pay.disabled=false;
        directMessage(error?.name==="AbortError"?
          "ЮKassa долго отвечает. Повторим проверку без создания нового платежа.":
          error?.message||"Не удалось подготовить оплату.");
      }finally{clearTimeout(timeout);}
    },400);
  }
  for(const field of [amountInput,receiptInput,...methodRadios]){
    field.addEventListener("input",scheduleDirectCheckoutPreparation);
    field.addEventListener("change",scheduleDirectCheckoutPreparation);
  }
  function directOpenHere(url){
    // Both Telegram Mini App and ordinary site remain in their existing tab.
    location.assign(url);
  }
  async function directSyncOnReturn(){
    if(!directPending||directSyncBusy||document.hidden)return;
    directSyncBusy=true;
    try{
      const result=await request("wallet_sync",{topup_id:directPending.topupId});
      if(result.status==="credited"){
        directCompleted=directPending.fingerprint;
        sessionStorage.removeItem(directPending.keyName);
        sessionStorage.removeItem(directPending.emailName);
        directPending=null;directPrepared=null;
        pay.textContent="Оплачено";pay.disabled=true;
        directMessage("Оплата подтверждена. Баланс обновлён.");
        void refreshWalletBadge();
      }else if(result.status==="canceled"){
        directPending=null;
        directMessage("Платёж отменён. Деньги не списаны.");
        pay.disabled=false;
      }else{
        directMessage("Проверяем статус оплаты. Повторных списаний нет.");
        // Reopening the same already-created provider URL is safe.
        pay.disabled=false;
        pay.textContent="Продолжить";
      }
    }catch(_){
      directMessage("Проверяем оплату. Новый платёж не создаём.");
      pay.disabled=false;
    }finally{directSyncBusy=false;}
  }
  window.addEventListener("focus",()=>{void directSyncOnReturn();});
  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden)void directSyncOnReturn();
  });
  walletForm.addEventListener("submit",event=>{
    event.preventDefault();
    if(!current||pay.disabled)return;
    const choice=directChoice();
    if(!choice){
      directMessage("Введите сумму и корректный email для чека.");
      return;
    }
    if(!directPrepared||directPrepared.fingerprint!==directFingerprint(choice)){
      scheduleDirectCheckoutPreparation();
      return;
    }
    try{
      directPending=directPrepared;
      pay.disabled=true;
      pay.textContent="Переходим к оплате…";
      directMessage("Открываем оплату в этом окне.");
      directOpenHere(directPrepared.href);
    }catch(error){
      pay.disabled=false;
      directMessage(error?.message||"Не удалось открыть оплату.");
      pay.disabled=false;
    }
  });
  // These controls are bound to the authenticated server account, never to
  // an unverified localStorage subscription flag or a browser-side price.
  const subscriptionFeedback=document.getElementById("numi-subscription-feedback");
  const subscriptionEntries=[
    {code:"club_month",short:"club",name:"Клуб",price:49000},
    {code:"school_week",short:"school",name:"Самоучитель нумерологии",price:14900}
  ];
  // A subscription is an explicitly ordered recurring purchase, not a pre-checked box.
  // The buyer confirms clear price/frequency/cancellation terms by clicking its
  // dedicated subscribe button. One-off wallet purchases remain separate.
  const subscriptionAutopay=new Map();
  for(const entry of subscriptionEntries){
    const renew=document.getElementById("numi-"+entry.short+"-subscription-renew");
    if(!renew)continue;
    const row=document.createElement("div");
    row.className="numi-subscription-autopay";

    const period=entry.code==="club_month"?"каждый месяц":"каждые 7 дней";
    const price=(entry.price/100)+" ₽";

    const email=document.createElement("input");
    email.type="email";email.autocomplete="email";email.maxLength=254;
    email.placeholder="Email для чека";email.setAttribute("aria-label","Email для электронного чека за подписку");
    email.className="numi-subscription-email";
    const payAuto=document.createElement("button");
    payAuto.type="button";payAuto.className="numi-subscription-card-pay";
    payAuto.textContent="Оформить подписку";
    payAuto.disabled=true;
    const terms=document.createElement("p");
    terms.className="numi-subscription-note";
    terms.textContent="Нажимая кнопку, вы соглашаетесь на сохранение способа оплаты ЮKassa "+
      "и списание "+price+" "+period+" до отмены. "+
      "Отключение и отвязка карты — здесь, в «Моих подписках». Оплаченный срок сохраняется.";
    row.append(email,payAuto,terms);
    // Show the default subscription offer FIRST, then optional one-off payment.
    const actions=renew.closest(".account-actions");
    if(actions)actions.insertAdjacentElement("beforebegin",row);
    else renew.insertAdjacentElement("beforebegin",row);
    renew.classList.remove("account-primary");
    renew.classList.add("account-secondary");
    const ui={row,email,payAuto,available:false};
    subscriptionAutopay.set(entry.code,ui);
    payAuto.addEventListener("click",async()=>{
      if(subscriptionBusy||!current||!ui.available)return;
      const address=email.value.trim().toLowerCase();
      if(!address||!email.checkValidity()){
        subscriptionMessage("Введите корректный email для чека.");
        email.focus();return;
      }
      const keyId="numi-subscription-card-"+entry.code;
      let key=sessionStorage.getItem(keyId);
      if(!key||!/^[a-f0-9-]{36}$/i.test(key)){
        key=crypto.randomUUID();sessionStorage.setItem(keyId,key);
      }
      subscriptionBusy=true;payAuto.disabled=true;
      subscriptionMessage("Открываем безопасную оплату подписки в ЮKassa…");
      try{
        const result=await request("subscription_checkout",{
          product_code:entry.code,receipt_email:address,
          auto_renew_consent:true,request_key:key
        });
        if(result.test!==false||!result.checkout_id)
          throw new Error("Сервер не подтвердил заказ подписки.");
        if(!result.confirmation_url){
          const verified=await request("subscription_status",{checkout_id:result.checkout_id});
          if(verified.status==="paid"){
            sessionStorage.removeItem(keyId);
            subscriptionMessage("Подписка оплачена. Автопродление: "+
              (verified.auto_renew===true?"включено.":"не включено."));
            await refreshWalletBadge();
          }else{
            subscriptionMessage("Платёж ещё проверяется ЮKassa. Повторное списание не создаём.");
          }
          return;
        }
        const url=new URL(result.confirmation_url);
        if(url.protocol!=="https:"||url.port||url.username||url.password||
          !["yookassa.ru","yoomoney.ru"].some(host=>
            url.hostname===host||url.hostname.endsWith("."+host)))
          throw new Error("Небезопасный адрес платежной формы.");
        location.assign(url.href);
      }catch(error){
        subscriptionMessage(error?.message||"Не удалось начать оплату подписки.");
      }finally{subscriptionBusy=false;payAuto.disabled=!ui.available;}
    });
  }
  let subscriptionBusy=false;
  function subscriptionUntil(raw){
    if(typeof raw!=="string"||!raw)return "";
    const date=new Date(raw.replace(" ","T")+"Z");
    return Number.isNaN(date.getTime())?"":date.toLocaleDateString("ru-RU",{
      timeZone:"UTC",day:"numeric",month:"long",year:"numeric"
    });
  }
  function renderSubscriptions(response){
    const subs=Array.isArray(response?.subscriptions)?response.subscriptions:[];
    for(const entry of subscriptionEntries){
      const info=subs.find(item=>item?.product_code===entry.code);
      const status=document.getElementById("numi-"+entry.short+"-subscription-status");
      const renew=document.getElementById("numi-"+entry.short+"-subscription-renew");
      const cancel=document.getElementById("numi-"+entry.short+"-subscription-cancel");
      if(!status||!renew||!cancel)continue;
      if(!info){
        status.textContent="Не удалось загрузить статус подписки.";
        renew.disabled=true;cancel.disabled=true;cancel.hidden=false;
        const ui=subscriptionAutopay.get(entry.code);
        if(ui){ui.available=false;ui.payAuto.disabled=true;ui.row.hidden=true;}continue;
      }
      const until=subscriptionUntil(info.expires_at);
      status.textContent=info.active===true
        ?"Активна"+(until?" до "+until:"")+
          (info.auto_renew===true?" · автопродление включено":
           info.payment_method_attached===true?" · автосписаний нет, карту можно отвязать":" · автосписаний нет")
        : "Не подключена"+(until?" · предыдущий период закончился "+until:"");
      renew.textContent=info.active===true
        ?"Продлить с баланса"
        :"Разовая оплата с баланса";
      renew.disabled=subscriptionBusy;
      const auto=subscriptionAutopay.get(entry.code);
      if(auto){
        auto.available=info.recurring_available===true;
        auto.row.hidden=walletMode!=="live"||info.auto_renew===true;
        auto.payAuto.disabled=!auto.available||subscriptionBusy;

      }
      // Keep cancellation visible beside the one-off purchase, even for a guest
      // without an active subscription. Only enable an actual cancellation.
      cancel.hidden=false;
      cancel.disabled=subscriptionBusy||!(info.active===true||info.auto_renew===true||info.payment_method_attached===true);
      cancel.textContent="Отменить подписку";
    }
    const tariffs=document.querySelector('#account-dialog [data-account-content="prices"]');
    if(tariffs){
      let note=tariffs.querySelector("#numi-personal-club-price-note");
      if(!note){
        note=document.createElement("p");note.id="numi-personal-club-price-note";
        note.style.cssText="margin:8px 0 15px;color:#1d5b43;font-weight:700;font-size:14px";
        tariffs.querySelector("h3")?.insertAdjacentElement("afterend",note);
      }
      note.textContent=response.club_active===true
        ?"Ваш клуб активен — при покупке применяются клубные цены."
        :"Цены клуба применяются только при действующей подписке.";
    }
    document.documentElement.classList.toggle("numi-club-active",response.club_active===true);
  }
  function subscriptionMessage(message){
    if(subscriptionFeedback)subscriptionFeedback.textContent=message;
  }
  let subscriptionReturnHandled=false;
  async function subscriptionReturnedPayment(){
    if(subscriptionReturnHandled)return;
    const params=new URLSearchParams(location.search);
    const id=params.get("subscription_checkout");
    if(!id||!/^[a-f0-9-]{36}$/i.test(id))return;
    subscriptionReturnHandled=true;
    try{
      const response=await request("subscription_status",{checkout_id:id});
      const state=response.status;
      subscriptionMessage(state==="paid"
        ? "Подписка оплачена. "+(response.auto_renew===true
          ?"Автопродление активно. Отключить его можно в личном кабинете."
          :"Автопродление не включено; доступ оплачен.")
        :state==="pending_receipt"?"Платёж принят, ожидаем регистрацию чека."
        :state==="canceled"?"Оплата подписки отменена."
        :state==="refunded"?"Оплата подписки возвращена."
        :"Проверяем подтверждение платежа ЮKassa.");
      if(["paid","canceled","refunded"].includes(state)){
        for(const entry of subscriptionEntries)
          sessionStorage.removeItem("numi-subscription-card-"+entry.code);
        params.delete("subscription_checkout");
        history.replaceState(null,"",location.pathname+
          (params.toString()?"?"+params:"")+location.hash);
      }else{
        subscriptionReturnHandled=false;
      }
    }catch(_){
      subscriptionReturnHandled=false;
      subscriptionMessage("Платёж проверяется. Без подтверждения ЮKassa новый срок не выдаётся.");
    }
  }
  for(const entry of subscriptionEntries){
    document.getElementById("numi-"+entry.short+"-subscription-renew")?.addEventListener("click",async()=>{
      if(subscriptionBusy||!current)return;
      subscriptionBusy=true;subscriptionMessage("Проверяем цену и баланс…");
      try{
        const item={product_code:entry.code};
        const quote=await request("wallet_quote",{item});
        if(quote.test!==false||quote.kind!=="subscription"||quote.ready!==true)
          throw new Error("Подписка сейчас недоступна для покупки.");
        const required=Number(quote.price_kopeks);
        const available=Number(quote.balance_kopeks);
        if(!Number.isSafeInteger(required)||required<1||!Number.isSafeInteger(available))
          throw new Error("Не удалось проверить сумму.");
        if(available<required){
          subscriptionMessage("Для продления нужно "+(required/100)+" ₽. Пополните баланс и затем нажмите «Продлить».");
          showTopupPage();return;
        }
        const keyId="numi-subscription-renew-"+entry.code;
        let key=sessionStorage.getItem(keyId);
        if(!key||!/^[a-f0-9-]{36}$/i.test(key)){
          key=crypto.randomUUID();sessionStorage.setItem(keyId,key);
        }
        const result=await request("wallet_buy",{item,request_key:key});
        if(result.test!==false||!result.entitlement_id)
          throw new Error("Сервер не подтвердил продление.");
        sessionStorage.removeItem(keyId);
        subscriptionMessage(entry.name+" оплачена. Срок доступа обновлён.");
        await refreshWalletBadge();
        window.dispatchEvent(new Event("numi:club-activated"));
      }catch(error){
        subscriptionMessage(error?.message||"Не удалось продлить подписку. Деньги не списываем повторно.");
      }finally{subscriptionBusy=false;}
    });
    document.getElementById("numi-"+entry.short+"-subscription-cancel")?.addEventListener("click",async()=>{
      if(subscriptionBusy||!current)return;
      subscriptionBusy=true;subscriptionMessage("Отключаем будущие списания…");
      try{
        const result=await request("subscription_cancel",{product_code:entry.code});
        if(result.auto_renew!==false||result.access_unchanged!==true||
          (result.test===false&&result.payment_method_unlinked!==true))
          throw new Error("Сервер не подтвердил отключение и отвязку карты.");
        subscriptionMessage("Будущие списания отключены, привязка карты удалена. Уже оплаченный период сохраняется.");
        await refreshWalletBadge();
      }catch(error){
        subscriptionMessage(error?.message||"Не удалось отключить автопродление.");
      }finally{subscriptionBusy=false;}
    });
  }
  let pendingWalletRefreshTimer=null;
  let pendingWalletRefreshCount=0;
  function scheduleWalletPendingRefresh(response){
    const pending=response?.test===false && Number(response.pending_topups)>0;
    if(!pending){
      pendingWalletRefreshCount=0;
      if(pendingWalletRefreshTimer!==null){
        clearTimeout(pendingWalletRefreshTimer);
        pendingWalletRefreshTimer=null;
      }
      return;
    }
    // The next status call queries YooKassa for THIS signed-in account only.
    // Do not create another payment or retry wallet_topup in this loop.
    if(pendingWalletRefreshTimer!==null||pendingWalletRefreshCount>=45||!dialog.open)return;
    pendingWalletRefreshCount++;
    pendingWalletRefreshTimer=setTimeout(()=>{
      pendingWalletRefreshTimer=null;
      if(current&&dialog.open)void refreshWalletBadge();
    },8000);
  }
  dialog.addEventListener("close",()=>{
    if(pendingWalletRefreshTimer!==null){
      clearTimeout(pendingWalletRefreshTimer);
      pendingWalletRefreshTimer=null;
    }
  });
  async function refreshWalletBadge(){
    if(!current){walletBadge.hidden=true;return;}
    walletBadge.hidden=false;walletAmount.textContent="…";
    try{
      await walletReturnedPayment();
      await subscriptionReturnedPayment();
      const response=await request("wallet_status");
      if(typeof response.test!=="boolean")throw new Error("UNKNOWN_WALLET_MODE");
      const previousWalletMode=walletMode;
      walletMode=response.test?"test":"live";
      methodGroup.hidden=walletMode!=="live";
      receiptLabel.hidden=walletMode!=="live";
      receiptInput.required=walletMode==="live";
      testNote.textContent=walletMode==="test"?"Тестовый режим · без настоящих списаний":"Оплата через ЮKassa · картой или СБП";
      vpnWarning.hidden=walletMode!=="live";
      vpnBanner.hidden=walletMode!=="live";
      walletAmount.textContent=(Number(response.balance_kopeks)/100).toLocaleString("ru-RU")+" ₽";
      topupCurrentAmount.textContent=walletAmount.textContent;
      if(!topupPage.hidden && previousWalletMode!==walletMode) scheduleDirectCheckoutPreparation();
      if(!receiptInput.value && typeof response.receipt_email_suggestion==="string"){
        receiptInput.value=response.receipt_email_suggestion;
        if(!topupPage.hidden) scheduleDirectCheckoutPreparation();
      }
      scheduleWalletPendingRefresh(response);
      // Status checks are silent; only errors deserve space inside the card.
      walletFeedback.hidden=true;
      walletFeedback.textContent="";
      renderSubscriptions(response);
      if(response.club_active===true){
        const expiry=typeof response.club_expires_at==="string"
          ? new Date(response.club_expires_at.replace(" ","T")+"Z") : null;
        const until=expiry&&!Number.isNaN(expiry.getTime())
          ? " до "+expiry.toLocaleDateString("ru-RU",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}) : "";
        clubText.textContent="Клуб активен"+until+" · скидка 50% на разборы";
        clubJoin.hidden=true;
      }else{
        clubText.textContent="Клуб не подключён · участникам разборы вдвое дешевле";
        clubJoin.hidden=false;
      }
      window.dispatchEvent(new Event("numi:club-status-updated"));
      ledger.replaceChildren();
      const labels={topup:"Пополнение",purchase:"Покупка",refund:"Возврат"};
      for(const item of response.operations||[]){
        const line=document.createElement("li"),delta=Number(item.delta_kopeks);
        line.textContent=(labels[item.kind]||"Операция")+" · "+(delta>0?"+":"")+
          (delta/100).toLocaleString("ru-RU")+" ₽";
        ledger.append(line);
      }
      if(!ledger.childElementCount){const li=document.createElement("li");li.textContent="Операций пока нет";ledger.append(li);}
    }catch(_){
      if(pendingWalletRefreshTimer!==null){clearTimeout(pendingWalletRefreshTimer);pendingWalletRefreshTimer=null;}
      renderSubscriptions(null);walletAmount.textContent="Недоступен";walletFeedback.hidden=false;
      walletFeedback.textContent="Не получилось проверить баланс. Покупки без подтверждения сервера не выполняются.";}
  }
  window.addEventListener("numi:wallet-updated",()=>{void refreshWalletBadge();});
  const root = document.getElementById("numi-account-entry");
  // Let visitors verify both typed passwords before submitting any account form.
  // Scoped to this cabinet only. Does not change credentials or submission logic.
  const passwordVisibilityStyle = document.createElement("style");
  passwordVisibilityStyle.textContent = `
    #numi-account-entry .numi-password-field { position: relative; display: block; }
    #numi-account-entry .numi-password-field input { padding-right: 52px; }
    #numi-account-entry .numi-password-eye {
      position: absolute; top: calc(50% + 3px); right: 5px;
      transform: translateY(-50%); display: flex; align-items: center;
      justify-content: center; width: 42px; height: 42px;
      padding: 0; border: 0; border-radius: 9px;
      background: transparent; color: #315f4a; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    #numi-account-entry .numi-password-eye:focus-visible {
      outline: 2px solid #247753; outline-offset: -2px;
    }
    #numi-account-entry .numi-password-eye svg { width: 21px; height: 21px; }
  `;
  root.append(passwordVisibilityStyle);
  // Public browser visitors can enter the existing mini-app through our own bot.
  // This is navigation to the current signed Telegram login, not a new identity provider.
  const botSignInStyle = document.createElement("style");
  botSignInStyle.textContent = `
    #numi-account-entry #numi-bot-signin {
      display: flex; align-items: center; justify-content: center;
      box-sizing: border-box; width: 100%; min-height: 56px;
      margin: 17px 0 5px; padding: 13px 14px;
      border-radius: 15px; background: #19513f; color: #fff;
      font: 800 17px/1.3 Inter, system-ui, sans-serif;
      text-align: center; text-decoration: none;
      overflow-wrap: anywhere; -webkit-tap-highlight-color: transparent;
    }
    #numi-account-entry #numi-bot-signin:focus-visible {
      outline: 3px solid #c49e56; outline-offset: 3px;
    }
    #numi-account-entry .numi-bot-signin-note {
      margin: 5px 0 13px; color: #596c61;
      font: 500 12px/1.45 Inter, system-ui, sans-serif;
      text-align: center;
    }
    #numi-account-entry .numi-bot-signin-divider {
      display: flex; align-items: center; gap: 12px;
      margin: 12px 0 14px; color: #728176;
      font: 600 12px/1.3 Inter, system-ui, sans-serif;
      text-align: center;
    }
    #numi-account-entry .numi-bot-signin-divider::before,
    #numi-account-entry .numi-bot-signin-divider::after {
      content: ""; flex: 1; height: 1px; background: #dce2da;
    }
  `;
  root.append(botSignInStyle);
  const visibleEye = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
  const hiddenEye = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18"/><path d="M10.6 5.1C11.1 5 11.5 5 12 5c6.4 0 10 7 10 7a18 18 0 0 1-3.2 4.1"/><path d="M6.1 6.1C3.4 8.1 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.2-1.1"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>';
  root.querySelectorAll('input[type="password"]').forEach(input => {
    const field = document.createElement("span");
    field.className = "numi-password-field";
    input.parentNode.insertBefore(field, input);
    field.append(input);
    const eye = document.createElement("button");
    eye.type = "button";
    eye.className = "numi-password-eye";
    eye.setAttribute("aria-label", "Показать пароль");
    eye.setAttribute("aria-pressed", "false");
    eye.innerHTML = visibleEye;
    eye.addEventListener("click", () => {
      const shown = input.type === "password";
      input.type = shown ? "text" : "password";
      eye.setAttribute("aria-label", shown ? "Скрыть пароль" : "Показать пароль");
      eye.setAttribute("aria-pressed", String(shown));
      eye.innerHTML = shown ? hiddenEye : visibleEye;
    });
    field.append(eye);
  });
  const guest = document.getElementById("numi-account-guest");
  const signed = document.getElementById("numi-account-signed");
  const logoutButton=document.getElementById("numi-account-logout");
  const logoutOverview=document.getElementById("account-logout-overview");
  const logoutControls=[logoutButton,logoutOverview].filter(Boolean);
  const accountSettings=document.querySelector('#account-dialog [data-account-content="settings"]');
  if(accountSettings && logoutButton){
    const logoutRow=document.createElement("div");
    logoutRow.className="account-actions";
    logoutRow.style.marginTop="16px";
    logoutButton.textContent="Выйти из аккаунта";
    logoutButton.className="numi-cabinet-logout";
    logoutRow.append(logoutButton);
    accountSettings.append(logoutRow);
  }

  const tgBox = document.getElementById("numi-account-telegram");
  const emailForm = document.getElementById("numi-email-form");
  const resetForm = document.getElementById("numi-reset-form");
  const passForm = document.getElementById("numi-new-password-form");
  const setEmailForm = document.getElementById("numi-set-email-form");
  const mergeForm = document.getElementById("numi-existing-email-form");
  setEmailForm?.addEventListener("submit",event=>{
    const fields=new FormData(setEmailForm);
    if(String(fields.get("password")||"")!==String(fields.get("password_confirm")||"")){
      event.preventDefault();
      event.stopImmediatePropagation();
      alertMessage("Пароли не совпадают. Проверьте повтор пароля.");
    }
  },true);
  const message = document.getElementById("numi-account-message");

  function alertMessage(content,success=false) {
    message.hidden=false;
    message.textContent=content;
    message.classList.toggle("is-success",success);
  }
  function clearMessage(){ message.hidden=true;message.textContent="";message.classList.remove("is-success"); }
  function setFormState(loading) {
    busy=loading;
    for (const control of root.querySelectorAll("button,input")) control.disabled=loading;
    const submit=resetForm.querySelector('button[type="submit"]');
    if (submit) {
      submit.textContent=loading && selected==="reset" ? "Отправляем запрос..." : "Отправить ссылку";
      submit.setAttribute("aria-busy",loading && selected==="reset" ? "true" : "false");
    }
  }
  function choose(mode) {
    selected=mode;
    clearMessage();
    const reset = mode==="reset";
    const password = mode==="password";
    emailForm.hidden=reset||password;
    resetForm.hidden=!reset;
    passForm.hidden=!password;
    document.querySelector(".numi-auth-tabs").hidden=reset||password;
    document.getElementById("numi-forgot").hidden=mode!=="login";
    document.getElementById("numi-back-login").hidden=!reset&&!password;
    document.querySelectorAll("[data-numi-tab]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.numiTab===mode));
    emailForm.querySelector('input[name="password"]').autocomplete=mode==="register"?"new-password":"current-password";
    const confirmation = document.getElementById("numi-confirm-label");
    confirmation.hidden=mode!=="register";
    confirmation.querySelector("input").required=mode==="register";
    emailForm.querySelector('button[type=submit]').textContent=mode==="register"?"Зарегистрироваться":"Войти в кабинет";
  }
  root.querySelectorAll("[data-numi-tab]").forEach(btn=>btn.addEventListener("click",()=>choose(btn.dataset.numiTab)));
  document.getElementById("numi-forgot").addEventListener("click",()=>choose("reset"));
  document.getElementById("numi-back-login").addEventListener("click",()=>choose("login"));

  async function refresh() {
    try {
      const session=await request("session");
      current=session.authenticated?session.account:null;
      render();
      window.dispatchEvent(new Event("numi:account-session-changed"));
      if (current) {await updatePurchases();await refreshWalletBadge();} else walletBadge.hidden=true;
      return current;
    } catch (err) {
      current=null;walletBadge.hidden=true;render();window.dispatchEvent(new Event("numi:account-session-changed"));return null;
    }
  }
  function render() {
    const tg=isTelegram();
    guest.hidden=!resetToken && (tg||!!current);
    signed.hidden=true;
    // Once the user is signed in by email, the identity card above is enough.
    // Do not repeat the email/Telegram onboarding box on every visit.
    root.style.display=(!resetToken && !tg && !!current)?"none":"";
    for(const exit of logoutControls) exit.hidden=!(tg||current);
    tgBox.hidden=!tg||!current;
    if (!tg) {
      if (current) {
        if (identityLabel) identityLabel.textContent="Вы вошли как";
        if (name) name.textContent=current.email||current.name;
        if (avatar) avatar.textContent=(current.email||current.name||"П")[0].toUpperCase();
        if (verifiedIcon) verifiedIcon.hidden=false;
        if (browserNote) browserNote.hidden=true;
        document.getElementById("numi-account-email-label").textContent="Почта подтверждена. Ваши покупки привязаны к аккаунту.";
        document.getElementById("account-birth").value=displayDate(current.birth_date);
      } else {
        if (browserNote) {
          browserNote.hidden=false;
          browserNote.textContent="Без входа ваши данные остаются только в этом браузере. После регистрации покупки будут сохраняться в аккаунте.";
        }
      }
    }
  }
  function displayDate(date){
    const d=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return d?d[3]+"."+d[2]+"."+d[1]:"";
  }
  async function perform(action,payload,success) {
    if (busy) return;
    setFormState(true);
    try {
      const result=await request(action,payload);
      clearMessage();
      if(result?.authenticated){
        current=result.account;
        render();await updatePurchases();
      }else if(success){
        alertMessage(success,true);
      }
      return true;
    } catch(err) {
      alertMessage(err.message||"Не удалось подключиться.");
      return false;
    } finally { setFormState(false); }
  }
  emailForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const fields=new FormData(emailForm);
    const email=String(fields.get("email")||"").trim();
    const password=String(fields.get("password")||"");
    if(!email||!password){alertMessage("Введите email и пароль.");return;}
    if(selected==="register" && password!==String(fields.get("password_confirm")||"")){alertMessage("Пароли не совпадают. Проверьте повтор пароля.");return;}
    await perform(selected==="register"?"register":"login",{email,password},selected==="register"?
      "Проверьте почту: мы отправили ссылку подтверждения.":null);
  });
  resetForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const email=String(new FormData(resetForm).get("email")||"").trim();
    if (!email || !resetForm.reportValidity()) return;
    clearMessage();
    await perform("request_reset",{email},"✓ Запрос принят. Если почта зарегистрирована и подтверждена, мы отправим письмо со ссылкой для смены пароля. Проверьте «Входящие» и «Спам». Если письма нет, проверьте адрес или попробуйте зарегистрироваться.");
  });
  passForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const password=String(new FormData(passForm).get("password")||"");
    if(!password){alertMessage("Введите новый пароль.");return;}
    if(password!==String(new FormData(passForm).get("password_confirm")||"")){alertMessage("Пароли не совпадают. Проверьте повтор пароля.");return;}
    await perform("reset_password",{token:resetToken,password},"Пароль изменён. Теперь войдите.");
    if(!message.hidden&&message.classList.contains("is-success")){
      passForm.hidden=true;choose("login");alertMessage("Пароль изменён. Теперь войдите.",true);
    }
  });
  document.getElementById("numi-resend").addEventListener("click",async ()=>{
    const email=String(new FormData(emailForm).get("email")||"");
    await perform("resend",{email},"Если адрес зарегистрирован, мы отправили письмо повторно.");
  });
  // Real email logout revokes the server session. In Telegram it also closes
  // the signed Mini App; the next launch can authenticate afresh with initData.
  let signingOut=false;
  const logoutAccount=async ()=>{
    if(signingOut||busy) return;
    signingOut=true;
    for(const control of logoutControls) control.disabled=true;
    try {
      await request("logout");
      current=null;
      emailForm.reset();
      choose("login");
      render();
      window.dispatchEvent(new Event("numi:account-logged-out"));
      window.dispatchEvent(new Event("numi:account-session-changed"));
      if(isTelegram() && typeof window.Telegram?.WebApp?.close==="function") {
        window.Telegram.WebApp.close();
      } else if(!isTelegram() && dialog.open) {
        dialog.close();
      }
    } catch(err) {
      if(isTelegram()) {
        const notice=document.getElementById("account-status");
        if(notice){notice.textContent="Не удалось выйти из аккаунта. Попробуйте ещё раз.";notice.hidden=false;}
      } else alertMessage(err.message);
    } finally {
      signingOut=false;
      for(const control of logoutControls) control.disabled=false;
    }
  };
  for(const control of logoutControls) control.addEventListener("click",logoutAccount);

  document.getElementById("numi-set-email-open").addEventListener("click",()=>{
    mergeForm.hidden=true;
    setEmailForm.hidden=!setEmailForm.hidden;
  });
  document.getElementById("numi-existing-email-open").addEventListener("click",()=>{
    setEmailForm.hidden=true;
    mergeForm.hidden=!mergeForm.hidden;
  });
  mergeForm.addEventListener("submit",async event=>{
    event.preventDefault();
    if(!isTelegram() || !mergeForm.reportValidity()) return;
    const form=new FormData(mergeForm);
    const merged=await perform("merge_telegram_email",{
      email:String(form.get("email")||"").trim(),
      password:String(form.get("password")||""),
      init_data:signedTelegram()
    },null);
    if(merged && current?.email_verified){
      document.getElementById("numi-telegram-link-prompt").hidden=true;
      document.getElementById("numi-telegram-email-linked").hidden=false;
      mergeForm.hidden=true;
      setEmailForm.hidden=true;
      await updatePurchases();
    }
  });
  setEmailForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=new FormData(setEmailForm);
    await perform("set_email",{
      email:String(form.get("email")||""),
      password:String(form.get("password")||"")
    },"На почту отправлена ссылка подтверждения. После подтверждения можно входить без Telegram.");
  });

  async function updatePurchases() {
    if(!savedPanel||!current) return;
    try {
      const result=await request("purchases");
      let container=document.getElementById("numi-confirmed-purchases");
      if(!container){
        container=document.createElement("div");
        container.id="numi-confirmed-purchases";
        savedPanel.querySelector(".account-panel-intro")?.insertAdjacentElement("afterend",container);
      }
      container.replaceChildren();
      for(const purchase of result.purchases||[]){
        const item=document.createElement("div"); item.className="numi-purchase-entry";
        const title=document.createElement("strong");title.textContent=purchase.product_code;
        const detail=document.createElement("small");detail.textContent="Код материала: "+purchase.resource_id;
        item.append(title,detail);
        if(!purchase.is_test&&purchase.entitlement_id){const read=document.createElement("button");read.type="button";read.textContent="Открыть";read.className="account-secondary";read.onclick=async()=>{try{const {openMaterial}=await import("/store-material.js?v=2");let box=item.querySelector(".numi-purchase-content");if(!box){box=document.createElement("div");box.className="numi-purchase-content";item.append(box);}await openMaterial(box,purchase.entitlement_id);}catch(_){read.textContent="Не удалось открыть. Повторить";}};item.append(read);}
        container.append(item);
      }
      savedPanel.querySelector(".account-empty-state")?.toggleAttribute("hidden",(result.purchases||[]).length>0);
    }catch(_){ /* Never claim payments without a verified server result */ }
  }
  // Browser birth dates persist in the account, Telegram birth dates still use the existing verified endpoint.
  document.getElementById("account-birth-save")?.addEventListener("click",async ()=>{
    if(isTelegram()||!current||!birthInput) return;
    const m=birthInput.value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(!m)return;
    const iso=m[3]+"-"+m[2]+"-"+m[1];
    try {
      const result=await request("birth",{birth_date:iso});
      current=result.account;
      if(birthNote)birthNote.textContent="✓ Дата сохранена в аккаунте. Она будет доступна с другого устройства.";
    }catch(err){if(birthNote)birthNote.textContent=err.message;}
  });
  // Capture first: the legacy browser-only date handler must not report success
  // before this authenticated email account has actually deleted it on REG.RU.
  document.getElementById("account-birth-delete")?.addEventListener("click",async event=>{
    if(isTelegram()||!current)return;
    event.stopImmediatePropagation();
    if(busy)return;
    const control=event.currentTarget;
    control.disabled=true;
    try {
      const result=await request("birth",{birth_date:null});
      current=result.account;
      if(birthInput)birthInput.value="";
      birthInput?.removeAttribute("aria-invalid");
      try{localStorage.removeItem("num-online-birth-v1:browser");}catch(_){}
      if(birthNote)birthNote.textContent="✓ Дата рождения удалена из личного кабинета.";
    }catch(err){
      if(birthNote)birthNote.textContent="Дата не удалена: "+err.message;
    }finally{
      control.disabled=false;
    }
  },true);

  ownerButton.addEventListener("click",()=>{
    if(isTelegram())return;
    // The legacy cabinet opens first. After that, restore the server-verified identity.
    queueMicrotask(()=>{ render();if(!initialized){initialized=true;void refresh();} });
  });
  render();
  if(isTelegram()){
    // Only the server-verified signed Telegram login may show account linking.
    request("telegram",{init_data:signedTelegram()}).then(result=>{
      current=result.account;
      if(browserNote)browserNote.hidden=true;
      const linked=Boolean(current.email_verified_at||current.email_verified);
      document.getElementById("numi-telegram-link-prompt").hidden=linked;
      document.getElementById("numi-telegram-email-linked").hidden=!linked;
      if(linked){setEmailForm.hidden=true;mergeForm.hidden=true;}
      render();
      window.dispatchEvent(new Event("numi:account-session-changed"));
      void updatePurchases();
      void refreshWalletBadge();
    }).catch(()=>{
      current=null;
      render();
    });
  }else{
    void refresh();
  }
  if(new URLSearchParams(location.search).get("account")==="1"){
    ownerButton.click();
  }else if(resetToken) {
    choose("password");
    ownerButton.click();
  }else if(accountVerified) {
    ownerButton.click();
  }else{
    choose("login");
  }
})();
