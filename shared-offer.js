/* Один общий шаблон предложения из полного разбора.
   HTML берём из pro/index.html только по запросу; стили тоже загружаются только
   при открытии. Никакой платёж или предоставление доступа этим кодом не выполняется. */
let dialogPromise;

function ensureStyles() {
  const source = new URL("./shared-offer.css?v=1", import.meta.url).href;
  if (document.querySelector('link[data-shared-offer-style]')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = source;
    link.dataset.sharedOfferStyle = "1";
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", () => {
      link.remove();
      reject(new Error("Не загрузились стили покупки"));
    }, { once: true });
    document.head.append(link);
  });
}

function findNode(dialog, selector) {
  const node = dialog.querySelector(selector);
  if (!node) throw new Error("Не найден элемент предложения " + selector);
  return node;
}

async function prepareDialog() {
  const response = await fetch(new URL("./pro/", import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw new Error("Шаблон покупки недоступен");
  const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
  const original = parsed.querySelector("#pro-paywall-dialog");
  if (!original) throw new Error("В полном разборе нет окна покупки");
  const dialog = document.importNode(original, true);
  dialog.id = "shared-paywall-dialog";
  document.body.append(dialog);
  try { await ensureStyles(); }
  catch (error) { dialog.remove(); throw error; }

  const note = findNode(dialog, "#pro-paywall-checkout-note");
  findNode(dialog, "#pro-paywall-one-time").addEventListener("click", () => {
    const cfg = dialog._offerConfig;
    note.textContent = "Вы выбрали " + cfg.product + " за " + cfg.oncePrice
      + " ₽ без подписки. Оплата пока не подключена.";
    note.hidden = false;
  });
  findNode(dialog, "#pro-paywall-club").addEventListener("click", () => {
    const cfg = dialog._offerConfig;
    const firstMonth = cfg.memberPrice + cfg.clubMonthly;
    note.textContent = cfg.subscriptionOnly ? "Клуб " + cfg.clubMonthly + " ₽/мес. Оплата пока не подключена." : "Вы выбрали " + cfg.product + " за " + cfg.memberPrice
      + " ₽ и клуб за " + cfg.clubMonthly + " ₽/мес. Первый месяц: "
      + firstMonth + " ₽; далее клуб " + cfg.clubMonthly
      + " ₽/мес. Оплата пока не подключена.";
    note.hidden = false;
  });
  return dialog;
}

export async function openSharedOffer({
  product = "полный разбор",
  title = "Откройте полный разбор",
  oncePrice = 990,
  memberPrice = 490,
  clubMonthly = 490,
  itemKind = "report",
  subscriptionOnly = false
} = {}) {
  if (!dialogPromise) dialogPromise = prepareDialog().catch(error => {
    dialogPromise = null;
    throw error;
  });
  const dialog = await dialogPromise;
  if (dialog.open) return;
  dialog._offerConfig = { product, title, oncePrice, memberPrice, clubMonthly, subscriptionOnly };
  const isQuestion = itemKind === "question";
  const item = isQuestion ? "ответ" : "разбор";
  const oncePlan = findNode(dialog, ".pro-paywall-plan-once");
  oncePlan.hidden = subscriptionOnly;
  oncePlan.style.display = subscriptionOnly ? "none" : "";
  findNode(dialog, ".pro-paywall-compare").style.gridTemplateColumns = subscriptionOnly ? "1fr" : "";
  findNode(dialog, "#pro-paywall-dialog-title").textContent = title;
  findNode(dialog, "#pro-paywall-once-title").textContent = (isQuestion ? "Один ответ" : "Разбор без подписки");
  findNode(dialog, "#pro-paywall-club-title").textContent = (subscriptionOnly ? "Доступ по подписке" : isQuestion ? "Ответ с подпиской" : "Разбор с подпиской");
  findNode(dialog, ".pro-paywall-plan-once .pro-paywall-plan-price").textContent = oncePrice + " ₽";
  findNode(dialog, ".pro-paywall-plan-club .pro-paywall-plan-price").textContent = (subscriptionOnly ? clubMonthly + " ₽ / мес." : memberPrice + " ₽");
  findNode(dialog, ".pro-paywall-plan-detail-club").textContent =
    subscriptionOnly ? "Все материалы раздела входят в клуб" : "−50% по подписке — " + memberPrice + " ₽ за " + item;
  findNode(dialog, ".pro-paywall-plan-once .pro-paywall-plan-detail").textContent = isQuestion ? "Разовая покупка выбранного ответа" : "Все ответы и PDF навсегда";
  findNode(dialog, ".pro-paywall-book-art-once span").textContent = isQuestion ? "ВАШ ОТВЕТ" : "ЛИЧНЫЙ РАЗБОР";
  findNode(dialog, ".pro-paywall-book-art-club span").textContent = isQuestion ? "ВАШ ОТВЕТ" : "ЛИЧНЫЙ РАЗБОР";
  findNode(dialog, ".pro-paywall-compare").setAttribute("aria-label", "Варианты покупки: " + product);
  findNode(dialog, ".pro-paywall-billing-summary").textContent =
    subscriptionOnly ? "Клуб " + clubMonthly + " ₽/мес. Материалы доступны во время подписки." : "В первый месяц: " + item + " " + memberPrice + " ₽ + клуб " + clubMonthly
    + " ₽ = " + (memberPrice + clubMonthly) + " ₽. Затем клуб " + clubMonthly + " ₽/мес.";
  const bigReportRow = [...dialog.querySelectorAll(".pro-paywall-matrix-table tbody tr")]
    .find(row => row.querySelector('th[scope="row"]')?.textContent?.includes("Большие разборы"));
  if (bigReportRow) {
    const amount = bigReportRow.querySelector("td strong");
    if (amount) amount.textContent = "990 ₽";
  }
  const redFlagRow = [...dialog.querySelectorAll(".pro-paywall-matrix-table tbody tr")]
    .find(row => row.querySelector('th[scope="row"]')?.textContent?.includes("Мужчина или Red Flag"));
  if (redFlagRow) {
    const amount = redFlagRow.querySelector("td strong");
    if (amount) amount.textContent = "20–79 ₽";
  }
  const note = findNode(dialog, "#pro-paywall-checkout-note");
  note.hidden = true;
  note.textContent = "";
  dialog.showModal();
  dialog.scrollTop = 0;
}
