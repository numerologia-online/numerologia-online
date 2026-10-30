import {prepare,bodyOf,readPrivate,contentError} from '../lib/content-security.mjs';
import {parseEnergyText} from '../lib/year-text.mjs';
const reduce=n=>{while(n>9)n=String(n).split('').reduce((a,c)=>a+Number(c),0);return n;};
const yearEnergy=(day,month,year)=>reduce(day+month+String(year).split('').reduce((a,c)=>a+Number(c),0));
export default async function handler(req,res) {
 if(!prepare(req,res))return;
 try {
  const b=bodyOf(req),match=String(b.birth_date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!match)throw Error('INVALID_BODY');
  const [y,m,d]=match.slice(1).map(Number),year=Number(b.year),date=new Date(Date.UTC(y,m-1,d));
  if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d||y<1900||y>new Date().getFullYear()||!Number.isInteger(year)||year<1900||year>2050)throw Error('INVALID_BODY');
  let parts;
  try{parts=new Intl.DateTimeFormat('en-CA',{timeZone:b.timezone||'Europe/Samara',year:'numeric',month:'2-digit'}).formatToParts(new Date());}catch{throw Error('INVALID_BODY');}
  const nowYear=Number(parts.find(x=>x.type==='year').value),nowMonth=Number(parts.find(x=>x.type==='month').value);
  const limit=year<nowYear?12:year>nowYear?0:nowMonth-1;
  const before=yearEnergy(d,m,year-1),after=yearEnergy(d,m,year),energies=[...new Set([before,after])];
  const primary={},alternate={},seen=new Set(),needed={primary:new Map(),alternate:new Map()};
  for(let month=1;month<=limit;month++) {
   const selected=month===m?[before,after]:[month<m?before:after];
   for(const energy of selected) {
    const target=reduce(energy+month),pair=energy+'-'+target,kind=seen.has(pair)?'alternate':'primary';
    seen.add(pair);
    if(!needed[kind].has(energy))needed[kind].set(energy,new Set());
    needed[kind].get(energy).add(target);
   }
  }
  const first=year%2===0?'':'odd/',second=first?'':'odd/';
  await Promise.all(energies.map(async energy=>{
   const source=parseEnergyText(await readPrivate('data/year/'+first+'energy-'+energy+'.txt'),energy);
   primary[energy]={energy,year:source.year,links:{},missingConnections:[]};
   for(const link of needed.primary.get(energy)||[]) {
    if(!source.links[link])throw Error('PRIVATE_CONTENT_UNAVAILABLE');
    primary[energy].links[link]=source.links[link];
   }
   alternate[energy]={energy,year:null,links:{},missingConnections:[]};
   if(needed.alternate.has(energy)) {
    const other=parseEnergyText(await readPrivate('data/year/'+second+'energy-'+energy+'.txt'),energy);
    for(const link of needed.alternate.get(energy)) {
     if(!other.links[link])throw Error('PRIVATE_CONTENT_UNAVAILABLE');
     alternate[energy].links[link]=other.links[link];
    }
   }
  }));
  return res.status(200).json({ok:true,primary,alternate});
 }catch(e){return contentError(e,res);}
}
