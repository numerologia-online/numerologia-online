import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const core=read('numerology-core.js').replaceAll('export const ','const ');
const child=read('child/child.js');
const definitionMatch=child.match(/const matrixDefinitions = \(matrix\) => \[([\s\S]*?)\n\];/);
assert(definitionMatch,'Matrix definitions missing');
const ctx=vm.createContext({});
const calculate=vm.runInContext(core+';calculateMatrix',ctx);
const definitions=vm.runInContext('(matrix)=>['+definitionMatch[1]+']',ctx);
const keys=new Set();const bank={};
for(let i=1;i<=22;i++){const json=JSON.parse(read('child/data/matrix/sections/energy-'+i+'.json'));assert.equal(json.id,i);bank[i]=json.sections}
let dates=0,pointChecks=0,repeatEnergyCases=0;const failures=[];let countBySection={};
for(let year=1900;year<=2026;year++)for(let month=1;month<=12;month++)for(let day=1;day<=31;day++){
const dt=new Date(Date.UTC(year,month-1,day));
if(dt.getUTCFullYear()!==year||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)continue;
if(year===2026&&(month>10||(month===10&&day>28)))continue;
dates++;
const matrix=calculate({day,month,year});
const pts=definitions(matrix);
const ids=new Set();const selection=new Map();
for(const p of pts){
 if(ids.has(p.id))failures.push({date:[day,month,year],error:'duplicate point',id:p.id});
 ids.add(p.id);
 if(p.id==='tail')continue;
 const e=Number(p.number), section=p.section||p.id;
 countBySection[section]=(countBySection[section]||0)+1;
 pointChecks++;
 if(!Number.isInteger(e)||e<1||e>22||!Array.isArray(bank[e]?.[section]?.paragraphs)||!bank[e][section].paragraphs.length)failures.push({date:[day,month,year],id:p.id,energy:e,section,error:'bad route'});
 const route=e+'|'+section;
 if(selection.has(route))failures.push({date:[day,month,year],id:p.id,other:selection.get(route),route,error:'same reading for two points'});
 selection.set(route,p.id);
}
const groups=new Map();
for(const p of pts.filter(p=>p.id!=='tail')){const group=groups.get(p.number)||new Set();group.add(p.section||p.id);groups.set(p.number,group)}
if([...groups.values()].some(s=>s.size>1))repeatEnergyCases++;
}
console.log(JSON.stringify({dates,pointChecks,repeatEnergyCases,uniqueSections:Object.keys(countBySection).length,failures:failures.slice(0,10),failureCount:failures.length},null,2));
assert.equal(failures.length,0,'Routing check failed');
