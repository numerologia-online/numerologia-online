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
      chapters.push({title:point.title, subtitle:bank.title || "", lead:bank.lead || "", parts, paragraphs:[]});
      continue;
    }
    const bank = energy.get(Number(point.number));
    const section = bank?.sections?.[point.section || point.id];
    const lines = paragraphsOf(section?.paragraphs);
    // Draft banks are still being edited; never publish them as a finished report.
    if (bank?.status !== "ready" || !lines.length) {
      missing.push(point.title); continue;
    }
    const key = lines.join("\n");
    const earlier = uniqueTexts.get(key);
    chapters.push({
      title:point.title,
      paragraphs:earlier ? ["Подробная трактовка этой темы приведена в главе «" + earlier + "»."] : lines,
      subtitle:"", lead:"", parts:[]
    });
    if (!earlier) uniqueTexts.set(key, point.title);
  }
  const birthday = [birth.day,birth.month].map(n=>String(n).padStart(2,"0")).join(".") + "." + birth.year;
  return {birthday, chapters, missing, total:definitions.length, ready:chapters.length===definitions.length};
}

export function childPdfDefinition(report) {
  if (!report?.ready) throw new Error("Полный PDF пока не готов: не все главы доступны.");
  const ink="#343041",forest="#294E42",gold="#B79B70",soft="#976E8D";
  const textBlocks=lines=>lines.map(t=>({text:t,style:"paragraph"}));
  const allChapters=report.chapters.flatMap((chapter,i)=>[
    {stack:[
      {text:"ГЛАВА "+String(i+1).padStart(2,"0"),style:"chapterKicker"},
      {text:chapter.title,style:"chapterTitle"},
      ...(chapter.subtitle?[{text:chapter.subtitle,style:"chapterSubtitle"}]:[])
    ],margin:[0,i===0?9:22,0,12]},
    ...(chapter.lead?[{text:chapter.lead,style:"chapterLead"}]:[]),
    ...textBlocks(chapter.paragraphs),
    ...chapter.parts.flatMap(part=>[
      {text:part.title,style:"partTitle"},
      ...textBlocks(part.paragraphs)
    ])
  ]);
  return {
    pageSize:"A4",pageMargins:[57,68,57,66],
    info:{title:"Всё о ребёнке - "+report.birthday,author:"Нумерология Онлайн"},
    background:()=>({canvas:[
      {type:"rect",x:21,y:21,w:553,h:800,lineWidth:.6,lineColor:"#D0B994"}
    ]}),
    watermark:{text:"9966",opacity:.045,color:"#DCC7BA",angle:0,fontSize:75},
    defaultStyle:{font:"Roboto",fontSize:11.4,color:ink,lineHeight:1.38},
    styles:{
      coverBrand:{fontSize:11,bold:true,color:gold,characterSpacing:2,alignment:"center",margin:[0,0,0,28]},
      coverTitle:{fontSize:38,bold:true,color:forest,alignment:"center",margin:[0,0,0,18]},
      coverSubtitle:{fontSize:15.5,color:soft,alignment:"center",lineHeight:1.25,margin:[0,0,0,30]},
      coverDate:{fontSize:15,bold:true,color:forest,alignment:"center"},
      coverNote:{fontSize:11,italics:true,color:"#64606C",alignment:"center",margin:[0,24,0,0]},
      toc:{fontSize:28,bold:true,color:forest,margin:[0,0,0,18]},
      tocItem:{fontSize:12.3,color:ink,margin:[0,0,0,9]},
      chapterKicker:{fontSize:10,bold:true,color:gold,characterSpacing:1.6,margin:[0,0,0,7]},
      chapterTitle:{fontSize:21,bold:true,color:forest,margin:[0,0,0,8]},
      chapterSubtitle:{fontSize:12.5,color:soft,margin:[0,0,0,10]},
      chapterLead:{fontSize:11.7,italics:true,color:soft,margin:[0,0,0,13]},
      partTitle:{fontSize:14,bold:true,color:soft,margin:[0,17,0,8]},
      paragraph:{fontSize:11.4,color:ink,lineHeight:1.4,margin:[0,0,0,12]},
      endTitle:{fontSize:22,bold:true,color:forest,alignment:"center",margin:[0,0,0,26]}
    },
    content:[
      {stack:[
        {text:"НУМЕРОЛОГИЯ ОНЛАЙН",style:"coverBrand"},
        {text:"Всё о ребёнке",style:"coverTitle"},
        {text:"Характер, таланты, воспитание,\nчувства и жизненные задачи",style:"coverSubtitle"},
        {text:"Дата рождения: "+report.birthday,style:"coverDate"},
        {text:"Персональный путеводитель по миру вашего ребёнка",style:"coverNote"}
      ],margin:[0,155,0,0],pageBreak:"after"},
      {text:"Содержание",style:"toc"},
      {text:report.chapters.length+" главы о вашем ребёнке",margin:[0,0,0,18],color:soft},
      ...report.chapters.map((chapter,index)=>({
        text:String(index+1).padStart(2,"0")+"   "+chapter.title,style:"tocItem"
      })),
      {text:"",pageBreak:"after"},
      ...allChapters,
      {stack:[
        {text:"НУМЕРОЛОГИЯ ОНЛАЙН",style:"coverBrand"},
        {text:"Ваш ребёнок - целый мир, который стоит узнавать",style:"endTitle"},
        {text:"Возвращайтесь к этому разбору по мере взросления ребёнка. Пусть он помогает замечать сильные стороны, понимать потребности и сохранять доверие в семье.",style:"paragraph"},
        {text:"С любовью, Татьяна ♡",color:soft,italics:true,margin:[0,25,0,22]},
        {text:"Наш сайт",style:"partTitle"},
        {text:"numerologia-online.github.io/numerologia-online/",color:forest,
          link:"https://numerologia-online.github.io/numerologia-online/",margin:[0,0,0,15]},
        {text:"Техподдержка: @Kod_9966",color:forest,link:"https://t.me/Kod_9966"}
      ],pageBreak:"before",margin:[0,50,0,0]}
    ],
    footer:(n,total)=>n===1?null:{
      columns:[
        {text:"НУМЕРОЛОГИЯ ОНЛАЙН",fontSize:8,color:gold},
        {text:n+" / "+total,alignment:"right",fontSize:8,color:gold}
      ],margin:[57,20,57,0]
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
export async function buildChildPdfBlob(report) {
  const pdfMake=await getPdfMake();
  if (!pdfMake?.createPdf) throw new Error("PDF-модуль не загрузился.");
  return new Promise((resolve,reject)=>{
    try { pdfMake.createPdf(childPdfDefinition(report)).getBlob(resolve); }
    catch(err) { reject(err); }
  });
}
