/* Explicit opt-in live API smoke test. Never reads research files or project data. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
if(!process.argv.includes('--live')){console.log('Pass --live to explicitly search Europe PMC using public chart keywords.');process.exit(0);}
const {JSDOM}=require('jsdom'),api=require('../skills/polish-sci-figures/assets/figure-studio/literature.js');
(async()=>{
 const requests=[],client=api.createClient({DOMParser:new JSDOM('').window.DOMParser,fetch:(url,options)=>{requests.push(url);return fetch(url,options);}});
 const result=await client.searchExamples({views:['compare_box_points','compare_ecdf','estimation_graphic'],topic:'cell viability'});
 const report={checkedAt:result.fetchedAt,query:result.query,requests,papers:result.papers.map(p=>({title:p.title,pmid:p.pmid,pmcid:p.pmcid,doi:p.doi,url:p.articleUrl,evidence_level:p.evidence_level,figures:p.figures.map(f=>({label:f.label,url:f.url,evidence:f.evidence_level,chartTypes:f.chartTypes.map(c=>c.id)}))})),partial:result.partial};
 const target=path.join(__dirname,'../.cache/discovery-qa/live-literature.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(JSON.stringify({papers:report.papers.length,verifiedFigures:report.papers.reduce((n,p)=>n+p.figures.length,0),requests:requests.length,partial:report.partial}));
})().catch(e=>{console.error('Live service unavailable:',e.code||e.name);process.exitCode=1;});
