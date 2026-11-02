/* Один общий шаблон предложения из полного разбора.
   HTML берём из pro/index.html только по запросу; стили тоже загружаются только
   при открытии. Никакой платёж или предоставление доступа этим кодом не выполняется. */
let dialogPromise;

function ensureStyles() {
  const source = "shared-offer.css?v=1";
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
  const response = await fetch("./pro/", { cache: "force-cache" });
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
    note.textContent = "Вы выбрали " + cfg.product + " за " + cfg.memberPrice
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
  clubMonthly = 490
} = {}) {
  if (!dialogPromise) dialogPromise = prepareDialog().catch(error => {
    dialogPromise = null;
    throw error;
  });
  const dialog = await dialogPromise;
  if (dialog.open) return;
  dialog._offerConfig = { product, title, oncePrice, memberPrice, clubMonthly };
  findNode(dialog, "#pro-paywall-dialog-title").textContent = title;
  findNode(dialog, "#pro-paywall-once-title").textContent = "Разбор без подписки";
  findNode(dialog, "#pro-paywall-club-title").textContent = "Разбор с клубом";
  findNode(dialog, ".pro-paywall-plan-once .pro-paywall-plan-price").textContent = oncePrice + " ₽";
  findNode(dialog, ".pro-paywall-plan-club .pro-paywall-plan-price").textContent = memberPrice + " ₽";
  findNode(dialog, ".pro-paywall-plan-detail-club").textContent =
    "Скидка " + (oncePrice - memberPrice) + " ₽ на разбор для участников клуба";
  findNode(dialog, ".pro-paywall-plan-once .pro-paywall-plan-detail").textContent = "Все ответы и PDF навсегда";
  findNode(dialog, ".pro-paywall-book-art-once span").textContent = "ЛИЧНЫЙ РАЗБОР";
  findNode(dialog, ".pro-paywall-book-art-club span").textContent = "ЛИЧНЫЙ РАЗБОР";
  findNode(dialog, ".pro-paywall-compare").setAttribute("aria-label", "Варианты покупки: " + product);
  findNode(dialog, ".pro-paywall-billing-summary").textContent =
    "В первый месяц: разбор " + memberPrice + " ₽ + клуб " + clubMonthly
    + " ₽ = " + (memberPrice + clubMonthly) + " ₽. Затем клуб " + clubMonthly + " ₽/мес.";
  const bigReportRow = [...dialog.querySelectorAll(".pro-paywall-matrix-table tbody tr")]
    .find(row => row.querySelector('th[scope="row"]')?.textContent?.includes("Большие разборы"));
  if (bigReportRow) {
    const amount = bigReportRow.querySelector("td strong");
    if (amount) amount.textContent = oncePrice + " ₽";
  }
  const note = findNode(dialog, "#pro-paywall-checkout-note");
  note.hidden = true;
  note.textContent = "";
  dialog.showModal();
  dialog.scrollTop = 0;
}
