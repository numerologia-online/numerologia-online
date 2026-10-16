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

// Exact names from the site's home screen, in the owner's approved order.
// Keep each button on its own row so Telegram does not truncate the labels.
// For sections under construction, a small callback notice avoids dead links.
const SECTION_BUTTONS = [
  { text: 'Полный разбор', route: 'pro/' },
  { text: 'Разбор года', route: '#razbor-goda' },
  { text: 'Мужчина или Ред Флаг', route: '' },
  { text: 'Женщина или тарелочница', soon: 'woman' },
  { text: 'Код богатства', route: '#moy-kod-deneg' },
  { text: 'Личный расчёт дня', route: '#lichnyj-den' },
  { text: 'Расчёт для детей', soon: 'children' },
  { text: 'Деньги', soon: 'money' },
  { text: 'Совместимость', route: '' },
  { text: 'Хорарная нумерология', soon: 'horary' },
  { text: 'Школы нумерологии', route: 'pro/schools/' },
];
const SOON_SECTIONS = new Set(SECTION_BUTTONS.filter(x => x.soon).map(x => 'soon_' + x.soon));
const LEGACY_QUESTION_CALLBACKS = new Set(['topic_love', 'topic_money', 'topic_self', 'topic_answers']);
const BOTTOM_MENU_LABEL = '🫶 Открой все разделы';

// A Telegram message may install a reply keyboard OR carry an inline
// keyboard, not both. Install this reply keyboard in a short, silent message
// immediately before the "account ready" reply with its inline site buttons.
function bottomMenuKeyboard() {
  return {
    keyboard: [[{ text: BOTTOM_MENU_LABEL }]],
    resize_keyboard: true,
    is_persistent: true,
  };
}

async function installBottomMenu(env, header, chatId) {
  // No token or chat identifiers are ever included in diagnostics.
  const token = typeof env.BOT_TOKEN === 'string' ? env.BOT_TOKEN.trim() : '';
  if (!token) {
    console.warn('BOTTOM_MENU_SETUP: BOT_TOKEN_MISSING');
    return false;
  }
  if (header !== await regSecret(token)) {
    console.warn('BOTTOM_MENU_SETUP: WEBHOOK_SECRET_MISMATCH');
    return false;
  }
  const response = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: '🫶 Разделы сайта теперь можно открыть кнопкой внизу.',
      reply_markup: bottomMenuKeyboard(),
      disable_notification: true,
    }),
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) {
    // Status only, not Telegram's full error text or any personal data.
    console.warn('BOTTOM_MENU_SETUP: TELEGRAM_HTTP_' + response.status);
    return false;
  }
  const result = await response.json();
  if (result?.ok !== true) console.warn('BOTTOM_MENU_SETUP: TELEGRAM_RESPONSE_NOT_OK');
  return result?.ok === true;
}



function sectionsKeyboard() {
  return {
    inline_keyboard: SECTION_BUTTONS.map(section => [{
      text: section.text,
      ...(section.soon
        ? { callback_data: 'soon_' + section.soon }
        : { web_app: { url: SITE_URL + section.route } }),
    }]),
  };
}

function updateBotNavigation(reply, update) {
  if (reply?.method !== 'sendMessage' || typeof reply.text !== 'string') return reply;
  const message = update?.message;
  if (message?.chat?.type !== 'private' || typeof message.text !== 'string'
      || Number(reply.chat_id) !== Number(message.chat.id)) return reply;
  const input = message.text.trim();
  const command = input.split(/\s+/u, 1)[0].toLowerCase().split('@')[0];

  // The site keyboard is attached to the SAME "ready" message, not the
  // Telegram typing area and not a separately sent message.
  const ready = reply.text.includes('Ваш личный кабинет готов!')
    || (reply.text.includes('Вы подписались на личный прогноз')
        && reply.text.includes('Готово!'));
  if (ready) {
    // Keep the completion message compact so the full site menu is more visible.
    // Only remove the printed unsubscribe hint; /stop remains functional.
    const compactText = reply.text
      .replace(/(?:\s*Для отключения рассылки напишите \/stop\.|\s*Отключить сообщения можно командой \/stop\.)/gu, '')
      .replace(/\n[ \t]*\n+/g, '\n')
      .trim();
    return { ...reply, text: compactText, reply_markup: sectionsKeyboard() };
  }

  // Old bottom-keyboard buttons may still be visible in earlier chat history;
  // their use should also show the same inline menu rather than another keyboard.
  if (input === BOTTOM_MENU_LABEL || input === CATALOG_LABEL || command === '/catalog' || command === '/catalogue') {
    return { ...reply, text: 'Разделы сайта:', reply_markup: sectionsKeyboard() };
  }

  // Preserve original birthday registration and yes/no subscription consent.
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
        navigation: 'inline-site-sections-on-ready',
        site_sections: SECTION_BUTTONS.length,
        bottom_menu: BOTTOM_MENU_LABEL,
        bottom_menu_token_configured: typeof env.BOT_TOKEN === 'string' && env.BOT_TOKEN.trim().length > 0,
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
      if (!callback.id || (!LEGACY_QUESTION_CALLBACKS.has(action) && !SOON_SECTIONS.has(action))) {
        return json({ ok: true, ignored: true });
      }
      return json({
        method: 'answerCallbackQuery',
        callback_query_id: callback.id,
        text: SOON_SECTIONS.has(action) ? 'Этот раздел пока в разработке.' : 'Скоро здесь появится подробный ответ. 🤍',
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
      const outgoing = updateBotNavigation(reply, update);
      const incoming = update.message;
      const command = typeof incoming?.text === 'string'
        ? incoming.text.trim().split(/\s+/u, 1)[0].toLowerCase().split('@')[0] : '';
      const ready = typeof outgoing.text === 'string'
        && (outgoing.text.includes('Ваш личный кабинет готов!')
          || (outgoing.text.includes('Вы подписались на личный прогноз')
            && outgoing.text.includes('Готово!')));
      // Only after onboarding is ready: never change birth-date/yes-no flows.
      // The website menu button remains the existing Telegram chat menu button.
      if (ready && incoming?.chat?.type === 'private'
          && Number(outgoing.chat_id) === Number(incoming.chat.id)
          && (command === '/start' || command === '/menu'
            || incoming.text.trim() === '✅ Да, каждый день')) {
        try {
          await installBottomMenu(env, telegramHeader, incoming.chat.id);
        } catch {
          // Keep the working inline site keyboard if Telegram setup fails.
          console.error('BOTTOM_MENU_SETUP_FAILED');
        }
      }
      return json(outgoing);
    } catch {
      // Never log secret headers, Telegram updates or users' personal data.
      return json({ ok: false, error: 'BACKEND_TIMEOUT' }, 502);
    }
  },
};
