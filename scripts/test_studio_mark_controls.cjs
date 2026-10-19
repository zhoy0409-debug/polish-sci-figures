'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root='skills/polish-sci-figures/assets/figure-studio/';
const code=fs.readFileSync(root+'studio.js','utf8'),html=fs.readFileSync(root+'studio.html','utf8');
const core=require('../'+root+'studio.js'),marks=require('../'+root+'mark-style.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const initial={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}};
const project={id:'mark-controls-test',panels:[{id:'panel-0',variants:[{name:'grouped_observations'},{name:'compare_facet_boxes'}]}]};
for(const value of [null,[],{'red':'#123456'},{'#123456':'url(https://bad.invalid)'},Object.fromEntries(Array.from({length:257},(_,i)=>['#'+i.toString(16).padStart(6,'0'),'#112233']))]){
  const state=clone(initial);state.panels['panel-0'].markPalette=value;assert.throws(()=>core.validateState(state,project));
}
const state=clone(initial);state.panels['panel-0'].markPalette={'#4477aa':'#22aa66'};core.validateState(state,project);
const section=html.slice(html.indexOf('<section data-pane="detail"><details id="markControls"'),html.indexOf('<section data-pane="annotation" id="statisticalAnnotations"'));
assert.ok(section.endsWith('</section>\n')||section.endsWith('</section>\r\n'));
for(const id of ['pointsVisible','errorsVisible','pointFillMode','pointStrokeMode','errorColorMode','pointScale','errorCapWidth'])assert.equal([...section.matchAll(new RegExp('id="'+id+'"','g'))].length,1,'one obvious control for '+id);
assert.equal((code.match(/\$\('errorDirection'\)\.onchange=/g)||[]).length,1,'direction must have one guarded handler');
console.log('Mark control structure, palette validation and single-entry bindings passed');

async function domChecks(){
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<!doctype html><body>'+section+'<svg id="artboard"></svg></body>',{pretendToBeVisual:true});
  const $=id=>dom.window.document.getElementById(id),source=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
    <defs><path id="symbol" d="M-3 0L3 0L0 3Z"/></defs>
    <g id="axes_1"><g id="patch_2"><path d="M0 0L240 0L240 160L0 160Z" style="fill:#ffffff"/></g><g id="bar"><path data-key="e1" d="M20 150L50 150L50 80L20 80Z" style="fill:#4477aa"/></g>
    <g id="points"><use data-key="e2" href="#symbol" x="35" y="70" style="fill:#4477aa;stroke:#4477aa"/></g>
    <g id="line"><path data-key="e3" d="M10 60L80 50" style="fill:none;stroke:#4477aa"/></g>
    <g id="error"><path data-key="e4" d="M35 50L35 90" style="fill:none;stroke:#20242a"/></g></g>
    <metadata id="studio-mark-styles">${JSON.stringify({version:1,points:['points'],pointColors:[{id:'points',kind:'collection',colorSource:{id:'bar',paint:'fill'}}],errors:[{id:'error',caps:[],segments:[{axis:'y',ends:[[35,50],[35,90]],center:[35,70]}],colorSource:{id:'bar',paint:'fill'},capWidth:6,lineWidth:1}]})}</metadata>
  </svg>`;
  const parse=text=>new dom.window.DOMParser().parseFromString(text,'image/svg+xml').documentElement;
  const history=new core.History(initial),frames=new Map();let frameId=0,previews=0,commits=0;
  const context={console,document:dom.window.document,StudioMarkStyle:marks,copy:clone,project:clone(project),selectedPanel:'panel-0',original:false,selected:[],panelSelection:[],templateCache:new Map(),inspectorPreviewCache:{},zoomView:null,
    state:()=>history.current,panel:id=>context.project.panels.find(p=>p.id===id),$: $,T:(key,...values)=>key.replace(/\{(\d+)\}/g,(_,n)=>values[+n]),
    baseSvg:()=>parse(source),sanitize:parse,keysToObjects:svg=>[...svg.querySelectorAll('[data-key]')],hex:value=>/^#[\da-f]{6}$/i.test(value||'')?value.toLowerCase():null,
    paint:(node,property)=>node.style.getPropertyValue(property)||node.getAttribute(property)||(property==='fill'?'#000000':'none'),paletteSourceColors:()=>['#4477aa'],
    editsFor:(id,vi,s=history.current)=>s.panels[id].edits[vi]||{},setEdit:(s,id,vi,key,property,value)=>{((s.panels[id].edits[vi]??={})[key]??={})[property]=value;},
    layout:()=>({positions:[{id:'panel-0',width:240,height:160}]}),fittedVariant:()=>null,annotationFirstTopHeight:()=>0,
    requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),
    previewCategorySpacing:()=>previews++,renderCanvas:()=>{},commit:next=>{core.validateState(next,context.project);history.commit(next);commits++;context.renderMarkControls();},
    validateProject:()=>{},validateState:core.validateState,installPanelState:core.installPanelState,StudioI18n:{preserveDisplayNames:()=>{}},captureProfile:()=>[{colors:[],roles:{}}],chromatic:()=>true,migrateStableTextEdits:()=>({}),validValue:()=>true,matchSizes:()=>{throw Error('appearance-preserving install must not reset layout');}
  };
  vm.createContext(context);
  const start=code.indexOf('  let markGesture=null,markFrame=0;');
  // The source declaration may contain additional UI-only state after markFrame.
  const realStart=start>=0?start:code.indexOf('  let markGesture=null,markFrame=0,');
  vm.runInContext(code.slice(realStart,code.indexOf('  function renderInspector()',realStart)),context);
  const pane=() =>history.current.panels[context.selectedPanel];
  const click=mode=>$('pointControls').querySelector('[data-point-mode="'+mode+'"]').click();
  const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new dom.window.Event('change'));};
  const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new dom.window.Event('input'));};
  const flush=()=>{const calls=[...frames.values()];frames.clear();calls.forEach(fn=>fn());};
  context.renderMarkControls();
  context.StudioMarkStyle={...marks,inspect:svg=>{const info=marks.inspect(svg);return{...info,errors:info.errors.map(error=>({...error,colorSource:undefined,segments:error.segments.map(segment=>({...segment,colorSource:undefined}))}))};}};
  context.renderMarkControls();assert.equal([...$('errorColorMode').options].find(option=>option.value==='group').disabled,true);const unsupportedCount=commits;change('errorColorMode','group');assert.equal(commits,unsupportedCount,'unidentified sources cannot silently use a guessed group color');context.StudioMarkStyle=marks;context.renderMarkControls();
  const directPoints=parse(source);directPoints.querySelector('#points').innerHTML='<path data-key="e2" d="M32 70L38 70L35 73Z"/>';assert.equal(context.markUsePreviewNodes(directPoints),null,'direct-path marks must take the complete preview path');assert.equal(context.markUsePreviewNodes(parse(source)).length,1);
  click('hollow');assert.equal(pane().markStyle.pointFill,'none');assert.equal(pane().edits[0].e2.fill,'none');assert.equal(pane().edits[1].e2.fill,'none');
  assert.equal(pane().edits[0].e1,undefined,'point presets must not recolor bars');assert.equal(pane().edits[0].e3,undefined,'point presets must not recolor lines');
  click('custom');assert.equal($('pointCustomControls').hidden,false);
  change('pointFillMode','custom');input('pointFillColor','#f4a261');input('pointFillColor','#ee7733');
  assert.equal(frames.size,1,'multiple color inputs must share one animation frame');const beforeCommit=commits;flush();assert.equal(previews,1);
  $('pointFillColor').dispatchEvent(new dom.window.Event('change'));$('pointFillColor').dispatchEvent(new dom.window.Event('blur'));
  assert.equal(commits,beforeCommit+1,'change followed by blur creates one undo step');assert.equal(pane().markStyle.pointFill,'#ee7733');
  change('pointStrokeMode','custom');input('pointStrokeColor','#123456');$('pointStrokeColor').dispatchEvent(new dom.window.Event('change'));
  assert.equal(pane().markStyle.pointFill,'#ee7733');assert.equal(pane().markStyle.pointStroke,'#123456');
  input('pointStrokeWidth','0');$('pointStrokeWidth').dispatchEvent(new dom.window.Event('change'));assert.equal(pane().markStyle.pointStrokeWidth,0,'zero-width outline is a valid explicit choice');
  const customStyle=clone(pane().markStyle);$('pointsVisible').checked=false;$('pointsVisible').dispatchEvent(new dom.window.Event('change'));
  assert.equal(pane().markStyle.pointsVisible,false);assert.equal($('pointScale').disabled,true);assert.equal($('pointsVisible').disabled,false);
  assert.equal(pane().markStyle.pointFill,customStyle.pointFill);$('pointsVisible').checked=true;$('pointsVisible').dispatchEvent(new dom.window.Event('change'));assert.equal($('pointScale').disabled,false);
  change('errorColorMode','#20242a');assert.equal(pane().markStyle.errorColor,'#20242a');assert.equal(pane().edits[0].e4.stroke,'#20242a');
  change('errorColorMode','#7a7f87');assert.equal(pane().edits[0].e4.stroke,'#7a7f87');
  change('errorColorMode','custom');assert.equal($('errorColor').hidden,false);input('errorColor','#44bb88');$('errorColor').dispatchEvent(new dom.window.Event('change'));
  const independentError=pane().edits[0].e4.stroke;click('solid');assert.equal(pane().edits[0].e4.stroke,independentError,'point preset cannot erase independent error paint');
  $('errorsVisible').checked=false;$('errorsVisible').dispatchEvent(new dom.window.Event('change'));assert.equal($('errorColorMode').disabled,true);assert.equal($('errorDirection').disabled,true);assert.equal(pane().markStyle.errorColor,'#44bb88');
  $('errorsVisible').checked=true;$('errorsVisible').dispatchEvent(new dom.window.Event('change'));change('errorDirection','negative');assert.equal(pane().errorDirection,'negative');
  const saved=clone(history.current),count=commits;input('pointScale','2.5');flush();$('pointScale').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));$('pointScale').dispatchEvent(new dom.window.Event('change'));
  assert.equal(commits,count);assert.deepEqual(history.current,saved,'Escape must restore preview without changing project history');
  input('pointScale','1.5');const unrelated=clone(history.current);unrelated.gap=22;history.commit(unrelated);$('pointScale').dispatchEvent(new dom.window.Event('change'));assert.equal(history.current.gap,22);assert.equal(pane().markStyle.pointScale,undefined,'stale gesture cannot overwrite another edit');
  const locked=clone(history.current);locked.panels['panel-0'].locked=true;history.commit(locked);context.renderMarkControls();const lockedCount=commits;
  $('resetMarkStyle').onclick();context.changeMarkStyle(p=>{p.markStyle={pointScale:3};});assert.equal(commits,lockedCount,'programmatic entry must respect panel lock too');
  history.undo();context.renderMarkControls();context.original=true;$('resetMarkStyle').onclick();assert.equal(commits,lockedCount);context.original=false;
  // The real palette transition must preserve independent colors and update
  // group-linked markers, across both source variants.
  vm.runInContext(code.slice(code.indexOf('  function paletteState('),code.indexOf('  function bindPaletteCard(')),context);
  context.$=id=>id==='scope'?{value:'panel'}:$(id);
  click('hollow');change('errorColorMode','#20242a');const current=history.current;
  const prepared={saved:current,scope:'panel',panelId:'panel-0',entries:[0,1].map(vi=>({id:'panel-0',vi,allColors:['#4477aa'],channels:[{key:'e1',prop:'fill',index:0},{key:'e2',prop:'fill',index:0},{key:'e2',prop:'stroke',index:0},{key:'e3',prop:'stroke',index:0}]}))};
  const recolored=context.paletteState(['#228833'],null,prepared);assert.equal(recolored.panels['panel-0'].edits[0].e2.fill,'none');assert.equal(recolored.panels['panel-0'].edits[0].e2.stroke,'#228833');assert.equal(recolored.panels['panel-0'].edits[0].e4.stroke,'#20242a');
  context.commit(recolored);click('custom');change('pointFillMode','custom');input('pointFillColor','#aa3377');$('pointFillColor').dispatchEvent(new dom.window.Event('change'));
  const reloaded=JSON.parse(JSON.stringify(history.current));core.validateState(reloaded,context.project);assert.equal(reloaded.panels['panel-0'].markPalette['#4477aa'],'#228833');
  // Colors chosen before hiding must survive a palette change while hidden.
  for(const id of ['pointsVisible','errorsVisible']){$(id).checked=false;$(id).dispatchEvent(new dom.window.Event('change'));}
  const hiddenPalette=context.paletteState(['#ccbb44'],null,{...prepared,saved:history.current});context.commit(hiddenPalette);
  assert.equal(pane().markStyle.pointsVisible,false);assert.equal(pane().markStyle.errorsVisible,false);assert.equal(pane().edits[0].e2.fill,'#aa3377');assert.equal(pane().edits[0].e4.stroke,'#20242a');
  $('pointsVisible').checked=true;$('pointsVisible').dispatchEvent(new dom.window.Event('change'));assert.equal(pane().edits[0].e2.fill,'#aa3377','restoring hidden points preserves their independent color');
  const beforeInstall=clone(pane());
  vm.runInContext(code.slice(code.indexOf('  function installAsset('),code.indexOf("  $('importImage').onclick=",code.indexOf('  function installAsset('))),context);
  context.installAsset({variants:[{name:'grouped_observations',svg:source,width:240,height:160,viewBox:[0,0,240,160]}]},'panel-0',null,'Replace data',true);
  assert.deepEqual(pane().markStyle,beforeInstall.markStyle,'data replacement preserves all independent appearances and visibility');assert.equal(pane().errorDirection,beforeInstall.errorDirection);assert.deepEqual(pane().markPalette,beforeInstall.markPalette);assert.equal(pane().edits[0].e2.fill,'#aa3377','inherited custom style must survive profile palette edits');
  $('resetMarkStyle').click();assert.equal(pane().markStyle,undefined);assert.equal(pane().errorDirection,undefined);assert.equal($('pointsVisible').checked,true);assert.equal($('errorsVisible').checked,true);
  assert.equal(pane().edits[0]?.e1,undefined,'reset never edits bars');assert.equal(pane().edits[0]?.e3,undefined,'reset never edits connecting lines');
  // A legacy local project upgrades only semantic metadata, not artwork or
  // the user's edit records. Opening Properties is the explicit local trigger.
  const semantic=require('../'+root+'statistical-metadata.js'),oldSvg=parse(source),meta=oldSvg.querySelector('metadata'),oldInfo=JSON.parse(meta.textContent);
  delete oldInfo.pointColors;for(const error of oldInfo.errors)delete error.colorSource;meta.textContent=JSON.stringify(oldInfo);
  const oldSource=new dom.window.XMLSerializer().serializeToString(oldSvg),upgradeProject={id:'legacy-upgrade',panels:[{id:'panel-0',recipe:{family:'gallery',parameters:{view:'grouped_observations'}},table:{sha256:'table',rows:[['group','value'],['Control','1']]},variants:[{name:'grouped_observations',sha256:'variant',width:240,height:160,svg:oldSource}]}]};
  const upgradeState=clone(initial);upgradeState.panels['panel-0'].edits={0:{e2:{fill:'#abcdef','offset-x':'3'}}};const stateBefore=JSON.stringify(upgradeState);let requests=0,persisted=0;
  const upgrade={project:upgradeProject,selectedPanel:'panel-0',activePane:'detail',dataSerial:0,localEngine:{token:'local-test'},engineConnection:'connected',StudioMarkStyle:marks,StudioStatisticalMetadata:semantic,
    state:()=>upgradeState,panel:id=>upgrade.project.panels.find(p=>p.id===id),sanitize:parse,copy:clone,T:x=>x,XMLSerializer:dom.window.XMLSerializer,templateCache:new Map(),render:()=>{},persist:()=>persisted++,say:message=>{throw Error(message);},engineFetch:async()=>{requests++;return{ok:true,json:async()=>({variant:{svg:source}})};}};
  vm.createContext(upgrade);vm.runInContext(code.slice(code.indexOf('  const statisticalUpgradeRequests='),code.indexOf('  async function ensureHeatmapMetadata()')),upgrade);
  upgrade.document={querySelectorAll:()=>[]};upgrade.$=()=>({parentElement:{}});upgrade.renderInspectorPreviews=()=>{};upgrade.renderCanvas=()=>{};upgrade.mobileWorkspace=null;upgrade.imageInsets=null;upgrade.imageColorUI=null;upgrade.imageRectifyUI=null;upgrade.imageLinks=null;
  vm.runInContext(code.slice(code.indexOf('  function showPane('),code.indexOf('  const state =',code.indexOf('  function showPane('))),upgrade);
  upgrade.activePane='chart';await upgrade.ensureStatisticalMetadata();assert.equal(requests,0);
  const upgradeFunction=upgrade.ensureStatisticalMetadata;let triggered;upgrade.ensureStatisticalMetadata=()=>triggered=upgradeFunction();upgrade.showPane('detail');await triggered;assert.equal(requests,1);assert.equal(persisted,1);const enriched=upgrade.project.statisticalRenders['panel-0/0'];assert.ok(semantic.isCurrentMarks(parse(enriched.svg)));assert.equal(upgrade.project.panels[0].variants[0].svg,oldSource);assert.equal(JSON.stringify(upgradeState),stateBefore);
  await upgrade.ensureStatisticalMetadata();assert.equal(requests,1,'current metadata must not trigger a repeated local render');
  // Browser display:none collapses its bbox. Run the real SVG rendering order
  // and category-spacing implementation with a deterministic geometry adapter;
  // this reproduces the hidden-mark failure without jsdom claiming SVG layout.
  const spacing=require('../'+root+'group-spacing.js');
  const categorySource=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160"><defs><clipPath id="plot-clip"><rect x="10" y="10" width="220" height="130"/></clipPath><path id="point-symbol" d="M-3 0L3 0L0 3Z"/></defs><g id="axes_1">${[60,180].map((x,i)=>`<g id="xtick_${i+1}" data-box="${x-15},140,${x+15},155"><use href="#point-symbol" x="${x}" y="140"/><text x="${x}" y="153">${i?'Treatment':'Control'}</text></g><g id="patch_${i+3}" data-box="${x-10},80,${x+10},140"><path data-key="e${i*3+1}" clip-path="url(#plot-clip)" d="M${x-10} 140L${x+10} 140L${x+10} 80L${x-10} 80Z" style="fill:#4477aa"/></g><g id="studio-mark-points-${i}" data-box="${x-3},67,${x+3},73"><use data-key="e${i*3+2}" href="#point-symbol" x="${x}" y="70" clip-path="url(#plot-clip)" style="fill:#4477aa;stroke:#4477aa"/></g><g id="studio-mark-error-${i}" data-box="${x},50,${x},90"><path data-key="e${i*3+3}" d="M${x} 50L${x} 90" clip-path="url(#plot-clip)" style="fill:none;stroke:#20242a"/></g>`).join('')}</g><metadata id="studio-mark-styles">${JSON.stringify({version:1,points:[0,1].map(i=>'studio-mark-points-'+i),pointColors:[0,1].map(i=>({id:'studio-mark-points-'+i,kind:'collection',colorSource:{id:'patch_'+(i+3),paint:'fill'}})),errors:[60,180].map((x,i)=>({id:'studio-mark-error-'+i,caps:[],segments:[{axis:'y',ends:[[x,50],[x,90]],center:[x,70]}],colorSource:{id:'patch_'+(i+3),paint:'fill'}}))})}</metadata><metadata id="studio-category-groups">${JSON.stringify({version:1,axes:[{axis:'axes_1',groups:[0,1].map(i=>({label:i?'Treatment':'Control',tick:'xtick_'+(i+1),members:['xtick_'+(i+1),'patch_'+(i+3),'studio-mark-points-'+i,'studio-mark-error-'+i]}))}]})}</metadata></svg>`;
  class Matrix{constructor(a=1,b=0,c=0,d=1,e=0,f=0){Object.assign(this,{a,b,c,d,e,f});}inverse(){return new Matrix(this.d,-this.b,-this.c,this.a,-this.e,-this.f);}multiply(m){return new Matrix(this.a*m.a+this.c*m.b,this.b*m.a+this.d*m.b,this.a*m.c+this.c*m.d,this.b*m.c+this.d*m.d,this.a*m.e+this.c*m.f+this.e,this.b*m.e+this.d*m.f+this.f);}}
  const categorySvg=()=>{const svg=parse(categorySource);for(const node of [svg,...svg.querySelectorAll('*')])node.getScreenCTM=()=>new Matrix();return svg;};
  const measure=node=>{for(let n=node;n;n=n.parentElement)if(n.style?.display==='none')return{left:0,top:0,right:0,bottom:0};const [left,top,right,bottom]=(node.getAttribute('data-box')||'0,0,0,0').split(',').map(Number);return{left,top,right,bottom};};
  const broken=categorySvg();marks.apply(broken,{pointsVisible:false,errorsVisible:false});assert.equal(spacing.inspect(broken,{measure}).available,false,'fixture reproduces the actual collapsed-bbox failure');
  let spacingResult;
  const rendering={NS:'http://www.w3.org/2000/svg',StudioMarkStyle:marks,StudioGroupSpacing:{apply:(svg,factor,options)=>spacingResult=spacing.apply(svg,factor,{...options,measure})},baseSvg:categorySvg,groupSpacingOrders:()=>[['Control','Treatment']],panel:()=>({variants:[{width:240,height:160,viewBox:[0,0,240,160]}]}),editsFor:()=>({}),applyHeatmapPalette:()=>{},applyHeatmapValueLabels:()=>{},refreshHeatmapLabelContrast:()=>{},appendConditionMatrix:()=>{}};
  vm.createContext(rendering);vm.runInContext(code.slice(code.indexOf('  function editedSvg('),code.indexOf('  function clearStatisticalResultEdits(')),rendering);
  const hiddenState=clone(initial);hiddenState.panels['panel-0'].markStyle={pointsVisible:false,errorsVisible:false};hiddenState.panels['panel-0'].groupSpacing={factor:.8};
  const rendered=rendering.editedSvg('panel-0',0,hiddenState);
  assert.equal(spacingResult.available,true,'hiding points/errors must not disable bar group spacing');
  for(const i of [0,1]){const point=rendered.querySelector('#studio-mark-points-'+i),error=rendered.querySelector('#studio-mark-error-'+i),bar=rendered.querySelector('#patch_'+(i+3));assert.equal(point.style.display,'none');assert.equal(error.style.display,'none');assert.notEqual(bar.style.display,'none');assert.ok(bar.getAttribute('transform'));assert.equal(point.getAttribute('transform'),bar.getAttribute('transform'),'hidden points travel with their complete category');assert.equal(error.getAttribute('transform'),bar.getAttribute('transform'),'hidden errors travel with their complete category');}
  const inspection=rendering.editedSvg('panel-0',0,hiddenState,false,null,true);assert.equal(spacing.inspect(inspection,{measure}).available,true,'the spacing inspector sees underlying category geometry');
  const restoredState=clone(hiddenState);restoredState.panels['panel-0'].markStyle={pointsVisible:true,errorsVisible:true};const restored=rendering.editedSvg('panel-0',0,restoredState);assert.equal(spacingResult.available,true);assert.notEqual(restored.querySelector('#studio-mark-points-0').style.display,'none');assert.equal(restored.querySelector('#studio-mark-points-0').getAttribute('transform'),rendered.querySelector('#studio-mark-points-0').getAttribute('transform'),'restore retains the chosen spacing');
  dom.window.close();
  console.log('Actual controls: presets, independent paints, hide/restore, coalesced previews, cancel/undo, locks, palette and data replacement passed');
}
if(process.argv.includes('--dom'))domChecks().catch(error=>{console.error(error);process.exitCode=1;});
