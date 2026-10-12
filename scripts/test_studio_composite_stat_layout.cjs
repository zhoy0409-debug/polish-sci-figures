/* Complex statistical result bands and stale-result guards. Browser font metrics are separate. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(file),'utf8'),helpers=require(file);
const proof=path.join(__dirname,'../.cache/composite-statistics-qa/results.json');
assert.ok(fs.existsSync(proof),'Run test_composite_statistics.py first to compute real results from the synthetic observations');
const input=JSON.parse(fs.readFileSync(proof,'utf8')),copy=x=>JSON.parse(JSON.stringify(x));
let panelState={variant:0,statistics:{tableKey:input.original.data_sha256,analysis:input.original.analysis,config:input.original.config}},tableKey=input.original.data_sha256;
const panel={table:{sha256:tableKey},analysis:{sourceMarker:'original-bundle'},variants:[{preserveAspect:true}]},s={panels:{p:panelState}};
const ctx={...helpers,T:x=>x,state:()=>s,panel:()=>panel,baseSvg:()=>({querySelectorAll:()=>[{}, {}, {}]}),statisticalAnchorElements:()=>null,statisticalPlotAnchors:()=>null,statisticalFacetTitleElements:()=>[]};vm.createContext(ctx);
const analysisStart=source.indexOf('  function statisticalAnalysisFor('),analysisEnd=source.indexOf('  function comparisonsFor(',analysisStart);
const setsStart=source.indexOf('  function statisticalAnnotationSets('),setsEnd=source.indexOf('  function renderStatisticalAnnotations(',setsStart);
assert.ok(analysisStart>0&&setsStart>0);vm.runInContext(source.slice(analysisStart,analysisEnd)+'\n'+source.slice(setsStart,setsEnd),ctx);
assert.deepEqual(ctx.statisticalAnalysisFor('p'),input.original.analysis);
panelState.statistics.stale=true;assert.deepEqual(JSON.stringify(ctx.statisticalAnalysisFor('p')),'{}','stale results cannot fall back to old bundled P values');delete panelState.statistics.stale;
panel.table.sha256='changed-data';assert.equal(JSON.stringify(ctx.statisticalAnalysisFor('p')),'{}','data identity mismatch hides old statistics');panel.table.sha256=tableKey;
const saved=panelState.statistics;delete panelState.statistics;assert.equal(ctx.statisticalAnalysisFor('p').sourceMarker,'original-bundle');panelState.statistics=saved;

const info=ctx.statisticalAnnotationInfo('p');assert.equal(info.available,true);assert.equal(info.placement,'band');assert.equal(info.sets.length,2);
assert.deepEqual(info.sets.map(x=>x.label),['Assay A','Assay B']);assert.equal(info.comparisons.length,6);assert.equal(info.letters,true);
for(const set of info.sets){assert.equal(set.comparisons.length,3);assert.deepEqual(set.order,['Control','Treatment','Rescue']);}
const analysisSnapshot=JSON.stringify(saved.analysis),layouts=[];
for(const width of [259.2,345.6,703.2,1050])for(const fontSize of [9,24,32])for(const style of ['p','stars','letters'])for(const format of style==='p'?['standard','precise']:['standard']){
  const layout=helpers.statisticalBandLayout(info,style,width,{variant:0,annotationPFormat:format,annotationFont:{font:'Arial',size:fontSize}});
  assert.equal(layout.fontSize,fontSize);assert.ok(Number.isFinite(layout.height)&&layout.height>0);
  assert.equal(layout.rows.filter(r=>r.kind==='facet').length,2);
  const results=layout.rows.filter(r=>['letters','comparison'].includes(r.kind));assert.equal(results.length,6);
  for(let i=0;i<layout.rows.length;i++){
    const r=layout.rows[i];assert.ok(r.y>=0&&r.height>0&&r.y+r.height<=layout.height,'every result fits its reserved vertical range');
    if(i)assert.ok(r.y>=layout.rows[i-1].y+layout.rows[i-1].height,'result row boxes never overlap');
    if(r.kind==='comparison'||r.kind==='letters'){
      assert.equal(r.labelLines.join('').replace(/\s/g,''),r.label.replace(/\s/g,''),'wrapped group identities are complete');
      assert.equal(r.resultLines.join('').replace(/\s/g,''),r.result.replace(/\s/g,''),'wrapped values and exponents are complete');
      assert.ok(r.resultX>=layout.pad&&r.resultX<width-layout.pad);
      const lines=r.sideBySide?Math.max(r.labelLines.length,r.resultLines.length):r.labelLines.length+r.resultLines.length;
      assert.ok(r.height>=lines*layout.lineHeight,'row reserves all wrapped label and result lines');
    }
  }
  let active=-1;
  for(const row of layout.rows){if(row.kind==='facet')active++;if(row.kind==='comparison')assert.ok(info.sets[active].comparisons.some(p=>p.a===row.comparison.a&&p.b===row.comparison.b&&p.p===row.comparison.p),'result remains in its original facet');}
  layouts.push({width,fontSize,style,format,height:layout.height,rows:layout.rows});
}
assert.equal(JSON.stringify(saved.analysis),analysisSnapshot,'layout never mutates scientific results');
const narrow=layouts.find(x=>x.width===259.2&&x.fontSize===32&&x.style==='p'),wide=layouts.find(x=>x.width===1050&&x.fontSize===32&&x.style==='p');
assert.ok(narrow.height>wide.height,'narrow large-font results wrap rather than overlap or shrink');
const large=layouts.find(x=>x.width===345.6&&x.fontSize===32&&x.style==='p'),small=layouts.find(x=>x.width===345.6&&x.fontSize===9&&x.style==='p');assert.ok(large.height>small.height);

// Incomplete pairwise families cannot acquire compact-letter groups, nor borrow another facet.
const incomplete=copy(input.original.analysis);incomplete.facets[1].primary_test.pairwise.pop();panelState.statistics.analysis=incomplete;
const partial=ctx.statisticalAnnotationInfo('p');assert.equal(partial.available,true);assert.equal(partial.letters,false);assert.equal(partial.sets[0].comparisons.length,3);assert.equal(partial.sets[1].comparisons.length,2);
panelState.statistics.analysis=input.updated.analysis;panelState.statistics.tableKey=input.updated.data_sha256;panel.table.sha256=input.updated.data_sha256;
const updated=ctx.statisticalAnnotationInfo('p');assert.notEqual(updated.sets[0].comparisons[0].p,info.sets[0].comparisons[0].p);

// Execute the production SVG result-band builder. Existing chart geometry must
// remain exactly untouched; only its bottom viewBox extent may grow.
function node(tag){const attrs=new Map();return {localName:tag,children:[],ownText:'',style:{setProperty(k,v){this[k]=v;}},closest:()=>null,hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,String(v)),getAttribute:k=>attrs.get(k),append(...items){this.children.push(...items);},set textContent(value){this.ownText=String(value);},get textContent(){return this.ownText+this.children.map(c=>c.textContent||'').join('');}};}
const bandStart=source.indexOf('  function appendStatisticalBand('),bandEnd=source.indexOf('  function annotationHeight(',bandStart);
assert.ok(bandStart>0&&bandEnd>bandStart);
const dom={...helpers,NS:'svg',document:{createElementNS:(_,tag)=>node(tag),createTextNode:text=>({textContent:text})}};vm.createContext(dom);vm.runInContext(source.slice(bandStart,bandEnd),dom);
let svgBuilds=0;
for(const [width,height]of [[259.2,388.8],[345.6,259.2],[703.2,259.2]])for(const fontSize of [9,24,32])for(const format of ['standard','precise']){
  svgBuilds++;
  const svg=node('svg'),original=node('g');original.setAttribute('transform','translate(17 24) scale(1.03)');original.textContent='Existing chart content';svg.append(original);
  const before=JSON.stringify(original),p={variant:0,annotationStyle:'p',annotationPFormat:format,annotationFont:{font:'Arial',size:fontSize}},v={width,height,viewBox:[10,20,width*2,height*2]};
  const plan=dom.appendStatisticalBand(svg,'p',0,{panels:{p}},v,info),group=svg.children[1];
  assert.equal(svg.children[0],original);assert.equal(JSON.stringify(original),before,'source chart remains unscaled and unmoved');
  assert.equal(group.getAttribute('transform'),`translate(10 ${20+height*2})`,'band uses native SVG units, preventing font edits from being scaled twice');
  assert.deepEqual(svg.getAttribute('viewBox').split(' ').map(Number),[10,20,width*2,(height+plan.height)*2]);
  assert.equal(+svg.getAttribute('data-stat-source-height'),height);assert.equal(+svg.getAttribute('data-stat-band-height'),plan.height);
  const texts=group.children.filter(n=>n.localName==='text'),pTexts=texts.filter(n=>n.textContent.startsWith('P'));
  assert.equal(pTexts.length,6);assert.ok(texts.every(n=>+n.getAttribute('font-size')/2===fontSize));
  assert.ok(texts.every(n=>+n.getAttribute('x')>=plan.pad*2));
  for(const text of texts)for(let i=1;i<text.children.length;i++)assert.equal(+text.children[i].getAttribute('dy'),plan.lineHeight*2,'wrapped text spacing uses source SVG units');
  for(const text of pTexts){const symbol=text.children[0].children[0];assert.equal(symbol.textContent,'P');assert.equal(symbol.getAttribute('font-style'),'italic');assert.equal(text.getAttribute('font-style'),'normal','ordinary values do not inherit statistical-symbol italics');}
  assert.equal(group.children.filter(n=>n.localName==='path'&&n.getAttribute('data-stat-result')==='true').length,6);
  const drawable=group.children.filter(n=>['text','path','line','rect'].includes(n.localName)),selected=pTexts[0],key='e'+(900000+drawable.indexOf(selected));
  const generatedStart=source.indexOf('    let generated=900000;'),generatedEnd=source.indexOf('    return svg;',generatedStart);
  svg.querySelectorAll=()=>drawable;
  vm.runInNewContext(source.slice(generatedStart,generatedEnd),{svg,raw:false,id:'p',vi:0,s:{},editsFor:()=>({[key]:{'font-size':'64'}})});
  assert.equal(selected.style['font-size'],'64px');assert.equal(parseFloat(selected.style['font-size'])/2,32,'a 32 pt override remains 32 pt for source unit 2');
}

// The whole ending row receives the same physical footer reservation. Reflow
// requests only the unchanged chart body, never compresses it to include text.
const layoutStart=source.indexOf('  function layout(s=state(),'),layoutEnd=source.indexOf('  function plotFrame(',layoutStart);
const reflowStart=source.indexOf('  function reflowSpec('),reflowEnd=source.indexOf('  function currentHeatmapMetadata(',reflowStart);
assert.ok(layoutStart>0&&layoutEnd>layoutStart&&reflowStart>0);
const assets={a:{table:{rows:input.rows},recipe:input.recipe,variants:[{name:'compare_facet_boxes',width:345.6,height:259.2,viewBox:[0,0,345.6,259.2],preserveAspect:true,svg:'studio-plot-frame',sha256:'a'}]},b:{table:{rows:input.rows},recipe:input.recipe,variants:[{name:'compare_facet_boxes',width:345.6,height:259.2,viewBox:[0,0,345.6,259.2],preserveAspect:true,svg:'studio-plot-frame',sha256:'b'}]}};
const layoutContext={copy,panel:id=>assets[id],gridFor:s=>s.grid,conditionMatrixHeight:()=>0,annotationTopHeight:()=>0,annotationFirstTopHeight:()=>0,statisticalAnnotationInfo:()=>({placement:'band'}),annotationHeight:(id,s,vi,width=345.6)=>s.panels[id].annotationStyle?helpers.statisticalBandLayout(info,'p',width,s.panels[id]).height:0};
vm.createContext(layoutContext);vm.runInContext(source.slice(layoutStart,layoutEnd)+'\n'+source.slice(reflowStart,reflowEnd),layoutContext);
const gridState={order:['a','b'],columns:2,gap:12,grid:{rows:1,widths:[400,400],places:{a:{row:0,col:0,rs:1,cs:1},b:{row:0,col:1,rs:1,cs:1}}},panels:{a:{variant:0},b:{variant:0}}};
const unchangedSource=JSON.stringify(assets),plain=layoutContext.layout(gridState);assert.equal(plain.positions[0].statisticsBand,0);assert.equal(plain.height,259.2);
let previousBand=0;
for(const size of [9,24,32]){
  const ss=copy(gridState);ss.panels.a.annotationStyle='p';ss.panels.a.annotationFont={font:'Arial',size};
  const l=layoutContext.layout(ss),[a,b]=l.positions;assert.equal(a.statisticsBand,b.statisticsBand);assert.ok(a.statisticsBand>previousBand);previousBand=a.statisticsBand;
  for(const pos of l.positions){assert.ok(pos.height-pos.statisticsBand>=259.2-1e-8);const request=layoutContext.reflowSpec(pos,ss);assert.equal(request.width,400);assert.equal(request.height,+((pos.height-pos.statisticsBand).toFixed(3)));}
  const span=copy(ss);span.grid.rows=2;span.grid.places.a.rs=2;span.grid.places.b.row=1;
  const spanLayout=layoutContext.layout(span);assert.equal(spanLayout.positions[0].statisticsBand,spanLayout.positions[1].statisticsBand,'row-spanning panel reserves its footer in its ending row');
}
assert.equal(JSON.stringify(assets),unchangedSource,'layout does not mutate chart dimensions or data');

// Run the real data-update handler and its real statistics-install block with
// controlled async responses. No browser or network is replaced with claims.
const recomputeStart=source.indexOf('  async function recomputeData('),recomputeEnd=source.indexOf("  $('addDataRow').onclick",recomputeStart);
const installStart=source.indexOf('      const old=state().panels[oldId],record=old.statistics;'),installEnd=installStart+source.slice(installStart).search(/\r?\n    }\r?\n    selectedPanel=id;/);
assert.ok(recomputeStart>0&&installStart>0&&installEnd>installStart);
function installStatistics(record,asset,preserveStatistics=false){
  const old={statistics:copy(record),annotationStyle:'p',annotationPFormat:'precise',showFacetTitles:false,annotationFont:{size:24,font:'Arial'},annotationLine:'rounded'},next={panels:{next:{}}};
  vm.runInNewContext(source.slice(installStart,installEnd),{...helpers,state:()=>({panels:{old}}),oldId:'old',id:'next',asset,next,preserveStatistics,copy,panel:()=>({analysis:{group_order:['Control','Treatment','Rescue']}})});
  return next.panels.next;
}
const record={binding:'current',tableKey:input.original.data_sha256,config:input.original.config,analysis:input.original.analysis,data_sha256:input.original.data_sha256};
let installed=installStatistics(record,{table:{sha256:input.updated.data_sha256},statistics:input.updated});
assert.equal(installed.statistics.binding,'current');assert.equal(installed.statistics.tableKey,input.updated.data_sha256);assert.deepEqual(installed.statistics.analysis,input.updated.analysis);assert.equal(installed.annotationFont.size,24);assert.equal(installed.annotationPFormat,'precise','data replacement preserves the selected P display format');assert.equal(installed.showFacetTitles,false,'data replacement preserves hidden facet titles');
for(const binding of ['external','results']){
  const imported={...copy(record),binding,inputRows:[['sample','value'],['A','1']]};
  installed=installStatistics(imported,{table:{sha256:'new-source-table'},analysis:{}});
  assert.equal(installed.statistics.stale,true);assert.equal(installed.statistics.analysis,undefined);assert.deepEqual(installed.statistics.inputRows,imported.inputRows);assert.equal(installed.annotationStyle,undefined,'old external results are removed from rendered annotations');
  installed=installStatistics(imported,{table:{sha256:record.tableKey},analysis:{}},true);
  assert.equal(installed.statistics.stale,undefined);assert.deepEqual(installed.statistics.analysis,record.analysis);assert.equal(installed.annotationStyle,'p','changing only the view preserves confirmed linked statistics');assert.equal(installed.annotationPFormat,'precise');
}
async function updateCase(binding,mutate=null,ok=true){
  const ui=new Map(),calls=[],sourcePanel={name:'Fixture',recipe:input.recipe,table:{sha256:input.original.data_sha256}},current={order:['p'],panels:{p:{statistics:{...copy(record),binding}}}};
  const c={...helpers,dataBusy:false,localEngine:{endpoint:'/api/render',token:'local-token'},dataDrafts:{p:copy(input.rows)},selectedPanel:'p',dataSerial:1,project:{id:'project'},copy,state:()=>current,panel:()=>sourcePanel,variant:()=>({name:'raincloud',size:'original'}),T:x=>x,document:{activeElement:null},persist:()=>{},refreshDataExport:()=>{},say:()=>{},setTimeout:()=>0,$:id=>{if(!ui.has(id))ui.set(id,{});return ui.get(id);},engineFetch:async(endpoint,options)=>{calls.push(JSON.parse(options.body));if(mutate)mutate(c,current);return {ok,json:async()=>ok?{panel:{table:{sha256:input.updated.data_sha256},variants:[{name:'raincloud',size:'original'}],statistics:input.updated},seconds:.1}:{error:'Invalid data'}};},installAsset:(...args)=>calls.push({installed:args})};
  c.paintDataValidation=()=>({valid:true});
  vm.createContext(c);vm.runInContext(source.slice(recomputeStart,recomputeEnd),c);await c.recomputeData();return {calls,c,current};
}
async function verifyUpdates(){
  for(const binding of ['current','external','results']){const r=await updateCase(binding);assert.deepEqual(r.calls[0].statistics,binding==='current'?record.config:undefined);assert.equal(r.calls.length,2);assert.equal(r.c.dataDrafts.p,undefined);assert.equal(r.calls[1].installed[4],true);}
  for(const change of [(c)=>{c.dataSerial++;},(c)=>{c.selectedPanel='other';},(c,s)=>{s.panels.p.statistics.config.method='mannwhitney';},(c,s)=>{s.panels.p.locked=true;},(c)=>{c.project.id='other-project';}]){const r=await updateCase('current',change);assert.equal(r.calls.length,1,'stale async response cannot install a panel');assert.ok(r.c.dataDrafts.p);}
  const failed=await updateCase('current',null,false);assert.equal(failed.calls.length,1);assert.ok(failed.c.dataDrafts.p);assert.equal(failed.c.dataBusy,false);
}

function productionRange(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>0&&b>a,`Missing production range: ${start}`);return source.slice(a,b);}
const previewCode=productionRange('  function statisticsReadyReason(','  function statisticsControls(')+'\n'+productionRange('  function statisticsSessionValid(','  function renderStatisticsPreview(')+'\n'+productionRange('  async function runStatisticsPreview(',"  $('closeStatistics').onclick");
const applyCode=source.split('\n').find(line=>line.startsWith("  $('applyStatistics').onclick="));assert.ok(applyCode);
const clearStart=source.indexOf('  function clearStatisticalResultEdits('),clearEnd=source.indexOf('  function renderAlignmentGuideControls(',clearStart);
assert.ok(clearStart>0&&clearEnd>clearStart);const clearCode=source.slice(clearStart,clearEnd);
const editedProperties={e900001:{text:'Old P = 0.01',hidden:'true','offset-x':'12','offset-y':'-30',fill:'#526e9e','font-size':'24'},e900002:{hidden:'true'},e900003:{text:'Old next-style label','offset-x':'7',stroke:'#26364b'},e5:{text:'User title',hidden:'true','offset-x':'9'},e900099:{text:'50 μm','offset-y':'4',fill:'#ffffff'}};
const previousCleanup={panels:{
  p:{edits:{0:copy(editedProperties),1:{e900011:{text:'Another variant old result','offset-y':'20','font-size':'32'}},2:{e7:{fill:'#112233'}}}},
  other:{edits:{0:{e900001:{text:'Other panel result'}}}}
}},nextCleanup=copy(previousCleanup),cleanupCalls=[];
const priorSnapshot=JSON.stringify(previousCleanup),clearContext={state:()=>previousCleanup,editedSvg:(id,vi,snapshot)=>{cleanupCalls.push([id,vi,snapshot===previousCleanup?'old':'new']);return {querySelectorAll:selector=>{assert.equal(selector,'[data-stat-top],[data-stat-bracket],[data-stat-result]');const keys=vi===0?(snapshot===previousCleanup?['e900001','e900002']:['e900003']):vi===1?['e900011']:[];return keys.map(key=>({getAttribute:()=>key}));}};}};
vm.createContext(clearContext);vm.runInContext(clearCode,clearContext);clearContext.clearStatisticalResultEdits(nextCleanup,'p');
assert.deepEqual(nextCleanup.panels.p.edits[0].e900001,{fill:'#526e9e','font-size':'24'});assert.equal(nextCleanup.panels.p.edits[0].e900002,undefined);assert.deepEqual(nextCleanup.panels.p.edits[0].e900003,{stroke:'#26364b'});assert.deepEqual(nextCleanup.panels.p.edits[1].e900011,{'font-size':'32'});
assert.deepEqual(nextCleanup.panels.p.edits[0].e5,editedProperties.e5,'ordinary source text edits are retained');assert.deepEqual(nextCleanup.panels.p.edits[0].e900099,editedProperties.e900099,'generated scale-bar edits are retained');assert.deepEqual(nextCleanup.panels.other,previousCleanup.panels.other);assert.equal(JSON.stringify(previousCleanup),priorSnapshot,'previous history snapshot remains intact');assert.equal(cleanupCalls.length,4,'only variants with changed result content/visibility/offsets require scans');
async function analyzeCase(binding,mutate=null,draft=false){
  const controls=new Map(),calls=[],sourcePanel={recipe:input.recipe,table:{sha256:input.original.data_sha256}},current={order:['p'],panels:{p:{variant:0,methodChoice:{key:'previous'},edits:{0:copy(editedProperties)}}}},config=copy(input.original.config);
  const initial=JSON.stringify(current),values={statisticsSource:binding,statisticsPreviewStyle:'p',statisticsOutcome:'continuous',statisticsDesign:config.design,statisticsUnit:config.unit};
  const c={...helpers,copy,statisticsRequest:0,statisticsSession:{id:'p',projectId:'project',source:sourcePanel,serial:1,style:'p'},localEngine:{token:'local-token'},dataDrafts:draft?{p:input.rows}:{},dataSerial:1,selectedPanel:'p',project:{id:'project'},state:()=>current,panel:()=>sourcePanel,T:x=>x,say:()=>{},StudioI18n:{language:'en'},statisticsProfile:()=>({group:config.group,value:config.value,validNumeric:true,groups:['Control','Treatment','Rescue']}),statisticsControls:()=>{},statisticsResultSummary:analysis=>calls.push({summary:analysis}),statisticsInvalidate:()=>{c.statisticsSession.pending=null;},renderStatisticsPreview:()=>calls.push({preview:c.statisticsPreviewState(c.statisticsSession)}),editedSvg:()=>({querySelectorAll:()=>['e900001','e900002','e900003'].map(key=>({getAttribute:()=>key}))}),statisticsConfig:()=>copy(config),statisticsRows:()=>input.rows,$:id=>{if(!controls.has(id))controls.set(id,{value:values[id]||'',checked:true,close:()=>calls.push('closed')});return controls.get(id);},engineFetch:async(endpoint,options)=>{calls.push({request:JSON.parse(options.body)});if(mutate)mutate(c,current,config);return {ok:true,json:async()=>input.original};},commit:next=>{calls.push({committed:next});return true;}};
  vm.createContext(c);vm.runInContext(clearCode+'\n'+previewCode+'\n'+applyCode,c);c.transferStatisticalStyleEdits=()=>{}; // Key remapping has production coverage in test_studio_statistical_line_editing.cjs.
  await c.runStatisticsPreview();
  assert.equal(calls.some(call=>call.committed),false,'analysis stages a preview without committing');assert.equal(calls.includes('closed'),false,'analysis keeps the preview dialog open');
  if(!mutate)assert.equal(JSON.stringify(current),initial,'preview must not alter the editable figure');
  return {calls,c,config};
}
async function verifyAnalysis(){
  for(const binding of ['current','external','results']){const r=await analyzeCase(binding),preview=r.calls.find(call=>call.preview).preview;assert.deepEqual(preview.panels.p.statistics.analysis,input.original.analysis);r.c.$('statisticsPreviewStyle').value='stars';r.c.$('applyStatistics').onclick();const saved=r.calls.find(call=>call.committed).committed.panels.p;assert.equal(saved.statistics.binding,binding);assert.equal(saved.statistics.tableKey,input.original.data_sha256);assert.deepEqual(saved.statistics.analysis,input.original.analysis);assert.equal(saved.annotationStyle,'stars','apply uses the style selected after calculation');assert.equal(saved.methodChoice,undefined);assert.deepEqual(saved.statistics.inputRows,binding==='current'?undefined:input.rows);assert.equal(r.calls.at(-1),'closed');assert.deepEqual(saved.edits[0].e900001,{fill:'#526e9e','font-size':'24'});assert.deepEqual(saved.edits[0].e5,editedProperties.e5);assert.deepEqual(saved.edits[0].e900099,editedProperties.e900099);assert.equal(r.calls.filter(call=>call.committed).length,1,'apply creates one history entry');}
  for(const change of [(c)=>{c.statisticsRequest++;},(c)=>{c.statisticsSession={};},(c)=>{c.project.id='another';},(c)=>{c.selectedPanel='other';},(c,s)=>{s.panels.p.locked=true;},(c)=>{c.panel=()=>({});},(c)=>{c.dataSerial++;},(c,s,config)=>{config.method='mannwhitney';}]){const r=await analyzeCase('current',change);assert.equal(r.calls.length,1,'a stale analysis response cannot commit or close the current editor');}
  assert.equal((await analyzeCase('current',null,true)).calls.length,0,'uncommitted data draft cannot start analysis');
  for(const change of [r=>r.c.dataSerial++,r=>{r.config.method='mannwhitney';},r=>{r.c.project.id='another';}]){const r=await analyzeCase('current');change(r);r.c.$('applyStatistics').onclick();assert.equal(r.calls.some(call=>call.committed),false,'staged results must be revalidated when applying');assert.equal(r.calls.includes('closed'),false);assert.equal(r.c.statisticsSession.pending,null);}
}

fs.writeFileSync(path.join(__dirname,'../.cache/composite-statistics-qa/band-layouts.json'),JSON.stringify({scope:'Production Node helpers and layout records; browser text metrics not measured here',layouts},null,2));
Promise.all([verifyUpdates(),verifyAnalysis()]).then(()=>console.log(`PASS composite statistical layout/data flow: stale/table-key guards, ${layouts.length} real-result layouts, ${svgBuilds} SVG-band builds, standard/precise P, 2 isolated facets, 9/24/32 pt, row/footer and reflow geometry, italic P, actual analysis/update handlers, external-result invalidation and stale async rejection.`)).catch(error=>{console.error(error);process.exitCode=1;});
