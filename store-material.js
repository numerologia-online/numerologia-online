/* Material viewer within the existing cabinet. Every open/download rechecks the entitlement. */
let pdfLoader;
const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
async function request(id){
 const response=await fetch('/api/numi-account.php',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'material',entitlement_id:id})});
 const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'MATERIAL_UNAVAILABLE');return data.material;
}
async function pdfMake(){
 if(window.pdfMake?.createPdf&&window.pdfMake.vfs)return window.pdfMake;
 pdfLoader ||= (async()=>{for(const url of ['https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js','https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js'])await new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=url;tag.onload=resolve;tag.onerror=reject;document.head.append(tag);});return window.pdfMake;})().catch(error=>{pdfLoader=null;throw error;});
 return pdfLoader;
}
export async function openMaterial(container,id){
 container.replaceChildren(node('p','Открываем приобретённый материал…'));
 try{
  const material=await request(id);container.replaceChildren(node('h3',material.title));
  for(const section of material.sections){const article=node('article');article.append(node('h4',section.title));for(const p of section.paragraphs)article.append(node('p',p));container.append(article);}
  for(const link of material.links||[]){if(!link.url.startsWith('/')||link.url.startsWith('//'))continue;const a=node('a',link.title);a.href=link.url;container.append(a);}
  if(material.pdf_available){const download=node('button','Скачать PDF');download.type='button';download.onclick=async()=>{
   download.disabled=true;
   try{const current=await request(id);const engine=await pdfMake();const content=[{text:current.title,fontSize:22,bold:true,margin:[0,0,0,20]}];
    for(const section of current.sections){content.push({text:section.title,fontSize:16,bold:true,margin:[0,15,0,8]});for(const p of section.paragraphs)content.push({text:p,margin:[0,0,0,9]});}
    engine.createPdf({pageSize:'A4',pageMargins:[45,45,45,45],defaultStyle:{font:'Roboto',fontSize:11,lineHeight:1.3},content}).download('numerologia-'+id+'.pdf');
   }catch(_){container.append(node('p','PDF недоступен. Проверьте доступ и попробуйте снова.'));}finally{download.disabled=false;}
  };container.append(download);}
 }catch(error){container.replaceChildren(node('p',error.message==='PROFILE_BIRTH_REQUIRED'?'Укажите дату рождения в личном кабинете, чтобы получить ритуалы с вашим личным кодом.':'Материал недоступен: проверьте срок доступа или повторите запрос позже.'));}
}
