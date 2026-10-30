import {manifest,readPrivate} from '../lib/content-security.mjs';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).end();
 try {
  await readPrivate('data/year/energy-1.txt');
  return res.status(200).json({ok:true,release:manifest.release,privateStorage:'verified',ownerConfigured:/^[1-9][0-9]{4,19}$/.test(String(process.env.SITE_OWNER_TELEGRAM_ID||'').trim())});
 }catch{return res.status(503).json({ok:false,error:'PRIVATE_STORAGE_UNAVAILABLE'});}
}
