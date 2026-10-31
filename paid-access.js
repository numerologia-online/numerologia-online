import {protectedFiles} from './paid-content-paths.js?v=20261030secure1';
export const AUTH_SERVER='https://xn--c1adkkdfjbp1a4l.online';
const root=new URL('./',import.meta.url);
let ownerRequest,ownerKey='',owner=false;
export function getInitData() {
 const data=globalThis.Telegram?.WebApp?.initData;
 if(typeof data==='string'&&data)return data;
 try{return new URLSearchParams(globalThis.location?.hash?.replace(/^#/,'')||'').get('tgWebAppData')||'';}catch{return '';}
}
export function hasOwnerAccess() {
 const data=getInitData();
 if(!data){owner=false;ownerRequest=null;ownerKey='';return Promise.resolve(false);}
 if(!ownerRequest||ownerKey!==data) {
  ownerKey=data;
  ownerRequest=globalThis.fetch(AUTH_SERVER+'/api/numi-miniapp.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({init_data:data}),cache:'no-store',signal:AbortSignal.timeout(20000)})
   .then(async r=>r.ok?r.json():null).then(r=>{owner=!!(r?.ok&&r.owner===true&&r.user?.id);return owner;})
   .catch(()=>{ownerRequest=null;owner=false;return false;});
 }
 return ownerRequest;
}
export const ownerAccessKnown=()=>owner;
export async function privateContent(path) {
 const r=await globalThis.fetch(AUTH_SERVER+'/api/numi-paid-content.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({init_data:getInitData(),path}),cache:'no-store',signal:AbortSignal.timeout(25000)});
 const d=await r.json();
 if(!r.ok||d.ok!==true)throw Object.assign(Error(d.error||'PRIVATE_CONTENT_UNAVAILABLE'),{status:r.status});
 return d.content;
}
export async function contentFetch(input,options) {
 const url=new URL(input instanceof Request?input.url:String(input),globalThis.document?.baseURI||root);
 if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))return globalThis.fetch(input,options);
 const path=url.pathname.slice(root.pathname.length),policy=protectedFiles[path];
 if(!policy)return globalThis.fetch(input,options);
 if(!await hasOwnerAccess()) {
  if(policy.public)return globalThis.fetch(input,options);
  return new Response(JSON.stringify({ok:false,error:'PURCHASE_REQUIRED'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 }
 try {
  const data=await privateContent(path);
  return new Response(typeof data==='string'?data:JSON.stringify(data),{status:200,headers:{'Content-Type':path.endsWith('.json')?'application/json':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 }catch(e){return new Response(JSON.stringify({ok:false,error:e.message}),{status:e.status||502,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
}
