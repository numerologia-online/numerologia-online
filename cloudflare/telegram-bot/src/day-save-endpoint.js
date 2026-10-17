/**
 * Save an already rendered personal-day forecast to the user's OWN bot chat.
 * No registration, database writes, birth-date changes or opt-in side effects.
 * Called only on an explicit "Сохранить в Telegram" button click.
 */
const WEBSITE_ORIGIN = 'https://numerologia-online.github.io';
const encoder = new TextEncoder();
const SAME_ORIGIN_HEADERS = {
  'Access-Control-Allow-Origin': WEBSITE_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  'Vary': 'Origin',
  'Content-Type': 'application/json; charset=utf-8',
};

function reply(body, status = 200, cors = false) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors ? SAME_ORIGIN_HEADERS : { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
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

export async function handleDaySave(request, env) {
  const origin = request.headers.get('Origin');
  if (origin !== WEBSITE_ORIGIN) return reply({ ok: false, error: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: SAME_ORIGIN_HEADERS });
  if (request.method !== 'POST') return reply({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405, true);
  if (!env?.BOT_TOKEN) return reply({ ok: false, error: 'BOT_NOT_CONFIGURED' }, 503, true);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 8500) return reply({ ok: false, error: 'BODY_TOO_LARGE' }, 413, true);
    body = JSON.parse(raw);
  } catch {
    return reply({ ok: false, error: 'INVALID_REQUEST' }, 400, true);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || typeof body.text !== 'string'
      || body.text.length < 90 || body.text.length > 3800
      || !body.text.startsWith('🔮 Личный расчёт дня\n')
      || !body.text.includes('https://numerologia-online.github.io/numerologia-online/')
      || !body.text.includes('https://t.me/Numerologiaonline_bot')
      || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(body.text)) {
    return reply({ ok: false, error: 'INVALID_FORECAST' }, 400, true);
  }

  let verified;
  try { verified = await verifiedTelegramUser(body.init_data, env.BOT_TOKEN); }
  catch { verified = { error: 'AUTH_CHECK_UNAVAILABLE' }; }
  if (!verified?.id) return reply({ ok: false, error: verified?.error || 'AUTH_CHECK_UNAVAILABLE' }, 401, true);
  const chatId = verified.id;

  try {
    // No chat_id from the browser: the recipient is ALWAYS the signed Telegram user.
    const res = await fetch('https://api.telegram.org/bot' + env.BOT_TOKEN + '/sendMessage', {
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
    if (res.ok && api?.ok === true) return reply({ ok: true }, 200, true);
    // Only categorical delivery diagnostics; never echo Telegram responses,
    // secrets or private chat/user details to the Mini App.
    if (res.status === 401) return reply({ ok: false, error: 'BOT_API_AUTH_FAILED' }, 502, true);
    if (res.status === 403) return reply({ ok: false, error: 'BOT_CHAT_UNAVAILABLE' }, 502, true);
    if (res.status === 429) return reply({ ok: false, error: 'BOT_RATE_LIMIT' }, 503, true);
    if (res.status === 400 && /chat not found/i.test(String(api?.description || '')))
      return reply({ ok: false, error: 'BOT_CHAT_UNAVAILABLE' }, 502, true);
    return reply({ ok: false, error: 'DELIVERY_FAILED' }, 502, true);
  } catch {
    return reply({ ok: false, error: 'DELIVERY_FAILED' }, 502, true);
  }
}
