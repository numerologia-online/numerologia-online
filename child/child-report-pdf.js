// Lightweight text-only PDF for the full child matrix. The data is always
// read from the same authored energy/tail sources used by the interactive site.
const paragraphsOf = (source) => Array.isArray(source)
  ? source.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim()) : [];

export async function collectChildPdf(birth, definitions, loadEnergy, loadTail) {
  if (!birth || !definitions?.length) throw new Error("Сначала рассчитайте матрицу ребёнка.");
  const needed = [...new Set(definitions.filter(x => x.id !== "tail").map(x => Number(x.number)))];
  const requests = await Promise.all(needed.map(async n => {
    try { return [n, await loadEnergy(n)]; } catch { return [n, null]; }
  }));
  const energy = new Map(requests);
  const tail = definitions.find(x => x.id === "tail");
  let tailResult = null;
  if (tail) {
    try { tailResult = await loadTail(String(tail.code || "").replace(/\s*-\s*/g, "-")); }
    catch { tailResult = {state:"error"}; }
  }
  const chapters = [], missing = [], uniqueTexts = new Map();
  for (const point of definitions) {
    if (point.id === "tail") {
      const bank = tailResult?.state === "ready" ? tailResult.bank : null;
      const parts = bank?.sections?.map(p => ({title:p.title, paragraphs:paragraphsOf(p.paragraphs)})) || [];
      if (!parts.length || parts.some(p => !p.title || !p.paragraphs.length)) {
        missing.push(point.title); continue;
      }
      chapters.push({id:point.id, title:point.title, subtitle:bank.title || "", lead:bank.lead || "", parts, paragraphs:[]});
      continue;
    }
    const bank = energy.get(Number(point.number));
    const section = bank?.sections?.[point.section || point.id];
    const lines = paragraphsOf(section?.paragraphs);
    // Draft banks are still being edited; never publish them as a finished report.
    if (!["ready", "complete"].includes(bank?.status) || !lines.length) {
      missing.push(point.title); continue;
    }
    const key = lines.join("\n");
    const earlier = uniqueTexts.get(key);
    chapters.push({
      id:point.id, title:point.title,
      paragraphs:earlier ? ["Подробная трактовка этой темы приведена в главе «" + earlier + "»."] : lines,
      subtitle:"", lead:"", parts:[]
    });
    if (!earlier) uniqueTexts.set(key, point.title);
  }
  const birthday = [birth.day,birth.month].map(n=>String(n).padStart(2,"0")).join(".") + "." + birth.year;
  const topics = definitions.map(point => ({id:point.id, title:point.title}));
  return {birthday, chapters, topics, missing, total:definitions.length, ready:chapters.length===definitions.length};
}

// Minimal vector stationery: cream paper, paired gold borders, tiny brand motif.
// No photos, fonts, or raster backgrounds are embedded on individual pages.
const childPaperSvg = String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="595" height="842" viewBox="0 0 595 842">
  <defs>
    <radialGradient id="childPaper" cx="43%" cy="19%" r="92%">
      <stop offset="0%" stop-color="#FFFEFA"/>
      <stop offset="70%" stop-color="#FCFAF5"/>
      <stop offset="100%" stop-color="#F8F2E9"/>
    </radialGradient>
  </defs>
  <rect width="595" height="842" fill="url(#childPaper)"/>
  <rect x="19" y="19" width="557" height="804" rx="8" fill="none" stroke="#C5A15D" stroke-width=".78"/>
  <rect x="27" y="27" width="541" height="788" rx="6" fill="none" stroke="#E4D7BB" stroke-width=".32"/>
  <g fill="none" stroke="#C5A15D" stroke-width=".7" opacity=".37">
    <path d="M35 50H128 M467 50H560 M35 792H128 M467 792H560"/>
    <path d="M46 73Q48 48 76 44 M549 73Q546 48 519 44"/>
    <path d="M46 769Q48 793 76 798 M549 769Q546 793 519 798"/>
    <circle cx="75" cy="117" r="27" opacity=".17"/>
    <circle cx="75" cy="117" r="39" opacity=".11" stroke-dasharray="3 6"/>
  </g>
  <g fill="#BA9A61" opacity=".42">
    <circle cx="297.5" cy="34" r="1.8"/>
    <circle cx="289" cy="34" r=".9"/>
    <circle cx="306" cy="34" r=".9"/>
    <circle cx="297.5" cy="808" r="1.8"/>
  </g>
  <g fill="#B89B6A" font-family="Arial,sans-serif" text-anchor="middle" opacity=".19">
    <text x="297.5" y="808" font-size="10" letter-spacing="5">9 · 9 · 6 · 6</text>
  </g>
