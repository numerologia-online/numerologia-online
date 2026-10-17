/**
 * Isolated Telegram "Личный расчёт дня" flow.
 * No changes to /start, the REG.RU database schema, existing subscriptions,
 * the site, or CRON. REG.RU remains the sole writer of birth dates / opt-ins.
 */
const PROMPT_MARKER = '☀️ Личный расчёт дня - дата рождения';
const ORIGINS = [
  'https://numerologia-online.github.io/numerologia-online/',
  'https://atelier-8k2m7q.vercel.app/',
];

function chatMessage(chatId, text, replyMarkup) {
  const result = { method: 'sendMessage', chat_id: chatId, text, disable_web_page_preview: true };
  if (replyMarkup) result.reply_markup = replyMarkup;
  return result;
}

function requestDate(chatId, correction = false) {
  return chatMessage(
    chatId,
    PROMPT_MARKER + '\n\n'
      + (correction ? 'Похоже, в дате ошибка. Попробуй ещё раз. ❤️\n\n' : 'Привет! ❤️\n\n')
      + 'Напиши дату своего рождения в формате ДД.ММ.ГГГГ, например 09.09.1986.\n\n'
      + 'Я сохраню её для личного расчёта и включу ежедневный прогноз на 10:00 по Москве. '
      + 'Рассылку можно отключить в любой момент командой /stop.',
    { force_reply: true, input_field_placeholder: 'ДД.ММ.ГГГГ', selective: true }
  );
}

function trustedPrivateChat(update, callback = false) {
  const data = callback ? update?.callback_query : update?.message;
  const chatId = data?.message?.chat?.id ?? data?.chat?.id;
  const kind = data?.message?.chat?.type ?? data?.chat?.type;
  const senderId = data?.from?.id;
  if (!Number.isSafeInteger(chatId) || chatId <= 0 || kind !== 'private'
      || !Number.isSafeInteger(senderId) || senderId !== chatId) return null;
  return chatId;
}

function parseBirthDate(input) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(input || '').trim());
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const now = new Date();
  if (year < 1900 || year > now.getUTCFullYear() ||
      date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day || date.getTime() > now.getTime()) return null;
  return { day, month, year, formatted: match[0] };
}

async function backendMessage(update, secret, backendUrl) {
  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Bot-Api-Secret-Token': secret,
    },
    body: JSON.stringify(update),
    redirect: 'manual',
    signal: AbortSignal.timeout(7500),
  });
  if (!response.ok) throw new Error('REG_REQUEST_FAILED');
  const reply = await response.json();
  if (!reply || reply.method !== 'sendMessage' || typeof reply.text !== 'string') {
    throw new Error('REG_INVALID_REPLY');
  }
  return reply;
}

function asBackendText(update, chatId, text) {
  return {
    update_id: update?.update_id ?? 0,
    message: {
      message_id: update?.message?.message_id ?? update?.callback_query?.message?.message_id ?? 0,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: 'private' },
      from: { id: chatId, is_bot: false },
      text,
    },
  };
}

function numberDigits(value) {
  return String(Math.abs(value)).split('').reduce((sum, digit) => sum + Number(digit), 0);
}
function reduce9(value) {
  let n = Math.abs(value);
  while (n > 9) n = numberDigits(n);
  return n || 9;
}
function personalKeys(birth, today) {
  const personalYear = reduce9(birth.day + birth.month + numberDigits(today.year));
  const personalMonth = reduce9(personalYear + today.month);
  const personalDay = reduce9(personalMonth + today.day);
  const universalDay = reduce9(today.day + today.month + numberDigits(today.year));
  let lifePath = numberDigits(birth.day) + numberDigits(birth.month) + numberDigits(birth.year);
  while (lifePath > 9 && ![11, 22, 33].includes(lifePath)) lifePath = numberDigits(lifePath);
  let energy = personalDay + personalMonth + universalDay + birth.day + today.month;
  while (energy > 22) energy -= 22;
  let position = lifePath + birth.day + today.day + numberDigits(birth.year);
  while (position > 31) position -= 31;
  return { energy: energy || 22, position: position || 31 };
}
function moscowToday() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'numeric', year: 'numeric'
  }).formatToParts(new Date());
  const lookup = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { day: Number(lookup.day), month: Number(lookup.month), year: Number(lookup.year) };
}
async function loadBank(path) {
  for (const origin of ORIGINS) {
    try {
      const response = await fetch(origin + path, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) continue;
      const bank = await response.json();
      if (bank && bank.entries && typeof bank.entries === 'object') return bank;
    } catch { /* Try next known public origin. */ }
  }
  return null;
}
function entry(bank, energy, position) {
  return bank?.entries?.[String(position)] ?? bank?.entries?.[String(energy) + '-' + String(position)];
}
async function dailyForecast(birth) {
  const today = moscowToday();
  const { energy, position } = personalKeys(birth, today);
  const fileNo = String(energy).padStart(2, '0');
  const [general, practical] = await Promise.all([
    loadBank('data/day/general/general-day-' + fileNo + '.json'),
    loadBank('data/day/practical/practical-day-' + fileNo + '.json'),
  ]);
  const generalEntry = entry(general, energy, position);
  if (typeof generalEntry?.text !== 'string' || !generalEntry.text.trim()) return null;
  const label = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date());
  let result = '🔮 Твой личный расчёт на ' + label + '\n\n' + generalEntry.text.trim();
  const advice = entry(practical, energy, position);
  for (const [key, heading] of [['todayNeed', '✅ Сегодня нужно'], ['todayAvoid', '⛔ Сегодня нельзя']]) {
    const items = advice?.[key];
    if (Array.isArray(items)) {
      const lines = items.filter(value => typeof value === 'string' && value.trim());
      if (lines.length) result += '\n\n' + heading + ':\n• ' + lines.join('\n• ');
    }
  }
  return result.slice(0, 3900);
}

