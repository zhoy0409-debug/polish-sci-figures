/* Production frontend paths: whole-library discovery, lazy current previews,
 * and bounded same-origin reconnection without replacing project/draft state. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const range=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end);};
const copy=x=>JSON.parse(JSON.stringify(x));
const names={bar:'distribution',roc:'roc',roc_band:'roc',blank_canvas:'distribution'};
const discovery={roc:{zh:['ROC 曲线','分类结果']},roc_band:{en:['ROC interval','uncertainty']}};
const gallery={catalogueCategory:'distribution',catalogueStartMode:false,templateStarters:{bar:{},roc:{},roc_band:{}},StudioDiscovery:discovery,StudioCatalogue:{names:Object.keys(names),category:key=>names[key]},chartName:key=>key};
vm.createContext(gallery);vm.runInContext(range('  function chartLibraryNames(','  function renderChartLibrary('),gallery);
const available=new Map([['bar',{}]]);
assert.deepEqual([...gallery.chartLibraryNames(available,'roc')],['roc','roc_band'],'search crosses the currently selected category');
assert.deepEqual([...gallery.chartLibraryNames(available,'')],['bar']);gallery.catalogueCategory='current';assert.deepEqual([...gallery.chartLibraryNames(available,'')],['bar']);
assert.deepEqual([...gallery.chartLibraryNames(available,'uncertainty')],['roc_band']);assert.equal(gallery.chartLibraryNames(available,'absent').length,0);
assert.match(source,/catalogueSearchTimer=setTimeout\(renderChartLibrary,150\)/,'typing coalesces preview rebuilds');
assert.match(source,/candidate\?'当前数据':templatePreviews\[name\]\?'示例数据'/,'data provenance remains visible');

let current={panels:{p:{variant:0,fontSize:9}}},chartBuilds=0,paletteBuilds=0,latest;
const fields={scope:{value:'panel'},chartGoal:{value:'overview'},topCount:{value:'5'}};
const previews={activePane:'detail',selectedPanel:'p',project:{},inspectorPreviewCache:{},StudioI18n:{language:'zh'},state:()=>current,$:id=>fields[id],selectionGroups:()=>[],selectedAnnotations:[],selectedPanelLabel:null,renderChartChoices(){chartBuilds++;latest=current;},drawPalettes(){paletteBuilds++;latest=current;}};
vm.createContext(previews);vm.runInContext(range('  function renderInspectorPreviews(','  let categorySpacingGesture='),previews);
previews.renderInspectorPreviews();assert.equal(chartBuilds+paletteBuilds,0,'font editing does not build hidden SVG galleries');
previews.activePane='explore';previews.renderInspectorPreviews();previews.renderInspectorPreviews();assert.equal(chartBuilds,1,'same visible state is not rebuilt twice');
previews.activePane='data';current={panels:{p:{variant:0,fontSize:14}}};previews.renderInspectorPreviews();assert.equal(chartBuilds,1);previews.activePane='explore';previews.renderInspectorPreviews();assert.equal(chartBuilds,2);assert.equal(latest,current,'returning to previews uses the latest edited state');
previews.activePane='palette';previews.renderInspectorPreviews();assert.equal(paletteBuilds,1);fields.scope.value='element';previews.renderInspectorPreviews();assert.equal(paletteBuilds,2);
previews.project.heatmapRenders={'p/0':{sha256:'new-meta'}};previews.renderInspectorPreviews();assert.equal(paletteBuilds,3,'new heatmap metadata invalidates cached previews');
assert.ok(source.includes('renderRecommendations();showPane(activePane,false);'),'one full render does not draw the canvas twice');

const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data,clone(){return response(status,data);},text:async()=>JSON.stringify(data)});
const authorization=()=>response(403,{error:'Local editor authorization required'});
function connectionHarness(queue){
  const project={id:'saved',table:[['group','value'],['A','12.5']]},drafts={p:[['group','value'],['A','14.1']]},before=JSON.stringify({project,drafts}),requests=[];
  const ctx={T:x=>x,localEngine:{token:'original-token-at-least-20',endpoint:'/api/render'},engineRefreshPromise:null,engineConnection:'connected',location:{protocol:'http:',hostname:'127.0.0.1',href:'http://127.0.0.1:18820/'},URL,DOMParser:class{parseFromString(text){return {querySelector:()=>({textContent:text})};}},setEngineConnection(kind){ctx.engineConnection=kind;},engineConnectionText:()=>'',fetch:async(url,options)=>{requests.push({url,options:copy(options)});const next=queue.shift();if(next instanceof Error)throw next;assert.ok(next,'unexpected network retry');return typeof next==='function'?next():next;}};
  vm.createContext(ctx);vm.runInContext(range('  function engineConnectionText(','  function renderConnectionNotice(')+range('  function engineConnectionError(','  let statisticsSession='),ctx);
  return {ctx,requests,assertUnchanged:()=>assert.equal(JSON.stringify({project,drafts}),before)};
}
const post={method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':'original-token-at-least-20'},body:'{"rows":[["A",12.5]]}'};
(async()=>{
  const renewed='renewed-token-at-least-20',fresh=()=>response(200,{token:renewed,endpoint:'/api/render',reflowEndpoint:'/api/reflow'});
  const ok=connectionHarness([authorization(),fresh(),response(200,{panel:{}})]);await ok.ctx.engineFetch('/api/render',post);assert.equal(ok.requests.length,3);assert.equal(ok.requests[1].url,'http://127.0.0.1:18820/');assert.equal(ok.requests[2].options.headers['X-Studio-Token'],renewed);assert.equal(ok.requests[2].options.body,post.body);assert.equal(ok.ctx.engineConnection,'connected');ok.assertUnchanged();
  const same=connectionHarness([authorization(),response(200,{token:post.headers['X-Studio-Token'],endpoint:'/api/render'})]);await assert.rejects(same.ctx.engineFetch('/api/render',post),error=>error.connection);assert.equal(same.requests.length,2,'unchanged token does not retry a Host/Origin rejection');same.assertUnchanged();
  const refused=connectionHarness([authorization(),fresh(),authorization()]);await assert.rejects(refused.ctx.engineFetch('/api/render',post),error=>error.connection);assert.equal(refused.requests.length,3,'at most one POST retry');
  const wrong=connectionHarness([response(403,{error:'Invalid host'})]);assert.equal((await wrong.ctx.engineFetch('/api/render',post)).status,403);assert.equal(wrong.requests.length,1,'unrelated 403 does not refresh credentials');
  const offline=connectionHarness([new TypeError('Failed to fetch')]);await assert.rejects(offline.ctx.engineFetch('/api/render',post),error=>error.connection&&error.message.includes('草稿已保留')&&!error.message.includes('fetch'));offline.assertUnchanged();
  const invalid=connectionHarness([authorization(),response(200,{token:renewed,endpoint:'https://other.example/render'})]);await assert.rejects(invalid.ctx.engineFetch('/api/render',post));assert.equal(invalid.ctx.localEngine.token,post.headers['X-Studio-Token']);assert.equal(invalid.requests.length,2);
  const validation=connectionHarness([response(400,{error:'Invalid value'})]);assert.equal((await validation.ctx.engineFetch('/api/render',post)).status,400,'data validation remains distinct from connection failure');assert.equal(validation.requests.length,1);
  console.log('PASS beginner flow: cross-category search, debounced input, current-state lazy previews, no duplicate canvas render, same-origin renewed-token retry, unchanged/unrelated authorization rejection, offline drafts and bounded retries.');
})().catch(error=>{console.error(error);process.exitCode=1;});
