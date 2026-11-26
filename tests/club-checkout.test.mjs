import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {webcrypto} from "node:crypto";
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const values=new Map();
globalThis.sessionStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
globalThis.location={hash:"",search:"",pathname:"/moment/yes-no/",origin:"https://example.test",href:"https://example.test/moment/yes-no/",assign:u=>{globalThis.lastNavigation=u;}};
globalThis.window={addEventListener(){},dispatchEvent(){return true;}};
globalThis.document={addEventListener(){}};
const source=await readFile(new URL("../club-checkout.js",import.meta.url),"utf8");
const mod=await import("data:text/javascript;base64,"+Buffer.from(source.replace(/^import .*wallet-client.*;$/m,'const walletRequest=(...args)=>globalThis.mockWallet(...args);')).toString("base64"));
function mock(balance,active=false){
 const calls=[];
 const fn=async(action,payload)=>{
  calls.push({action,payload});
  if(action==="session")return {authenticated:true,account:{id:"test-account"}};
  if(action==="wallet_status")return {test:false,balance_kopeks:balance,club_active:active,subscriptions:[{product_code:"club_month",active,expires_at:"2026-12-26 12:00:00"}]};
  if(action==="wallet_quote")return {test:false,kind:"subscription",product_code:"club_month",price_kopeks:49000,balance_kopeks:balance,ready:true,club_active:active};
  if(action==="wallet_buy")return {test:false,entitlement_id:"mock-entitlement"};
  throw Error("Unexpected "+action);
 };
 return {fn,calls};
}
test("insufficient balance shows exact shortfall and cannot charge",async()=>{
 const {fn,calls}=mock(8100);
 const state=await mod.readClub(fn);
 assert.equal(state.missing,40900);
 assert.equal(state.balance,8100);
 await assert.rejects(mod.confirmClub(state,fn),/NOT_CONFIRMED/);
 assert.equal(calls.some(c=>c.action==="wallet_buy"),false);
});
test("sufficient balance does not charge until explicit confirmation",async()=>{
 const {fn,calls}=mock(60000);
 const state=await mod.readClub(fn);
 assert.equal(state.missing,0);
 assert.equal(calls.some(c=>c.action==="wallet_buy"),false);
 await mod.confirmClub(state,fn);
 const buy=calls.filter(c=>c.action==="wallet_buy");
 assert.equal(buy.length,1);
 assert.equal(buy[0].payload.expected_price_kopeks,49000);
 assert.equal(buy[0].payload.item.product_code,"club_month");
});
test("active Club reports expiry and cannot be purchased again",async()=>{
 const {fn,calls}=mock(8100,true);
 const state=await mod.readClub(fn);
 assert.equal(state.active,true);
 assert.equal(state.expires,"2026-12-26 12:00:00");
 await assert.rejects(mod.confirmClub(state,fn),/NOT_CONFIRMED/);
 assert.equal(calls.some(c=>c.action==="wallet_quote"||c.action==="wallet_buy"),false);
});
test("a changed account cannot authorize the old quote",async()=>{
 const {fn}=mock(60000);
 const state=await mod.readClub(fn);
 await assert.rejects(mod.confirmClub(state,async action=>{assert.equal(action,"session");return {authenticated:true,account:{id:"other"}};}),/ACCOUNT_CHANGED/);
});
test("ambiguous response retries the same idempotency key",async()=>{
 const {fn}=mock(60000);
 const state=await mod.readClub(fn),keys=[];
 const retry=async(action,payload)=>{
  if(action==="wallet_buy"){keys.push(payload.request_key);if(keys.length===1)throw Error("SERVICE_UNAVAILABLE");}
  return fn(action,payload);
 };
 await assert.rejects(mod.confirmClub(state,retry),/SERVICE_UNAVAILABLE/);
 await mod.confirmClub(state,retry);
 assert.equal(keys.length,2);
 assert.equal(keys[0],keys[1]);
});
test("Telegram signed data is verified by the server, not trusted locally",async()=>{
 const {fn,calls}=mock(8100);
 window.Telegram={WebApp:{initData:"signed-test-fixture"}};
 await mod.readClub(async(action,payload)=>{if(action==="telegram"){calls.push({action,payload});return {authenticated:true};}return fn(action,payload);});
 delete window.Telegram;
 assert.equal(calls[0].action,"telegram");
 assert.equal(calls[0].payload.init_data,"signed-test-fixture");
 assert.equal(calls.some(c=>c.action==="wallet_buy"),false);
});
