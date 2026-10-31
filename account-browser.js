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

  async function request(action, payload={}) {
    const res = await fetch(API, {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({action,...payload})
    });
    let json;
    try { json = await res.json(); } catch (_) { throw new Error("Нет ответа от сервера."); }
    if (!res.ok || json?.ok !== true) {
      const message={
        INVALID_EMAIL_OR_PASSWORD:"Укажите правильный email и пароль не короче 10 символов.",
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
        IDENTITY_ALREADY_LINKED:"Этот Telegram уже привязан к другому аккаунту."
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
        '<div class="numi-auth-tabs" role="group" aria-label="Выберите действие">',
          '<button type="button" data-numi-tab="login" class="is-active">Войти</button>',
          '<button type="button" data-numi-tab="register">Регистрация</button>',
        '</div>',
        '<form id="numi-email-form" novalidate>',
          '<label>Email<input name="email" type="email" inputmode="email" autocomplete="username" maxlength="191" required placeholder="Ваша почта"></label>',
          '<label>Пароль<input name="password" type="password" autocomplete="current-password" minlength="10" maxlength="200" required placeholder="Не менее 10 символов"></label>',
          '<label id="numi-confirm-label" hidden>Повторите пароль<input name="password_confirm" type="password" autocomplete="new-password" minlength="10" maxlength="200" placeholder="Повторите пароль"></label>',
          '<button type="submit" class="numi-auth-submit">Войти в кабинет</button>',
        '</form>',
        '<form id="numi-reset-form" hidden>',
          '<label>Email для восстановления<input name="email" type="email" inputmode="email" autocomplete="email" required></label>',
          '<button type="submit" class="numi-auth-submit">Отправить ссылку</button>',
        '</form>',
        '<form id="numi-new-password-form" hidden>',
          '<label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label>',
          '<label>Повторите новый пароль<input name="password_confirm" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label>',
          '<button type="submit" class="numi-auth-submit">Сохранить новый пароль</button>',
        '</form>',
        '<button id="numi-forgot" type="button" class="numi-auth-link">Забыли пароль?</button>',
        '<button id="numi-back-login" type="button" class="numi-auth-link" hidden>Вернуться ко входу</button>',
        '<button id="numi-resend" type="button" class="numi-auth-link" hidden>Отправить письмо ещё раз</button>',
        '<p id="numi-account-message" class="numi-account-message" role="status" aria-live="polite" hidden></p>',
      '</div>',
      '<div id="numi-account-signed" hidden>',
        '<p id="numi-account-email-label" class="numi-signed-email"></p>',
        '<button type="button" id="numi-account-logout" class="numi-auth-link">Выйти из аккаунта</button>',
      '</div>',
      '<div id="numi-account-telegram" hidden>',
        '<p>Ваш Telegram-аккаунт подтверждён. Покупки будут сохраняться за вашим профилем.</p>',
        '<button type="button" id="numi-set-email-open" class="numi-auth-link">Добавить email для входа с другого устройства</button>',
        '<form id="numi-set-email-form" hidden>',
          '<label>Email<input name="email" type="email" inputmode="email" autocomplete="email" required></label>',
          '<label>Придумайте пароль<input name="password" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label>',
          '<label>Повторите пароль<input name="password_confirm" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label>',
          '<button type="submit" class="numi-auth-submit">Привязать почту</button>',
        '</form>',
      '</div>',
    '</section>'
  ].join("");
  const identity = overview.querySelector(".account-identity");
  if (!identity) return;
  identity.insertAdjacentHTML("afterend",html);
  const root = document.getElementById("numi-account-entry");
  const guest = document.getElementById("numi-account-guest");
  const signed = document.getElementById("numi-account-signed");
  const tgBox = document.getElementById("numi-account-telegram");
  const emailForm = document.getElementById("numi-email-form");
  const resetForm = document.getElementById("numi-reset-form");
  const passForm = document.getElementById("numi-new-password-form");
  const setEmailForm = document.getElementById("numi-set-email-form");
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
  function clearMessage(){ message.hidden=true;message.textContent=""; }
  function setFormState(loading) {
    busy=loading;
    for (const control of root.querySelectorAll("button,input")) control.disabled=loading;
    if (!loading) for(const control of root.querySelectorAll("button,input")) control.disabled=false;
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
      if (current) await updatePurchases();
      return current;
    } catch (err) {
      current=null;render();return null;
    }
  }
  function render() {
    const tg=isTelegram();
    guest.hidden=tg||!!current;
    signed.hidden=tg||!current;
    tgBox.hidden=!tg;
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
      if(result?.authenticated){
        current=result.account;
        render();await updatePurchases();
      }else if(success){
        alertMessage(success,true);
      }
    } catch(err) {
      alertMessage(err.message||"Не удалось подключиться.");
    } finally { setFormState(false); }
  }
  emailForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const fields=new FormData(emailForm);
    const email=String(fields.get("email")||"").trim();
    const password=String(fields.get("password")||"");
    if(!email||password.length<10){alertMessage("Введите email и пароль не короче 10 символов.");return;}
    if(selected==="register" && password!==String(fields.get("password_confirm")||"")){alertMessage("Пароли не совпадают. Проверьте повтор пароля.");return;}
    await perform(selected==="register"?"register":"login",{email,password},selected==="register"?
      "Проверьте почту: мы отправили ссылку подтверждения.":null);
  });
  resetForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const email=String(new FormData(resetForm).get("email")||"");
    await perform("request_reset",{email},"Если такой адрес зарегистрирован, на него отправлена ссылка для восстановления.");
  });
  passForm.addEventListener("submit",async event=>{
    event.preventDefault();
    const password=String(new FormData(passForm).get("password")||"");
    if(password.length<10){alertMessage("Пароль должен быть не короче 10 символов.");return;}
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
  document.getElementById("numi-account-logout").addEventListener("click",async ()=>{
    try {await request("logout");current=null;render();choose("login");}
    catch(err){alertMessage(err.message);}
  });

  document.getElementById("numi-set-email-open").addEventListener("click",()=>{
    setEmailForm.hidden=!setEmailForm.hidden;
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
        item.append(title,detail);container.append(item);
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
  document.getElementById("account-birth-delete")?.addEventListener("click",async ()=>{
    if(isTelegram()||!current)return;
    try {
      const result=await request("birth",{birth_date:null});
      current=result.account;
      if(birthNote)birthNote.textContent="Дата удалена из аккаунта.";
    }catch(err){if(birthNote)birthNote.textContent=err.message;}
  });

  ownerButton.addEventListener("click",()=>{
    if(isTelegram())return;
    // The legacy cabinet opens first. After that, restore the server-verified identity.
    queueMicrotask(()=>{ render();if(!initialized){initialized=true;void refresh();} });
  });
  if(isTelegram()){
    // Signed Mini App launch is the only trust root for Telegram account linking.
    request("telegram",{init_data:signedTelegram()}).then(result=>{
      current=result.account;
      if(browserNote)browserNote.hidden=true;
      if(current.email_verified_at||current.email_verified)
        document.getElementById("numi-set-email-open").hidden=true;
    }).catch(()=>{tgBox.hidden=true;});
  }else{
    void refresh();
  }
  if(resetToken) {
    choose("password");
    ownerButton.click();
  }else if(accountVerified) {
    ownerButton.click();
  }else{
    choose("login");
  }
})();
