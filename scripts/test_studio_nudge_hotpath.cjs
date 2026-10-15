'use strict';
// Actual host capture/draw code with deterministic SVG geometry. Operation
// counts verify the hot path; this does not simulate browser paint timing.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync(path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8'),NS='http://www.w3.org/2000/svg';
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
const alignmentCode=section('    const objectScreenBox=','    const paintSnapGuides='),captureCode=section('    zoomView.nudgeCanvas=','    svg.classList.toggle(\'is-marquee-selecting\'');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function fixture({objects=5000,selected=142}={}){
  const dom=new JSDOM(`<svg xmlns="${NS}" id="root"><svg data-panel="p"><g id="first"/><g id="second"/><g id="third"/></svg><g id="selection"/></svg>`,{contentType:'image/svg+xml'}),doc=dom.window.document,svg=doc.documentElement,selectionLayer=doc.getElementById('selection'),groups=['first','second','third'].map(id=>doc.getElementById(id));
  const counts={bounds:0,screen:0,inverses:0,transforms:0},items=[],snapshots=[],operations=[],base={alignmentGuides:[{axis:'x',position:120,id:'guide-1'},{axis:'y',position:180,id:'guide-2'}]},matrices=[[2,0,0,2,0,0],[0,3,-2,0,10,20],[2,.5,0,3,5,2]];let zoom=1;
  class Matrix{
    constructor(m){[this.a,this.b,this.c,this.d,this.e,this.f]=m;}
    inverse(){counts.inverses++;const det=this.a*this.d-this.b*this.c;return new Matrix([this.d/det,-this.b/det,-this.c/det,this.a/det,(this.c*this.f-this.d*this.e)/det,(this.b*this.e-this.a*this.f)/det]);}
    transformPoint(p){return {x:this.a*p.x+this.c*p.y+this.e,y:this.b*p.x+this.d*p.y+this.f};}
  }
  const snapshot={...counts};
  svg.getBoundingClientRect=()=>{counts.bounds++;return {left:100,top:200,right:100+1200*zoom,bottom:200+800*zoom,width:1200*zoom,height:800*zoom};};
  groups.forEach((g,i)=>g.getScreenCTM=()=>{counts.screen++;operations.push('read');const m=matrices[i];return m?Object.fromEntries(['a','b','c','d','e','f'].map((key,j)=>[key,m[j]*zoom])):null;});
  for(let i=0;i<objects;i++){
    const el=doc.createElementNS(NS,'rect'),x=i%100*5,y=Math.floor(i/100)*5;
    for(const [key,value]of Object.entries({'data-key':'e'+i,x,y,width:2,height:2,fill:'#123456'}))el.setAttribute(key,value);
    if(i%2)el.setAttribute('transform','scale(.8)');
    el.getBoundingClientRect=()=>{counts.bounds++;return {left:100+x*2*zoom,top:200+y*2*zoom,right:100+(x+2)*2*zoom,bottom:200+(y+2)*2*zoom,width:4*zoom,height:4*zoom};};
    const write=el.setAttribute;el.setAttribute=function(key,value){if(key==='transform'){counts.transforms++;operations.push('write');}return write.call(this,key,value);};
    groups[i%3].append(el);if(i<selected)items.push({kind:'element',id:'p',vi:0,key:'e'+i,el,originalTransform:el.getAttribute('transform'),parentIndex:i%3});
  }
  const ctx={svg,l:{width:600,height:400,positions:[{id:'p',x:0,y:0,width:600,height:400}]},selectionLayer,zoomView:{},previewState:base,state:()=>base,DOMMatrix:Matrix,
    screenRect:el=>el.getBoundingClientRect(),isVisibleObject:()=>true,captureLabelMotion(){throw Error('No label in fixture');},refreshInsetGraphics(){},drawAlignmentGuides(){},
    alignmentSnap(bounds,targets,dx,dy,tolerance){snapshots.push({bounds,targets,dx,dy,tolerance});return {guides:[]};},paintSnapGuides(){},
    selectionResize:null,elementDrag:null,overlayDrag:null,labelDrag:null,guideDrag:null,marquee:null,resizeDrag:null,panelDrag:null};
  vm.createContext(ctx);vm.runInContext(alignmentCode+captureCode+'\nglobalThis.testAlignmentContext=alignmentContext;',ctx);
  return {dom,svg,ctx,base,counts,items,snapshots,matrices,operations,zoom:value=>zoom=value,resetCounts(){Object.assign(counts,snapshot);},close:()=>dom.window.close()};
}
function near(a,b){assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);}
test('a 5,000-object figure only measures 142 selected bounds on keyboard capture, preserving manual and page hints',()=>{
  const f=fixture();try{
    const before=JSON.stringify(f.base),preview=f.ctx.zoomView.nudgeCanvas.capture(f.items);
    assert.equal(f.counts.bounds,143,'one canvas plus selected objects; unrelated artists are not measured');assert.equal(f.counts.screen,142);assert.equal(f.counts.inverses,0);
    preview.draw(f.base,{dx:1,dy:2});const hints=f.snapshots.at(-1);
    assert.equal(hints.targets.length,14,'two manual guides, six page anchors and six panel anchors');
    assert.deepEqual(JSON.parse(JSON.stringify(hints.targets.filter(t=>t.manual))),[{axis:'x',position:120,manual:true,id:'guide-1'},{axis:'y',position:180,manual:true,id:'guide-2'}]);
    assert.equal(hints.dx,1);assert.equal(hints.dy,2);assert.equal(JSON.stringify(f.base),before,'preview cannot mutate the source state');
  }finally{f.close();}
});
test('60 keyboard preview frames reuse captured parent matrices and inverses with exact affine translations',()=>{
  const f=fixture();try{
    const preview=f.ctx.zoomView.nudgeCanvas.capture(f.items);for(let i=1;i<=60;i++)preview.draw(f.base,{dx:i/10,dy:i/20});
    assert.equal(f.counts.screen,142,'no getScreenCTM call may follow per-frame transform writes');assert.equal(f.counts.inverses,142,'each selected object inverts its captured parent once per gesture');assert.equal(f.counts.bounds,203);assert.equal(f.counts.transforms,142*60);
    for(const item of f.items){const [a,b,c,d]=f.matrices[item.parentIndex],det=a*d-b*c,match=item.el.getAttribute('transform').match(/^translate\(([^ ]+) ([^)]+)\) (.*)$/);assert.ok(match);near(+match[1],(d*12-c*6)/det);near(+match[2],(-b*12+a*6)/det);assert.equal(match[3],item.originalTransform||'','an existing transform is composed once');}
    preview.draw(f.base,{dx:0,dy:0});for(const item of f.items)assert.equal(item.el.getAttribute('transform'),item.originalTransform,'return to origin restores the exact original transform');assert.equal(f.counts.screen,142);assert.equal(f.counts.inverses,142);
  }finally{f.close();}
});
test('mouse alignment retains every automatic object target by default',()=>{
  const f=fixture();try{
    const context=f.ctx.testAlignmentContext(f.items.map(item=>item.el));assert.equal(f.counts.bounds,5001);assert.equal(context.targets.length,14+(5000-142)*6);assert.equal(context.targets.filter(t=>t.manual).length,2);
    f.resetCounts();const explicit=f.ctx.testAlignmentContext(f.items.map(item=>item.el),{includeObjects:true});assert.equal(f.counts.bounds,5001);assert.deepEqual(explicit,context,'the default preserves the complete pointer-drag target set');
  }finally{f.close();}
});
test('zoom during a held arrow refreshes matrices once before writes and keeps the physical movement exact',()=>{
  const f=fixture();try{
    const preview=f.ctx.zoomView.nudgeCanvas.capture(f.items);preview.draw(f.base,{dx:2,dy:1});
    const positions=f.items.map(item=>item.el.getAttribute('transform').match(/^translate\(([^ ]+) ([^)]+)\)/).slice(1).map(Number));
    const beforeZoom=f.operations.length;f.zoom(1.5);preview.draw(f.base,{dx:2,dy:1});assert.equal(f.counts.screen,284);assert.equal(f.counts.inverses,284);assert.deepEqual(f.operations.slice(beforeZoom),[...Array(142).fill('read'),...Array(142).fill('write')],'a viewport change batches all geometry reads before any native transform write');
    f.items.forEach((item,i)=>{const value=item.el.getAttribute('transform').match(/^translate\(([^ ]+) ([^)]+)\)/);near(+value[1],positions[i][0]);near(+value[2],positions[i][1]);});
    for(let i=0;i<10;i++)preview.draw(f.base,{dx:4,dy:2});assert.equal(f.counts.screen,284,'unchanged zoom resumes the cached fast path');assert.equal(f.counts.inverses,284);
    f.items.forEach((item,i)=>{const value=item.el.getAttribute('transform').match(/^translate\(([^ ]+) ([^)]+)\)/);near(+value[1],positions[i][0]*2);near(+value[2],positions[i][1]*2);});
  }finally{f.close();}
});
test('a fresh gesture captures new parent geometry and disconnected matrix sources are skipped safely',()=>{
  const f=fixture({objects:3,selected:3});try{
    const first=f.ctx.zoomView.nudgeCanvas.capture(f.items);first.draw(f.base,{dx:3,dy:0});assert.equal(f.items[0].el.getAttribute('transform'),'translate(3 0) ');
    first.draw(f.base,{dx:0,dy:0});f.matrices[0]=[4,0,0,4,0,0];f.matrices[1]=null;f.resetCounts();
    const second=f.ctx.zoomView.nudgeCanvas.capture(f.items);second.draw(f.base,{dx:3,dy:0});assert.equal(f.items[0].el.getAttribute('transform'),'translate(1.5 0) ');assert.equal(f.items[1].el.getAttribute('transform'),f.items[1].originalTransform);assert.equal(f.counts.screen,3);assert.equal(f.counts.inverses,2,'new captures cannot reuse inverses from the prior gesture');
  }finally{f.close();}
});
console.log(`${checks} production keyboard nudge hot-path regressions passed`);
