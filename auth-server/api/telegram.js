"use strict";
/* /start greeting for @Numerologiaonline_bot.
 * This endpoint must only receive Telegram webhooks. It never prints bot tokens.
 * BotFather's existing 'Код денег' menu button is not changed.
 */
const crypto = require("node:crypto");
const SITE_URL = "https://numerologia-online.github.io/numerologia-online/";
const TG_API = "https://api.telegram.org";

function keyboard() {
  return {
    inline_keyboard: [
      [{ text: "✨ Открыть Нумерология Онлайн", web_app: { url: SITE_URL } }]
    ]
  };
}

function replyFor(text) {
  const command = String(text || "").trim().split(/\s+/)[0].split("@")[0].toLowerCase();
  if (command === "/start") {
    return {
      text: [
        "✨ Добро пожаловать в Нумерология Онлайн!",
        "",
        "Здесь вы сможете лучше понять себя, отношения и свои возможности - через персональные нумерологические расчёты.",
        "",
        "Нажмите кнопку ниже. Сайт откроется прямо в Telegram и узнает вас автоматически. Никаких паролей и отдельной регистрации. 💛"
      ].join("\n"),
      reply_markup: keyboard()
    };
  }
  if (command === "/help" || command === "/menu") {
    return {
      text: "Все расчёты и ваш личный кабинет доступны по кнопке ниже. ✨",
      reply_markup: keyboard()
    };
  }
  return null;
}
function secretMatches(input, expected) {
  if (!input || !expected) return false;
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
module.exports = async function handle(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // A strong webhook header secret derived from the private bot token.
  // Only one variable, TELEGRAM_BOT_TOKEN, is required to set up this bot.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || (token && crypto.createHash("sha256").update("numerologia-online:webhook:v1:").update(token).digest("hex"));
  if (req.method === "GET") {
    // Bot token values and user data are never returned.
    return res.status(200).json({ ok: true, handler: "telegram-start", configured: Boolean(token && secret) });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD" });
  if (!token || !secret) return res.status(503).json({ ok: false, error: "NOT_CONFIGURED" });
  if (!secretMatches(req.headers["x-telegram-bot-api-secret-token"], secret)) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }
  const update = typeof req.body === "string" ? (()=>{try{return JSON.parse(req.body)}catch{return null}})() : req.body;
  const message = update?.message;
  if (!message?.chat?.id || message.chat.type !== "private") {
    return res.status(200).json({ ok: true, ignored: true });
  }
  const reply = replyFor(message.text);
  if (!reply) return res.status(200).json({ ok: true, ignored: true });
  try {
    const answer = await fetch(TG_API + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: message.chat.id, ...reply }),
      signal: AbortSignal.timeout(8000)
    });
    if (!answer.ok) {
      console.error("Telegram sendMessage returned", answer.status);
      return res.status(502).json({ ok: false, error: "SEND_FAILED" });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Telegram message delivery failed", error?.message || "unknown");
    return res.status(502).json({ ok: false, error: "SEND_FAILED" });
  }
};
