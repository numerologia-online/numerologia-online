// Matched to the working "Разбор года" iPhone PDF flow:
// on-page <dialog>, lazy PDF.js preview, native iOS file sharing and download.
// The existing protected Full Life PDF engine generates the identical PDF bytes.
let activeLifePdfPreview = null;
let pdfViewerPromise = null;

const getLifePdfViewer = () => {
  if (!pdfViewerPromise) {
    const build = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/legacy/build/";
    pdfViewerPromise = import(build + "pdf.min.mjs").then((viewer) => {
      viewer.GlobalWorkerOptions.workerSrc = build + "pdf.worker.min.mjs";
      return viewer;
    }).catch((error) => {
      pdfViewerPromise = null;
      throw error;
    });
  }
  return pdfViewerPromise;
};

const ensureLifePdfPreviewStyle = () => {
  if (document.getElementById("numi-life-pdf-preview-style-20261116")) return;
  const style = document.createElement("style");
  style.id = "numi-life-pdf-preview-style-20261116";
  // These classes mirror the already-working year/pdf-preview CSS and do
  // not change any other part of the site.
  style.textContent = [
    ".numi-life-pdf-preview {width:min(720px,100vw);height:min(920px,100dvh);margin:auto;padding:0;overflow:hidden;border:0;border-radius:24px;background:#eef1f4;box-shadow:0 28px 80px rgba(22,37,58,.34);color:#294b70;font-family:system-ui,-apple-system,sans-serif;z-index:2147483000}",
    ".numi-life-pdf-preview::backdrop {background:rgba(20,31,47,.62);backdrop-filter:blur(5px)}",
    ".numi-life-pdf-preview[open] {display:flex;flex-direction:column}",
    ".numi-life-pdf-preview-topbar {display:flex;flex-shrink:0;align-items:center;justify-content:space-between;min-height:62px;padding:0 17px 0 22px;border-bottom:1px solid rgba(130,107,62,.2);background:#fcfaf4}",
    ".numi-life-pdf-preview-topbar p {margin:0;color:#486682;font-size:11px;font-weight:800;letter-spacing:.13em}",
    ".numi-life-pdf-preview-topbar button {width:42px;height:42px;border:0;border-radius:50%;background:#edf2f6;color:#294b70;font:400 29px system-ui}",
    ".numi-life-pdf-preview-pages {flex:1;min-height:0;padding:14px;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;background:#e7edf3}",
    ".numi-life-pdf-preview-sheet {display:grid;place-items:center;max-width:595px;margin:0 auto 12px;background:#fffdf8;color:#486682;box-shadow:0 2px 10px rgba(22,37,58,.15)}",
    ".numi-life-pdf-preview-sheet canvas {display:block;width:100%;height:auto}",
    ".numi-life-pdf-preview-loading {display:grid;place-content:center;gap:10px;height:100%;padding:32px;color:#294b70;text-align:center}",
    ".numi-life-pdf-preview-actions {display:flex;flex-shrink:0;gap:12px;align-items:center;justify-content:center;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #d8d1c4;background:#fcfaf4}",
    ".numi-life-pdf-preview-actions button {flex:1;min-height:52px;padding:10px 14px;border:1px solid #a98b5b;border-radius:12px;background:#234a63;color:white;font:700 15px/1.25 system-ui}",
    ".numi-life-pdf-preview-actions button[hidden] {display:none}",
    ".numi-life-pdf-preview-actions button:disabled {opacity:.55}",
    "@media(max-width:699px){.numi-life-pdf-preview {width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;border-radius:0}.numi-life-pdf-preview-topbar {min-height:58px;padding:0 14px 0 16px}.numi-life-pdf-preview-pages {padding:10px}}"
  ].join("\n");
  document.head.append(style);
};

const node = (tag, className, contents = "") => {
  const element = document.createElement(tag);
  element.className = className;
  if (contents) element.textContent = contents;
  return element;
};

