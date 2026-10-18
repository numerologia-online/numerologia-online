/**
 * One-time delivery of an already displayed Red Flag answer.
 * Called only for a VERIFIED private Telegram /start r_<ticket> message.
 * Other bot updates are not changed.
 */
const TICKET_API = 'https://xn--c1adkkdfjbp1a4l.online/api/redflag-save.php';
const TICKET_RE = /^r_[A-Za-z0-9_-]{32}$/;

const validToken = token => typeof token === 'string'
  && /^[0-9]{5,15}:[A-Za-z0-9_-]{30,100}$/.test(token);

async function backend(ticket, action) {
  const response = await fetch(TICKET_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ticket }),
    redirect: 'manual',
    signal: AbortSignal.timeout(8500),
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.ok === true ? payload : null;
}

export async function deliverRedFlagTicket(update, ticket, env) {
  const message = update?.message;
  const chat = message?.chat;
  const user = message?.from;
  if (!TICKET_RE.test(ticket) || chat?.type !== 'private'
      || !Number.isSafeInteger(chat?.id) || chat.id <= 0
      || !Number.isSafeInteger(user?.id) || user.id !== chat.id) {
    return {
      method: 'sendMessage',
      chat_id: chat?.id,
      text: 'Не получилось открыть ссылку. Вернись к ответу на сайте и нажми «Сохранить» ещё раз.',
    };
  }

  const botToken = typeof env?.BOT_TOKEN === 'string'
    ? env.BOT_TOKEN.replace(/[\s\u200B-\u200D\uFEFF]/g, '') : '';
  if (!validToken(botToken)) {
    return { method: 'sendMessage', chat_id: chat.id,
      text: 'Сохранение временно недоступно. Ответ пока остаётся на сайте, попробуй чуть позже.' };
  }

  let saved;
  try { saved = await backend(ticket, 'read'); }
  catch { saved = null; }
  if (!saved || typeof saved.text !== 'string' || saved.text.length < 100
      || saved.text.length > 3800 || !saved.text.startsWith('🚩 Мужчина или Red Flag\n')) {
    return { method: 'sendMessage', chat_id: chat.id,
      text: 'Ссылка на сохранение устарела или ещё не готова. Открой ответ на сайте и нажми «Сохранить» снова.' };
  }

  try {
    const response = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat.id,
        text: '❤️ Твой ответ сохранён!\n\n' + saved.text
          + '\n\n☀️ Хочешь ежедневный личный расчёт? Отправь /start, когда будешь готова.',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const sent = await response.json();
    if (!response.ok || sent?.ok !== true) throw new Error('SEND_FAILED');
    // Consume only after Telegram confirms actual delivery.
    try { await backend(ticket, 'consume'); } catch {}
    return { ok: true, delivered: true };
  } catch {
    return { method: 'sendMessage', chat_id: chat.id,
      text: 'Не удалось доставить ответ. Попробуй нажать ту же ссылку ещё раз. Повторно платить не нужно.' };
  }
}
