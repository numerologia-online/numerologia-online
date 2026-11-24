import assert from 'node:assert/strict';
import { deliverRedFlagTicket } from '../cloudflare/telegram-bot/src/redflag-delivery.js';
const ticket='r_'+'A'.repeat(32);
const text='🚩 Мужчина или Red Flag\n'+('Синтетическая проверка доставки без персональных данных. ').repeat(4);
const update={message:{chat:{id:123,type:'private'},from:{id:123}}};
const env={BOT_TOKEN:'123456789:'+('X'.repeat(35))};
const previous=globalThis.fetch;
let calls=[],fail=false;
globalThis.fetch=async (url,options)=>{
 const body=JSON.parse(options.body);calls.push(body.action||'sendMessage');
 if(body.action==='read')return new Response(JSON.stringify({ok:true,text}));
 if(body.action==='consume')return new Response(JSON.stringify({ok:true}));
 assert.equal(body.chat_id,123);assert.ok(body.text.includes(text));
 return new Response(JSON.stringify({ok:!fail}),{status:fail?500:200});
};
try{
 const result=await deliverRedFlagTicket(update,ticket,env);
 assert.equal(result.delivered,true);assert.deepEqual(calls,['read','sendMessage','consume']);
 calls=[];fail=true;
 const unsuccessful=await deliverRedFlagTicket(update,ticket,env);
 assert.notEqual(unsuccessful.delivered,true);assert.deepEqual(calls,['read','sendMessage']);
 calls=[];
 await deliverRedFlagTicket({message:{chat:{id:123,type:'group'},from:{id:123}}},ticket,env);
 assert.deepEqual(calls,[]);
 console.log('TELEGRAM_TICKET_MOCK_PASS success consumes; failure remains retryable; nonprivate denied');
}finally{globalThis.fetch=previous;}
