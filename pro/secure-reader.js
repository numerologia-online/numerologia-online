/* Full-life only: read original protected authored files after server authentication.
   No purchase bypass, no edited bank copy, no changes to other products. */
const pending = new Map();
function reportBirth(){
  const input=document.querySelector("#pro-birth-date");
  const match=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(input?.value?.trim()||"");
  if(!match)throw new Error("PRO_BIRTH_REQUIRED");
  return match[3]+"-"+match[2]+"-"+match[1];
}
async function load(kind,params={},textMode=false){
  const birth_date=reportBirth();
  const body={kind,birth_date,...params};
  const key=JSON.stringify(body);
  if(!pending.has(key)){
    const req=fetch("pro/private-content.php",{
      method:"POST",credentials:"same-origin",cache:"no-store",
      headers:{"Content-Type":"application/json","Accept":textMode?"text/plain":"application/json"},
      body:JSON.stringify(body)
    }).then(async response=>{
      if(!response.ok){
        let error="";
        try{error=(await response.json()).error||"";}catch(_){}
        throw new Error("PRO_PROTECTED_SOURCE_"+response.status+"_"+error);
      }
      return textMode?response.text():response.json();
    }).catch(error=>{pending.delete(key);throw error;});
    pending.set(key,req);
  }
  return pending.get(key);
}
export const readProJson=(kind,params={})=>load(kind,params,false);
export const readProText=(kind,params={})=>load(kind,params,true);
export const loadProtectedFullReportSection=energy=>
  readProJson("section",{energy:Number(energy)});
