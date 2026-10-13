'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const start=source.indexOf('  let variantRequest=0;'),end=source.indexOf('  // Arrow-key repeats',start);
assert.ok(start>0&&end>start);
function fixture(){
  let resolve,requests=0,installed=0,commits=0;
  const asset={name:'My results',recipe:{family:'gallery',parameters:{view:'grouped_observations'}},table:{rows:[['group','value'],['A',2]]},variants:[{name:'grouped_observations'},{name:'compare_facet_boxes'}]};
  const current={order:['p'],panels:{p:{variant:0,statistics:{binding:'current',config:{method:'welch'}}}}};
  const ctx={project:{id:'same-id'},selectedPanel:'p',dataSerial:1,dataDrafts:{},localEngine:{endpoint:'/api/render',token:'local-only'},panel:()=>asset,state:()=>current,variant:()=>asset.variants[0],T:s=>s,say:()=>{},copy:x=>JSON.parse(JSON.stringify(x)),selected:[],matchSizes:s=>s,commit:()=>commits++,installAsset:()=>{installed++;delete ctx.dataDrafts.p;},engineFetch:()=>{requests++;return new Promise(r=>{resolve=r;});}};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
  return {ctx,asset,current,count:()=>({requests,installed,commits}),reply:()=>resolve({ok:true,json:async()=>({panel:{variants:asset.variants}})})};
}
(async()=>{
  for(const change of [
    f=>{f.ctx.dataDrafts.p=[['group','value'],['A',3]];f.ctx.dataSerial++;},
    f=>{f.ctx.dataSerial++;},
    f=>{f.current.panels.p.statistics.config.method='mannwhitney';},
    f=>{f.ctx.project={id:'same-id'};},
    f=>{f.current.panels.p.locked=true;},
    f=>{f.ctx.selectedPanel='other';}
  ]){
    const f=fixture(),pending=f.ctx.activateVariant(1);change(f);const draft=f.ctx.dataDrafts.p;f.reply();await pending;assert.equal(f.count().installed,0,'stale rendering must not overwrite current work');assert.equal(f.ctx.dataDrafts.p,draft,'draft must survive');
  }
  const draft=fixture();draft.ctx.dataDrafts.p=[['group','value'],['A',3]];await draft.ctx.activateVariant(1);assert.equal(draft.count().requests,0);
  const fresh=fixture(),pending=fresh.ctx.activateVariant(1);fresh.reply();await pending;assert.equal(fresh.count().installed,1);
  const resized=fixture();resized.asset.variants.push({name:'grouped_observations',size:'wide'},{name:'compare_facet_boxes',size:'wide'});
  const beforeResize=resized.ctx.activateVariant(1);resized.current.panels.p.variant=2;resized.reply();await beforeResize;
  assert.equal(resized.count().installed,0,'a delayed style must not replace a later canvas-size selection with the previous size');assert.equal(resized.current.panels.p.variant,2);
  const styled=fixture(),beforeStyle=styled.ctx.activateVariant(1);styled.current.panels.p.annotationFont={size:24};styled.current.columns=2;styled.current.grid={rows:1,places:{p:{row:0,col:0,rs:1,cs:2}}};styled.reply();await beforeStyle;
  assert.equal(styled.count().installed,1,'appearance and grid-span edits do not invalidate a switch when the source variant is unchanged');
  const local=fixture();local.ctx.localEngine=null;await local.ctx.activateVariant(1);assert.deepEqual(local.count(),{requests:0,installed:0,commits:1});
  console.log('PASS variant switching: preserve drafts, canvas-size choices and statistical settings across delayed responses, project replacement, locks and selection changes; valid local/engine switches apply.');
})().catch(error=>{console.error(error);process.exitCode=1;});
