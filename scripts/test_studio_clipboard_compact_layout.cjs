'use strict';
// Real compact measurement, planning, rendering and clipboard state. Native SVG
// geometry comes from deterministic affine adapters, not a browser ink claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module');
const fixtureFile=path.join(__dirname,'test_studio_canvas_clipboard_integration.cjs'),fixtureSource=fs.readFileSync(fixtureFile,'utf8'),cut=fixtureSource.indexOf('\nlet passed=0;');assert.ok(cut>0);
const host={require:Module.createRequire(fixtureFile),__dirname,console,setImmediate,clearImmediate,setTimeout,clearTimeout,TextEncoder};vm.createContext(host);vm.runInContext(fixtureSource.slice(0,cut)+'\nglobalThis.testFixture=fixture;',host);
const directory=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),studio=fs.readFileSync(path.join(directory,'studio.js'),'utf8'),compactSource=fs.readFileSync(path.join(directory,'compact-whitespace.js'),'utf8'),copy=x=>JSON.parse(JSON.stringify(x)),NS='http://www.w3.org/2000/svg';
const section=(a,b)=>{const start=studio.indexOf(a),stop=studio.indexOf(b,start+a.length);assert.ok(start>=0&&stop>start,a);return studio.slice(start,stop);};
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function setup(){
  const f=host.testFixture(),c=f.ctx,G=c.StudioImageInsets;let activeRoot=null;
  const matrix=m=>({...m,inverse(){return matrix(G.inverse(this));},multiply(other){return matrix(G.multiply(this,other));}}),identity=matrix({a:1,b:0,c:0,d:1,e:0,f:0});
  const inherited=(node,key,fallback)=>{for(let at=node;at;at=at.parentElement){const value=at.style?.getPropertyValue(key)||at.getAttribute?.(key);if(value)return value;}return fallback;};
  const computed=node=>({display:inherited(node,'display','inline'),visibility:inherited(node,'visibility','visible'),opacity:inherited(node,'opacity','1'),fill:inherited(node,'fill','#000000'),stroke:inherited(node,'stroke','none'),fillOpacity:inherited(node,'fill-opacity','1'),strokeOpacity:inherited(node,'stroke-opacity','1'),strokeWidth:inherited(node,'stroke-width','1')});
  f.w.SVGElement.prototype.getScreenCTM=function(){return this===activeRoot?identity:matrix(G.relativeMatrix(this,activeRoot));};
  f.w.SVGElement.prototype.getBBox=function(){
    const number=key=>parseFloat(this.getAttribute(key))||0;
    if(['rect','image'].includes(this.localName))return {x:number('x'),y:number('y'),width:number('width'),height:number('height')};
    if(this.localName==='circle'){const r=number('r');return{x:number('cx')-r,y:number('cy')-r,width:r*2,height:r*2};}
    if(this.localName==='ellipse')return{x:number('cx')-number('rx'),y:number('cy')-number('ry'),width:number('rx')*2,height:number('ry')*2};
    if(this.localName==='text'){const size=c.StudioRichText.pointSize(this);return{x:number('x'),y:number('y')-size,width:Math.max(size*.6,this.textContent.length*size*.6),height:size*1.2};}
    const values=this.localName==='path'?this.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number):this.localName==='line'?[number('x1'),number('y1'),number('x2'),number('y2')]:null;
    if(values){const xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2===1);return{x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
    throw Error('Unexpected native geometry: '+this.localName);
  };
  const moduleContext={document:f.d,getComputedStyle:computed};vm.createContext(moduleContext);vm.runInContext(compactSource+'\nglobalThis.testCompact=StudioCompactWhitespace;',moduleContext);
  const original=moduleContext.testCompact,calls=[];const compact={...original,measure(svg,options){activeRoot=svg;calls.push(options||{});return original.measure(svg,options);}};
  Object.assign(c,{StudioCompactWhitespace:compact,StudioI18n:{language:'en'}});vm.runInContext(section('  let compactLayoutCache=','  function renderCompactWhitespaceControls(){'),c);
  return Object.assign(f,{c,compact,calls,measure:compact.measure,resetLayoutCaches(){vm.runInContext('compactLayoutCache=new WeakMap();compactMetricCache=null;',c);}});
}
(async()=>{
await test('paste, move, undo/redo and saved-project reopen keep the compact master and neighbouring figure fixed',async()=>{
  const f=setup(),c=f.c;try{
    const other=copy(c.panel('panel-0'));other.id='panel-1';c.project.panels.push(other);c.state().order.push('panel-1');c.state().panels['panel-1']={variant:0,edits:{}};c.state().grid.rows=1;c.state().grid.places['panel-1']={row:0,col:1,rs:1,cs:1};c.state().compactWhitespace=true;c.render();
    const before=copy(c.layout()),assets=JSON.stringify(c.project.panels),neighbour=JSON.stringify(c.state().panels['panel-1']);assert.equal(before.compactStatus.available,true);assert.ok(before.compact,'fixture actually uses compact geometry');
    c.selected=[f.keys.other];await c.copyCanvasSelection();await c.pasteCanvasClipboard();assert.deepEqual(copy(c.layout()),before);assert.equal(JSON.stringify(c.project.panels),assets);assert.equal(JSON.stringify(c.state().panels['panel-1']),neighbour);assert.ok(f.calls.every(options=>options.ignoreInserted===true),'only automatic compaction requests exclusion');
    const record=c.state().panels['panel-0'].insertedElements[0][0],next=copy(c.state());next.panels['panel-0'].edits[0]={[`e${record.keyStart}`]:{'offset-x':'1','offset-y':'1'}};c.commit(next,'move copy');assert.deepEqual(copy(c.layout()),before,'editing a pasted copy cannot retrim the original graph');
    const saved=JSON.parse(JSON.stringify({project:c.project,state:c.state(),history:c.history.toJSON()}));c.project=saved.project;c.history=c.History.restore(saved.history,c.project,saved.state);f.resetLayoutCaches();c.templateCache.clear();c.render();assert.deepEqual(copy(c.layout()),before,'fresh cache and reopened JSON retain the same layout');
    c.history.undo();c.render();assert.deepEqual(copy(c.layout()),before);c.history.undo();c.render();assert.equal(c.state().panels['panel-0'].insertedElements,undefined);assert.deepEqual(copy(c.layout()),before);c.history.redo();c.render();assert.deepEqual(copy(c.layout()),before);
  }finally{f.close();}
});
await test('explicit paper measurement counts pasted ink while compact measurement retains every original circle and panel label',async()=>{
  const f=setup(),c=f.c;try{
    const svg=f.d.createElementNS(NS,'svg');for(const [key,value]of Object.entries({viewBox:'0 0 200 120',width:200,height:120}))svg.setAttribute(key,value);
    const create=(tag,attrs,text)=>{const node=f.d.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;return node;};
    const panel=create('svg',{'data-panel':'panel-0',viewBox:'0 0 200 120',width:200,height:120}),circle=create('circle',{'data-key':'e1',cx:150,cy:70,r:10}),label=create('text',{'data-panel-label':'panel-0',x:10,y:100,'font-size':12},'A');panel.append(create('rect',{'data-key':'e0',x:50,y:20,width:20,height:20}),circle);svg.append(panel,label);
    const initial=f.measure(svg,{ignoreInserted:true}).ink['panel-0'];assert.deepEqual(copy(initial),{x:10,y:20,width:150,height:82.4},'native circle and separate panel label both contribute');
    const inserted=create('g',{'data-studio-inserted':'true','data-key':'e1000000000'});inserted.append(create('rect',{'data-key':'e1000000001',x:0,y:0,width:200,height:120}));panel.append(inserted);
    assert.deepEqual(copy(f.measure(svg,{ignoreInserted:true}).ink['panel-0']),copy(initial));assert.deepEqual(copy(f.measure(svg).ink['panel-0']),{x:0,y:0,width:200,height:120},'default measurement used by explicit paper fitting still includes inserted ink');
    circle.setAttribute('cx','190');const moved=f.measure(svg,{ignoreInserted:true}).ink['panel-0'];assert.equal(moved.x+moved.width,200,'old source geometry edits are never excluded');label.setAttribute('x','2');assert.equal(f.measure(svg,{ignoreInserted:true}).ink['panel-0'].x,2,'old panel-label edits remain measurable');
  }finally{f.close();}
});
await test('new text is placed inside the compact cell clip rather than its distant original render box',async()=>{
  const f=setup(),c=f.c;try{
    const asset=c.panel('panel-0');asset.variants[0].svg=asset.variants[0].svg.replace('translate(10 5)','translate(70 50) scale(.5)');c.state().columns=1;c.state().grid.rows=1;c.state().compactWhitespace=true;c.render();const before=copy(c.layout()),visible=before.positions[0];assert.equal(before.compactStatus.available,true);assert.ok(visible.renderBox.x<visible.x-20&&visible.renderBox.y<visible.y-20,'the fixture has a genuinely clipped original viewport');
    await c.pasteCanvasText('New');const text=f.main.querySelector('[data-studio-inserted] text'),G=c.StudioImageInsets,baseline=G.point(G.relativeMatrix(text,f.main),{x:0,y:14});assert.ok(baseline.x>=visible.x&&baseline.x<=visible.x+visible.width,'new text starts in the actual compact clip');assert.ok(baseline.y>=visible.y&&baseline.y<=visible.y+visible.height,'new text is not hidden in the old top margin');assert.deepEqual(copy(c.layout()),before);
  }finally{f.close();}
});
console.log(`${passed} production clipboard compact-layout stability groups passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
