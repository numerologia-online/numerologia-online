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
      <p class="school-client-explainer">Ваши расчёты останутся прежними. На титульном листе будут ваши данные, а в документе - личное обращение.</p>
      <label>Имя клиента <span>*</span><input name="client" autocomplete="off" maxlength="90" required placeholder="Например, Анастасия"></label>
      <label>Имя и фамилия нумеролога <span>*</span><input name="specialist" autocomplete="name" maxlength="110" required placeholder="Например, Мария Иванова"></label>
      <label>Соцсети или контакт<input name="social" autocomplete="off" maxlength="140" placeholder="@maria_numerolog"></label>
      <label>Главный запрос клиента<input name="focus" maxlength="200" placeholder="Например, семья и отношения"></label>
      <label>Моё личное обращение к клиенту<textarea name="message" rows="4" maxlength="2200" placeholder="Анастасия, в вашем разборе я уделила особое внимание..."></textarea></label>
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
      client: clean(fields.get("client"), 90),
      specialist: clean(fields.get("specialist"), 110),
      social: clean(fields.get("social"), 140),
      focus: clean(fields.get("focus"), 200),
      message: clean(fields.get("message"), 2200)
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

    // Свой титульный лист вместо фирменного. Дальнейшие расшифровки берутся без изменений.
    documentDefinition.content[0] = {
      stack: [
        { text: "ПЕРСОНАЛЬНЫЙ НУМЕРОЛОГИЧЕСКИЙ РАЗБОР", color: "#9D7D49", bold: true, fontSize: 11, characterSpacing: 2, alignment: "center", margin: [0, 0, 0, 13] },
        { text: "Полный разбор", color: "#263C50", bold: true, fontSize: 38, alignment: "center", margin: [0, 0, 0, 12] },
        { text: d.client, color: "#A27D50", fontSize: 25, alignment: "center", margin: [0, 0, 0, 13] },
        { ...matrix, width: 355, height: 355, alignment: "center", margin: [0, 0, 0, 18] },
        { text: birthLine, fontSize: 18, bold: true, color: "#293F52", alignment: "center", margin: [0, 0, 0, 19] },
        { text: "Ваш персональный нумеролог", fontSize: 13, color: "#6B7780", alignment: "center", margin: [0, 0, 0, 5] },
        { text: d.specialist, fontSize: 20, bold: true, color: "#293F52", alignment: "center" },
        ...(d.social ? [{ text: d.social, fontSize: 13, color: "#9D7D49", alignment: "center", margin: [0, 6, 0, 0] }] : [])
      ],
      pageBreak: "after"
    };

    if (d.focus || d.message) {
      const personalPage = [
        { text: "ЛИЧНОЕ ОБРАЩЕНИЕ", bold: true, fontSize: 12, color: "#A0804D", characterSpacing: 1.7, margin: [0, 16, 0, 18] },
        { text: d.client, bold: true, fontSize: 32, color: "#263C50", margin: [0, 0, 0, 22] },
        ...(d.focus ? [{ text: "Главная тема консультации", bold: true, fontSize: 17, color: "#8F744F", margin: [0, 0, 0, 9] }, { text: d.focus, fontSize: 22, color: "#293F52", margin: [0, 0, 0, 29] }] : []),
        ...(d.message ? [{ text: d.message, fontSize: 20, color: "#354658", lineHeight: 1.45, margin: [0, 0, 0, 31] }] : []),
        { text: "Ваш персональный нумеролог", fontSize: 14, color: "#71808C", margin: [0, 8, 0, 5] },
        { text: d.specialist, bold: true, fontSize: 19, color: "#263C50" },
        ...(d.social ? [{ text: d.social, fontSize: 15, color: "#9D7D49", margin: [0, 8, 0, 0] }] : [])
      ];
      documentDefinition.content.splice(1, 0, { stack: personalPage, pageBreak: "after" });
    }

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
  };

  return { beforeDownload, customizeDocument };
}
