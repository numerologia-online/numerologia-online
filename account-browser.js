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
        INVALID_SAVED_ITEM:"Не удалось определить запись.",
        SAVED_ITEM_NOT_FOUND:"Запись уже недоступна.",
        TEST_NOT_ENABLED:"Тестовые покупки разрешены только владельцу.",
        INVALID_TEST_PRODUCT:"Неизвестный пробный разбор.",
        INVALID_TEST_DATE:"Проверьте дату рождения.",
        EMAIL_ALREADY_VERIFIED:"Почта уже привязана.",
        IDENTITY_ALREADY_LINKED:"Этот Telegram уже привязан к другому аккаунту.",
        TELEGRAM_EMAIL_CONFLICT:"Для безопасности эти аккаунты нельзя объединить автоматически. Покупки не изменены."
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
          '<label>Пароль<input name="password" type="password" autocomplete="current-password" maxlength="200" required placeholder="Введите пароль"></label>',
          '<label id="numi-confirm-label" hidden>Повторите пароль<input name="password_confirm" type="password" autocomplete="new-password" minlength="9" maxlength="200" placeholder="Повторите пароль"></label>',
          '<button type="submit" class="numi-auth-submit">Войти в кабинет</button>',
        '</form>',
        '<form id="numi-reset-form" hidden>',
          '<label>Email для восстановления<input name="email" type="email" inputmode="email" autocomplete="email" required></label>',
          '<button type="submit" class="numi-auth-submit">Отправить ссылку</button>',
        '</form>',
        '<form id="numi-new-password-form" hidden>',
          '<label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="9" maxlength="200" required></label>',
          '<label>Повторите новый пароль<input name="password_confirm" type="password" autocomplete="new-password" minlength="9" maxlength="200" required></label>',
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
          '<label>Придумайте пароль<input name="password" type="password" autocomplete="new-password" minlength="9" maxlength="200" required></label>',
          '<label>Повторите пароль<input name="password_confirm" type="password" autocomplete="new-password" minlength="9" maxlength="200" required></label>',
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
  const root = document.getElementById("numi-account-entry");
  const guest = document.getElementById("numi-account-guest");
  const signed = document.getElementById("numi-account-signed");
  const logoutButton=document.getElementById("numi-account-logout");
  const accountSettings=document.querySelector('#account-dialog [data-account-content="settings"]');
  if(accountSettings && logoutButton){
    const logoutRow=document.createElement("div");
    logoutRow.className="account-actions";
    logoutRow.style.marginTop="16px";
    logoutButton.textContent="Выйти из аккаунта";
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
    emailForm.querySelector('input[name="password"]').minLength=mode==="register"?9:0;
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
    signed.hidden=true;
    // Once the user is signed in by email, the identity card above is enough.
    // Do not repeat the email/Telegram onboarding box on every visit.
    root.style.display=(!tg && !!current)?"none":"";
    if(logoutButton) logoutButton.hidden=tg||!current;
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
    if(selected==="register" && password.length<9){alertMessage("Придумайте пароль не короче 9 символов.");return;}
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
    if(password.length<9){alertMessage("Новый пароль должен содержать не менее 9 символов.");return;}
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
    if(String(form.get("password")||"").length<9){alertMessage("Придумайте пароль не короче 9 символов.");return;}
    await perform("set_email",{
      email:String(form.get("email")||""),
      password:String(form.get("password")||"")
    },"На почту отправлена ссылка подтверждения. После подтверждения можно входить без Telegram.");
  });

  async function updatePurchases() {
    if(!savedPanel||!current) return;
    let container=document.getElementById("numi-confirmed-purchases");
    if(!container){
      container=document.createElement("div");
      container.id="numi-confirmed-purchases";
      container.setAttribute("aria-label","Ваши сохранённые разборы и ответы");
      savedPanel.querySelector(".account-panel-intro")?.insertAdjacentElement("afterend",container);
    }
    try {
      const result=await request("purchases");
      const purchases=Array.isArray(result.purchases)?result.purchases:[];
      container.replaceChildren();
      const testBox=document.getElementById("numi-test-checkout");
      if(testBox) testBox.hidden=result.test_enabled!==true;
      const testLink=document.getElementById("numi-open-test-from-prices");
      if(testLink) testLink.hidden=result.test_enabled!==true;
      for(const purchase of purchases){
        const item=document.createElement("div");
        item.className="numi-saved-row";
        const content=document.createElement("div");
        content.className="numi-saved-row-content";
        const title=document.createElement("strong");
        title.textContent=(purchase.is_test?"🧪 ТЕСТ · ":"")+(purchase.product_code||"Сохранённый разбор");
        const detail=document.createElement("small");
        const date=String(purchase.created_at||"").slice(0,10);
        detail.textContent=date && /^\\d{4}-\\d{2}-\\d{2}$/.test(date)
          ? "Сохранено "+date.slice(8,10)+"."+date.slice(5,7)+"."+date.slice(0,4)
          : "Ваш сохранённый материал";
        content.append(title,detail);
        if(purchase.is_test){
          const description=document.createElement("small");
          description.textContent="Дата: "+String(purchase.resource_id||"").split(":").pop()+" · Деньги не списаны";
          content.append(description);
          const details=document.createElement("details");
          details.className="numi-test-answer";
          const summary=document.createElement("summary");
          summary.textContent="Открыть пробный ответ";
          const answer=document.createElement("p");
          answer.textContent=purchase.test_answer||"Пробный ответ без оплаты";
          details.append(summary,answer);
          content.append(details);
        }
        const remove=document.createElement("button");
        remove.type="button";
        remove.className="numi-saved-remove";
        remove.setAttribute("aria-label","Удалить из сохранённого");
        remove.title="Удалить из сохранённого";
        remove.textContent="🗑";
        remove.addEventListener("click",async ()=>{
          if(remove.disabled) return;
          remove.disabled=true;
          try {
            await request("hide_saved",{entitlement_id:purchase.entitlement_id});
            item.remove();
            savedPanel.querySelector(".account-empty-state")?.toggleAttribute("hidden",container.children.length>0);
          } catch(err) {
            remove.disabled=false;
            alertMessage(err.message||"Не удалось удалить запись.");
          }
        });
        item.append(content,remove);
        container.append(item);
      }
      savedPanel.querySelector(".account-empty-state")?.toggleAttribute("hidden",purchases.length>0);
    }catch(_){ /* Never pretend a payment or a saved record has been verified. */ }
  }
  // Owner-only interface; backend checks verified email for EVERY write.
  document.getElementById("numi-test-checkout-form")?.addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget;
    const submit=form.querySelector("button[type=submit]");
    const note=document.getElementById("numi-test-checkout-message");
    const kind=form.querySelector("[name=kind]")?.value;
    const birth_date=form.querySelector("[name=birth_date]")?.value;
    if(!kind||!birth_date)return;
    if(submit)submit.disabled=true;
    try{
      const response=await request("test_purchase",{kind,birth_date});
      if(note)note.textContent=response.already_exists
        ?"Этот тестовый ответ уже сохранён. Повторной покупки не было."
        :"Тестовая покупка готова: 0 ₽, без списаний. Ответ появился ниже.";
      await updatePurchases();
    }catch(err){
      if(note)note.textContent=err.message||"Не удалось провести тест.";
    }finally{
      if(submit)submit.disabled=false;
    }
  });

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
      void updatePurchases();
    }).catch(()=>{
      current=null;
      render();
    });
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
