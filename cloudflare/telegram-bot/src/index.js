/**
 * Telegram webhook receiver for Numerologia Online.
 * All user data and calculations remain at REG.RU.
 * Secret values are read from Cloudflare runtime, never GitHub.
 * Does not register or change Telegram webhook by itself.
 */
const REG_HANDLER = 'https://xn--c1adkkdfjbp1a4l.online/api/telegram-reg-stage-15-10-2026.php';
const MAX_UPDATE_BYTES = 32768;
const PREFIX = 'numerologia-online:webhook:v1:';

const SITE_URL = 'https://numerologia-online.github.io/numerologia-online/';
const CATALOG_LABEL = '✨ Что ещё знают числа?';

// Names copied verbatim from the live site's home-page product cards
// and its additional profile, school and reference navigation.
const SITE_BUTTON_ROWS = [
  [{ text: 'Полный разбор', route: 'pro/' }, { text: 'Разбор года', route: '#razbor-goda' }],
  [{ text: 'Мужчина или Ред Флаг', route: '' }],
  [{ text: 'Женщина или тарелочница', route: null }],
  [{ text: 'Код богатства', route: '#moy-kod-deneg' }],
  [{ text: 'Личный расчёт дня', route: '#lichnyj-den' }],
  [{ text: 'Расчёт для детей', route: null }, { text: 'Деньги', route: null }],
  [{ text: 'Совместимость', route: '' }],
  [{ text: 'Хорарная нумерология', route: null }],
  [{ text: 'Записаться на личный расчёт', route: null }],
  [{ text: 'Школы нумерологии', route: 'pro/schools/' }],
  [{ text: 'Справочник по нумерологии', route: 'guide/' }],
  [{ text: 'Личный кабинет', route: '' }],
];
const SITE_BUTTONS = new Map(SITE_BUTTON_ROWS.flat().map(button => [button.text, button.route]));
const LEGACY_QUESTION_CALLBACKS = new Set(['topic_love', 'topic_money', 'topic_self', 'topic_answers']);

function launchKeyboard() {
  return {
    keyboard: [[
      { text: '🌐 Открыть сайт', web_app: { url: SITE_URL } },
      { text: CATALOG_LABEL },
    ]],
    resize_keyboard: true,
    one_time_keyboard: true,
    is_persistent: false,
  };
}

function siteMenuKeyboard() {
  return {
    keyboard: SITE_BUTTON_ROWS.map(row => row.map(button =>
      button.route === null
        ? { text: button.text }
        : { text: button.text, web_app: { url: SITE_URL + button.route } }
    )),
    resize_keyboard: true,
    one_time_keyboard: true,
    is_persistent: false,
  };
}

function hasYesNoKeyboard(markup) {
  return Array.isArray(markup?.keyboard)
    && markup.keyboard.some(row => Array.isArray(row)
      && row.some(button => button?.text === '✅ Да, каждый день'));
}

function updateBotNavigation(reply, update) {
  if (reply?.method !== 'sendMessage' || typeof reply.text !== 'string') return reply;
  const message = update?.message;
  if (message?.chat?.type !== 'private' || typeof message.text !== 'string'
      || Number(reply.chat_id) !== Number(message.chat.id)) return reply;

  const input = message.text.trim();
  const command = input.split(/\s+/u, 1)[0].toLowerCase().split('@')[0];

  // The full site menu appears only when explicitly requested.
  if (input === CATALOG_LABEL || command === '/catalog' || command === '/catalogue'
      || command === '/menu') {
    return {
      ...reply,
      text: 'Выбери раздел сайта:',
      reply_markup: siteMenuKeyboard(),
    };
  }

  // Unpublished cards keep their exact site names but do not open irrelevant pages.
  if (SITE_BUTTONS.has(input) && SITE_BUTTONS.get(input) === null) {
    return {
      ...reply,
      text: 'Раздел «' + input + '» пока в разработке.',
      reply_markup: launchKeyboard(),
    };
  }

  // Respect the existing birthday/onboarding and daily-consent controls.
  if (hasYesNoKeyboard(reply.reply_markup)) return reply;

  // Replace the previous unwanted four-button keyboard on the user's next reply.
  // No unsolicited question, inline keyboard or catalogue is added to /start.
  return { ...reply, reply_markup: launchKeyboard() };
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
        navigation: 'on-demand-site-keyboard',
        site_sections: SITE_BUTTONS.size,
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
      if (!callback.id || !LEGACY_QUESTION_CALLBACKS.has(action)) {
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
