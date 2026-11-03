import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = file => readFile(new URL("../" + file, import.meta.url), "utf8");

test("Original school layout and simple trainer are restored without the new construction player", async () => {
  const home = await read("pro/school/index.html");
  const script = await read("pro/school/school.js");
  const originalPoints = await read("pro/school/points.js");
  assert.match(home, /id="school-train-point"/);
  assert.match(home, /id="school-train-answer"/);
  assert.match(home, /id="school-train-feedback"/);
  assert.match(script, /import \{ pointCatalog \} from "\.\/points\.js\?v=3"/);
  assert.match(script, /function renderTrainer\(\)/);
  assert.match(script, /function buildFormulaSheet\(birth\)/);
  assert.doesNotMatch(script, /mountConstruction/);
  assert.doesNotMatch(home, /pro\/school\/learning\.css/);
  assert.match(originalPoints, /export const pointCatalog\s*=\s*baseline\.map\(/);
  assert.match(home, /31 точка по шагам/);
});

test("First school lesson starts with an empty hand-drawn matrix and no digit exercises", async () => {
  const lesson = JSON.parse(await read("pro/school/lessons/start.json"));
  const page = await read("pro/school/lesson/index.html");
  const source = await read("pro/school/lesson/lesson.js");
  assert.match(lesson.lead, /Числа и формулы будем изучать позже/);
  assert.match(lesson.sections.at(-1).text, /не нужно запоминать значение/);
  assert.match(page, /id="lesson-step-title"/);
  assert.match(page, /id="lesson-step-next"/);
  assert.match(source, /function drawFirstLessonOutline\(\)/);
  assert.match(source, /На этом шаге никаких цифр/);
  assert.match(source, /if\(id==="start"\)/);
  assert.match(source, /\$\("lesson-date-form"\)\.hidden=true/);
  assert.doesNotMatch(source, /mountLessonGuide|mountConstruction/);
});

test("Matrix lesson two teaches the rule first, then computes 31.10.1988 without requesting personal data", async () => {
  const script = await read("pro/school/lesson/lesson.js");
  const {calculateMatrix,reduce22}=await import("../numerology-core.js");
  const example=calculateMatrix({day:31,month:10,year:1988});
  assert.equal(example.left,4,"31 becomes 4");
  assert.equal(example.top,10,"10 is preserved");
  assert.equal(example.right,8,"1988 becomes 26 then 8");
  assert.equal(reduce22(22),22);
  assert.equal(reduce22(23),5);
  assert.match(script, /Какие числа оставляем, а какие сокращаем/);
  assert.match(script, /Разбираем дату 31\.10\.1988/);
  assert.match(script, /Любое число в этом диапазоне оставляем как есть/);
  assert.match(script, /Слева — день 31/);
  assert.match(script, /31 больше 22, поэтому 3 \+ 1 = 4/);
  assert.match(script, /Сверху — месяц 10/);
  assert.match(script, /10 не больше 22, поэтому оставляем 10/);
  assert.match(script, /Справа — год 1988/);
  assert.match(script, /1 \+ 9 \+ 8 \+ 8 = 26/);
  assert.match(script, /\$\("lesson-date-form"\)\.hidden=true/);
  assert.match(script, /if\(exampleStep\)drawBasic\(calculateMatrix\(\{day:31,month:10,year:1988\}\)\)/);
  assert.doesNotMatch(script, /Обязательно введите дату рождения ниже/);
});

test("Fifth Matrix lesson highlights exactly the chosen axis, diagonal or money/love calculation", async () => {
  const source=await read("pro/school/lesson/lesson.js");
  const {calculateMatrix,reduce22}=await import("../numerology-core.js");
  const {nodesFor}=await import("../pro/pro-points.js");
  const config=source.match(/const internalSelections=\{[\s\S]*?\n\};/)?.[0];
  assert.ok(config,"Choose within existing five steps");
  const selections=Function(config+";return internalSelections;")();
  assert.deepEqual([1,2,4].map(step=>selections[step].length),[3,4,5]);
  assert.match(source,/button\.setAttribute\("aria-pressed",String\(active\)\)/);
  assert.match(source,/root\.style\.display="none"/);
  assert.match(source,/const focus=id==="internal"\?getInternalFocus\(\):\[\]/);
  assert.match(source,/\$\("lesson-drawing"\)\.querySelector\("\.school-visual-grid"\)\.before\(root\)/);
  assert.match(source,/if\(id==="internal"\)internalDetail=0/);
  assert.match(source,/\["1\. Средняя:",compactSumFormula\(\[base,m\.center\],part\.near\)\]/);
  assert.match(source,/\["2\. Внешняя:",compactSumFormula\(\[base,part\.near\],part\.outer\)\]/);
  assert.match(source,/\["3\. Ближе к центру:",compactSumFormula\(\[part\.near,m\.center\],part\.core\)\]/);
  assert.match(source,/\["1\. Внутренняя:",compactSumFormula\(\[base,m\.center\],part\.near\)\]/);
  assert.match(source,/marker\.textContent=isMoney\?"\$":"♥"/);
  for(const birth of [
    {day:14,month:7,year:1990},{day:9,month:9,year:1986},
    {day:31,month:10,year:1988},{day:22,month:11,year:2009},
    {day:29,month:12,year:1979}
  ]){
    const m=calculateMatrix(birth);
    const nodes=new Map(nodesFor(birth,m).map(p=>[p.key,p.value]));
    assert.equal(nodes.size,31);
    for(const group of [1,2,4])for(const selection of selections[group]){
      for(const point of selection.keys)
        assert.ok(nodes.has(point),"All focused positions exist: "+point);
      assert.ok(selection.keys.includes("center")||group===4);
      if(group===1){
        const part=m[selection.spoke],start=m[selection.base];
        assert.equal(part.near,reduce22(start+m.center));
        assert.equal(part.outer,reduce22(start+part.near));
        assert.equal(part.core,reduce22(part.near+m.center));
      }
      if(group===2){
        const part=m.diagonals[selection.corner],start=m.corners[selection.corner];
        assert.equal(part.near,reduce22(start+m.center));
        assert.equal(part.outer,reduce22(start+part.near));
      }
    }
    assert.equal(nodes.get("rightNear"),m.channels.moneyEntry);
    assert.equal(nodes.get("tailFirst"),m.channels.loveEntry);
    assert.equal(nodes.get("wellbeing"),m.channels.balance);
    assert.equal(nodes.get("moneyPoint"),m.channels.moneyPoint);
    assert.equal(nodes.get("loveHeart"),m.channels.lovePoint);
  }
  assert.deepEqual(selections[4].map(x=>x.keys.at(-1)),
    ["rightNear","tailFirst","wellbeing","moneyPoint","loveHeart"]);
});

test("Fifth lesson diagram has no empty 186-unit tail and keeps all 31 points in view", async () => {
  const source=await read("pro/school/lesson/lesson.js");
  const {calculateMatrix}=await import("../numerology-core.js");
  const {nodesFor}=await import("../pro/pro-points.js");
  assert.match(source,/viewBox:"0 0 620 620",role:"img","aria-label":"Все 31 позиции рассчитанной матрицы"/);
  assert.doesNotMatch(source,/viewBox:"0 0 620 806"/);
  assert.match(source,/viewBox:"0 0 400 400"/); // other lessons unchanged
  for(const date of [{day:9,month:9,year:1986},{day:31,month:10,year:1988},{day:14,month:7,year:1990}]){
    const points=nodesFor(date,calculateMatrix(date));
    assert.equal(points.length,31);
    for(const point of points){
      assert.ok(point.x>=34&&point.x<=586,"x remains within diagram: "+point.key);
      assert.ok(point.y>=34&&point.y<=586,"y remains within diagram: "+point.key);
    }
  }
});

test("Fifth lesson second step describes where every number goes for the selected axis", async () => {
  const source=await read("pro/school/lesson/lesson.js");
  const match=source.match(/function guidedText\(isFull\)\{[\s\S]*?\n\}/);
  assert.ok(match,"Only the existing step description is updated");
  const {calculateMatrix}=await import("../numerology-core.js");
  const format=(values)=> {
    const total=values.reduce((a,b)=>a+b,0);
    let n=total,extra=[];
    while(n>22){n=String(n).split("").reduce((a,d)=>a+Number(d),0);extra.push(n)}
    return values.join(" + ")+" = "+total+extra.map(x=>" → "+x).join("");
  };
  const readText=Function("id","step","currentBirth","getInternalSelection","calculateMatrix","compactSumFormula",
    "internalStages","cornerStages","stepDescriptions",
    match[0]+";return guidedText(true)");
  const selections=[
    {label:"Верхняя ось",base:"top",spoke:"topSpoke"},
    {label:"Левая ось",base:"left",spoke:"leftSpoke"},
    {label:"Правая ось",base:"right",spoke:"rightSpoke"}
  ];
  for(const date of [{day:9,month:9,year:1986},{day:31,month:10,year:1988},{day:14,month:7,year:1990}])
    for(const selected of selections){
      const m=calculateMatrix(date),p=m[selected.spoke];
      const t=readText("internal",1,date,()=>selected,calculateMatrix,format,[],[],[]);
      assert.ok(t.includes(selected.label.toLowerCase()));
      assert.ok(t.includes("1. Складываем "+format([m[selected.base],m.center])));
      assert.ok(t.includes("2. Складываем "+format([m[selected.base],p.near])));
      assert.ok(t.includes("3. Складываем "+format([p.near,m.center])));
      assert.ok(t.includes([m[selected.base],p.outer,p.near,p.core,m.center].join(" → ")));
    }
  const top=readText("internal",1,{day:9,month:9,year:1986},()=>selections[0],calculateMatrix,format,[],[],[]);
  assert.match(top,/9 → 21 → 12 → 15 → 3/);
  assert.match(top,/Записываем 12 между крайним числом 9 и центром/);
  assert.match(top,/Записываем 21 между 9 и 12/);
  assert.match(top,/Записываем 15 между 12 и центром/);
});

test("Fifth Matrix lesson uses friendly line names without changing five formulas", async () => {
  const script=await read("pro/school/lesson/lesson.js");
  assert.match(script,/title:"Строим линии денег и любви"/);
  const labels=[
    "1. Начало денежной линии",
    "2. Начало линии любви",
    "3. Общая точка двух линий",
    "4. Денежная точка $",
    "5. Любовная точка ♥"
  ];
  labels.forEach(label=>assert.ok(script.includes('label:"'+label+'"'),label));
  for(const label of ["Начало денежной линии:","Начало линии любви:","Общая точка двух линий:","Денежная точка $:","Любовная точка ♥:"]){
    assert.ok(script.includes('["'+label+'",compactSumFormula('),"The calculated value stays linked to "+label);
  }
  assert.match(script,/\["Денежная точка \$:",compactSumFormula\(\[m\.channels\.moneyEntry,m\.channels\.balance\],m\.channels\.moneyPoint\)\]/);
  assert.match(script,/\["Любовная точка ♥:",compactSumFormula\(\[m\.channels\.loveEntry,m\.channels\.balance\],m\.channels\.lovePoint\)\]/);
  assert.doesNotMatch(script,/label:"[1-5]\. (?:Вход в деньги|Вход в отношения|Баланс|Под долларом|Под сердцем)/);
});

test("Protected lesson delivery and owner-only white-label PDF survive", async () => {
  const js = await read("pro/school/lesson/lesson.js");
  const gate = await read("server/school-access/private/gate.php");
  const home = await read("pro/school/index.html");
  const pro = await read("pro/pro.js");
  const manifest = JSON.parse(await read("pro/school/lessons-manifest.json"));
  assert.equal(manifest.lessons.length, 32);
  assert.deepEqual(manifest.lessons.slice(0,5).map(x=>x.id),["start","reduce","base","corners","internal"]);
  assert.match(js, /fetch\("\/api\/numi-school\.php"/);
  assert.match(js, /action:"content"/);
  assert.match(js, /credentials:"same-origin"/);
  assert.doesNotMatch(js, /fetch\(manifest\[index\]\.file\s*\+/);
  assert.match(gate, /function nsOwner\(/);
  assert.match(gate, /SCHOOL_SUBSCRIPTION_REQUIRED/);
  assert.match(home, /Персональный PDF для клиента/);
  assert.match(home, /href="pro\/\?from=school"/);
  assert.match(pro, /verifiedSchoolClientOwner/);
  assert.match(pro, /customizeDocument: schoolClientMode \?/);
  assert.match(home, /school\.js\?v=20261103legacy1/);
});
