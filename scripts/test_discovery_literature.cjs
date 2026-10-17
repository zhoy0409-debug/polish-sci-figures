'use strict';
const assert=require('node:assert/strict'),api=require('../skills/polish-sci-figures/assets/figure-studio/literature.js');
const response=(x,status=200)=>({ok:status===200,status,headers:{get:()=>null},text:async()=>JSON.stringify(x)});
const paper=(i,extra={})=>({id:String(i),pmid:String(i),pmcid:'PMC'+i,title:'Public method paper '+i,isOpenAccess:'N',doi:'10.1234/example.'+i,...extra});
async function main(){
 const views=['compare_box_points','compare_ecdf'];
 const evidence=api.buildSearch({views,topic:'cell viability',sampleType:'cell culture',assay:'ELISA'});
 for(const word of ['box plot','cell viability','cell culture','ELISA'])assert.ok(evidence.query.includes(word));
 const explore=api.buildSearch({views,topic:'cell viability',mode:'explore'});assert.ok(!explore.query.includes('box plot'));assert.ok(explore.query.includes('TITLE_ABS:"cell viability"'));
 for(const topic of ['PATIENT_42','MRN12345','住院号','Jane patient ID','sample 12.34','private_project','a@b.com'])assert.throws(()=>api.buildSearch({views,topic}),e=>e.code==='invalid_topic');
 const urls=[];const client=api.createClient({fetch:async url=>{urls.push(url);return response(url.includes('cursorMark=')?{resultList:{result:[paper(6),paper(7,{pmcid:'',pmid:'70',id:'70',doi:'10.1234/example.1'}),paper(8,{abstractText:'We display an empirical cumulative distribution.'})]},nextCursorMark:'thirdPage'}:{resultList:{result:[1,2,3,4,5].map(i=>paper(i))},nextCursorMark:'secondPage'});}});
 const result=await client.searchExamples({views,topic:'cell viability',mode:'explore'});
 assert.equal(urls.length,2,'at most two search pages');assert.equal(result.papers.length,7,'DOI aliases deduplicate records with different IDs');
 assert.equal(result.papers.find(p=>p.id==='8').evidence_level,'design_inferred');assert.equal(result.papers[0].evidence_level,'paper_relevant');
 for(const p of result.papers){assert.equal(p.figures.length,0);assert.equal(p.imageReuseAllowed,false);assert.equal(p.license,null);assert.ok(p.checkedAt);}
 assert.equal((await api.createClient({fetch:async()=>response({resultList:{result:[]}})}).searchExamples({views})).papers.length,0);
 let tries=0;await api.createClient({fetch:async()=>++tries===1?response({},429):response({resultList:{result:[]}})}).searchExamples({views});assert.equal(tries,2,'one bounded 429 retry');
 let pages=0;const partial=await api.createClient({fetch:async()=>++pages===1?response({resultList:{result:[1,2,3,4,5].map(i=>paper(i))},nextCursorMark:'page2'}):response({},503)}).searchExamples({views});assert.equal(partial.partial,true);assert.equal(partial.papers.length,5);
 assert.equal(api.providers.openalex.enabled,false);
 console.log('PASS literature enhancement: explicit semantic modes, keyword privacy, two-page cap, DOI deduplication, evidence grades, no invented figures/images, no results, partial service and bounded 429 retry');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