</svg>`;

const childCoverOrnament = String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="104" height="74" viewBox="0 0 104 74">
  <g fill="none" stroke="#BC9A62">
    <circle cx="52" cy="37" r="31" stroke-width=".85" opacity=".63"/>
    <circle cx="52" cy="37" r="25" stroke-width=".45" stroke-dasharray="2 5" opacity=".65"/>
    <path d="M52 12 L58 37 L52 62 L46 37Z" stroke-width=".7"/>
    <path d="M27 37 H77 M52 7 V17 M52 57 V67" stroke-width=".55"/>
  </g>
  <g fill="#BA9561">
    <circle cx="52" cy="37" r="3.5"/>
    <circle cx="52" cy="4" r="1.5"/>
    <circle cx="20" cy="37" r="1.5"/>
    <circle cx="84" cy="37" r="1.5"/>
  </g>
</svg>`;

// Serif vector lettering uses the same refined headline treatment as the year PDF.
// Remains lightweight and requires no extra font download.
const childCoverLettering = String.raw`<svg xmlns="http://www.w3.org/2000/svg" width="472" height="131" viewBox="0 0 472 131">
  <g text-anchor="middle">
    <text x="236.8" y="82" font-family="Georgia, 'Times New Roman', serif" font-size="61" font-weight="700" fill="#CDBB9A" opacity=".50">Всё о ребёнке</text>
    <text x="235.5" y="80.5" font-family="Georgia, 'Times New Roman', serif" font-size="61" font-weight="700" fill="#24473D">Всё о ребёнке</text>
  </g>
  <g stroke="#BE9A5F" stroke-width=".82" fill="none" opacity=".8">
    <path d="M65 110H207 M265 110H407"/>
    <path d="M236 104L241 110L236 116L231 110Z"/>
  </g>
</svg>`;

