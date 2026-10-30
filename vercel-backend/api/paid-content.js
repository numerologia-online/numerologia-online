import {prepare,bodyOf,requireOwner,readPrivate,contentError} from '../lib/content-security.mjs';
export default async function handler(req,res) {
 if(!prepare(req,res))return;
 try {
  const b=bodyOf(req);if(!requireOwner(b,res))return;
  const text=await readPrivate(b.path);
  return res.status(200).json({ok:true,content:b.path.endsWith('.json')?JSON.parse(text.replace(/^\uFEFF/,'')):text});
 }catch(e){return contentError(e,res);}
}
