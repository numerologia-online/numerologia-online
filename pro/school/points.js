import { constructionSteps } from "./construction-model.js?v=20261102learn1";
const baseline=constructionSteps({day:14,month:7,year:1990});
export const pointCatalog=baseline.map(p=>({
 id:p.id,title:p.title,group:p.group,
 get:matrix=>constructionSteps({day:14,month:7,year:1990},matrix).find(n=>n.id===p.id).value,
 work:(matrix,birth)=>constructionSteps(birth,matrix).find(n=>n.id===p.id).expression
}));
