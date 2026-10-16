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

/**
 * Independent evening subscriptions. These are opt-in and never modify REG.RU.
 * Stored in a SQLite-backed Cloudflare Durable Object, not an in-memory list.
 */
const EVENING_TIME_MSK = '20:00';
const EVENING_TOPICS = CHOICES;
const EVENING_OPENERS = [
  '🌙 Ну что, как прошёл твой день?\n\nЕсли что-то осталось на душе, давай попробуем разобраться.',
  '🌙 Что сегодня не даёт тебе покоя?\n\nИногда достаточно взглянуть на вопрос с другой стороны.',
  '🌙 Хочется немного ясности?\n\nВыбери то, о чём думаешь в последнее время.',
  '🌙 Как ты сегодня?\n\nЕсли есть вопрос, который не отпускает, можешь начать с него.',
];
const EVENING_BATCH_SIZE = 12;
const EVENING_MAX_BATCHES = 250;

export class EveningSubscriberStore {
  constructor(ctx) {
    this.sql = ctx.storage.sql;
    this.sql.exec(
      'CREATE TABLE IF NOT EXISTS evening_subscribers (' +
      'chat_id TEXT PRIMARY KEY, consented_at INTEGER NOT NULL, attempted_date TEXT NOT NULL DEFAULT \'\')'
    );
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method !== 'POST') return json({ ok: false }, 405);
    let input;
    try { input = await request.json(); } catch { return json({ ok: false }, 400); }
    if (!input || typeof input !== 'object') return json({ ok: false }, 400);

    if (path === '/subscribe' || path === '/unsubscribe') {
      const chat = String(input.chat_id ?? '');
      if (!/^[1-9][0-9]{0,19}$/.test(chat)) return json({ ok: false }, 400);
      if (path === '/subscribe') {
        this.sql.exec(
          'INSERT INTO evening_subscribers(chat_id,consented_at) VALUES(?,?) ' +
          'ON CONFLICT(chat_id) DO UPDATE SET consented_at=excluded.consented_at',
          chat, Date.now()
        );
      } else {
        this.sql.exec('DELETE FROM evening_subscribers WHERE chat_id=?', chat);
      }
      return json({ ok: true });
    }

    if (path === '/claim') {
      const date = input.date;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ ok: false }, 400);
      const limit = EVENING_BATCH_SIZE;
      const rows = [...this.sql.exec(
        'SELECT chat_id FROM evening_subscribers WHERE attempted_date <> ? ORDER BY chat_id LIMIT ?',
        date, limit
      )];
      for (const row of rows) {
        this.sql.exec('UPDATE evening_subscribers SET attempted_date=? WHERE chat_id=?', date, row.chat_id);
      }
      return json({ ok: true, chats: rows.map(row => row.chat_id) });
    }
    return json({ ok: false }, 404);
  }
}

function eveningStore(env) {
  if (!env.EVENING_STORE) throw new Error('EVENING_STORAGE_NOT_CONFIGURED');
  return env.EVENING_STORE.get(env.EVENING_STORE.idFromName('evening-opt-ins-v1'));
}

async function eveningStorageAction(env, action, payload) {
  const response = await eveningStore(env).fetch('https://evening.internal/' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('EVENING_STORAGE_UNAVAILABLE');
  const result = await response.json();
  if (!result?.ok) throw new Error('EVENING_STORAGE_UNAVAILABLE');
  return result;
}

async function sendEveningMessage(env, chatId, text) {
  const response = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: inlineQuestions(),
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(12000),
  });
  // A blocked bot must not keep trying to message this user.
  if (response.status === 403) {
    await eveningStorageAction(env, 'unsubscribe', { chat_id: chatId });
    return false;
  }
  return response.ok;
}

async function runEvening(env, scheduledTime) {
  if (!env.BOT_TOKEN || !env.EVENING_STORE) {
    console.error('EVENING_CONFIGURATION_UNAVAILABLE');
    return;
  }
  // The cron fires at 17:00 UTC, which is 20:00 in Moscow throughout the year.
  const date = new Date(scheduledTime).toISOString().slice(0, 10);
  const text = EVENING_OPENERS[Math.floor(new Date(date).getTime() / 86400000) % EVENING_OPENERS.length];
  let successful = 0;
  let attempted = 0;
  for (let batch = 0; batch < EVENING_MAX_BATCHES; batch++) {
    const result = await eveningStorageAction(env, 'claim', { date });
    if (!Array.isArray(result.chats) || result.chats.length === 0) break;
    attempted += result.chats.length;
    const statuses = await Promise.all(result.chats.map(chat =>
      sendEveningMessage(env, chat, text).catch(() => false)
    ));
    successful += statuses.filter(Boolean).length;
    // Telegram broadcast: do not exceed its ordinary sending rate limit.
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log('EVENING_DELIVERY', JSON.stringify({ date, attempted, successful }));
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
        evening_ready: Boolean(env.BOT_TOKEN && env.EVENING_STORE),
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
    const privateText = update.message?.chat?.type === 'private'
      && update.message?.chat?.id === update.message?.from?.id
      && typeof update.message?.text === 'string' ? update.message.text.trim() : null;
    if (privateText === '/evening' || privateText === '/evening_stop') {
      // The Cloudflare worker acts only on authentic Telegram updates.
      if (!env.BOT_TOKEN || typeof env.BOT_TOKEN !== 'string'
          || telegramHeader !== await regSecret(env.BOT_TOKEN)) {
        return json({ ok: false, error: 'FORBIDDEN' }, 403);
      }
      try {
        const subscribe = privateText === '/evening';
        await eveningStorageAction(env, subscribe ? 'subscribe' : 'unsubscribe', {
          chat_id: update.message.chat.id,
        });
        return json({
          method: 'sendMessage',
          chat_id: update.message.chat.id,
          text: subscribe
            ? '🌙 Вечерние сообщения включены! Каждый вечер примерно в ' + EVENING_TIME_MSK + ' по Москве я буду спрашивать, как прошёл день, и предлагать четыре вопроса.\n\nОтключить: /evening_stop'
            : '🌙 Вечерние сообщения отключены. Личный утренний прогноз остаётся без изменений.\n\nВключить снова: /evening',
          reply_markup: { remove_keyboard: true },
        });
      } catch {
        return json({ ok: false, error: 'EVENING_UNAVAILABLE' }, 503);
      }
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
  async scheduled(controller, env) {
    if (controller.cron !== '0 17 * * *') return;
    await runEvening(env, controller.scheduledTime);
  },
};
