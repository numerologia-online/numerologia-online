import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const src = name => readFile(new URL("../"+name,import.meta.url),"utf8");
const core = await src("numerology-core.js");
const calc = new Function(core.replace(/^export /gm,"")+";return calculateMatrix")();
const points = await src("pro/school/points.js");
const catalog = new Function(points.replace(/^export /gm,"")+";return pointCatalog")();
const pro = await src("pro/pro-points.js");
const nodesFor = new Function(pro.replace(/^export /gm,"")+";return nodesFor")();
const cases=[
  [{day:5,month:9,year:2026},[5,9,10,6,3],[[4,17],[5,22],[8,19],[7,14]]],
  [{day:1,month:2,year:2026},[1,2,10,13,8],[[14,11],[5,20],[18,13],[9,22]]],
  [{day:2,month:3,year:2026},[2,3,10,15,3],[[13,8],[11,16],[17,10],[10,20]]],
  [{day:31,month:10,year:1989},[4,10,9,5,10],[[20,6],[3,11],[20,6],[10,19]]],
  [{day:14,month:7,year:1990},[14,7,19,4,8],[[5,11],[6,16],[18,13],[8,8]]]
];
const reduce=n=>n>22?String(n).split("").reduce((s,d)=>s+Number(d),0):n;
test("Пять контрольных дат: все четыре родовые диагонали",()=>{
  for(const [birth,basics,expected] of cases){
    const m=calc(birth);
    assert.deepEqual([m.left,m.top,m.right,m.bottom,m.center],basics);
    const keys=["topLeft","topRight","bottomRight","bottomLeft"];
    assert.deepEqual(keys.map(k=>[m.diagonals[k].outer,m.diagonals[k].near]),expected,JSON.stringify(birth));
    for(const k of keys){assert.equal(m.diagonals[k].near,reduce(m.corners[k]+m.center));assert.equal(m.diagonals[k].outer,reduce(m.corners[k]+m.diagonals[k].near));}
  }
});
test("Сила рода остаётся самостоятельной, хвост и денежный канал не меняются",()=>{
  const m=calc({day:5,month:9,year:2026});
  assert.equal(m.lineage.ancestralCenter,6);
  assert.deepEqual([m.tail.first,m.tail.second,m.bottom],[9,15,6]);
  assert.deepEqual([m.channels.moneyEntry,m.channels.balance],[13,22]);
});
test("31 позиция взрослого разбора и 28 учебных формул согласованы с ядром",()=>{
  assert.equal(catalog.length,28);
  for(const [birth] of cases){
    const m=calc(birth);
    assert.equal(nodesFor(birth,m).length,31);
    for(const p of catalog)assert.ok(p.work(m,birth).endsWith(String(p.get(m))),p.id+" "+JSON.stringify(birth));
  }
});
