const {JSDOM}=require('jsdom');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../..');
const catalog=JSON.parse(fs.readFileSync(root+'/store-catalog.json'));
const source=fs.readFileSync(root+'/store-browser.js','utf8');
let requests=[];
function setup(saved){
 const dom=new JSDOM('<main></main><div id="account-overview"></div><button data-account-open="profile">Вход</button>',{url:'https://example.test/',runScripts:'outside-only'});
 const w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 if(saved)w.sessionStorage.setItem('numi-cart-v1',saved);
 w.fetch=async(url,init)=>{
  if(url==='/store-catalog.json')return {ok:true,json:async()=>catalog};
  const body=JSON.parse(init.body);requests.push(body);
  if(body.action==='cart_quote')return {ok:true,json:async()=>({ok:true,authenticated:false,items:body.items.map(i=>({price_kopeks:99000,sale_ready:false,access_active:false})),total_kopeks:body.items.length*99000,checkout_enabled:false})};
  return {ok:false,json:async()=>({ok:false,error:'LOGIN_REQUIRED'})};
 };
 w.eval(source);return dom;
}
(async()=>{
 const dom=setup();const w=dom.window;
 await w.NumiStore.open();assert.equal(w.document.querySelector('select').options.length,11);
 const form=w.document.querySelector('#numi-store form');form.querySelector('input[type=date]').value='1986-09-09';
 form.dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(r=>setImmediate(r));
 assert.equal(JSON.parse(w.sessionStorage.getItem('numi-cart-v1')).length,1);
 assert.equal(w.document.querySelector('#numi-store ul').children.length,1);
 assert.match(w.document.querySelector('#numi-store').textContent,/990 ₽/);
 const confirm=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Подтвердить заказ');assert.equal(confirm.disabled,true);
 const saved=w.sessionStorage.getItem('numi-cart-v1');const reload=setup(saved);await reload.window.NumiStore.open();assert.equal(reload.window.document.querySelector('#numi-store ul').children.length,1);
 w.document.querySelector('#numi-store ul button').click();assert.equal(JSON.parse(w.sessionStorage.getItem('numi-cart-v1')).length,0);
 const product=w.document.querySelector('select');product.value='moment_question';product.dispatchEvent(new w.Event('change'));assert.equal(form.querySelector('button').disabled,true);
 assert.equal(requests.filter(r=>r.action==='checkout').length,0);
 console.log('PASS UI: catalogue, basket, server quote, removal, login persistence, disabled checkout, moment blocked');
 dom.window.close();reload.window.close();
})().catch(e=>{console.error(e);process.exit(1)});
