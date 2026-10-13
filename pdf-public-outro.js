// Shared closing page for public PDF documents. Never include in school client PDFs.
export const PUBLIC_PDF_LINKS = Object.freeze({
  site: "https://numerologia-online.github.io/numerologia-online/",
  bot: "https://t.me/Numerologiaonline_bot",
  channel: "https://t.me/numerologia_online",
  instagram: "https://www.instagram.com/zapiski__woman/",
  consultation: "https://t.me/Kod_9966"
});

const ink = "#24394E";
const muted = "#516577";
const gold = "#A5824D";
const blue = "#275A6C";

const linked = (text, url, size = 11.5) => ({
  text, link: url, font: "Roboto", bold: true, fontSize: size,
  color: blue, decoration: "underline"
});

const featured = (title, description, action, url) => ({
  table: {
    widths: ["*"],
    body: [[{
      fillColor: "#F7F2E9",
      margin: [12, 9, 12, 9],
      stack: [
        { text: title, fontSize: 13.5, bold: true, color: ink, margin: [0, 0, 0, 3] },
        { text: description, fontSize: 11.2, lineHeight: 1.23, color: muted, margin: [0, 0, 0, 5] },
        linked(action, url, 12)
      ]
    }]]
  },
  layout: "noBorders",
  margin: [0, 0, 0, 7]
});

const contact = (title, description, action, url) => ({
  stack: [
    { text: title, fontSize: 12.5, bold: true, color: ink, margin: [0, 0, 0, 2] },
    { text: description, fontSize: 11, lineHeight: 1.23, color: muted, margin: [0, 0, 0, 3] },
    linked(action, url, 11.2)
  ],
  margin: [0, 0, 0, 10]
});

export function createPublicPdfOutro() {
  return {
    pageBreak: "before",
    unbreakable: true,
    stack: [
      { text: "НУМЕРОЛОГИЯ ОНЛАЙН", fontSize: 10, bold: true,
        color: gold, characterSpacing: 1.6, alignment: "center", margin: [0, 0, 0, 10] },
      { text: "Ваш разбор закончился.\nА ваша история продолжается.",
        fontSize: 24, bold: true, color: ink, lineHeight: 1.13,
        alignment: "center", margin: [0, 0, 0, 15] },
      { text: "Вы узнали немного больше о себе, своих возможностях, сильных сторонах и жизненных уроках.",
        fontSize: 11.5, color: muted, lineHeight: 1.3, margin: [0, 0, 0, 7] },
      { text: "Но самое интересное начинается тогда, когда знания превращаются в действия. Возвращайтесь к этому разбору, когда ищете ответы, стоите перед важным выбором или хотите лучше понять происходящее.",
        fontSize: 11.5, color: muted, lineHeight: 1.3, margin: [0, 0, 0, 8] },
      { text: "А если хочется заглянуть ещё глубже - я рядом.",
        fontSize: 12, bold: true, color: ink, margin: [0, 0, 0, 13] },
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 340, y2: 0,
        lineWidth: 0.7, lineColor: "#CBB793" }], margin: [0, 0, 0, 12] },
      { text: "Давайте останемся на связи",
        fontSize: 17, bold: true, color: ink, margin: [0, 0, 0, 10] },
      featured("Нумерология Онлайн",
        "Расчёты, прогнозы и новые способы узнать себя лучше.",
        "Открыть наш сайт", PUBLIC_PDF_LINKS.site),
      featured("Наш Telegram-бот",
        "Нумерология под рукой, прямо в вашем мессенджере.",
        "Открыть @Numerologiaonline_bot", PUBLIC_PDF_LINKS.bot),
      contact("Telegram-канал «Нумерология Secret»",
        "Прогнозы, подсказки и интересные наблюдения о числах.",
        "Подписаться: @numerologia_online", PUBLIC_PDF_LINKS.channel),
      contact("Мой Instagram",
        "Разборы, открытия и нумерология простым языком.",
        "Открыть @zapiski__woman", PUBLIC_PDF_LINKS.instagram),
      contact("Личный разбор со мной",
        "Отношения, деньги, предназначение и важные жизненные периоды.",
        "Записаться: @Kod_9966", PUBLIC_PDF_LINKS.consultation),
      { text: "С любовью к цифрам и людям, которые за ними стоят.",
        fontSize: 11.5, italics: true, color: gold, alignment: "center",
        margin: [0, 7, 0, 0] }
    ]
  };
}

export function appendPublicPdfOutro(definition) {
  if (!definition || !Array.isArray(definition.content)) {
    throw new Error("Невозможно добавить финальную страницу PDF: нет содержания");
  }
  definition.content.push(createPublicPdfOutro());
  return definition;
}
