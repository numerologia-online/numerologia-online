/**
 * Save an already rendered personal-day forecast to the user's OWN bot chat.
 * No registration, database writes, birth-date changes or opt-in side effects.
 * Called only on an explicit "Сохранить в Telegram" button click.
 */
// Accept only the two explicitly configured site origins; never use a wildcard.
const WEBSITE_ORIGINS = new Set([
  'https://numerologia-online.github.io',
  'https://xn--c1adkkdfjbp1a4l.online',
]);
const TRUSTED_SITE_LINKS = [
  'https://numerologia-online.github.io/numerologia-online/',
  'https://xn--c1adkkdfjbp1a4l.online/?view=redflag',
  'https://xn--c1adkkdfjbp1a4l.online/?view=day',
];
const encoder = new TextEncoder();
const SAME_ORIGIN_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
  'Content-Type': 'application/json; charset=utf-8',
};

function reply(body, status = 200, corsOrigin = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsOrigin ? { ...SAME_ORIGIN_HEADERS, 'Access-Control-Allow-Origin': corsOrigin } : { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
  });
}

async function verifiedTelegramUser(initData, botToken) {
  // Return a public error category, never any signed data or user identifier.
  if (typeof initData !== 'string' || !initData)
    return { error: 'INIT_DATA_MISSING' };
  if (initData.length < 60 || initData.length > 4096)
    return { error: 'INIT_DATA_FORMAT' };
  if (typeof botToken !== 'string' || !/^[0-9]{5,15}:[A-Za-z0-9_-]{30,100}$/.test(botToken))
    return { error: 'BOT_NOT_CONFIGURED' };

  const params = new URLSearchParams(initData);
  const pairs = [...params.entries()];
  if (new Set(pairs.map(([key]) => key)).size !== pairs.length)
    return { error: 'INIT_DATA_FORMAT' };
  const providedHash = params.get('hash');
  if (!providedHash || !/^[0-9a-f]{64}$/i.test(providedHash))
    return { error: 'INIT_DATA_FORMAT' };

  const authDate = Number(params.get('auth_date'));
  const elapsed = Math.floor(Date.now() / 1000) - authDate;
  if (!Number.isSafeInteger(authDate)) return { error: 'INIT_DATA_FORMAT' };
  if (elapsed < -120 || elapsed > 86400) return { error: 'SESSION_EXPIRED' };

  const keyForToken = await crypto.subtle.importKey(
    'raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const derivedSecret = await crypto.subtle.sign('HMAC', keyForToken, encoder.encode(botToken));
  const signatureKey = await crypto.subtle.importKey(
    'raw', derivedSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const hashBytes = Uint8Array.from(providedHash.match(/../g), hex => parseInt(hex, 16));
  const checked = async (excludeSignature) => {
    const checkString = pairs.filter(([key]) => key !== 'hash' && (!excludeSignature || key !== 'signature'))
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => key + '=' + value).join('\n');
    return crypto.subtle.verify('HMAC', signatureKey, hashBytes, encoder.encode(checkString));
  };
  // Telegram versions may include their separate third-party Ed25519 signature.
  // Both accepted variants still REQUIRE a valid bot-token HMAC.
  let trusted = await checked(false);
  if (!trusted && params.has('signature')) trusted = await checked(true);
  if (!trusted) return { error: 'SIGNATURE_MISMATCH' };

  let user;
  try { user = JSON.parse(params.get('user') || 'null'); }
  catch { return { error: 'INIT_DATA_FORMAT' }; }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.is_bot === true)
    return { error: 'USER_NOT_PRESENT' };
  return { id: user.id };
}

