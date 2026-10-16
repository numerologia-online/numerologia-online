/**
 * Telegram webhook receiver for Numerologia Online.
 * All user data and calculations remain at REG.RU.
 * Secret values are read from Cloudflare runtime, never GitHub.
 * Does not register or change Telegram webhook by itself.
 */
const REG_HANDLER = 'https://xn--c1adkkdfjbp1a4l.online/api/telegram-reg-stage-15-10-2026.php';
const MAX_UPDATE_BYTES = 32768;
const PREFIX = 'numerologia-online:webhook:v1:';

const INTRO_QUESTION = '🌙 Что сейчас тревожит твоё сердце?';
const CHOICES = [
  [{ text: '❤️ Почему в любви всё так сложно?', data: 'topic_love' },
   { text: '💰 Когда закончатся денежные трудности?', data: 'topic_money' }],
  [{ text: '✨ Почему я не могу найти себя?', data: 'topic_self' },
   { text: '🔮 Какой ответ скрывают мои числа?', data: 'topic_answers' }],
];
const CHOICE_DATA = new Set(CHOICES.flat().map(choice => choice.data));
const CHOICE_TEXTS = new Set(CHOICES.flat().map(choice => choice.text));
function inlineQuestions() {
  return { inline_keyboard: CHOICES.map(row => row.map(choice => ({
    text: choice.text, callback_data: choice.data,
  }))) };
}
function updateBotNavigation(reply, update) {
  if (reply?.method !== 'sendMessage' || typeof reply.text !== 'string') return reply;
  const message = update?.message;
  if (message?.chat?.type !== 'private' || typeof message.text !== 'string'
      || Number(reply.chat_id) !== Number(message.chat.id)) return reply;
  const input = message.text.trim();
  const command = input.split(/\s+/u, 1)[0].toLowerCase().split('@')[0];

  if (input === '✨ Что ещё знают числа?' || command === '/catalog' || command === '/catalogue') {
    return { ...reply, text: INTRO_QUESTION, reply_markup: inlineQuestions() };
  }
  if (CHOICE_TEXTS.has(input)) {
    return { ...reply,
      text: 'Этот вопрос пока готовится. Скоро здесь появится подробный ответ. 🤍',
      reply_markup: inlineQuestions(),
    };
  }
  // Do not interfere with /start registration and the daily consent keyboard.
  if (command === '/start' && /Ваш личный кабинет готов/u.test(reply.text)) {
    return { ...reply, text: reply.text + '\n\n' + INTRO_QUESTION, reply_markup: inlineQuestions() };
  }
  return reply;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
async function regSecret(botToken) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PREFIX + botToken));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
async function backendHealth() {
  try {
    const response = await fetch(REG_HANDLER + '?health=1', {
      method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000),
    });
    // The old PHP diagnostic accidentally leaves its JSON ok:false.
    // Connectivity is determined by HTTP 200 instead.
    return response.status === 200 ? 'REACHABLE' : 'HTTP_' + response.status;
  } catch {
    return 'UNREACHABLE';
  }
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && (path === '/' || path === '/health')) {
      return json({
        ok: true,
        service: 'numerologia-online-telegram-worker',
        version: '2026-10-16',
        configured: true,
        reg_ru: await backendHealth(),
        webhook_changed: false,
        navigation: 'inline-questions-2x2',
      });
    }
    if (request.method !== 'POST' || path !== '/telegram') {
      return json({ ok: false, error: 'NOT_FOUND' }, 404);
    }
    const telegramHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!telegramHeader) return json({ ok: false, error: 'FORBIDDEN' }, 403);
    const body = await request.text();
    const bytes = new TextEncoder().encode(body).length;
    if (bytes < 2 || bytes > MAX_UPDATE_BYTES) {
      return json({ ok: false, error: 'INVALID_UPDATE_SIZE' }, 400);
    }
    let update;
    try {
      update = JSON.parse(body);
      if (!update || typeof update !== 'object' || Array.isArray(update)) {
        return json({ ok: false, error: 'INVALID_JSON' }, 400);
      }
    } catch {
      return json({ ok: false, error: 'INVALID_JSON' }, 400);
    }
    if (update.callback_query && typeof update.callback_query === 'object') {
      const callback = update.callback_query;
      const action = callback.data;
      if (!env.BOT_TOKEN || typeof env.BOT_TOKEN !== 'string'
          || telegramHeader !== await regSecret(env.BOT_TOKEN)) {
        return json({ ok: false, error: 'FORBIDDEN' }, 403);
      }
      if (!callback.id || !CHOICE_DATA.has(action)) {
        return json({ ok: true, ignored: true });
      }
      return json({
        method: 'answerCallbackQuery',
        callback_query_id: callback.id,
        text: 'Скоро здесь появится подробный ответ. 🤍',
        show_alert: false,
      });
    }

    try {
      const response = await fetch(REG_HANDLER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': telegramHeader,
        },
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(18000),
      });
      if (!response.ok) return json({ ok: false, error: 'BACKEND_UNAVAILABLE' }, 502);
      const reply = await response.json();
      // Telegram accepts Bot API method JSON in a webhook HTTP reply.
      if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
        return json({ ok: false, error: 'INVALID_BACKEND_REPLY' }, 502);
      }
      if (reply.method && reply.method !== 'sendMessage') {
        return json({ ok: false, error: 'UNSUPPORTED_BOT_METHOD' }, 502);
      }
      return json(updateBotNavigation(reply, update));
    } catch {
      // Never log secret headers, Telegram updates or users' personal data.
      return json({ ok: false, error: 'BACKEND_TIMEOUT' }, 502);
    }
  },
};
