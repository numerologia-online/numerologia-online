import crypto from 'node:crypto';
import contentManifest from './content-manifest.json' with { type: 'json' };
export const manifest=contentManifest;
const origins=new Set(['https://numerologia-online.github.io','https://xn--c1adkkdfjbp1a4l.online']);
const key=crypto.createPublicKey({key:Buffer.from('302a300506032b6570032100e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d','hex'),format:'der',type:'spki'});
const cache=new Map();
export function bodyOf(req) {
 const b=typeof req.body==='string'?JSON.parse(req.body):req.body;
 if(!b||typeof b!=='object'||Array.isArray(b))throw Error('INVALID_BODY');
 return b;
}
export function prepare(req,res) {
 for(const h of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])res.setHeader(h,'no-store, private');
 res.setHeader('Vary','Origin');res.setHeader('X-Content-Type-Options','nosniff');
 const origin=req.headers.origin;
 if(origin&&!origins.has(origin)){res.status(403).json({ok:false,error:'ORIGIN_NOT_ALLOWED'});return false;}
 if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
 if(req.method==='OPTIONS'){res.status(204).end();return false;}
 if(req.method!=='POST'){res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});return false;}
 return true;
}
// Official Telegram Mini App HMAC and Ed25519 validation; never trust initDataUnsafe.
export function telegramUser(data,{now=Date.now(),botToken=process.env.TELEGRAM_BOT_TOKEN}={}) {
 if(typeof data!=='string'||!data||data.length>16384)return null;
 try {
  const p=new URLSearchParams(data);
  if([...p.keys()].length!==new Set(p.keys()).size)return null;
  const issued=Number(p.get('auth_date')),seconds=Math.floor(now/1000);
  if(!Number.isSafeInteger(issued)||issued<=0||issued>seconds+60||seconds-issued>86400)return null;
  const entries=[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0);
  let valid=false;
  const signature=p.get('signature');
  if(signature&&/^[A-Za-z0-9_-]{86}(?:==)?$/.test(signature)) {
   const text='8814989076:WebAppData\n'+entries.filter(([k])=>k!=='hash'&&k!=='signature').map(([k,v])=>k+'='+v).join('\n');
   valid=crypto.verify(null,Buffer.from(text),key,Buffer.from(signature,'base64url'));
  }
  const hash=p.get('hash');
  if(!valid&&botToken&&/^[a-f0-9]{64}$/i.test(hash||'')) {
   const secret=crypto.createHmac('sha256','WebAppData').update(botToken).digest();
   const text=entries.filter(([k])=>k!=='hash').map(([k,v])=>k+'='+v).join('\n');
   const expected=crypto.createHmac('sha256',secret).update(text).digest();
   valid=crypto.timingSafeEqual(expected,Buffer.from(hash,'hex'));
  }
  if(!valid)return null;
  const user=JSON.parse(p.get('user')||'{}');
  if(!Number.isSafeInteger(user.id)||user.id<=0)return null;
  const name=[user.first_name,user.last_name].filter(x=>typeof x==='string').join(' ')||user.username||'Пользователь';
  return {id:String(user.id),name:String(name).slice(0,80)};
 }catch{return null;}
}
export function isOwner(user) {
 const id=String(process.env.SITE_OWNER_TELEGRAM_ID||'').trim();
 return !!user&&/^[1-9][0-9]{4,19}$/.test(id)&&user.id===id;
}
export function requireOwner(body,res) {
 const user=telegramUser(body.init_data);
 if(!user){res.status(401).json({ok:false,error:'TELEGRAM_AUTH_REQUIRED'});return false;}
 if(!isOwner(user)){res.status(403).json({ok:false,error:'PURCHASE_REQUIRED'});return false;}
 return true;
}
export async function readPrivate(path) {
 if(typeof path!=='string'||!Object.hasOwn(manifest.files,path))throw Error('INVALID_PATH');
 const token=process.env.GITHUB_PRIVATE_TOKEN;
 if(!token)throw Error('SERVER_NOT_CONFIGURED');
 const expected=manifest.files[path].sha,cacheKey=expected+':'+path,hit=cache.get(cacheKey);
 if(hit&&hit.expires>Date.now())return hit.text;
 const url='https://api.github.com/repos/numerologia-online/numi-numi-on-private/contents/'+path.split('/').map(encodeURIComponent).join('/')+'?ref='+encodeURIComponent(manifest.ref);
 const r=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000),redirect:'error'});
 if(!r.ok)throw Error('PRIVATE_CONTENT_UNAVAILABLE');
 const bytes=Buffer.from(await r.arrayBuffer());
 if(bytes.length>5000000)throw Error('CONTENT_TOO_LARGE');
 const actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 if(actual!==expected)throw Error('CONTENT_INTEGRITY_ERROR');
 const text=bytes.toString('utf8');
 if(cache.size>=32)cache.delete(cache.keys().next().value);
 cache.set(cacheKey,{text,expires:Date.now()+300000});return text;
}
export function contentError(error,res) {
 const e=error?.message;
 return res.status(['INVALID_PATH','INVALID_BODY'].includes(e)?400:502).json({ok:false,error:['INVALID_PATH','INVALID_BODY','CONTENT_INTEGRITY_ERROR','SERVER_NOT_CONFIGURED'].includes(e)?e:'PRIVATE_CONTENT_UNAVAILABLE'});
}