export async function personalDayCallback(update, secret, backendUrl) {
  const chatId = trustedPrivateChat(update, true);
  if (!chatId) return { ok: true, ignored: true };
  let status;
  try {
    status = await backendMessage(asBackendText(update, chatId, '/status'), secret, backendUrl);
  } catch {
    return chatMessage(chatId, 'Не удалось проверить сохранённую дату рождения. Попробуй, пожалуйста, ещё раз чуть позже. ❤️');
  }
  const saved = /Дата рождения:\s*(\d{2}\.\d{2}\.\d{4})/u.exec(status.text);
  if (!saved) return requestDate(chatId);
  const birth = parseBirthDate(saved[1]);
  if (!birth) return requestDate(chatId);
  const forecast = await dailyForecast(birth);
  return chatMessage(chatId, forecast || 'Не удалось загрузить авторский текст дня. Дата рождения сохранена, попробуй открыть расчёт ещё раз чуть позже. ❤️');
}

export async function personalDayDateReply(update, secret, backendUrl) {
  const message = update?.message;
  const replyTo = message?.reply_to_message;
  if (replyTo?.from?.is_bot !== true || typeof replyTo.text !== 'string'
      || !replyTo.text.startsWith(PROMPT_MARKER)) return null;
  const chatId = trustedPrivateChat(update);
  if (!chatId) return { ok: true, ignored: true };
  const birth = parseBirthDate(message?.text);
  if (!birth) return requestDate(chatId, true);
  let saved;
  try {
    saved = await backendMessage(update, secret, backendUrl);
  } catch {
    return chatMessage(chatId, 'Не удалось сохранить дату. Попробуй ещё раз чуть позже. ❤️');
  }
  if (!saved.text.startsWith('Дата рождения ' + birth.formatted + ' сохранена!')) {
    return chatMessage(chatId, saved.text);
  }
  try {
    // Use only the existing opt-in command. REG.RU remains the sole DB writer.
    // REG.RU may send its already-existing permanent keyboard confirmation.
    await backendMessage(asBackendText(update, chatId, '✅ Да, каждый день'), secret, backendUrl);
  } catch {
    return chatMessage(chatId, 'Дата рождения сохранена, но подключение ежедневного прогноза не подтвердилось. Напиши «✅ Да, каждый день», чтобы включить рассылку.');
  }
  const forecast = await dailyForecast(birth);
  return chatMessage(chatId, forecast || 'Дата рождения сохранена и ежедневный прогноз подключён. ❤️ Авторский текст дня пока не загрузился, попробуй открыть расчёт снова.');
}

export async function acknowledgePersonalDayCallback(update, secret, botToken) {
  if (typeof botToken !== 'string' || !botToken
      || update?.callback_query?.id == null) return;
  const prefixed = 'numerologia-online:webhook:v1:' + botToken;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(prefixed));
  const hash = [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, '0')).join('');
  if (hash !== secret) return;
  await fetch('https://api.telegram.org/bot' + botToken + '/answerCallbackQuery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: update.callback_query.id }),
    signal: AbortSignal.timeout(3000),
  });
}
