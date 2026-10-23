import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import worker from '../cloudflare/telegram-bot/src/index.js';

const TOKEN = '8814989076:' + 'A'.repeat(40);
const OWNER_API = '/api/owner-mailing.php';
const NORMAL_API = '/api/telegram-reg-stage-15-10-2026.php';

async function signedHeader() {
  const data = new TextEncoder().encode('numerologia-online:webhook:v1:' + TOKEN);
  const hash = await webcrypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(v => v.toString(16).padStart(2, '0')).join('');
}
function update(data, header) {
  return new Request('https://worker.test/telegram', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': header },
    body: JSON.stringify({ update_id: 910, ...data }),
  });
}
function message(text, extra = {}) {
  return { message: { message_id: 42, from: { id: 123, is_bot: false },
    chat: { id: 123, type: 'private' }, text, ...extra } };
}
async function callAndCapture(payload) {
  const previous = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), init });
    return new Response(JSON.stringify({ method: 'sendMessage', chat_id: 123, text: 'OK' }), { status: 200 });
  };
  try {
    const r = await worker.fetch(update(payload, await signedHeader()), { BOT_TOKEN: TOKEN }, {});
    return { result: await r.json(), status: r.status, seen };
  } finally { globalThis.fetch = previous; }
}

test('Owner /broadcast is routed to the isolated REG.RU service', async () => {
  const r = await callAndCapture(message('/broadcast Доброе утро'));
  assert.equal(r.status, 200);
  assert.equal(r.result.text, 'OK');
  assert.ok(r.seen[0].url.endsWith(OWNER_API));
});
test('Ordinary Telegram messages preserve the old REG.RU handler', async () => {
  const r = await callAndCapture(message('привет'));
  assert.equal(r.status, 200);
  assert.ok(r.seen[0].url.endsWith(NORMAL_API));
});
test('News opt-in is separate from the morning handler', async () => {
  const r = await callAndCapture(message('/news_on'));
  assert.equal(r.status, 200);
  assert.ok(r.seen[0].url.endsWith(OWNER_API));
});
test('ForceReply draft routes only when responding to the owner-mailing prompt', async () => {
  const r = await callAndCapture(message('Новый разбор готов!', {
    reply_to_message: { from: { id: 8814989076, is_bot: true },
      text: '📣 Напиши текст рассылки одним сообщением:' },
  }));
  assert.ok(r.seen[0].url.endsWith(OWNER_API));
});
test('Owner inline confirmation is routed before normal callback handling', async () => {
  const r = await callAndCapture({
    callback_query: { id: 'callback1', data: 'bc:s:1', from: { id: 123 },
      message: { message_id: 45, chat: { id: 123, type: 'private' } } },
  });
  assert.ok(r.seen[0].url.endsWith(OWNER_API));
});
test('Forged webhook cannot use owner mailing', async () => {
  const previous = globalThis.fetch;
  let sent = false;
  globalThis.fetch = async () => {sent = true; throw new Error('Should not fetch');};
  try {
    const r = await worker.fetch(update(message('/broadcast Fake'), 'invalid'), { BOT_TOKEN: TOKEN }, {});
    assert.equal(r.status, 403);
    assert.equal(sent, false);
  } finally { globalThis.fetch = previous; }
});
