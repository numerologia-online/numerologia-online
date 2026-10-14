"use strict";
/* Guarded activation: fixed webhook URL, cannot override another service. */
const crypto = require("node:crypto");
const API = "https://api.telegram.org";
const WEBHOOK_URL = "https://numerologia-online-auth-server.vercel.app/api/telegram";
const ORIGIN = "https://numerologia-online-auth-server.vercel.app";
const pick = token => process.env.TELEGRAM_WEBHOOK_SECRET ||
  crypto.createHash("sha256").update("numerologia-online:webhook:v1:").update(token).digest("hex");
const page = "<!doctype html>\n<html lang=\"ru\"><meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Подключение приветствия Telegram</title>\n<style>body{font:16px/1.5 system-ui,sans-serif;background:#f5f5ef;color:#154432;margin:0}main{max-width:460px;margin:12vh auto;padding:24px;background:white;border-radius:20px}h1{font-size:23px}button{display:block;width:100%;border:0;border-radius:14px;background:#176149;color:white;padding:15px;font:700 16px system-ui}#result{white-space:pre-wrap;margin-top:12px}</style>\n<main><h1>Приветствие Telegram-бота</h1><p>Эта кнопка подключит приветствие к <b>@Numerologiaonline_bot</b> после добавления <b>TELEGRAM_BOT_TOKEN</b> в Vercel.</p><p>Если у бота уже есть другой webhook, он не будет заменён.</p><button id=\"activate\">Подключить приветствие</button><div id=\"result\" role=\"status\"></div></main>\n<script>\ndocument.getElementById(\"activate\").addEventListener(\"click\",async function(){\nthis.disabled=true;\nconst out=document.getElementById(\"result\");out.textContent=\"Проверяем...\";\ntry{\nconst res=await fetch(location.pathname,{method:\"POST\",headers:{\"Content-Type\":\"application/json\"},body:\"{}\"});\nconst d=await res.json();\nout.textContent=d.ok?\"Готово! Проверьте /start в боте.\":\"Не подключено: \"+(d.error||\"Ошибка.\");\n}catch(e){out.textContent=\"Нет связи с сервером.\"}\nthis.disabled=false;\n});\n</script></html>";

module.exports = async function activate(req, res) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(page);
  }
  if (req.method !== "POST") return res.status(405).json({ok:false,error:"METHOD"});
  if (req.headers.origin !== ORIGIN) return res.status(403).json({ok:false,error:"ORIGIN"});
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ok:false,error:"Сначала добавьте TELEGRAM_BOT_TOKEN в Vercel и опубликуйте обновление."});
  try {
    const infoRes = await fetch(API+"/bot"+token+"/getWebhookInfo",{signal:AbortSignal.timeout(8000)});
    const info = await infoRes.json();
    if (!infoRes.ok || !info.ok) return res.status(503).json({ok:false,error:"Не удалось проверить настройки бота. Проверьте токен."});
    const existing = String(info.result?.url||"");
    if (existing && existing !== WEBHOOK_URL) {
      return res.status(409).json({ok:false,error:"У бота уже есть другой webhook. Ничего не изменено."});
    }
    if (existing === WEBHOOK_URL) return res.status(200).json({ok:true,alreadyActive:true});
    const configured = await fetch(API+"/bot"+token+"/setWebhook",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({url:WEBHOOK_URL,secret_token:pick(token),
        allowed_updates:["message"],drop_pending_updates:false}),
      signal:AbortSignal.timeout(8000)
    });
    const answer=await configured.json();
    if (!configured.ok||!answer.ok) return res.status(502).json({ok:false,error:"Telegram отклонил подключение."});
    return res.status(200).json({ok:true,alreadyActive:false});
  } catch (error) {
    console.error("Telegram setup failed",error?.message||"unknown");
    return res.status(503).json({ok:false,error:"Нет связи с Telegram."});
  }
};