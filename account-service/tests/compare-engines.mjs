import {calculateMatrix} from '../../numerology-core.js';
import {calculateCompatibility} from '../../compatibility-engine.js';
import {buildFullReportSections} from '../../full-report-library.js';
const fixtures=[];
for(let n=0;n<100;n++){
 const date={year:1950+n%75,month:1+n%12,day:1+n%28};const partner={year:1960+n%60,month:1+(n*7)%12,day:1+(n*13)%28};
 const iso=d=>`${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;
 const m=calculateMatrix(date);fixtures.push({date:iso(date),partner:iso(partner),matrix:{left:m.left,top:m.top,right:m.right,bottom:m.bottom,center:m.center,corners:m.corners,leftSpoke:{outer:m.leftSpoke.outer,near:m.leftSpoke.near},rightSpoke:{outer:m.rightSpoke.outer,near:m.rightSpoke.near},topSpoke:{outer:m.topSpoke.outer,near:m.topSpoke.near},channels:{moneyPoint:m.channels.moneyPoint,lovePoint:m.channels.lovePoint},purpose:{personal:m.purpose.personal,social:m.purpose.social,general:m.purpose.general},tail:m.tail},life:buildFullReportSections(m).map(x=>({key:x.key,energy:x.energy})),compatibility:calculateCompatibility(date,partner)});
}
process.stdout.write(JSON.stringify(fixtures));
