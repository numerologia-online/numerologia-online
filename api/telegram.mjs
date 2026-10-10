// Тестовый Telegram webhook. Не изменяет существующие страницы и не содержит секретов.
const TELEGRAM_API = 'https://api.telegram.org';
const DEFAULT_SITE = 'https://numerologia-online.github.io/numerologia-online/';

function siteUrl() {
  const raw = process.env.TELEGRAM_SITE_URL || DEFAULT_SITE;
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('TELEGRAM_SITE_URL должен начинаться с https://');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function makeKeyboard(baseUrl = siteUrl()) {
  const root = new URL(baseUrl);
  const code = new URL(root.href);
  code.hash = 'moy-kod-deneg';
  const day = new URL(root.href);
  day.hash = 'lichnyj-den';
  return {
    inline_keyboard: [
      [{ text: '💰 Код денег', url: code.href }],
      [{ text: '☀️ Разбор дня', url: day.href }],
      [{ text: '✨ Полный расчёт', url: root.href }],
    ],
  };
}

export function getBotReply(message) {
  const text = String(message?.text || '').trim().split(/\s+/)[0].split('@')[0].toLowerCase();
  if (text === '/start') {
    return {text:'Привет! ✨ Это Нумерология.online. Выбери раздел:', reply_markup:makeKeyboard()};
  }
  if (text === '/test') {
    return {text:'✅ Бот отвечает! Кнопки тоже готовы к проверке.', reply_markup:makeKeyboard()};
  }
  if (text === '/help') {
    return {text:'Выбери нужный раздел по кнопке ниже.', reply_markup:makeKeyboard()};
  }
  return null;
}

export async function GET() {
  return Response.json({ok: true, botConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN), webhookProtected: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)});
}

export async function POST(request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) return Response.json({ok:false, error:'Not configured'}, {status:503});
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return Response.json({ok:false}, {status:403});
  }
  let update;
  try {update = await request.json();}
  catch {return Response.json({ok:false, error:'Invalid JSON'}, {status:400});}

  const message = update?.message;
  if (!message?.chat?.id || message.chat.type !== 'private') return Response.json({ok:true, ignored:true});
  let reply;
  try {reply = getBotReply(message);}
  catch (error) {console.error('Telegram reply error:', error);return Response.json({ok:false}, {status:500});}
  if (!reply) return Response.json({ok:true, ignored:true});

  try {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({chat_id:message.chat.id, ...reply}),
      signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error('Telegram API request failed:', response.status);
      return Response.json({ok:false, error:'Telegram API unavailable'}, {status:502});
    }
    return Response.json({ok:true});
  } catch (error) {
    console.error('Telegram API network error:', error);
    return Response.json({ok:false, error:'Telegram API unreachable'}, {status:502});
  }
}
