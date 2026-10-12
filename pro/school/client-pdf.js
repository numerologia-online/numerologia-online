// Клиентский PDF только для режима школы. Базовая матрица и банк текстов остаются общими.
const clean = (value, limit = 900) => String(value || "").trim().slice(0, limit);

const clientPaper = `<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <rect width="595" height="842" fill="#FFFEFB"/>
  <rect x="19" y="19" width="557" height="804" rx="9" fill="none" stroke="#B99A62" stroke-width=".85"/>
  <rect x="26" y="26" width="543" height="790" rx="7" fill="none" stroke="#E5DCC9" stroke-width=".4"/>
  <g fill="none" stroke="#B99A62" stroke-width=".6" opacity=".24">
    <circle cx="71" cy="118" r="39"/><circle cx="71" cy="118" r="26" stroke-dasharray="2 6"/>
    <path d="M71 68 V79 M71 158 V169 M21 118 H32 M110 118 H121"/>
    <circle cx="522" cy="707" r="40"/><path d="M522 669 L560 707 L522 745 L484 707Z"/>
  </g>
  <g fill="#B99A62" opacity=".36">
    <circle cx="297.5" cy="35" r="1.7"/><circle cx="297.5" cy="807" r="1.7"/>
    <circle cx="41" cy="41" r="1.6"/><circle cx="554" cy="41" r="1.6"/>
    <circle cx="41" cy="801" r="1.6"/><circle cx="554" cy="801" r="1.6"/>
  </g>
</svg>`;

