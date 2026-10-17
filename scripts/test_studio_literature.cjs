/* Optional lookup: real production query/transport/privacy/cancellation, with a bounded DOM adapter. */
'use strict';
const assert=require('node:assert/strict');
const api=require('../skills/polish-sci-figures/assets/figure-studio/literature.js');
const views=['compare_raincloud','compare_box_points','grouped_observations'];
const response=(value,status=200)=>({ok:status===200,status,headers:{get:()=>null},text:async()=>typeof value==='string'?value:JSON.stringify(value)});
const paper=(n,extra={})=>({id:String(100+n),source:'MED',pmid:String(100+n),pmcid:'PMC'+(100+n),title:'Public paper '+n,pubYear:'2025',journalTitle:'Journal',isOpenAccess:'Y',doi:'10.1234/paper.'+n,...extra});
function parserFor(figures) {
  return class Parser {
    parseFromString(source,type) {
      assert.equal(type,'application/xml');assert.ok(!source.includes('<!DOCTYPE'));assert.ok(!source.includes('<!ENTITY'));
      if(source==='invalid')return {documentElement:{localName:'parsererror'},getElementsByTagName:()=>[{}]};
      return {documentElement:{localName:'article'},getElementsByTagName:name=>name==='fig'?figures.map(f=>({getAttribute:k=>k==='id'?f.id:'',children:[{localName:'label',textContent:f.label},{localName:'caption',textContent:f.caption}]})):[]};
    }
  };
}
const Parser=parserFor([{id:'Fig1',label:'Figure 1',caption:'Individual observations shown as raincloud plots.'},{id:'Fig2',label:'Figure 2',caption:'This bar chart shows group observations.'}]);
class Node {
  constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.attrs={};this.value='';this.hidden=false;this.disabled=false;this.textContent='';}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(k,v){this.attrs[k]=String(v);}
  removeAttribute(k){delete this.attrs[k];}
}
const document={createElement(tag){return new Node(tag,this);}};
const all=node=>[node,...node.children.flatMap(all)];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function main(){
  const built=api.buildSearch({views,topic:'cell viability'});
  assert.match(built.query,/OPEN_ACCESS:Y/);assert.match(built.query,/TITLE_ABS:"cell viability"/);
  const effect=api.buildSearch({views:['compare_cumming','compare_gardner_altman','compare_box_points','compare_raincloud','compare_violin'],goal:'effect'});
  assert.deepEqual(effect.charts.map(c=>c.id),['estimation','box','raincloud','violin'],'caller recommendation order takes precedence over the static chart dictionary');
  assert.deepEqual(effect.charts[0].views,['compare_cumming','compare_gardner_altman'],'preview preserves the recommended within-family variant');
  assert.ok(effect.query.indexOf('estimation plot')<effect.query.indexOf('box plot'));assert.ok(!effect.query.includes('raincloud')&&!effect.query.includes('violin'),'only the first three supported ranked views contribute query terms, even if two share a family');
  assert.throws(()=>api.buildSearch({views:['https://evil.invalid/private']}),e=>e.code==='no_views');
  assert.throws(()=>api.buildSearch({views:[]}),e=>e.code==='no_views');
  for(const topic of ['https://example.com/private','www.example.com','user@example.com','patient:123','<script>','name\nprivate','x" OR OPEN_ACCESS:N','192.168.1.1','x'.repeat(121)])assert.throws(()=>api.buildSearch({views,topic}),e=>e.code==='invalid_topic',topic);
  assert.match(api.buildSearch({views,topic:'cancer OR diabetes'}).query,/TITLE_ABS:"cancer OR diabetes"$/,'query operators remain a literal phrase');
  assert.ok(!api.buildSearch({views:[...views,'patient_secret_123'],topic:''}).query.includes('patient_secret'));
  assert.equal(api.safeArticle(paper(1,{pmcid:'PMC101#javascript:alert(1)',pmid:'101/../../evil',id:'evil'})),null);
  const safe=api.safeArticle(paper(1,{doi:'javascript:alert(1)',url:'https://evil.invalid',title:'<script>alert(1)</script>'}));
  assert.equal(safe.doi,'');assert.equal(safe.articleUrl,'https://europepmc.org/articles/PMC101');
  assert.equal(api.safeArticle(paper(1,{pmcid:'',doi:'10.1234/../../evil'})).doi,'');
  const originalXML='<?xml version="1.0"?><!DOCTYPE article PUBLIC "public-id" "https://example.invalid/article.dtd"><article/>';
  assert.equal(api.parseFigures(originalXML,built.charts,'PMC101',Parser).length,2);
  for(const bad of ['<!DOCTYPE article [<!ENTITY x SYSTEM "file:///private">]><article/>','<!DOCTYPE article [ <!ELEMENT article ANY> ]><article/>','<!ENTITY x SYSTEM "https://evil.invalid"><article/>'])assert.throws(()=>api.parseFigures(bad,built.charts,'PMC101',Parser),e=>e.code==='invalid_response');
  assert.throws(()=>api.parseFigures('invalid',built.charts,'PMC101',Parser),e=>e.code==='invalid_response');
  assert.deepEqual(api.parseFigures('<article/>',built.charts,'PMC101',parserFor([{id:'Fig1',label:'Figure 1',caption:'A violin plot is shown.'} ])),[],'a chart absent from eligible views is never declared compatible');
  assert.deepEqual(api.parseFigures('<article/>',built.charts,'PMC101',parserFor([{id:'Fig1',label:'Figure 1',caption:'We used boxes to store the samples.'}])),[],'generic words do not falsely verify a chart');
  assert.deepEqual(api.parseFigures('<article/>',built.charts,'PMC101',parserFor([{id:'Fig1" onclick="alert(1)',label:'Figure 1',caption:'raincloud plot'}])),[],'unsafe figure IDs are rejected');

  const requests=[];const client=api.createClient({DOMParser:Parser,fetch:async(url,options)=>{requests.push({url,options});return url.includes('/search?')?response({resultList:{result:[1,2,3,4,5].map(n=>paper(n))}}):response(originalXML);}});
  assert.equal(requests.length,0,'creating a client does not connect');
  const result=await client.searchExamples({views,goal:'private_project_DO_NOT_SEND',topic:'cell viability',rows:[['PATIENT_42',12.34]],group:'PRIVATE_GROUP',token:'SECRET'});
  assert.equal(requests.length,4,'one search and at most three full-text requests');
  for(const r of requests){const u=new URL(r.url);assert.equal(u.protocol,'https:');assert.equal(u.hostname,'www.ebi.ac.uk');assert.equal(r.options.credentials,'omit');assert.equal(r.options.referrerPolicy,'no-referrer');assert.equal(r.options.redirect,'error');assert.equal(r.options.method,'GET');assert.equal(r.options.body,undefined);assert.equal(r.options.headers,undefined);assert.ok(!JSON.stringify(r).match(/PATIENT_42|12\.34|PRIVATE_GROUP|SECRET|private_project_DO_NOT_SEND/));}
  assert.equal(result.papers.filter(p=>p.verified).length,3);assert.equal(result.papers[3].verified,false);
  assert.deepEqual(result.papers[0].compatibleViews,['compare_raincloud','grouped_observations']);
  assert.equal(result.papers[0].figures[0].url,'https://europepmc.org/articles/PMC101#Fig1');
  const cached=await client.searchExamples({views,topic:'cell viability'});assert.equal(cached.fromCache,true);assert.equal(requests.length,4);
  cached.papers[0].title='changed';assert.notEqual((await client.searchExamples({views,topic:'cell viability'})).papers[0].title,'changed','cache returns detached records');
  const cancelledCache=new AbortController();cancelledCache.abort();await assert.rejects(client.searchExamples({views,topic:'cell viability',signal:cancelledCache.signal}),e=>e.code==='aborted');
  client.clearCache();await client.searchExamples({views,topic:'cell viability'});assert.equal(requests.length,8);

  await assert.rejects(api.createClient({fetch:async()=>{throw new TypeError('network');}}).searchExamples({views}),e=>e.code==='offline');
  await assert.rejects(api.createClient({fetch:async()=>response({},429)}).searchExamples({views}),e=>e.code==='rate_limit');
  await assert.rejects(api.createClient({fetch:async()=>response('<html>failure</html>')}).searchExamples({views}),e=>e.code==='invalid_response');
  await assert.rejects(api.createClient({fetch:async()=>response({resultList:{result:[{title:'Unverifiable'}]}})}).searchExamples({views}),e=>e.code==='invalid_response');
  let timeout;const hung=api.createClient({fetch:()=>new Promise(()=>{}),setTimeout:(fn,ms)=>{assert.equal(ms,10000);timeout=fn;return 1;},clearTimeout:()=>{}});
  const timed=hung.searchExamples({views});timeout();await assert.rejects(timed,e=>e.code==='timeout');
  let resolveFetch;const lateClient=api.createClient({fetch:()=>new Promise(resolve=>resolveFetch=resolve)}),abort=new AbortController();
  const late=lateClient.searchExamples({views,signal:abort.signal});abort.abort();await assert.rejects(late,e=>e.code==='aborted');resolveFetch(response({resultList:{result:[]}}));await tick();
  let partialCalls=0;const partialClient=api.createClient({fetch:async url=>{partialCalls++;return url.includes('/search?')?response({resultList:{result:[paper(1)]}}):response({},429);}});
  const partial=await partialClient.searchExamples({views});assert.equal(partial.partial,true);assert.equal(partial.papers[0].verified,false);assert.equal(partial.papers[0].verification,'rate_limit');await partialClient.searchExamples({views});assert.equal(partialCalls,6,'each rate-limited full text gets one bounded retry; partial verification is not cached');

  // UI never starts a request on mount, refresh, topic edits or language changes.
  const host=new Node('div',document);let context={views,goal:'distribution',language:'en',contextKey:'panel-1'},calls=0,resolveSearch,previewed=[];
  const ui=api.mount(host,{getContext:()=>context,onPreview:v=>previewed.push(v),searchExamples:()=>{calls++;return new Promise(resolve=>resolveSearch=resolve);}});
  ui.refresh();assert.equal(calls,0);
  const searchButton=all(host).find(n=>n.tagName==='button'&&n.textContent==='Find examples'),input=all(host).find(n=>n.tagName==='input');input.value='cell viability';input.oninput();assert.equal(calls,0);
  const first=searchButton.onclick();assert.equal(calls,1);context={...context,contextKey:'panel-2'};ui.refresh();resolveSearch(result);await first;
  assert.equal(all(host).filter(n=>n.className==='literature-card').length,0,'results from a previous panel are not rendered');
  const second=searchButton.onclick();resolveSearch(result);await second;assert.equal(all(host).filter(n=>n.className==='literature-card').length,5);
  const preview=all(host).find(n=>n.className==='literature-preview');preview.onclick();assert.equal(previewed.length,1);context={...context,contextKey:'panel-3'};preview.onclick();assert.equal(previewed.length,1,'stale preview actions cannot alter a different panel');
  const third=searchButton.onclick();resolveSearch(result);await third;assert.equal(all(host).filter(n=>n.className==='literature-card').length,5);const priorQueryPreview=all(host).find(n=>n.className==='literature-preview');input.value='new topic';input.oninput();assert.equal(all(host).filter(n=>n.className==='literature-card').length,0,'topic edits clear prior query results immediately');priorQueryPreview.onclick();assert.equal(previewed.length,1,'detached preview actions from an old query are rejected');assert.equal(calls,3,'typing a new topic never makes a request');
  context={...context,language:'zh-CN'};ui.refresh();assert.equal(calls,3);assert.ok(all(host).some(n=>n.textContent==='查找文献实例'));
  ui.destroy();assert.equal(host.children.length,0);

  // One caption may describe several chart types, repeated across figures.
  // Keep all figure links but offer one correctly named action per chart type.
  const combinedFigures=api.parseFigures('<article/>',built.charts,'PMC101',parserFor([
    {id:'Fig1',label:'Figure 1',caption:'Raincloud plots and box plots show the observations.'},
    {id:'Fig2',label:'Figure 2',caption:'A raincloud plot provides another comparison.'}
  ]));
  const combinedHost=new Node('div',document),chosen=[];let combinedLanguage='en',combinedCalls=0;
  const combinedUI=api.mount(combinedHost,{getContext:()=>({views:['compare_box_points','compare_raincloud'],language:combinedLanguage,contextKey:'combined'}),onPreview:view=>chosen.push(view),searchExamples:async()=>{combinedCalls++;return {...result,papers:[{...result.papers[0],figures:combinedFigures}]};}});
  const disclosure=combinedHost.children[0];assert.equal(disclosure.tagName,'details');assert.equal(disclosure.children[0].tagName,'summary');assert.equal(Boolean(disclosure.open),false,'optional literature starts collapsed');assert.equal(combinedCalls,0);
  const combinedSearch=all(combinedHost).find(n=>n.tagName==='button'&&n.textContent==='Find examples');await combinedSearch.onclick();
  const combinedActions=all(combinedHost).filter(n=>n.className==='literature-preview');
  assert.deepEqual(combinedActions.map(n=>n.textContent),['Preview with my data · Box plot','Preview with my data · Raincloud plot'],'each action names only the chart it actually previews, in local recommendation order');
  assert.equal(all(combinedHost).filter(n=>n.className==='literature-figure').length,2,'both source figure links remain visible');
  combinedActions.forEach(n=>n.onclick());assert.deepEqual(chosen,['compare_box_points','compare_raincloud']);
  combinedLanguage='zh-CN';combinedUI.refresh();await combinedSearch.onclick();assert.deepEqual(all(combinedHost).filter(n=>n.className==='literature-preview').map(n=>n.textContent),['用我的数据预览 · 箱线图','用我的数据预览 · 雨云图']);combinedUI.destroy();
  console.log('literature lookup: explicit opt-in, private allowlisted requests, safe IDs/XML, verified captions, bounded requests, timeout, cancellation, cache and stale UI passed');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