export function openFullReportPdfPanel({file, url, filename}) {
  // Keep permissions and PDF generation in the parent full-report controller.
  // Never make another entitlement request or generate an alternative PDF here.
  if (!(file instanceof File) || file.type !== "application/pdf" || !url || !filename) {
    throw new Error("Подготовленный PDF не найден");
  }
  activeLifePdfPreview?.close();
  ensureLifePdfPreviewStyle();

  const dialog = node("dialog", "numi-life-pdf-preview");
  dialog.setAttribute("aria-label", "Просмотр и сохранение полного разбора жизни");
  const topbar = node("div", "numi-life-pdf-preview-topbar");
  const title = node("p", "", "ВАШ PDF-РАЗБОР");
  const closeButton = node("button", "", "←");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Вернуться к разбору");
  topbar.append(title, closeButton);

  const pages = node("div", "numi-life-pdf-preview-pages");
  pages.setAttribute("role", "region");
  pages.setAttribute("tabindex", "0");
  pages.setAttribute("aria-label", "Страницы PDF");

  const actions = node("div", "numi-life-pdf-preview-actions");
  const shareButton = node("button", "", "Скачать PDF");
  shareButton.type = "button";
  actions.append(shareButton);
  dialog.append(topbar, pages, actions);
  document.body.append(dialog);

  const preview = {dialog, pages, visible:new Set(), rendered:new Set(), observer:null, canvasTask:null, loadingTask:null, document:null, rendering:false, closed:false};
  const setMessage = (message) => {
    const status = node("p", "numi-life-pdf-preview-loading", message);
    status.setAttribute("role", "status");
    pages.replaceChildren(status);
  };
  const cleanup = () => {
    if (preview.closed) return;
    preview.closed = true;
    preview.observer?.disconnect();
    preview.visible.clear();
    preview.canvasTask?.cancel();
    preview.loadingTask?.destroy().catch(()=>{});
    pages.replaceChildren();
    dialog.remove();
    if (activeLifePdfPreview===preview) activeLifePdfPreview=null;
  };
  const close = () => {
    if (dialog.open) dialog.close();
    else cleanup();
  };
  preview.close = close;
  activeLifePdfPreview=preview;
  closeButton.addEventListener("click",close);
  dialog.addEventListener("close",cleanup,{once:true});

  // Preserve the working native iOS share/download behavior in one button.
  // Fall back to a normal file download only in browsers without file sharing.
  const canShare = typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({files:[file]});
  shareButton.addEventListener("click",async()=>{
    if (shareButton.disabled) return;
    if (!canShare) {
      const link=document.createElement("a");
      link.href=url;
      link.download=filename;
      document.body.append(link);
      link.click();
      link.remove();
      return;
    }
    shareButton.disabled=true;
    try {
      await navigator.share({files:[file]});
    } catch (error) {
      if (error.name!=="AbortError") {
        alert("Не удалось открыть меню сохранения PDF.");
      }
    } finally {
      shareButton.disabled=false;
    }
  });

  dialog.showModal();
  setMessage("Открываю страницы PDF…");

  // The download controls work even if preview rendering cannot load.
  const renderPage = async (container) => {
    const page=await preview.document.getPage(Number(container.dataset.page));
    if (preview.closed || !preview.visible.has(container)) {
      page.cleanup();
      return;
    }
    const base=page.getViewport({scale:1});
    const scale=Math.min(container.clientWidth*Math.min(window.devicePixelRatio||1,2),1200)/base.width;
    const viewport=page.getViewport({scale});
    const canvas=document.createElement("canvas");
    canvas.width=Math.ceil(viewport.width);
    canvas.height=Math.ceil(viewport.height);
    canvas.setAttribute("role","img");
    canvas.setAttribute("aria-label","Страница "+container.dataset.page+" из "+preview.document.numPages);
    const task=page.render({canvas,viewport});
    preview.canvasTask=task;
    try {
      await task.promise;
      if (!preview.closed && preview.visible.has(container)) {
        container.replaceChildren(canvas);
        preview.rendered.add(container);
      }
    } finally {
      preview.canvasTask=null;
      page.cleanup();
    }
  };
  const renderVisiblePages=async()=>{
    if (preview.rendering || preview.closed) return;
    preview.rendering=true;
    try {
      while (!preview.closed) {
        const next=[...preview.visible].find(sheet=>!preview.rendered.has(sheet));
        if (!next) break;
        try {
          await renderPage(next);
        } catch(error) {
          if (preview.closed) return;
          console.error("Не удалось показать страницу PDF:",error);
          next.textContent="Не удалось показать страницу.";
          preview.rendered.add(next);
        }
      }
    } finally {
      preview.rendering=false;
    }
  };
  void (async()=>{
    const viewer=await getLifePdfViewer();
    if (preview.closed) return;
    const data=new Uint8Array(await file.arrayBuffer());
    if (preview.closed) return;
    preview.loadingTask=viewer.getDocument({data,isEvalSupported:false,useWorkerFetch:false,enableXfa:false});
    preview.document=await preview.loadingTask.promise;
    if (preview.closed) return;
    const first=await preview.document.getPage(1);
    if (preview.closed) return;
    const size=first.getViewport({scale:1});
    first.cleanup();
    const sheets=Array.from({length:preview.document.numPages},(_,i)=>{
      const sheet=node("div","numi-life-pdf-preview-sheet");
      sheet.dataset.page=String(i+1);
      sheet.style.aspectRatio=size.width+" / "+size.height;
      return sheet;
    });
    pages.replaceChildren(...sheets);
    pages.scrollTop=0;
    preview.observer=new IntersectionObserver(entries=>{
      if (preview.closed) return;
      for (const entry of entries) {
        const sheet=entry.target;
        if (entry.isIntersecting) preview.visible.add(sheet);
        else {
          preview.visible.delete(sheet);
          if (preview.rendered.delete(sheet)) sheet.replaceChildren();
        }
      }
      void renderVisiblePages();
    },{root:pages,rootMargin:"240px 0px"});
    sheets.forEach(sheet=>preview.observer.observe(sheet));
  })().catch((error)=>{
    if (preview.closed) return;
    console.error("Не удалось отобразить страницы PDF:",error);
    setMessage("Не удалось показать страницы. Готовый PDF можно сохранить или отправить кнопками внизу.");
  });
}
