/* Scientific contracts and actual annotation controls; no browser/packages required. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const asset=path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio');
const source=fs.readFileSync(path.join(asset,'studio.js'),'utf8');
const productionHelpers=require(path.join(asset,'studio.js'));
const {statisticalComparisons,statisticalPText,statisticalSymbol,statisticalBracketPath,statisticalMethodName,comparisonLetters,History,validateState}=productionHelpers;
const i18n=require(path.join(asset,'i18n.js')),copy=x=>JSON.parse(JSON.stringify(x));
const html=fs.readFileSync(path.join(__dirname,'../demo/figure_studio/layout-studio.html'),'utf8');
const project=JSON.parse(html.match(/<script type=.*?>(.*?)<\/script>/s)[1]);
const independent=project.panels.find(p=>p.analysis?.design==='independent'&&p.analysis.group_order.length===2);
const paired=project.panels.find(p=>p.analysis?.design==='paired');
const multigroup=project.panels.find(p=>p.analysis?.group_order?.length===4);
const original=JSON.stringify(project),result=statisticalComparisons(independent.analysis);
assert.equal(result.comparisons[0].p,independent.analysis.primary_test.p_value);
assert.equal(result.letters,true);
assert.equal(statisticalComparisons(paired.analysis).comparisons[0].p,paired.analysis.primary_test.p_value);
assert.equal(statisticalComparisons(multigroup.analysis).comparisons.length,0,'omnibus P is never assigned to arbitrary pairs');
assert.match(statisticalComparisons(multigroup.analysis).reason,/总体检验/);
assert.equal(statisticalComparisons(independent.analysis,{methodChoice:{key:'sensitivity_test'}}).comparisons[0].p,independent.analysis.sensitivity_test.p_value);
assert.equal(statisticalComparisons(null).comparisons.length,0);
const supplied={group_order:['A','B','C'],primary_test:{name:'Welch one-way ANOVA',p_value:.01},pairwise_method:'Holm',pairwise:[{a:0,b:1,p:.7},{a:1,b:2,p:.6},{a:0,b:2,p:.005}]};
assert.deepEqual(comparisonLetters(3,statisticalComparisons(supplied).comparisons),['a','ab','b']);
assert.equal(statisticalComparisons(supplied).method,'Holm','pairwise correction is not mislabeled as the omnibus method');
assert.equal(statisticalComparisons({...supplied,pairwise:supplied.pairwise.slice(0,2)}).letters,false);
assert.equal(statisticalComparisons({...supplied,sensitivity_test:{p_value:.01}},{methodChoice:{key:'sensitivity_test'}}).comparisons.length,0,'changing methods never borrows primary pairwise results');
for(const bad of [[...supplied.pairwise,{a:1,b:0,p:.3}],[{a:0,b:3,p:.2}],[{a:0,b:1,p:-.1}],[{a:0,b:1,p:NaN}],[{a:0,b:1,p:1.1}],[{a:0,b:0,p:.1}]])assert.equal(statisticalComparisons({...supplied,pairwise:bad}).comparisons.length,0,'invalid family is rejected as a whole');
assert.equal(statisticalPText(0),' = 0','a rounded zero does not imply an invented reporting threshold');
for(const [p,standard,precise]of [[0,' = 0',' = 0'],[1,' = 1.000',' = 1.00'],[.032,' = 0.032',' = 0.0320'],[.001,' = 0.001',' = 0.00100'],[.000999,' < 0.001',' = 9.99 × 10⁻⁴'],[.000012345,' < 0.001',' = 1.23 × 10⁻⁵'],[.123456,' = 0.123',' = 0.123'],[.98765,' = 0.988',' = 0.988']]){
  assert.equal(statisticalPText(p),standard);assert.equal(statisticalPText(p,'standard'),standard);assert.equal(statisticalPText(p,'precise'),precise);
  for(const format of ['standard','precise'])for(const width of [52,96,240]){
    const plan=productionHelpers.statisticalLabelPlan(p,'p',width,24,null,format);
    const semantic=plan.lines.join(' ').replace(/\s/g,'');
    assert.ok(!semantic.includes('P=<'),'less-than reporting never becomes an equality');
    if(format==='standard')assert.equal(semantic,('P'+standard).replace(/\s/g,''),'wrapping preserves standard display operator and value');
    if(format==='precise'&&p>0&&p<.001)assert.equal(semantic,('P'+precise).replace(/\s/g,''),'scientific mantissa and exponent remain complete');
  }
}
for(const bad of [NaN,Infinity,-.01,1.01])assert.throws(()=>statisticalPText(bad));
assert.equal(statisticalPText(independent.analysis.primary_test.p_value),' < 0.001');
assert.equal(statisticalPText(independent.analysis.primary_test.p_value,'precise'),' = 2.23 × 10⁻⁹');
assert.equal(statisticalComparisons({...supplied,pairwise:[{a:0,b:1,p:0}]}).zero,true);
for(const [p,count] of [[.051,0],[.05,0],[.049,1],[.01,1],[.009,2],[.001,2],[.0009,3],[.0001,3],[.00009,4]]){
  assert.equal(statisticalSymbol(p),count?'*'.repeat(count):'ns');assert.equal(statisticalSymbol(p,'hash'),count?'#'.repeat(count):'ns');
}
assert.equal(statisticalBracketPath(50,10,20,1,'line'),'M 10 20 H 50');
assert.match(statisticalBracketPath(10,50,20,1,'bracket'),/V 20 H 50 V 23/);
assert.match(statisticalBracketPath(10,50,20,1,'rounded'),/Q/);
for(const name of ['Welch two-sample t-test','Paired t-test','Wilcoxon signed-rank test','Welch one-way ANOVA']){
  const zh=statisticalMethodName(name);assert.match(zh,/[\u4e00-\u9fff]/);assert.ok(i18n.en[zh]);
}
assert.equal(statisticalMethodName('User-specified custom analysis'),'User-specified custom analysis','unknown method names are preserved');
assert.equal(JSON.stringify(project),original,'presentation helpers preserve original rows and analysis values');

// Production anchor-selection routine accepts only recorded, single-axis categories.
const start=source.indexOf('  function statisticalAnchorElements('),end=source.indexOf('  function measureStatisticalAnchors(',start);
const context={};vm.runInNewContext(source.slice(start,end),context);
const tick=text=>({textContent:text}),artist={id:'PathCollection_1',querySelector:()=>({})};
const categorySvg=(labels,axesCount=1,artists=[artist])=>({querySelector:()=>null,querySelectorAll:()=>Array.from({length:axesCount},()=>({children:artists,querySelectorAll:()=>labels.map(label=>({querySelector:()=>tick(label)}))}))});
assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Treatment']),['Control','Treatment']).kind,'categories');
assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Treatment'],2),['Control','Treatment']),null,'facets need explicit per-axis comparisons');
assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Other']),['Control','Treatment']),null,'category order is never guessed');
assert.equal(context.statisticalAnchorElements(categorySvg(['0','1']),['Control','Treatment']),null,'numeric positions do not imply group identity');
for(const id of ['studio-mark-0-points-1','studio-mark-0-marker-1','studio-mark-0-0-cap-0','studio-mark-0-0-stem-0']){
  const marked={id,querySelector:selector=>selector==='[clip-path]'?{}:null};
  assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Treatment'],1,[marked]),['Control','Treatment']).artists[0],marked,'editable mark metadata preserves category anchor detection');
  assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Other'],1,[marked]),['Control','Treatment']),null,'new artist ids do not bypass exact group identity');
  assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Treatment'],2,[marked]),['Control','Treatment']),null,'new artist ids do not bypass unique axis validation');
}
assert.equal(context.statisticalAnchorElements(categorySvg(['Control','Treatment'],1,[{id:'studio-mark-styles',querySelector:()=>null}]),['Control','Treatment']),null,'mark metadata and unclipped decoration cannot count as plotted observations');
const bars={querySelector:()=>({querySelector:()=>({})})};assert.equal(context.statisticalAnchorElements(bars,['Control','Treatment']).kind,'bars');

// Run the actual information gate and change handler against a real analysis fixture.
const panelId=independent.id,initial={order:[panelId],columns:1,gap:12,panels:{[panelId]:{variant:0,edits:{}}}};
const history=new History(initial),nodes={annotationStyle:{value:''},annotationLine:{value:'bracket'}};
let currentPanel={...independent,variants:[{...independent.variants[0],preserveAspect:false}]},lastMessage='',refreshes=0,pendingStyle='';
const ctx={...productionHelpers,...context,statisticalComparisons,comparisonLetters,copy,state:()=>history.current,panel:()=>currentPanel,statisticalAnalysisFor:()=>currentPanel.analysis,baseSvg:()=>categorySvg(independent.analysis.group_order),selectedPanel:panelId,$:id=>nodes[id],T:x=>x,commit:(next)=>{validateState(next,{panels:[currentPanel]});history.commit(next);},say:text=>{lastMessage=text;},renderStatisticalAnnotations:()=>refreshes++,openStatistics:style=>{pendingStyle=style;}};
const metricStart=source.indexOf('  function anchoredStatisticalLayout('),metricEnd=source.indexOf('  function translateStatisticalElement(',metricStart);
assert.ok(metricStart>0&&metricEnd>metricStart);vm.runInNewContext(source.slice(metricStart,metricEnd),ctx);
const infoStart=source.indexOf('  function statisticalAnnotationSets('),infoEnd=source.indexOf('  function renderStatisticalAnnotations(',infoStart);
vm.runInNewContext(source.slice(infoStart,infoEnd),ctx);
Object.assign(ctx,{selected:[],elementSelections:[],selectionAnchor:null,transferStatisticalStyleEdits:()=>{}});
const handler=source.split('\n').find(line=>line.includes("$('annotationStyle').onchange=()=>"));vm.runInNewContext(handler,ctx);
for(const style of ['letters','stars','hash','p','']){nodes.annotationStyle.value=style;nodes.annotationStyle.onchange();assert.equal(history.current.panels[panelId].annotationStyle,style||undefined);}
history.undo();assert.equal(history.current.panels[panelId].annotationStyle,'p');history.redo();assert.equal(history.current.panels[panelId].annotationStyle,undefined);
const snapshot=JSON.stringify(history.current),count=history.states.length;
currentPanel={...currentPanel,analysis:multigroup.analysis};nodes.annotationStyle.value='letters';nodes.annotationStyle.onchange();
assert.equal(JSON.stringify(history.current),snapshot);assert.equal(history.states.length,count);assert.equal(pendingStyle,'letters','missing pairwise results open the analysis setup without fake marks');assert.equal(refreshes,0);
currentPanel={...currentPanel,analysis:independent.analysis,variants:[{...currentPanel.variants[0],preserveAspect:true}]};nodes.annotationStyle.onchange();assert.equal(ctx.statisticalAnnotationInfo(panelId).placement,'plot');assert.equal(ctx.statisticalAnnotationInfo(panelId).preservePlot,true);assert.equal(history.current.panels[panelId].annotationStyle,'letters');assert.equal(history.states.length,count+1,'reliable categories use automatic on-plot labels while preserving the source geometry');
const analyzed=copy(history.current);analyzed.panels[panelId].statistics={binding:'external',tableKey:'source-table',data_sha256:'analysis-table',config:{value:'PC1 score',group:'Condition'},analysis:copy(independent.analysis),inputRows:[['unit','group','value'],['private-unit','Control','1']]};
assert.equal(ctx.statisticalAnnotationInfo(panelId,analyzed).bandTitle,'本小图组间比较 · PC1 score','the tested variable is explicit, not an implied test of the complete embedding');
const provenance=JSON.parse(JSON.stringify(ctx.statisticalExportRecords(analyzed)));
assert.equal(provenance[0].analysis.primary_test.p_value,independent.analysis.primary_test.p_value);
assert.equal(provenance[0].config.value,'PC1 score');assert.equal(provenance[0].tableKey,'source-table');assert.equal(provenance[0].data_sha256,'analysis-table');
assert.equal(provenance[0].inputRows,undefined,'SVG provenance records analysis configuration and results, not uploaded raw rows');
assert.equal(JSON.stringify(provenance).includes('private-unit'),false);
const invalid=copy(initial);invalid.panels[panelId].annotationLine='made-up';assert.throws(()=>validateState(invalid,{panels:[independent]}));
const formatResetCalls=[];nodes.annotationPFormat={value:'precise'};ctx.clearStatisticalResultEdits=(next,id)=>formatResetCalls.push(id);
const formatHandler=source.split('\n').find(line=>line.includes("$('annotationPFormat').onchange=()=>"));assert.ok(formatHandler);vm.runInNewContext(formatHandler,ctx);
for(const format of ['precise','standard']){nodes.annotationPFormat.value=format;nodes.annotationPFormat.onchange();assert.equal(history.current.panels[panelId].annotationPFormat,format);}
assert.deepEqual(formatResetCalls,[panelId,panelId]);history.undo();assert.equal(history.current.panels[panelId].annotationPFormat,'precise');history.redo();assert.equal(history.current.panels[panelId].annotationPFormat,'standard');
const badFormat=copy(initial);badFormat.panels[panelId].annotationPFormat='unknown';assert.throws(()=>validateState(badFormat,{panels:[independent]}));
nodes.showFacetTitles={checked:false};const titleHandler=source.split('\n').find(line=>line.includes("$('showFacetTitles').onchange=()=>"));assert.ok(titleHandler);vm.runInNewContext(titleHandler,ctx);nodes.showFacetTitles.onchange();assert.equal(history.current.panels[panelId].showFacetTitles,false);nodes.showFacetTitles.checked=true;nodes.showFacetTitles.onchange();assert.equal(history.current.panels[panelId].showFacetTitles,true);history.undo();assert.equal(history.current.panels[panelId].showFacetTitles,false);history.redo();assert.equal(history.current.panels[panelId].showFacetTitles,true);
const invalidTitles=copy(initial);invalidTitles.panels[panelId].showFacetTitles='false';assert.throws(()=>validateState(invalidTitles,{panels:[independent]}));
assert.equal(JSON.stringify(project),original);

// Reanalysis clears old computed text/visibility/position overrides by actual SVG
// metadata, not by a numeric key range that also contains manual scale bars.
const previous={panels:{p:{edits:{0:{e900000:{text:'old P',fill:'#4477aa','font-size':'24','offset-x':'8'},e900001:{hidden:'true'},e900002:{text:'100 μm'},e5:{text:'Response'},e900003:{'offset-y':'4'}}}}}};
const cleaned=copy(previous),beforeReset=JSON.stringify(previous),calls=[];
const resetStart=source.indexOf('  function clearStatisticalResultEdits('),resetEnd=source.indexOf('  function renderAlignmentGuideControls(',resetStart);
const resetContext={state:()=>previous,editedSvg:(id,vi,snapshot)=>{calls.push({id,vi});return {querySelectorAll:()=> (snapshot===previous?['e900000']:['e900001']).map(key=>({getAttribute:()=>key}))};}};
vm.runInNewContext(source.slice(resetStart,resetEnd),resetContext);resetContext.clearStatisticalResultEdits(cleaned,'p');
assert.deepEqual(cleaned.panels.p.edits[0].e900000,{fill:'#4477aa','font-size':'24'});
assert.equal(cleaned.panels.p.edits[0].e900001,undefined);
assert.equal(cleaned.panels.p.edits[0].e900002.text,'100 μm','scale-bar text remains unchanged');
assert.equal(cleaned.panels.p.edits[0].e5.text,'Response');assert.equal(cleaned.panels.p.edits[0].e900003['offset-y'],'4');
assert.equal(JSON.stringify(previous),beforeReset);assert.equal(calls.length,2);

// Changing a statistical font clears only the corresponding per-element font
// override; it must not reset manual placement, visibility, colour or source text.
const fontPrevious={panels:{p:{edits:{0:{e900000:{'font-family':'Arial','font-size':'32','font-weight':'700',fill:'#123456',hidden:'true','offset-x':'6'},e900001:{'font-size':'24'},e900002:{'font-size':'18'},e5:{text:'Caption','font-size':'12'},e900009:{text:'50 μm','font-size':'10'}}}}}},fontNext=copy(fontPrevious),fontSnapshot=JSON.stringify(fontPrevious);
const fontContext={state:()=>fontPrevious,editedSvg:(id,vi,snapshot)=>({querySelectorAll:()=>[{getAttribute:()=>snapshot===fontPrevious?'e900000':'e900002',querySelectorAll:()=>[{getAttribute:()=> 'e900001'}]}]})};
const fontStart=source.indexOf('  function clearStatisticalFontEdits('),fontEnd=source.indexOf('  function renderAlignmentGuideControls(',fontStart);assert.ok(fontStart>0&&fontEnd>fontStart);vm.runInNewContext(source.slice(fontStart,fontEnd),fontContext);fontContext.clearStatisticalFontEdits(fontNext,'p',['font-size']);
assert.deepEqual(fontNext.panels.p.edits[0].e900000,{'font-family':'Arial','font-weight':'700',fill:'#123456',hidden:'true','offset-x':'6'});assert.equal(fontNext.panels.p.edits[0].e900001,undefined);assert.equal(fontNext.panels.p.edits[0].e900002,undefined);assert.deepEqual(fontNext.panels.p.edits[0].e5,fontPrevious.panels.p.edits[0].e5);assert.deepEqual(fontNext.panels.p.edits[0].e900009,fontPrevious.panels.p.edits[0].e900009);assert.equal(JSON.stringify(fontPrevious),fontSnapshot);

const ui=fs.readFileSync(path.join(asset,'studio.html'),'utf8'),stats=ui.indexOf('id="statisticalAnnotations"'),geometry=ui.indexOf('id="barGeometry"');
assert.ok(stats>=0&&stats<geometry&&ui.indexOf('</section>',stats)<geometry,'statistical tools are outside the conditional bar-geometry details');
assert.ok(ui.includes('id="configureStatistics"')&&ui.includes('id="statisticsDialog"'),'missing results have an automated analysis entry');
const methodSection=ui.slice(ui.indexOf('<details id="methodExplorer">'),ui.indexOf('</details>',ui.indexOf('<details id="methodExplorer">')));
assert.ok(methodSection.includes('id="methodConfigureStatistics"'),'the discoverable Statistical analysis section opens the same analysis workflow');
i18n.setLanguage('en');
const entryNodes={configureStatistics:{},methodConfigureStatistics:{}},entryContext={$:id=>entryNodes[id],p:{},locked:false,T:key=>i18n.t(key),state:()=>({panels:{active:entryContext.p}}),selectedPanel:'active',openStatistics:style=>entryContext.openedStyle=style};
const entrySync=source.split('\n').find(line=>line.includes("for(const id of ['configureStatistics','methodConfigureStatistics'])"));
for(const [record,locked,label]of [[undefined,false,'完成统计分析'],[{stale:false},false,'更新统计分析'],[{stale:true},false,'完成统计分析'],[{stale:false},true,'更新统计分析']]){
  entryContext.p.statistics=record;entryContext.locked=locked;vm.runInNewContext(entrySync,entryContext);
  for(const node of Object.values(entryNodes)){assert.equal(node.disabled,locked);assert.equal(node.textContent,i18n.t(label));assert.match(node.textContent,/analysis/);}
}
for(const id of Object.keys(entryNodes)){
  vm.runInNewContext(source.split('\n').find(line=>line.includes(`$('${id}').onclick=()=>openStatistics(`)),entryContext);
  entryContext.p.annotationStyle='letters';entryNodes[id].onclick();assert.equal(entryContext.openedStyle,'letters');
  delete entryContext.p.annotationStyle;entryNodes[id].onclick();assert.equal(entryContext.openedStyle,'p');
}
// Newly calculated pairwise/facet results must appear here even when the source
// panel has no legacy analyses. Stale results are never presented as current.
const methodNode=()=>({children:[],textContent:'',append(...items){this.children.push(...items);},replaceChildren(){this.children=[];}});
const methodNodes={analysisGoal:{value:'mean'},methodReason:{},methodCards:methodNode(),methodRequirements:methodNode()},methodPanel={analysis:{},table:{sha256:'active-table'}},methodState={panels:{active:{statistics:{tableKey:'active-table',analysis:copy(supplied)}}}};
const methodsContext={document:{createElement:methodNode},$:id=>methodNodes[id],selectedPanel:'active',state:()=>methodState,panel:()=>methodPanel,T:(key,...args)=>i18n.t(key,...args),statisticalComparisons,statisticalMethodName,methodOrder:productionHelpers.methodOrder};
const analysisStart=source.indexOf('  function statisticalAnalysisFor('),analysisEnd=source.indexOf('  function comparisonsFor(',analysisStart),methodsStart=source.indexOf('  function renderMethods('),methodsEnd=source.indexOf('  function render() {',methodsStart);
vm.runInNewContext(source.slice(analysisStart,analysisEnd)+source.slice(methodsStart,methodsEnd),methodsContext);
const beforeMethods=JSON.stringify(methodState);methodsContext.renderMethods();
assert.equal(methodNodes.methodCards.children.length,1);assert.equal(methodNodes.methodCards.children[0].children[0].textContent,'Holm correction');assert.equal(methodNodes.methodCards.children[0].children[1].textContent,'3 group comparisons connected.');assert.equal(JSON.stringify(methodState),beforeMethods);assert.equal(methodNodes.analysisGoal.disabled,true);
methodState.panels.active.statistics.analysis={facets:[{...copy(supplied),label:'Day 1'},{...copy(supplied),label:'Day 7'}]};methodsContext.renderMethods();assert.equal(methodNodes.methodCards.children.length,2);assert.match(methodNodes.methodCards.children[0].children[0].textContent,/Day 1/);assert.match(methodNodes.methodCards.children[1].children[0].textContent,/Day 7/);
for(const update of [{stale:true,tableKey:'active-table'},{stale:false,tableKey:'outdated-table'}]){Object.assign(methodState.panels.active.statistics,update);methodsContext.renderMethods();assert.equal(methodNodes.methodCards.children.length,0);assert.match(methodNodes.methodRequirements.textContent,/data changed/i);}
i18n.setLanguage('zh-CN');
assert.ok(ui.includes('按最终尺寸检查文字、标注位置、颜色语义、科学符号与图像分辨率。'));
console.log('Statistical annotations: original P values, valid families/CLD, method isolation, zero precision, bilingual names, anchors, immediate controls, undo and unsupported states passed');