// Restore the existing incoming webhook only when Telegram reports NO webhook.
// This action is triggered after an authenticated Mini App user successfully
// saves a forecast. Never replace a nonempty webhook or clear queued messages.
// The secret matches REG.RU's existing expectedWebhookSecret(token).
async function restoreMissingInboundWebhook(botToken) {
  const webhookUrl = 'https://numerologia-online-bot.tankraft431.workers.dev/telegram';
  const apiBase = 'https://api.telegram.org/bot' + botToken + '/';
  try {
    const current = await fetch(apiBase + 'getWebhookInfo', {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
    });
    if (!current.ok) return;
    const payload = await current.json();
    if (payload?.ok !== true || !payload.result || payload.result.url !== '') return;

    const digest = await crypto.subtle.digest('SHA-256',
      encoder.encode('numerologia-online:webhook:v1:' + botToken));
    const secretToken = [...new Uint8Array(digest)]
      .map(byte => byte.toString(16).padStart(2, '0')).join('');
    await fetch(apiBase + 'setWebhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: false
      }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    // Saving the user's report must not depend on webhook maintenance.
  }
}

export async function handleDaySave(request, env, ctx) {
  const origin = request.headers.get('Origin');
  if (!WEBSITE_ORIGINS.has(origin)) return reply({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...SAME_ORIGIN_HEADERS, 'Access-Control-Allow-Origin': origin } });
  if (request.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, origin);
  // Telegram bot tokens never contain whitespace. iOS paste may add hidden
  // whitespace characters; normalize only for this independent save endpoint.
  const botToken = typeof env?.BOT_TOKEN === 'string'
    ? env.BOT_TOKEN.replace(/[\s\u200B-\u200D\uFEFF]/g, '') : '';
  if (!/^[0-9]{5,15}:[A-Za-z0-9_-]{30,100}$/.test(botToken))
    return reply({ ok: false, error: 'BOT_NOT_CONFIGURED' }, 503, origin);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8500) return reply({ ok: false, error: 'BODY_TOO_LARGE' }, 413, origin);
    body = JSON.parse(raw);
  } catch {
    return reply({ ok: false, error: 'INVALID_REQUEST' }, 400, origin);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.text !== 'string'
      || body.text.length < 90 || body.text.length > 3800
      || !(body.text.startsWith('🔮 Личный расчёт дня\n')
        || (body.text.startsWith('🚩 Мужчина или Red Flag\n')
          && body.text.includes('\nВопрос: ')
          && body.text.includes('\nДата рождения мужчины: ')))
      || !TRUSTED_SITE_LINKS.some(link => body.text.includes(link))
      || !body.text.includes('https://t.me/Numerologiaonline_bot')
      || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(body.text)) {
    return reply({ ok: false, error: 'INVALID_FORECAST' }, 400, origin);
  }

  let verified;
  try { verified = await verifiedTelegramUser(body.init_data, botToken); }
  catch { verified = { error: 'AUTH_CHECK_UNAVAILABLE' }; }
  if (!verified?.id) return reply({ ok: false, error: verified?.error || 'AUTH_CHECK_UNAVAILABLE' }, 401, origin);
  const chatId = verified.id;

  try {
    // No chat_id from the browser: the recipient is ALWAYS the signed Telegram user.
    const res = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: body.text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const api = await res.json();
    if (res.ok && api?.ok === true) {
      // A legitimate signed bot interaction can self-heal an unregistered
      // incoming webhook without changing registration, subscriptions or chats.
      if (ctx?.waitUntil) ctx.waitUntil(restoreMissingInboundWebhook(botToken));
      return reply({ ok: true }, 200, origin);
    }
    // Only categorical delivery diagnostics; never echo Telegram responses,
    // secrets or private chat/user details to the Mini App.
    if (res.status === 401) return reply({ ok: false, error: 'BOT_API_AUTH_FAILED' }, 502, origin);
    if (res.status === 403) return reply({ ok: false, error: 'BOT_CHAT_UNAVAILABLE' }, 502, origin);
    if (res.status === 429) return reply({ ok: false, error: 'BOT_RATE_LIMIT' }, 503, origin);
    if (res.status === 400 && /chat not found/i.test(String(api?.description || '')))
      return reply({ ok: false, error: 'BOT_CHAT_UNAVAILABLE' }, 502, origin);
    return reply({ ok: false, error: 'DELIVERY_FAILED' }, 502, origin);
  } catch {
    return reply({ ok: false, error: 'DELIVERY_FAILED' }, 502, origin);
  }
}
