import test from 'node:test';
import assert from 'node:assert/strict';
import {GET, POST, makeKeyboard, getBotReply} from '../api/telegram.mjs';

function setTestConfig() {
  process.env.TELEGRAM_BOT_TOKEN='FAKE_TOKEN_FOR_TESTS';
  process.env.TELEGRAM_WEBHOOK_SECRET='test-secret';
  process.env.TELEGRAM_SITE_URL='https://numerologia-online.github.io/numerologia-online/';
}
function update(text, headers = {'x-telegram-bot-api-secret-token':'test-secret'}, chat = {id:1234,type:'private'}) {
  return new Request('https://example.test/api/telegram', {method:'POST', headers, body:JSON.stringify({update_id:42,message:{message_id:2,text,chat}})});
}
test('Три кнопки ведут на разделы существующего сайта', () => {
  setTestConfig();
  const keys=makeKeyboard().inline_keyboard;
  assert.equal(keys.length,3);
  assert.equal(keys[0][0].url,'https://numerologia-online.github.io/numerologia-online/#moy-kod-deneg');
  assert.equal(keys[1][0].url,'https://numerologia-online.github.io/numerologia-online/#lichnyj-den');
  assert.equal(keys[2][0].url,'https://numerologia-online.github.io/numerologia-online/');
});
test('Ответы на /start и /test есть, на обычные фразы - нет',()=>{
  setTestConfig();
  assert.equal(getBotReply({text:'/start'})?.reply_markup.inline_keyboard.length,3);
  assert.match(getBotReply({text:'/test'})?.text,/Бот отвечает/);
  assert.equal(getBotReply({text:'привет'}),null);
});
test('Без секрета и токена webhook не работает',async()=>{
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
  assert.equal((await POST(update('/start'))).status,503);
  assert.equal((await (await GET()).json()).botConfigured,false);
});
test('Поддельный webhook отвергается',async()=>{
  setTestConfig();
  assert.equal((await POST(update('/start',{'x-telegram-bot-api-secret-token':'incorrect'}))).status,403);
});
test('Webhook отвечает /start сообщением и 3 кнопками',async()=>{
  setTestConfig();
  const oldFetch=globalThis.fetch;
  let sent;
  globalThis.fetch=async (url,options)=>{sent={url,body:JSON.parse(options.body)};return new Response(JSON.stringify({ok:true}),{status:200});};
  try {
    assert.equal((await POST(update('/start'))).status,200);
    assert.equal(sent.body.chat_id,1234);
    assert.equal(sent.body.reply_markup.inline_keyboard.length,3);
    assert.match(sent.url,/sendMessage$/);
  } finally {globalThis.fetch=oldFetch;}
});
test('Webhook не отвечает в группах',async()=>{
  setTestConfig();
  assert.equal((await (await POST(update('/start',{'x-telegram-bot-api-secret-token':'test-secret'},{id:7,type:'group'}))).json()).ignored,true);
});
