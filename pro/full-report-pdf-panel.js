// Full life PDF preview: safe bottom Save/Share controls inside Telegram's WebView.
// PDF content is created by the original controller; no upload or entitlement changes.
export function openFullReportPdfPanel({file,url,filename}) {
  const panel = document.createElement("section");
  panel.setAttribute("role","dialog");
  panel.setAttribute("aria-modal","true");
  panel.setAttribute("aria-label","Полный разбор жизни, просмотр PDF");
  panel.style.cssText="position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#f8f5ed;color:#1c394d;font-family:system-ui,-apple-system,sans-serif";
  const top=document.createElement("header");
  top.style.cssText="flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 12px;background:white;border-bottom:1px solid #e1d7c8";
  const title=document.createElement("strong");
  title.textContent="Полный разбор жизни · PDF";
  title.style.fontSize="15px";
  const closeButton=document.createElement("button");
  closeButton.type="button";
  closeButton.textContent="Закрыть ✕";
  closeButton.style.cssText="border:1px solid #d8cdb9;border-radius:10px;background:white;padding:10px 12px;color:#1c394d;font:600 14px system-ui";
  top.append(title,closeButton);
  const pages=document.createElement("main");
  pages.style.cssText="flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px";
  const status=document.createElement("p");
  status.textContent="Открываю страницы PDF…";
  status.setAttribute("role","status");
  status.style.cssText="padding:40px 10px;color:#536a77;text-align:center;font-size:15px";
  pages.append(status);
  const bottom=document.createElement("footer");
  bottom.style.cssText="flex:none;display:flex;gap:10px;padding:12px 12px calc(14px + env(safe-area-inset-bottom,0px));background:white;border-top:1px solid #dbcdb8;box-shadow:0 -4px 16px #00000012";
  const share=document.createElement("button");
  share.type="button";
  share.textContent="Сохранить / отправить";
  share.style.cssText="flex:2;min-height:52px;border:0;border-radius:11px;background:#19394f;color:white;font:700 15px system-ui";
  const download=document.createElement("button");
  download.type="button";
  download.textContent="Скачать";
  download.style.cssText="flex:1;min-height:52px;border:1px solid #baa783;border-radius:11px;background:#f9f5eb;color:#19394f;font:700 14px system-ui";
  bottom.append(share,download);
  panel.append(top,pages,bottom);
  const previousOverflow=document.documentElement.style.overflow;
  document.documentElement.style.overflow="hidden";
  document.body.append(panel);
  let closed=false, observer=null, loadingTask=null, task=null;
  const visible=new Set(), rendered=new Set();
  const close=()=>{
    if(closed)return;
    closed=true;
    observer?.disconnect();
    task?.cancel();
    loadingTask?.destroy().catch(()=>{});
    panel.remove();
    document.documentElement.style.overflow=previousOverflow;
  };
  closeButton.addEventListener("click",close);
  const saveFile=()=>{
    const a=document.createElement("a");
    a.href=url;
    a.download=filename;
    a.rel="noopener";
    document.body.append(a);
    a.click();
    a.remove();
  };
  download.addEventListener("click",saveFile);
  share.addEventListener("click",async()=>{
    if(share.disabled)return;
    share.disabled=true;
    try{
      if(typeof navigator.share==="function" &&
         typeof navigator.canShare==="function" &&
         navigator.canShare({files:[file]})){
        // Native iOS menu contains "Save to Files" and messaging apps.
        await navigator.share({files:[file]});
      }else{
        saveFile();
        alert("Системное меню сохранения недоступно в этом браузере. Используйте «Скачать».");
      }
    }catch(error){
      if(error?.name!=="AbortError"){
        console.error("PDF share error:",error);
        alert("Не удалось открыть меню сохранения. Попробуйте «Скачать».");
      }
    }finally{share.disabled=false;}
  });

  // Draw pages progressively: a 125-page PDF must not allocate 125 canvases.
  void (async()=>{
    const base="https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/legacy/build/";
    const pdfjs=await import(base+"pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc=base+"pdf.worker.min.mjs";
    if(closed)return;
    loadingTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useWorkerFetch:false,enableXfa:false});
    const doc=await loadingTask.promise;
    if(closed)return;
    const first=await doc.getPage(1), size=first.getViewport({scale:1});
    first.cleanup();
    if(closed)return;
    const sheets=Array.from({length:doc.numPages},(_,i)=>{
      const sheet=document.createElement("article");
      sheet.dataset.page=String(i+1);
      sheet.style.cssText="width:100%;max-width:720px;margin:0 auto 14px;background:white;box-shadow:0 1px 7px #0002;overflow:hidden";
      sheet.style.aspectRatio=size.width+" / "+size.height;
      sheet.setAttribute("aria-label","Страница "+(i+1)+" из "+doc.numPages);
      return sheet;
    });
    pages.replaceChildren(...sheets);
    let drawing=false;
    const render=async()=>{
      if(drawing||closed)return;
      drawing=true;
      try{
        while(!closed){
          const sheet=[...visible].find(s=>!rendered.has(s));
          if(!sheet)break;
          const page=await doc.getPage(Number(sheet.dataset.page));
          if(closed){page.cleanup();break;}
          const baseViewport=page.getViewport({scale:1});
          const scale=Math.min((sheet.clientWidth*Math.min(window.devicePixelRatio||1,2))/baseViewport.width,2);
          const viewport=page.getViewport({scale:Math.max(scale,0.2)});
          const canvas=document.createElement("canvas");
          canvas.width=Math.ceil(viewport.width);
          canvas.height=Math.ceil(viewport.height);
          canvas.style.cssText="display:block;width:100%;height:auto";
          try{
            task=page.render({canvasContext:canvas.getContext("2d"),viewport});
            await task.promise;
            if(!closed&&visible.has(sheet)){
              sheet.replaceChildren(canvas);
              rendered.add(sheet);
            }
          }catch(error){
            if(!closed&&error?.name!=="RenderingCancelledException"){
              sheet.textContent="Не удалось показать страницу.";
              rendered.add(sheet);
            }
          }finally{task=null;page.cleanup();}
        }
      }finally{drawing=false;}
    };
    observer=new IntersectionObserver(entries=>{
      if(closed)return;
      for(const entry of entries){
        const sheet=entry.target;
        if(entry.isIntersecting)visible.add(sheet);
        else{
          visible.delete(sheet);
          if(rendered.delete(sheet))sheet.replaceChildren();
        }
      }
      void render();
    },{root:pages,rootMargin:"240px 0px"});
    sheets.forEach(sheet=>observer.observe(sheet));
  })().catch(error=>{
    if(closed)return;
    console.warn("PDF preview unavailable:",error);
    status.textContent="Страницы не удалось показать внутри Telegram. Готовый PDF можно сохранить или отправить кнопками внизу.";
    pages.replaceChildren(status);
  });
}