export function createSchoolClientPdf() {
  const dialog = document.createElement("dialog");
  dialog.className = "school-client-dialog";
  dialog.setAttribute("aria-labelledby", "school-client-form-title");
  dialog.innerHTML = `
    <form method="dialog" class="school-client-form" id="school-client-personalization">
      <div class="school-client-form-head">
        <p>ПЕРСОНАЛЬНЫЙ ДОКУМЕНТ</p>
        <button type="button" class="school-client-close" aria-label="Закрыть анкету">×</button>
      </div>
      <h2 id="school-client-form-title">Оформить PDF для клиента</h2>
      <p class="school-client-explainer">На первой странице PDF будут имя клиента, ваша подпись и выбранные контакты. Дополнительных страниц с обращением не будет.</p>
      <label>Имя клиента <span>*</span>
        <input name="client" autocomplete="off" maxlength="65" required placeholder="Например, Татьяны">
        <small class="school-client-hint">Напишите так, как должно быть после слова «для»: для Татьяны, для Александра.</small>
      </label>
      <label>Имя и фамилия нумеролога <span>*</span><input name="specialist" autocomplete="name" maxlength="95" required placeholder="Например, Ирина Крафт"></label>
      <label>Instagram<input name="instagram" autocomplete="off" maxlength="95" placeholder="@moy_numerolog"></label>
      <label>Telegram<input name="telegram" autocomplete="off" maxlength="95" placeholder="@moy_telegram"></label>
      <label>Другой контакт / соцсеть<input name="other" autocomplete="off" maxlength="110" placeholder="ВКонтакте, сайт или другой контакт"></label>
      <p class="school-client-privacy">Данные используются только для формирования PDF в вашем браузере.</p>
      <div class="school-client-actions">
        <button type="button" class="school-client-cancel">Отмена</button>
        <button type="submit" class="school-client-confirm">Создать PDF ↓</button>
      </div>
    </form>
  `;
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  let pending = null;
  let details = null;
  const close = () => dialog.close("cancel");
  dialog.querySelector(".school-client-close").addEventListener("click", close);
  dialog.querySelector(".school-client-cancel").addEventListener("click", close);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const fields = new FormData(form);
    details = {
      client: clean(fields.get("client"), 65),
      specialist: clean(fields.get("specialist"), 95),
      instagram: clean(fields.get("instagram"), 95),
      telegram: clean(fields.get("telegram"), 95),
      other: clean(fields.get("other"), 110)
    };
    dialog.close("ready");
  });
  dialog.addEventListener("close", () => {
    const resolve = pending;
    pending = null;
    if (resolve) resolve(dialog.returnValue === "ready" && details ? true : false);
  });

  const beforeDownload = () => new Promise((resolve) => {
    if (pending) return resolve(false);
    pending = resolve;
    dialog.showModal();
    form.elements.client.focus();
  });

  const customizeDocument = (documentDefinition) => {
    if (!details) throw new Error("Для клиентского PDF сначала заполните анкету");
    const d = details;
    const first = documentDefinition.content[0];
    const matrix = first?.stack?.find((item) => item.svg && item.height === 430);
    if (!matrix) throw new Error("Матрица для титульного листа не найдена");
    const birthLine = first.stack.find((item) => typeof item.text === "string" && item.text.startsWith("Дата рождения"))?.text || "";

    // Всё персональное оформление умещается на ОДНОЙ обложке.
    // Все последующие разделы остаются без изменения.
    const contacts = [
      d.instagram ? `Instagram: ${d.instagram}` : "",
      d.telegram ? `Telegram: ${d.telegram}` : "",
      d.other ? `Контакт: ${d.other}` : ""
    ].filter(Boolean);
    const contactSize = contacts.some((item) => item.length > 45) ? 11 : 12.5;
    documentDefinition.content[0] = {
      stack: [
        { text: "ПЕРСОНАЛЬНЫЙ НУМЕРОЛОГИЧЕСКИЙ РАЗБОР", color: "#9D7D49", bold: true, fontSize: 11, characterSpacing: 2, alignment: "center", margin: [0, 0, 0, 12] },
        { text: "Полный разбор", color: "#263C50", bold: true, fontSize: 38, alignment: "center", margin: [0, 0, 0, 10] },
        { text: `для ${d.client}`, color: "#A27D50", fontSize: 25, alignment: "center", margin: [0, 0, 0, 12] },
        { ...matrix, width: 344, height: 344, alignment: "center", margin: [0, 0, 0, 14] },
        { text: birthLine, fontSize: 18, bold: true, color: "#293F52", alignment: "center", margin: [0, 0, 0, 17] },
        { text: "Ваш персональный нумеролог", fontSize: 13, color: "#6B7780", alignment: "center", margin: [0, 0, 0, 5] },
        { text: d.specialist, fontSize: 20, bold: true, color: "#293F52", alignment: "center", margin: [0, 0, 0, contacts.length ? 6 : 0] },
        ...contacts.map((contact) => ({
          text: contact,
          fontSize: contactSize,
          color: "#9D7D49",
          alignment: "center",
          margin: [0, 2, 0, 0]
        }))
      ],
      pageBreak: "after"
    };

    // Удаляем фирменные пометки и фоновый код из школьной, белой версии документа.
    for (const section of documentDefinition.content) {
      if (section && typeof section.text === "string") {
        section.text = section.text.replace(/НУМЕРОЛОГИЯ ОНЛАЙН\s*[·-]?\s*/gi, "");
      }
    }
    documentDefinition.background = () => ({ svg: clientPaper });
    documentDefinition.footer = (page, pages) => ({
      text: `${d.specialist}  ·  ${page} / ${pages}`,
      alignment: "center", color: "#9E8B72", fontSize: 9, margin: [0, 8, 0, 0]
    });
    documentDefinition.info = {
      title: `Полный разбор для ${d.client}`,
      author: d.specialist,
      subject: "Персональный нумерологический разбор"
    };
    const safeName = d.client.replace(/[^\p{L}\p{N} -]/gu, "").trim() || "клиента";
    const date = birthLine.split("·").pop().trim();
    return { filename: `Полный разбор - ${safeName} - ${date}.pdf` };
  };

  return { beforeDownload, customizeDocument };
}
