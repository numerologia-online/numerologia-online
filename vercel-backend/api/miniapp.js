import {prepare,bodyOf,telegramUser,isOwner} from '../lib/content-security.mjs';
export default function handler(req,res) {
 if(!prepare(req,res))return;
 try {
  const user=telegramUser(bodyOf(req).init_data);
  if(!user)return res.status(401).json({ok:false,error:'TELEGRAM_AUTH_REQUIRED'});
  return res.status(200).json({ok:true,user,owner:isOwner(user)});
 }catch{return res.status(400).json({ok:false,error:'INVALID_BODY'});}
}
