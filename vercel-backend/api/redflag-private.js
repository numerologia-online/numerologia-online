import {prepare,bodyOf,requireOwner,readPrivate,contentError} from '../lib/content-security.mjs';
export default async function handler(req,res) {
 if(!prepare(req,res))return;
 try {
  const b=bodyOf(req);if(!requireOwner(b,res))return;
  if(typeof b.path!=='string'||!b.path.startsWith('data/redflag/')||!b.path.endsWith('.json'))throw Error('INVALID_PATH');
  return res.status(200).json(JSON.parse((await readPrivate(b.path)).replace(/^\uFEFF/,'')));
 }catch(e){return contentError(e,res);}
}
