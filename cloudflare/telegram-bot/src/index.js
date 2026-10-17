import { personalDayCallback, personalDayDateReply, acknowledgePersonalDayCallback } from './personal-day-dialog.js';
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
  { text: 'Личный расчёт дня', route: '?view=day' },
  { text: 'Полный расчёт года', route: '#razbor-goda' },
  { text: 'Мужчина или Ред Флаг', route: '?view=redflag' },
  { text: 'Совместимость и любовь', route: '?view=compatibility' },
  { text: 'Полный разбор', route: 'pro/' },
  { text: 'Женщина или тарелочница', route: '#woman-section', soon: 'woman' },
  { text: 'Ваш код богатства и ритуалы', route: '?view=wealth' },
  { text: 'Для мам - всё о ребёнке', route: '#children-section', soon: 'children' },
  { text: 'Любой вопрос', route: '#horary-section', soon: 'horary' },
  { text: 'Школа нумерологии', route: 'pro/schools/' },
  { text: 'Записаться на личный расчёт', route: '#appointment-section', soon: 'appointment' },
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

function sectionsKeyboard() {
  return {
    inline_keyboard: SECTION_BUTTONS.map(section => [{
      text: section.text,
      web_app: { url: SITE_URL + section.route },
    }]),
  };
}

// Clickable text links can coexist with the persistent bottom reply keyboard
// in one Telegram message. Unfinished sections are shown without dead links.
function escapeTelegramHtml(value) {
  return String(value).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function sectionsAsTextLinks() {
  const icons = ['🔮', '📅', '🚩', '💃', '💎', '☀️', '👶', '💰', '💞', '🔭', '🎓'];
  return SECTION_BUTTONS.map((section, index) => {
    const title = escapeTelegramHtml(section.text);
    if (section.soon) return icons[index] + ' ' + title + ' <i>(скоро)</i>';
    const url = escapeTelegramHtml(SITE_URL + section.route);
    return icons[index] + ' <a href="' + url + '">' + title + '</a>';
  }).join('\n');
}

function updateBotNavigation(reply, update) {
  if (reply?.method !== 'sendMessage' || typeof reply.text !== 'string') return reply;
  const message = update?.message;
  if (message?.chat?.type !== 'private' || typeof message.text !== 'string'
      || Number(reply.chat_id) !== Number(message.chat.id)) return reply;

  const input = message.text.trim();
  const command = input.split(/\s+/u, 1)[0].toLowerCase().split('@')[0];

  // The full website catalogue is shown ONLY when the permanent button is pressed.
  // Its inline buttons do not replace the already-installed reply keyboard.
  if (input === BOTTOM_MENU_LABEL || input === CATALOG_LABEL
      || command === '/catalog' || command === '/catalogue') {
    return { ...reply, text: 'Разделы сайта:', reply_markup: sectionsKeyboard() };
  }

  // A manual fallback also refreshes the one-button reply keyboard.
  if (command === '/menu' || command === '/keyboard') {
    return { ...reply, text: '🫶 Открой все разделы', reply_markup: bottomMenuKeyboard() };
  }

  // A wrong date is corrected by entering it again. The original Telegram
  // keyboard must be removed while waiting for the replacement date.
  if (input === '❌ Нет, неверно') {
    return {
      ...reply,
      text: 'Введите вашу дату рождения в формате ДД.ММ.ГГГГ, например 09.09.1986.',
      reply_markup: { remove_keyboard: true },
    };
  }

  // The REG.RU backend sends the permanent bottom button as a separate
  // Telegram message, then returns the inline catalogue through this webhook.
  // Do not replace its 11 inline buttons with a reply keyboard.
  if (Array.isArray(reply.reply_markup?.inline_keyboard)) {
    return { ...reply, reply_markup: sectionsKeyboard() };
  }

  // During date registration preserve the two temporary consent choices.
  // REG.RU supplies a third "Open site" keyboard row; omit it here.
  const rows = reply.reply_markup?.keyboard;
  const hasYes = Array.isArray(rows) && rows.some(row =>
    Array.isArray(row) && row.some(button => button?.text === '✅ Да, каждый день'));
  const hasNo = Array.isArray(rows) && rows.some(row =>
    Array.isArray(row) && row.some(button => button?.text === '❌ Нет, спасибо'));
  if (hasYes && hasNo) {
    // The user has just ENTERED a birth date: ask to verify it.
    // REG.RU keeps ownership of daily forecast subscription on confirmation.
    const saved = /^Дата рождения (\d{2}\.\d{2}\.\d{4}) сохранена!/u.exec(reply.text);
    if (saved) {
      return {
        ...reply,
        text: 'Дата рождения ' + saved[1] + ' сохранена!\n\n'
          + 'Проверьте, пожалуйста, дату.',
        reply_markup: {
          keyboard: [[{ text: '✅ Да, верно' }, { text: '❌ Нет, неверно' }]],
          resize_keyboard: true,
          is_persistent: false,
        },
      };
    }
    // Preserve legacy consent prompts for users who already have a birth date.
    return {
      ...reply,
      reply_markup: {
        keyboard: [[{ text: '✅ Да, каждый день' }, { text: '❌ Нет, спасибо' }]],
        resize_keyboard: true,
        is_persistent: false,
      },
    };
  }

  // Keep the first /start response brief: the bot asks only for a birth date.
  // Do not modify existing-account replies or date/consent handling.
  if (command === '/start'
      && reply.text.includes('Добро пожаловать в Нумерологию Онлайн!')
      && reply.text.includes('Напишите вашу дату рождения')) {
    return {
      ...reply,
      text: 'Добро пожаловать в Нумерологию Онлайн! ❤️\n\nНапишите вашу дату рождения в формате ДД.ММ.ГГГГ, например 09.09.1986.',
      reply_markup: bottomMenuKeyboard(),
    };
  }

  // Confirm the existing REG.RU subscription result in the bot's own voice.
  // Never claim activation when the backend did not confirm success.
  if (input === '✅ Да, верно'
      && reply.text.startsWith('Готово!')
      && reply.text.includes('Вы подписались на личный прогноз')) {
    return {
      ...reply,
      // The owner's approved compact welcome. The existing bottom menu remains.
      // Full 11-section inline catalogue is available on button press.
      text: "<b>Готово! 🫶 Каждое утро я буду присылать тебе личный расчёт дня ☀️</b>\n\nЭтот бот создан, чтобы каждая женщина могла получать подсказки от жизни, не упускать важные шансы и избегать ошибок.\n\nМне очень хочется, чтобы ваша жизнь стала хоть чуточку легче, спокойнее и понятнее.\n\n<b>Я рядом 🤍</b>\n\n<b>Где тебе удобно продолжить?</b>\n\nНажми <b>«Открыть сайт»</b>, если хочешь получить ответы на свои вопросы через наше мини-приложение, или <b>«Открой все разделы»</b>, чтобы продолжить прямо здесь, в Telegram 👇",
      parse_mode: 'HTML',
      reply_markup: bottomMenuKeyboard(),
    };
  }

  // After accepting or refusing, and on first or repeat /start, replace the
  // temporary keyboard with ONE permanent button in the same bot message.
  // REG.RU still owns birth-date storage and subscription decisions.
  const compact = reply.text
    .replace(/(?:\s*Для отключения рассылки напишите \/stop\.|\s*Отключить сообщения можно командой \/stop\.)/gu, '')
    .replace(/\n[ \t]*\n+/g, '\n')
    .trim();
  return { ...reply, text: compact, reply_markup: bottomMenuKeyboard() };
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
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && (path === '/' || path === '/health')) {
      return json({
        ok: true,
        service: 'numerologia-online-telegram-worker',
        version: '2026-10-16',
        configured: true,
        reg_ru: await backendHealth(),
        webhook_changed: false,
        navigation: 'birth-date-confirmation-before-daily-opt-in',
        site_sections: SECTION_BUTTONS.length,
        bottom_menu: BOTTOM_MENU_LABEL,
        bottom_menu_delivery: 'webhook-reply',
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
      if (action === 'day_intro') {
        // The only enhanced inline button. REG.RU validates the existing
        // Telegram webhook secret and supplies the saved birth date.
        const reply = await personalDayCallback(update, telegramHeader, REG_HANDLER);
        if (ctx?.waitUntil && typeof env.BOT_TOKEN === 'string') {
          ctx.waitUntil(acknowledgePersonalDayCallback(update, telegramHeader, env.BOT_TOKEN).catch(() => {}));
        }
        return json(reply);
      }
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
      // Only date replies to the new personal-day prompt are handled here.
      // All other messages keep the original REG.RU onboarding flow.
      const personalDayReply = await personalDayDateReply(update, telegramHeader, REG_HANDLER);
      if (personalDayReply !== null) return json(personalDayReply);
      // Keep REG.RU as the only writer of birth dates and subscription status.
      // Only translate the two NEW confirmation answers into existing,
      // proven REG.RU commands. Even a rejected date reaches the backend
      // first for webhook authentication; it changes no stored data.
      const inputText = typeof update?.message?.text === 'string'
        ? update.message.text.trim() : '';
      const backendText = inputText === '✅ Да, верно' ? '✅ Да, каждый день'
        : inputText === '❌ Нет, неверно' ? '/start' : null;
      const backendBody = backendText === null ? body : JSON.stringify({
        ...update, message: { ...update.message, text: backendText },
      });
      const response = await fetch(REG_HANDLER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': telegramHeader,
        },
        body: backendBody,
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