export function childPdfDefinition(report, {preview=false}={}) {
  const draft = Boolean(preview && report && !report.ready);
  if (!report?.ready && !draft) throw new Error("Полный PDF пока не готов: не все главы доступны.");
  if (draft && !report.topics?.length) throw new Error("Нет данных для предварительного PDF.");
  const ink="#304052",forest="#24473D",gold="#AA854D",soft="#976E8D",muted="#65717C";
  const paragraphsOfChapter = lines => lines.map(line => ({text:line,style:"paragraph"}));
  const byId=new Map(report.chapters.map(chapter=>[chapter.id,chapter]));
  const displayedChapters=draft ? report.topics.map(topic=>byId.get(topic.id) || {
    id:topic.id,title:topic.title,subtitle:"В РАБОТЕ",lead:"",
    paragraphs:["Этот раздел пока не готов. Его авторская трактовка появится в окончательном разборе."],
    parts:[],pending:true
  }) : report.chapters;
  const chapterContents=displayedChapters.flatMap((chapter,index)=>[
    {stack:[
      {text:"ГЛАВА "+String(index+1).padStart(2,"0"),style:"chapterKicker"},
      {text:chapter.title,style:"chapterTitle"},
      ...(chapter.subtitle?[{text:chapter.subtitle,style:"chapterSubtitle"}]:[]),
      {canvas:[{type:"line",x1:0,y1:0,x2:445,y2:0,lineWidth:.65,lineColor:"#D6BF92"}],
       margin:[0,7,0,4]}
    ],unbreakable:true,margin:[0,index===0?12:21,0,11]},
    ...(chapter.lead?[{text:chapter.lead,style:"chapterLead"}]:[]),
    ...paragraphsOfChapter(chapter.paragraphs),
    ...chapter.parts.flatMap(part=>[
      {text:part.title,style:"partTitle"},
      ...paragraphsOfChapter(part.paragraphs)
    ])
  ]);
  const tocItems=displayedChapters.map((chapter,index)=>({
    columns:[
      {text:String(index+1).padStart(2,"0"),width:40,color:gold,bold:true,fontSize:16.8},
      {text:chapter.title+(chapter.pending?"  · В РАБОТЕ":""),color:ink,fontSize:17.2}
    ],
    columnGap:4,margin:[0,0,0,5]
  }));
  return {
    pageSize:"A4",
    pageMargins:[62,80,62,73],
    info:{title:(draft?"ЧЕРНОВИК - ":"")+"Всё о ребёнке - "+report.birthday,author:"Нумерология Онлайн"},
    background:()=>({svg:childPaperSvg}),
    watermark:{text:draft?"ЧЕРНОВИК":"9966",opacity:draft?.08:.027,color:"#D7C8B0",angle:0,fontSize:draft?54:65},
    defaultStyle:{font:"Roboto",fontSize:20.8,color:ink,lineHeight:1.38},
    styles:{
      coverBrand:{fontSize:16.5,bold:true,color:gold,characterSpacing:2.5,alignment:"center",margin:[0,0,0,20]},
      coverTitle:{fontSize:43,bold:true,color:forest,alignment:"center",lineHeight:1.07,margin:[0,0,0,17]},
      coverSubtitle:{fontSize:24,color:soft,alignment:"center",lineHeight:1.23,margin:[0,0,0,26]},
      coverDate:{fontSize:22.5,bold:true,color:forest,alignment:"center",margin:[0,0,0,16]},
      coverNote:{fontSize:17.4,italics:true,color:muted,alignment:"center",lineHeight:1.23,margin:[10,0,10,0]},
      coverFoot:{fontSize:11,bold:true,color:gold,characterSpacing:1.35,alignment:"center",margin:[0,0,0,0]},
      draftWarning:{fontSize:13,bold:true,color:"#9A336F",alignment:"center",lineHeight:1.3,margin:[0,22,0,0]},
      tocTitle:{fontSize:36,bold:true,color:forest,margin:[0,0,0,12]},
      tocIntro:{fontSize:16.8,color:soft,lineHeight:1.28,margin:[0,0,0,18]},
      chapterKicker:{fontSize:14.5,bold:true,color:gold,characterSpacing:1.7,margin:[0,0,0,10]},
      chapterTitle:{fontSize:34,bold:true,color:forest,lineHeight:1.12,margin:[0,0,0,10]},
      chapterSubtitle:{fontSize:19,color:soft,margin:[0,0,0,9]},
      chapterLead:{fontSize:20.8,italics:true,color:soft,lineHeight:1.37,margin:[0,0,0,21]},
      partTitle:{fontSize:25,bold:true,color:soft,lineHeight:1.18,margin:[0,24,0,14]},
      paragraph:{fontSize:20.8,color:ink,lineHeight:1.40,margin:[0,0,0,19]},
      endTitle:{fontSize:31,bold:true,color:forest,alignment:"center",lineHeight:1.14,margin:[0,0,0,25]}
    },
    content:[
      {stack:[
        {text:"НУМЕРОЛОГИЯ ОНЛАЙН",style:"coverBrand"},
        {svg:childCoverOrnament,width:100,height:72,alignment:"center",margin:[0,0,0,15]},
        {svg:childCoverLettering,width:470,height:131,alignment:"center",margin:[0,0,0,16]},
        {text:"Характер, таланты, воспитание,\nчувства и жизненные задачи",style:"coverSubtitle"},
        {text:"Дата рождения: "+report.birthday,style:"coverDate"},
        {text:"Персональный путеводитель по миру вашего ребёнка",style:"coverNote"},
        ...(draft?[{text:"ЧЕРНОВИК ДЛЯ ПРОВЕРКИ ОФОРМЛЕНИЯ\nНе отправлять клиентам как полный разбор.",style:"draftWarning"}]:[]),
        {canvas:[{type:"line",x1:52,y1:0,x2:419,y2:0,lineColor:"#D8C19B",lineWidth:.7}],
         margin:[0,20,0,0]}
      ],unbreakable:true,margin:[0,95,0,0],pageBreak:"after"},
      {text:"Содержание",style:"tocTitle"},
      {text:draft
        ? "Готово "+report.chapters.length+" из "+report.total+" глав. Остальные главы отмечены как находящиеся в работе."
        : report.chapters.length+" главы о вашем ребёнке. Возвращайтесь к нужным разделам в любое время.",
        style:"tocIntro"},
      ...tocItems,
      ...chapterContents,
      {stack:[
        {text:"НУМЕРОЛОГИЯ ОНЛАЙН",style:"coverBrand"},
        {text:"Ваш ребёнок - целый мир, который стоит узнавать",style:"endTitle"},
        {text:"Возвращайтесь к этому разбору по мере взросления ребёнка. Пусть он помогает замечать сильные стороны, понимать потребности и сохранять доверие в семье.",style:"paragraph"}
      ],margin:[0,26,0,0]}
    ],
    footer:(page,total)=>page===1?null:{
      columns:[
        {text:"НУМЕРОЛОГИЯ ОНЛАЙН",fontSize:9.2,color:gold},
        {text:page+" / "+total,alignment:"right",fontSize:9.2,color:gold}
      ],margin:[62,23,62,0]
    }
  };
}

let pdfMakeLoading;
function externalScript(url) {
  return new Promise((resolve,reject)=>{
    const node=document.createElement("script");
    node.src=url;node.async=true;node.onload=resolve;
    node.onerror=()=>reject(new Error("Не удалось загрузить PDF-модуль. Проверьте подключение."));
    document.head.append(node);
  });
}
function getPdfMake() {
  if (window.pdfMake?.createPdf) return Promise.resolve(window.pdfMake);
  if (!pdfMakeLoading) pdfMakeLoading=externalScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/pdfmake.min.js")
    .then(()=>externalScript("https://cdn.jsdelivr.net/npm/pdfmake@0.2/build/vfs_fonts.js"))
    .then(()=>window.pdfMake)
    .catch(error=>{pdfMakeLoading=null;throw error;});
  return pdfMakeLoading;
}
// As in the annual report, load PDFMake while the reader is viewing the result.
export const preloadChildPdfEngine = () => getPdfMake();

export async function buildChildPdfBlob(report, options={}) {
  const pdfMake=await getPdfMake();
  if (!pdfMake?.createPdf) throw new Error("PDF-модуль не загрузился.");
  return new Promise((resolve,reject)=>{
    try { pdfMake.createPdf(childPdfDefinition(report, options)).getBlob(resolve); }
    catch(err) { reject(err); }
  });
}
