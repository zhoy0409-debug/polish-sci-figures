/* Actual resize controller + SVG DOM integration. jsdom has no SVG layout;
 * only browser geometry/capture/rAF boundaries are supplied here. Matrices are
 * read by the production SVG parser, and all gestures hit real DOM handles. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const directory='../skills/polish-sci-figures/assets/figure-studio/';
const controller=require(directory+'selection-resize-controller.js');
const math=require(directory+'selection-transform.js');
const svgGeometry=require(directory+'image-insets.js');
const presentation=require(directory+'selection-transform-dom.js');
const rich=require(directory+'rich-text.js');
const hostSource=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8'),hostGeometry={StudioImageInsets:svgGeometry,overlayEditingSpace:require(directory+'studio.js').overlayEditingSpace,copy:value=>JSON.parse(JSON.stringify(value))};
vm.createContext(hostGeometry);vm.runInContext(hostSource.slice(hostSource.indexOf('function panelContentDelta('),hostSource.indexOf('function gridFor(')),hostGeometry);
const NS='http://www.w3.org/2000/svg';
const I=[1,0,0,1,0,0];
const raster='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOqkAAAAASUVORK5CYII=';
let passed=0;const failures=[];
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const matrixNear=(actual,expected)=>{assert.equal(actual.length,6);actual.forEach((value,index)=>near(value,expected[index]));};
const clone=value=>JSON.parse(JSON.stringify(value));
const values=m=>[m.a,m.b,m.c,m.d,m.e,m.f];
const object=m=>Object.fromEntries(['a','b','c','d','e','f'].map((key,index)=>[key,m[index]]));
function test(name,run){try{run();passed++;console.log('PASS '+name);}catch(error){failures.push({name,error});console.error('FAIL '+name+'\n'+error.stack);}}
function fixture({body,initial,screen=[2,0,0,2,100,50],options={}}={}){
  const dom=new JSDOM(`<svg xmlns="${NS}" id="canvas" viewBox="0 0 600 240" width="600" height="240">
    <svg data-panel="p1" x="10" y="20" width="200" height="100" viewBox="0 0 200 100"><g data-panel-content="true" id="content1">${body||'<rect data-key="e1" x="20" y="20" width="80" height="40" fill="#456789"/>'}</g></svg>
    <svg data-panel="p2" x="300" y="20" width="200" height="100" viewBox="0 0 400 200"><g data-panel-content="true" id="content2"><rect data-key="e1" x="40" y="40" width="80" height="80" fill="#986743"/></g></svg>
  </svg>`,{pretendToBeVisual:true});
  const {window}=dom,doc=window.document,svg=doc.querySelector('#canvas'),proto=window.SVGElement.prototype;
  let state=initial||{panels:{p1:{edits:{0:{}},label:{x:5,y:10,size:12,stretch:1}},p2:{edits:{0:{}},label:{x:5,y:10,size:12}}},overlays:[]};
  let selected=[],frameId=0;const frames=new Map(),captured=new Set(),commits=[],previews=[],errors=[],finishes=[],snapshots=[];
  const nativeStyle=window.getComputedStyle.bind(window),previousStyle=global.getComputedStyle;
  // Browser computed opacity is 1, whereas jsdom leaves inherited SVG defaults
  // empty. Everything else still comes from the actual CSSStyleDeclaration.
  global.getComputedStyle=node=>new Proxy(nativeStyle(node),{get:(style,key)=>key==='opacity'&&!style.opacity?'1':style[key]});
  const rootMatrix=node=>node===svg?object(screen):svgGeometry.multiply(object(screen),svgGeometry.relativeMatrix(node,svg));
  const originalTransform=node=>{
    const scratch=doc.createElementNS(NS,'svg'),g=doc.createElementNS(NS,'g');g.setAttribute('transform',node.getAttribute('transform')||'');scratch.append(g);return svgGeometry.relativeMatrix(g,scratch);
  };
  Object.defineProperty(proto,'transform',{configurable:true,get(){return {baseVal:{consolidate:()=>({matrix:originalTransform(this)})}};}});
  proto.getScreenCTM=function(){return rootMatrix(this);};
  const rectOf=(matrix,b)=>{
    const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]].map(([x,y])=>svgGeometry.point(matrix,{x,y}));
    const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
    return {x:left,y:top,left,right,top,bottom,width:right-left,height:bottom-top,toJSON(){return {left,right,top,bottom};}};
  };
  proto.getBoundingClientRect=function(){
    let box;const assigned=this.getAttribute('data-test-box');
    if(assigned){const [x,y,width,height]=assigned.split(',').map(Number);box={x,y,width,height};}
    else if(this.localName==='svg'){const [x,y,width,height]=this.getAttribute('viewBox').split(/[\s,]+/).map(Number);box={x,y,width,height};}
    else if(['rect','image'].includes(this.localName))box={x:Number(this.getAttribute('x')||0),y:Number(this.getAttribute('y')||0),width:Number(this.getAttribute('width')||0),height:Number(this.getAttribute('height')||0)};
    else if(this.localName==='line'){const x1=+this.getAttribute('x1'),x2=+this.getAttribute('x2'),y1=+this.getAttribute('y1'),y2=+this.getAttribute('y2');box={x:Math.min(x1,x2),y:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1)};}
    if(box)return rectOf(rootMatrix(this),box);
    const children=[...this.children].filter(el=>!['defs','title','metadata'].includes(el.localName)&&el.style.display!=='none').map(el=>el.getBoundingClientRect());
    if(!children.length)return rectOf(rootMatrix(this),{x:0,y:0,width:0,height:0});
    const left=Math.min(...children.map(b=>b.left)),top=Math.min(...children.map(b=>b.top)),right=Math.max(...children.map(b=>b.right)),bottom=Math.max(...children.map(b=>b.bottom));
    return {left,top,right,bottom,width:right-left,height:bottom-top,x:left,y:top};
  };
  svg.setPointerCapture=id=>captured.add(id);svg.hasPointerCapture=id=>captured.has(id);svg.releasePointerCapture=id=>captured.delete(id);
  const geometry={width:600,height:240,positions:[{id:'p1',x:10,y:20,width:200,height:100},{id:'p2',x:300,y:20,width:200,height:100}]};
  const api=controller.create({svg,geometry,state:()=>state,selection:()=>selected,commit:(next,label)=>{commits.push({next,label});state=next;return true;},aspect:()=>options.aspect||'auto',requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),onPreview:next=>previews.push(next),onFinish:()=>finishes.push(true),onError:error=>errors.push(error),onSnap:snap=>snapshots.push(snap),...options,aspect:typeof options.aspect==='function'?options.aspect:()=>options.aspect||'auto'});
  const find=(panel,key='e1')=>svg.querySelector(`[data-panel="${panel}"] [data-key="${key}"]`);
  const item=(panel='p1',key='e1')=>({kind:'element',id:panel,vi:0,key,el:find(panel,key)});
  const fire=(target,type,p={x:0,y:0},extra={})=>{
    const client=math.applyPoint(screen,p),e=new window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:client.x,clientY:client.y,shiftKey:!!extra.shiftKey,altKey:!!extra.altKey});
    Object.defineProperty(e,'pointerId',{value:extra.pointerId||7});target.dispatchEvent(e);return e;
  };
  const f={dom,doc,svg,api,geometry,find,item,commits,previews,errors,frames,captured,finishes,snapshots,get state(){return state;},set state(next){state=next;},select(items){selected=items;api.refresh();},frame(){const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(0));},fire,
    down(handle='se',extra={}){const target=svg.querySelector(`[data-selection-resize="${handle}"]`);assert.ok(target,`missing ${handle} handle`);const r=target.querySelector('rect'),p={x:+r.getAttribute('x')+(+r.getAttribute('width'))/2,y:+r.getAttribute('y')+(+r.getAttribute('height'))/2};fire(target,'pointerdown',p,extra);return p;},
    move(p,extra={}){fire(svg,'pointermove',p,extra);},up(p,extra={}){fire(svg,'pointerup',p,extra);},
    close(){api.dispose();global.getComputedStyle=previousStyle;window.close();}};
  return f;
}
function drag(f,handle,target,modifiers={}){f.down(handle,modifiers);f.move(target,modifiers);f.frame();f.up(target,modifiers);}

test('actual eight handles resize after one coalesced frame and one history commit',()=>{
  const f=fixture();try{
    const base=f.state,source=f.find('p1').outerHTML;f.select([f.item()]);assert.equal(f.svg.querySelectorAll('[data-selection-resize]').length,8);
    f.down();f.move({x:150,y:100});f.move({x:190,y:120});assert.equal(f.frames.size,1);assert.equal(f.previews.length,0);assert.equal(f.commits.length,0);assert.equal(f.state,base);assert.equal(f.find('p1').outerHTML,source);
    f.frame();assert.equal(f.previews.length,1);assert.equal(f.state,base);assert.equal(base.panels.p1.edits[0].e1,undefined);assert.notEqual(f.find('p1').outerHTML,source);
    f.move({x:230,y:140});f.frame();f.move({x:190,y:120});f.frame();assert.equal(f.previews.length,3);assert.equal(f.commits.length,0);matrixNear(values(svgGeometry.relativeMatrix(f.find('p1'),f.find('p1').parentElement)),[2,0,0,2,-20,-20]);
    f.up({x:190,y:120});assert.equal(f.commits.length,1);assert.equal(f.finishes.length,1);assert.equal(f.api.isActive(),false);assert.equal(f.captured.size,0);assert.equal(f.frames.size,0);matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),[2,0,0,2,-20,-20]);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('queued previews, pointer cancellation and explicit cancellation restore exact source',()=>{
  for(const reason of ['explicit','pointercancel','lostpointercapture']){const f=fixture({body:'<g transform="translate(3 4)"><rect data-key="e1" transform="rotate(0)" x="20" y="20" width="80" height="40"/></g>'});try{
    f.select([f.item()]);const before=f.find('p1').outerHTML,base=f.state;f.down();f.move({x:250,y:150});f.frame();assert.notEqual(f.find('p1').outerHTML,before);f.move({x:260,y:160});
    if(reason==='explicit')assert.equal(f.api.cancel(),true);else f.fire(f.svg,reason);
    f.frame();assert.equal(f.find('p1').outerHTML,before);assert.equal(f.state,base);assert.equal(f.commits.length,0);assert.equal(f.previews.at(-1),base);assert.equal(f.frames.size,0);assert.equal(f.captured.size,0);assert.equal(f.api.isActive(),false);
  }finally{f.close();}}
});

test('a click, tiny move or wrong pointer does not change history',()=>{
  const f=fixture();try{f.select([f.item()]);const start=f.down();f.move({x:start.x+40,y:start.y+20},{pointerId:99});f.up({x:start.x+40,y:start.y+20},{pointerId:99});assert.equal(f.api.isActive(),true);f.move({x:start.x+.25,y:start.y});f.up(start);assert.equal(f.commits.length,0);assert.equal(f.previews.length,1);assert.equal(f.api.isActive(),false);}finally{f.close();}
});

test('free, locked, Shift and Alt pass through real gesture events',()=>{
  for(const [options,handle,p,modifiers,expected]of [
    [{},'e',{x:190,y:60},{},[2,0,0,1,-20,0]],
    [{},'se',{x:190,y:100},{shiftKey:true},[2,0,0,1.5,-20,-10]],
    [{aspect:'free'},'se',{x:190,y:100},{},[2,0,0,1.5,-20,-10]],
    [{aspect:'locked'},'e',{x:190,y:60},{},[2,0,0,2,-20,-40]],
    [{},'e',{x:150,y:60},{altKey:true},[2,0,0,1,-60,0]]
  ]){const f=fixture({options});try{f.select([f.item()]);drag(f,handle,p,modifiers);assert.equal(f.commits.length,1);matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),expected);assert.equal(f.errors.length,0);}finally{f.close();}}
});

test('multi-panel selection shares a canvas action but stores physical panel coordinates',()=>{
  const f=fixture();try{f.select([f.item(),f.item('p2')]);const base=clone(f.state);drag(f,'se',{x:690,y:120});const a=JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),b=JSON.parse(f.state.panels.p2.edits[0].e1['object-transform']);matrixNear(a,[2,0,0,2,-20,-20]);matrixNear(b,[2,0,0,2,270,-20]);assert.equal(f.commits.length,1);assert.deepEqual(base.panels.p1.edits[0],{});
    // Reopen using the actual saved-presentation adapter, not the preview DOM.
    const reopened=fixture({initial:clone(f.state)});try{for(const [id,unit]of [['p1',1],['p2',2]])presentation.applyObjectTransforms(reopened.svg.querySelector(`[data-panel="${id}"]`),reopened.state.panels[id].edits[0],unit);for(const id of ['p1','p2']){const live=f.find(id).getBoundingClientRect(),restored=reopened.find(id).getBoundingClientRect();for(const key of ['left','top','right','bottom'])near(live[key],restored[key]);}}finally{reopened.close();}
  }finally{f.close();}
});

test('PDF text keeps its 50x local matrix, character arrays and inherited clipping',()=>{
  const body='<defs><clipPath id="crop"><rect width="200" height="100"/></clipPath></defs><g transform="translate(4 3)" clip-path="url(#crop)" opacity=".7"><text data-key="e1" data-test-box="0,0,1.6,.8" font-size=".24" x="0 .1 .2" y="0 0 0" transform="matrix(50 0 0 50 20 20)">ABC</text></g>';
  const f=fixture({body});try{f.select([f.item()]);const el=f.find('p1'),parent=el.parentElement;drag(f,'se',{x:194,y:123});assert.equal(el.parentElement,parent);assert.equal(parent.getAttribute('clip-path'),'url(#crop)');assert.equal(el.getAttribute('font-size'),'.24');assert.equal(el.getAttribute('x'),'0 .1 .2');assert.equal(el.getAttribute('y'),'0 0 0');near(rich.pointSize(el)*rich.localFontScale(el,f.svg),24);matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),[2,0,0,2,-24,-23]);assert.equal(f.errors.length,0);}finally{f.close();}
});

test('small text keeps all eight resize hit areas outside its visible glyph box',()=>{
  for(const transform of ['', ' transform="rotate(90)"']){
    const f=fixture({body:`<text data-key="e1" data-test-box="20,20,64,7" font-size="7"${transform}>Small PDF text</text>`,screen:[1,0,0,1,100,50]});try{
      f.select([f.item()]);const text=f.find('p1'),box=text.getBoundingClientRect(),hits=[...f.svg.querySelectorAll('.selection-resize-hit')];assert.equal(hits.length,8);
      for(const hit of hits){const b=hit.getBoundingClientRect();assert.ok(b.right<=box.left||b.left>=box.right||b.bottom<=box.top||b.top>=box.bottom,`${hit.parentElement.dataset.selectionResize} covers the small text`);near(b.width,18);near(b.height,18);}
      const outline=f.svg.querySelector('.selection-transform-outline').getBoundingClientRect();for(const key of ['left','right','top','bottom'])near(outline[key],box[key]);
      let downs=0,doubleClicks=0;f.svg.addEventListener('pointerdown',()=>downs++);f.svg.addEventListener('dblclick',e=>{assert.equal(e.target,text);doubleClicks++;});
      f.fire(text,'pointerdown',{x:62,y:43.5});f.fire(text,'pointerup',{x:62,y:43.5});f.fire(text,'pointerdown',{x:62,y:43.5});f.fire(text,'pointerup',{x:62,y:43.5});f.fire(text,'dblclick',{x:62,y:43.5});
      assert.equal(downs,2);assert.equal(doubleClicks,1);assert.equal(f.api.isActive(),false);assert.equal(f.commits.length,0);
    }finally{f.close();}
  }
});

test('outside small-text handles resize from exact pointer displacement without a start jump',()=>{
  for(const [handle,delta,modifiers,expected]of [
    ['se',{x:64,y:7},{},[2,0,0,2,-20,-20]],
    ['e',{x:16,y:0},{},[1.25,0,0,1,-5,0]],
    ['e',{x:16,y:0},{altKey:true},[1.5,0,0,1,-26,0]],
    ['se',{x:64,y:14},{shiftKey:true},[2,0,0,3,-20,-40]]
  ]){
    const f=fixture({body:'<text data-key="e1" data-test-box="20,20,64,7" font-size="7">Small</text>',screen:[1,0,0,1,100,50]});try{
      f.select([f.item()]);const before=f.find('p1').outerHTML,start=f.down(handle,modifiers);assert.equal(f.find('p1').outerHTML,before);assert.equal(f.commits.length,0);
      const end={x:start.x+delta.x,y:start.y+delta.y};f.move(end,modifiers);f.frame();assert.equal(f.commits.length,0);f.up(end,modifiers);
      matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),expected);assert.equal(f.commits.length,1);assert.equal(f.find('p1').getAttribute('font-size'),'7');assert.equal(f.errors.length,0);
    }finally{f.close();}
  }
});

test('outside handles cancel cleanly and grabbing the edge of a hit target causes no size jump',()=>{
  const f=fixture({body:'<text data-key="e1" data-test-box="20,20,64,7" font-size="7">Small</text>',screen:[1,0,0,1,100,50]});try{
    f.select([f.item()]);const before=f.find('p1').outerHTML,handle=f.svg.querySelector('[data-selection-resize="e"]'),hit=handle.querySelector('.selection-resize-hit'),start={x:+hit.getAttribute('x')+1,y:+hit.getAttribute('y')+1};
    f.fire(handle,'pointerdown',start);const end={x:start.x+16,y:start.y};f.move(end);f.frame();matrixNear(values(svgGeometry.relativeMatrix(f.find('p1'),f.find('p1').parentElement)),[1.25,0,0,1,-5,0]);
    assert.equal(f.api.cancel(),true);assert.equal(f.find('p1').outerHTML,before);assert.equal(f.commits.length,0);assert.equal(f.frames.size,0);assert.equal(f.captured.size,0);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('a small editable overlay or panel label receives the same unobstructed hit layout',()=>{
  for(const kind of ['label','overlay']){
    const f=fixture({screen:[1,0,0,1,100,50]});try{
      const el=f.doc.createElementNS(NS,kind==='label'?'text':'g');if(kind==='label'){el.setAttribute('data-test-box','20,30,64,7');el.textContent='Label';}else{el.innerHTML='<text data-test-box="20,30,64,7">Overlay</text>';f.state.overlays.push({id:'small',type:'text',locked:false});}f.svg.append(el);f.select([{kind,id:kind==='label'?'p1':'small',el}]);
      const box=el.getBoundingClientRect();for(const hit of f.svg.querySelectorAll('.selection-resize-hit')){const b=hit.getBoundingClientRect();assert.ok(b.right<=box.left||b.left>=box.right||b.bottom<=box.top||b.top>=box.bottom);}
      assert.equal(f.svg.querySelectorAll('[data-selection-resize]').length,8);assert.equal(f.commits.length,0);
    }finally{f.close();}
  }
});

test('ancestor and descendant selection transforms only the top-level selected group',()=>{
  const f=fixture({body:'<g data-key="e1" transform="translate(20 20)"><rect data-key="e2" width="80" height="40"/></g>'});try{f.select([f.item(),f.item('p1','e2')]);drag(f,'se',{x:190,y:120});assert.ok(f.state.panels.p1.edits[0].e1['object-transform']);assert.equal(f.state.panels.p1.edits[0].e2,undefined);assert.equal(f.find('p1','e2').getAttribute('transform'),null);assert.equal(f.errors.length,0);}finally{f.close();}
});

test('existing affine edits and offsets compose once and clear legacy offsets',()=>{
  const initial={panels:{p1:{edits:{0:{e1:{'object-transform':'[1.5,0,0,1.5,4,6]','offset-x':'7','offset-y':'-3',fill:'#112233'}}}},p2:{edits:{0:{}}}},overlays:[]},f=fixture({initial});try{presentation.applyObjectTransforms(f.svg.querySelector('[data-panel="p1"]'),initial.panels.p1.edits[0]);f.select([f.item()]);const r=f.find('p1').getBoundingClientRect(),start=math.applyPoint(math.inverse([2,0,0,2,100,50]),{x:r.left,y:r.top}),end=math.applyPoint(math.inverse([2,0,0,2,100,50]),{x:r.right,y:r.bottom});drag(f,'se',{x:start.x+2*(end.x-start.x),y:start.y+2*(end.y-start.y)});const props=f.state.panels.p1.edits[0].e1;matrixNear(JSON.parse(props['object-transform']),[3,0,0,3,-19,-27]);assert.equal(props['offset-x'],undefined);assert.equal(props['offset-y'],undefined);assert.equal(props.fill,'#112233');assert.equal(initial.panels.p1.edits[0].e1['offset-x'],'7');}finally{f.close();}
});

test('locked panels, objects and text runs cannot expose resize handles',()=>{
  for(const mode of ['panel','element','item','tspan']){const f=fixture({body:mode==='tspan'?'<text data-test-box="0,0,80,40"><tspan data-key="e1" data-test-box="0,0,80,40">ABC</tspan></text>':undefined});try{if(mode==='panel')f.state.panels.p1.locked=true;if(mode==='element')f.state.panels.p1.lockedElements={0:['e1']};f.select([{...f.item(),locked:mode==='item'}]);assert.equal(f.svg.querySelectorAll('[data-selection-resize]').length,0);assert.equal(f.commits.length,0);}finally{f.close();}}
});

test('a zero-height line keeps horizontal resize handles and finite saved geometry',()=>{
  const f=fixture({body:'<line data-key="e1" x1="20" y1="20" x2="100" y2="20" stroke="black"/>'});try{f.select([f.item()]);assert.deepEqual([...f.svg.querySelectorAll('[data-selection-resize]')].map(node=>node.dataset.selectionResize),['e','w']);drag(f,'e',{x:190,y:40});matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),[2,0,0,1,-20,0]);assert.equal(f.errors.length,0);}finally{f.close();}
});

test('raster inset handles surround its window rather than the distant source ROI',()=>{
  const f=fixture();try{const a={id:'inset1',type:'inset',x:300/600,y:100/240,w:80/600,h:40/240,size:10,stroke:1,source:{panelId:'p1',variant:0,key:'e1',widthPx:100,heightPx:50},roi:{x:0,y:0,w:.5,h:.5}},g=f.doc.createElementNS(NS,'g');g.innerHTML='<g><rect data-inset-roi="true" x="0" y="0" width="30" height="20"/><g data-inset-window="true"><image href="'+raster+'" x="300" y="100" width="80" height="40"/><rect data-inset-frame="true" x="300" y="100" width="80" height="40" fill="none"/></g></g>';f.svg.append(g);f.state.overlays.push(a);f.select([{kind:'overlay',id:'inset1',el:g}]);const outline=f.svg.querySelector('.selection-transform-outline');for(const [key,value]of Object.entries({x:300,y:100,width:80,height:40}))near(+outline.getAttribute(key),value);drag(f,'se',{x:460,y:180});near(f.state.overlays[0].w,160/600);near(f.state.overlays[0].h,80/240);assert.deepEqual(f.state.overlays[0].roi,a.roi);assert.deepEqual(f.state.overlays[0].source,a.source);assert.equal(g.querySelector('image').getAttribute('href'),raster);}finally{f.close();}
});

test('actual inset refresh applies live resize once and leaves the source ROI in place',()=>{
  let f,ctx;
  f=fixture({body:`<image data-key="e1" href="${raster}" x="20" y="10" width="80" height="80"/>`,options:{onPreview:next=>ctx.refreshInsetGraphics(f.svg,f.geometry,next)}});
  try{
    const source=fs.readFileSync(require.resolve(directory+'studio.js'),'utf8'),start=source.indexOf('  function refreshInsetGraphics('),end=source.indexOf('  function refreshOverlaySelection(',start);
    assert.ok(start>0&&end>start);
    ctx={document:f.doc,NS,StudioImageInsets:svgGeometry,selectedAnnotations:[],imageLinks:null,state:()=>f.state};vm.createContext(ctx);
    vm.runInContext(source.split('\n').find(line=>line.startsWith('function insetCalibrationWidth('))+'\n'+source.slice(start,end),ctx);
    const image=f.find('p1');image.closest('[data-panel]').dataset.panel='panel-1';
    const a={id:'annotation-7',type:'inset',x:300/600,y:100/240,w:60/600,h:60/240,text:'',font:'Arial',size:9,stroke:1,color:'#ffffff',opacity:1,fill:false,bold:false,locked:false,source:{panelId:'panel-1',variant:0,key:'e1',widthPx:1,heightPx:1},roi:{x:0,y:0,w:1,h:1},connector:true,showScale:false};
    f.state.overlays.push(a);const group=ctx.overlayNode(a,f.geometry,true,f.svg,f.state);f.svg.append(group);
    const roiPoint=()=>{const node=group.querySelector('[data-inset-roi]');assert.ok(node,group.innerHTML);const [x,y]=node.getAttribute('points').trim().split(/[\s,]+/).map(Number);return svgGeometry.point(svgGeometry.relativeMatrix(node,f.svg),{x,y});};
    const originalROI=roiPoint();f.select([{kind:'overlay',id:a.id,el:group}]);f.down();f.move({x:420,y:220});f.frame();
    const frame=group.querySelector('[data-inset-frame]');assert.ok(frame);near(frame.getBoundingClientRect().width/2,120);near(frame.getBoundingClientRect().height/2,120);near((frame.getBoundingClientRect().left-100)/2,300);near((frame.getBoundingClientRect().top-50)/2,100);assert.deepEqual(roiPoint(),originalROI);assert.equal(f.commits.length,0);assert.equal(f.errors.length,0);
    f.api.cancel();near(group.querySelector('[data-inset-frame]').getBoundingClientRect().width/2,60);assert.deepEqual(roiPoint(),originalROI);assert.equal(image.getAttribute('href'),raster);assert.equal(f.commits.length,0);
  }finally{f.close();}
});

test('image-owned scale bars follow every preview and cancel without changing calibration or pixels',()=>{
  const body=`<g transform="translate(3 4)"><image data-key="e1" href="${raster}" x="20" y="20" width="80" height="40"/><g data-scale-owner="e1" transform="translate(10 30)"><rect width="20" height="2"/><text data-key="e2" data-test-box="0,5,20,8" font-size="8">20 μm</text></g></g>`;
  const f=fixture({body});try{
    f.select([f.item()]);const bar=f.svg.querySelector('[data-scale-owner]'),before=geometryPoint(bar),source=bar.outerHTML,parent=bar.parentElement;f.down();f.move({x:193,y:124});f.frame();const after=geometryPoint(bar),action=[2,0,0,2,-33,-44];near(after.x,2*before.x+action[4]);near(after.y,2*before.y+action[5]);assert.equal(bar.querySelector('text').textContent,'20 μm');assert.equal(f.find('p1').getAttribute('href'),raster);assert.equal(f.commits.length,0);
    f.api.cancel();assert.equal(bar.outerHTML,source);assert.equal(bar.parentElement,parent);assert.equal(f.state.panels.p1.edits[0].e1,undefined);
    function geometryPoint(el){return svgGeometry.point(svgGeometry.relativeMatrix(el,f.svg),{x:4,y:2});}
  }finally{f.close();}
});

test('image and its selected scale-bar text transform once and reopen identically',()=>{
  const body=`<image data-key="e1" href="${raster}" x="20" y="20" width="80" height="40"/><g data-scale-owner="e1" transform="translate(30 45)"><rect width="20" height="2"/><text data-key="e2" data-test-box="0,5,20,8" font-size="8">20 μm</text></g>`;
  const f=fixture({body});try{
    const p2bar=f.doc.createElementNS(NS,'g');p2bar.dataset.scaleOwner='e1';p2bar.setAttribute('transform','translate(7 9)');f.doc.querySelector('#content2').append(p2bar);
    f.select([f.item(),f.item('p1','e2')]);drag(f,'se',{x:190,y:120});assert.deepEqual(Object.keys(f.state.panels.p1.edits[0]),['e1']);assert.equal(f.find('p1','e2').getAttribute('transform'),null);assert.equal(p2bar.getAttribute('transform'),'translate(7 9)');
    const bar=f.svg.querySelector('[data-panel="p1"] [data-scale-owner]'),live=values(svgGeometry.relativeMatrix(bar,f.svg)),reopened=fixture({body,initial:clone(f.state)});try{presentation.applyObjectTransforms(reopened.svg.querySelector('[data-panel="p1"]'),reopened.state.panels.p1.edits[0]);matrixNear(values(svgGeometry.relativeMatrix(reopened.svg.querySelector('[data-panel="p1"] [data-scale-owner]'),reopened.svg)),live);assert.equal(reopened.find('p1','e2').textContent,'20 μm');}finally{reopened.close();}
  }finally{f.close();}
});

test('whole content fits the cell, records background suppression and can move as one unit',()=>{
  const f=fixture({body:'<g id="figure_1"><g id="patch_1"><rect data-key="e9" width="200" height="100" fill="white"/></g><rect data-key="e1" x="20" y="20" width="80" height="40" fill="#123456"/></g>'});try{const content={kind:'content',id:'p1',vi:0,el:f.doc.querySelector('#content1')};f.select([content]);assert.equal(f.api.fitContent(),true);assert.equal(f.commits.length,1);matrixNear(f.state.panels.p1.contentTransforms[0],[2.3,0,0,2.3,-38,-42]);assert.deepEqual(f.state.panels.p1.contentBackgrounds[0],['e9']);assert.deepEqual(f.state.panels.p1.edits[0],{});assert.equal(f.find('p1','e9').getAttribute('fill'),'white');
  }finally{f.close();}
  const moving=fixture();try{moving.select([{kind:'content',id:'p1',vi:0,el:moving.doc.querySelector('#content1')}]);moving.fire(moving.find('p1'),'pointerdown',{x:50,y:60});moving.move({x:65,y:52});moving.frame();moving.up({x:65,y:52});matrixNear(moving.state.panels.p1.contentTransforms[0],[1,0,0,1,15,-8]);assert.equal(moving.commits.length,1);assert.equal(moving.commits[0].label,'已移动图内内容');}finally{moving.close();}
});

test('whole-content dragging captures alignment once and forwards Alt without accumulating previews',()=>{
  const captures=[],moves=[],context={label:'gesture alignment snapshot'};
  const f=fixture({options:{captureMove(items){captures.push(items);return context;},snapMove(snapshot,dx,dy,alt){assert.equal(snapshot,context);moves.push({dx,dy,alt});return alt?{dx,dy}:{dx:20,dy:-10};}}});
  try{
    const content=f.doc.querySelector('#content1');f.select([{kind:'content',id:'p1',vi:0,el:content}]);f.fire(f.find('p1'),'pointerdown',{x:50,y:60});assert.equal(captures.length,1);assert.equal(captures[0][0].el,content);
    f.move({x:65,y:52});f.frame();matrixNear(values(svgGeometry.relativeMatrix(content,content.parentElement)),[1,0,0,1,20,-10]);
    f.move({x:65,y:52},{altKey:true});f.frame();matrixNear(values(svgGeometry.relativeMatrix(content,content.parentElement)),[1,0,0,1,15,-8]);assert.deepEqual(moves.at(-1),{dx:15,dy:-8,alt:true});assert.equal(captures.length,1);assert.equal(f.commits.length,0);
    f.up({x:65,y:52},{altKey:true});matrixNear(f.state.panels.p1.contentTransforms[0],[1,0,0,1,15,-8]);assert.equal(f.commits.length,1);assert.deepEqual(f.snapshots.at(-1),{});assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('overlay and panel label resize retain source assets and change only presentation fields',()=>{
  const f=fixture();try{const overlay={id:'a1',type:'text',x:.05,y:1/6,w:80/600,h:40/240,size:10,stroke:2,text:'Synthetic',fill:false},g=f.doc.createElementNS(NS,'g');g.innerHTML='<rect x="30" y="40" width="80" height="40"/><image href="'+raster+'" width="1" height="1"/>';f.svg.append(g);f.state.overlays.push(overlay);f.select([{kind:'overlay',id:'a1',el:g}]);drag(f,'se',{x:190,y:100},{shiftKey:true});const saved=f.state.overlays[0];near(saved.w,160/600);near(saved.h,60/240);near(saved.size,15);near(saved.stroke,2*Math.sqrt(3));near(saved.stretch,4/3);assert.equal(g.querySelector('image').getAttribute('href'),raster);assert.equal(saved.text,'Synthetic');assert.equal(overlay.size,10);}finally{f.close();}
  const label=fixture();try{const el=label.doc.createElementNS(NS,'text');el.setAttribute('data-test-box','20,30,80,40');el.textContent='A';label.svg.append(el);label.select([{kind:'label',id:'p1',el}]);drag(label,'se',{x:180,y:90},{shiftKey:true});near(label.state.panels.p1.label.size,18);near(label.state.panels.p1.label.stretch,4/3);near(label.state.panels.p1.label.x,5);near(label.state.panels.p1.label.y,10);assert.equal(label.commits.length,1);}finally{label.close();}
});

test('a new state during a gesture cannot receive the stale resize commit',()=>{
  const f=fixture();try{f.select([f.item()]);const original=f.find('p1').getAttribute('transform');f.down();f.move({x:190,y:120});f.frame();const newer=clone(f.state);newer.panels.p1.label.text='New project state';f.state=newer;f.up({x:210,y:130});assert.equal(f.state,newer);assert.equal(f.commits.length,0);assert.equal(f.find('p1').getAttribute('transform'),original);assert.equal(f.api.isActive(),false);}finally{f.close();}
});

test('validation errors do not mutate saved state or leave a preview after cancellation',()=>{
  const f=fixture({options:{validate(){throw new Error('Synthetic validation rejection');}}});try{f.select([f.item()]);const before=f.find('p1').outerHTML,base=f.state;drag(f,'se',{x:190,y:120});assert.equal(f.state,base);assert.equal(f.find('p1').outerHTML,before);assert.equal(f.commits.length,0);assert.ok(f.errors.length);assert.equal(f.api.isActive(),false);}finally{f.close();}
});

test('a rejected commit restores the preview instead of leaving unsaved geometry',()=>{
  let calls=0;const f=fixture({options:{commit(){calls++;return false;}}});try{f.select([f.item()]);const before=f.find('p1').outerHTML,base=f.state;drag(f,'se',{x:190,y:120});assert.equal(calls,1);assert.equal(f.state,base);assert.equal(f.find('p1').outerHTML,before);assert.equal(f.previews.at(-1),base);assert.equal(f.api.isActive(),false);assert.equal(f.captured.size,0);}finally{f.close();}
});

test('a second pointer cannot replace or cancel the active pointer gesture',()=>{
  const f=fixture();try{f.select([f.item()]);f.down();f.move({x:150,y:100});f.frame();f.down('se',{pointerId:99});assert.deepEqual([...f.captured],[7]);f.fire(f.svg,'lostpointercapture',{x:0,y:0},{pointerId:99});assert.equal(f.api.isActive(),true);f.move({x:190,y:120});f.frame();f.up({x:190,y:120});assert.equal(f.commits.length,1);matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),[2,0,0,2,-20,-20]);assert.equal(f.captured.size,0);}finally{f.close();}
});

test('dispose cancels pending work and removes both handles and gesture listeners',()=>{
  const f=fixture();try{f.select([f.item()]);const before=f.find('p1').outerHTML;f.down();f.move({x:190,y:120});assert.equal(f.frames.size,1);f.api.dispose();f.frame();assert.equal(f.find('p1').outerHTML,before);assert.equal(f.frames.size,0);assert.equal(f.svg.querySelector('[data-editor-selection-resize]'),null);assert.equal(f.captured.size,0);f.fire(f.find('p1'),'pointerdown',{x:50,y:50});assert.equal(f.api.isActive(),false);assert.equal(f.commits.length,0);}finally{f.close();}
});
test('large selection uses linear membership checks and ordinary clicks skip all selection geometry',()=>{
  const count=400,f=fixture({body:Array.from({length:count},(_,i)=>`<rect data-key="e${i}" x="${i%40*4}" y="${Math.floor(i/40)*4}" width="3" height="3"/>`).join('')});
  try{
    const items=Array.from({length:count},(_,i)=>f.item('p1','e'+i));let contains=0,reads=0;
    for(const {el}of items){const oldContains=el.contains.bind(el),oldBox=el.getBoundingClientRect.bind(el);el.contains=node=>{contains++;return oldContains(node);};el.getBoundingClientRect=()=>{reads++;return oldBox();};}
    f.select(items);assert.equal(reads,count);assert.equal(contains,0,'sibling membership must not perform quadratic contains checks');
    reads=0;f.fire(items[0].el,'pointerdown',{x:11,y:21});assert.equal(reads,0);assert.equal(contains,0);assert.equal(f.api.isActive(),false);
    const handle=f.svg.querySelector('[data-selection-resize="se"]');f.down();reads=0;
    for(let i=0;i<100;i++)f.move({x:190+i/10,y:100});assert.equal(f.frames.size,1);f.frame();
    assert.equal(reads,0,'preview bounds use captured union instead of rereading every object');assert.equal(f.svg.querySelector('[data-selection-resize="se"]'),handle,'handles stay stable throughout preview');
    f.up({x:200,y:100});assert.equal(f.commits.length,1);assert.equal(Object.keys(f.state.panels.p1.edits[0]).length,count);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('gesture snapshots do not traverse unrelated edits or mutate an earlier preview',()=>{
  const f=fixture();try{
    const untouched={toJSON(){throw Error('Unrelated panel was serialized during a pointer frame');}},unchangedEdit={fill:'#c0ffee'};
    f.state.panels.p2.edits[0].unrelated=untouched;f.state.panels.p1.edits[0].untouched=unchangedEdit;
    const base=f.state;f.select([f.item()]);f.down();f.move({x:190,y:120});f.frame();
    const first=f.previews.at(-1),firstValue=first.panels.p1.edits[0].e1['object-transform'];
    assert.equal(first.panels.p2,base.panels.p2);assert.equal(first.panels.p1.edits[0].untouched,unchangedEdit);
    f.move({x:230,y:140});f.frame();const second=f.previews.at(-1);
    assert.notEqual(second.panels.p1.edits[0].e1['object-transform'],firstValue);assert.equal(first.panels.p1.edits[0].e1['object-transform'],firstValue);assert.equal(base.panels.p1.edits[0].e1,undefined);
    f.api.cancel();assert.equal(f.state,base);assert.equal(f.errors.length,0);
  }finally{f.close();}
});
test('semantic resize hooks receive panel-point action, preserve transforms and restore on cancel',()=>{
  const captures=[],plans=[],paints=[],restores=[];
  const f=fixture({body:'<line data-key="e1" x1="20" x2="20" y1="20" y2="60"/>',options:{
    resizeHandles:()=>['n','s'],captureResize(item){captures.push(item);return {axis:'y',end:item.el.getAttribute('y2')};},
    persistResize(item,delta,next){assert.equal(item.semantic.axis,'y');plans.push(delta);next.panels[item.id].edits[item.vi][item.key]['axis-extension']=JSON.stringify({version:1,axis:'y',min:0,max:100*delta[3]});return true;},
    previewResize(item,delta){paints.push(delta);item.el.setAttribute('y2',Number(item.semantic.end)*delta[3]+delta[5]);return true;},
    restoreResize(item){restores.push(item);item.el.setAttribute('y2',item.semantic.end);}
  }});
  try{
    f.select([f.item()]);assert.deepEqual([...f.svg.querySelectorAll('[data-selection-resize]')].map(el=>el.dataset.selectionResize),['n','s']);
    const before=f.find('p1').outerHTML;f.down('s');f.move({x:30,y:120});f.frame();assert.equal(captures.length,1);assert.equal(paints.length,1);matrixNear(plans[0],[1,0,0,2,0,-20]);assert.equal(f.find('p1').getAttribute('transform'),null);assert.equal(f.find('p1').getAttribute('y2'),'100');
    f.api.cancel();assert.equal(restores.length,1);assert.equal(f.find('p1').outerHTML,before);assert.equal(f.commits.length,0);
    f.down('s');f.move({x:30,y:120});f.up({x:30,y:120});assert.equal(f.commits.length,1);assert.equal(f.state.panels.p1.edits[0].e1['object-transform'],undefined);assert.equal(JSON.parse(f.state.panels.p1.edits[0].e1['axis-extension']).max,200);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

const ownerInterval='<g transform="translate(20 10) scale(2 3)"><path data-key="e1" data-test-box="10,5,0,20" d="M10 5 L10 25" stroke="#20242a"/></g><g transform="translate(-8 7) scale(.5 2)"><path data-key="e2" data-studio-error-owner="e1" data-test-box="90,9,12,0" d="M90 9 L102 9" stroke="#20242a"/></g><g transform="translate(4 -5) scale(3 .5)"><path data-key="e3" data-studio-error-owner="e1" data-test-box="10,180,4,0" d="M10 180 L14 180" stroke="#20242a"/></g>';
function renderedEnds(f,key,panel='p1'){
  const node=f.find(panel,key),raw=node.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g).map(Number),m=svgGeometry.relativeMatrix(node,f.svg);assert.equal(raw.length,4);
  return [svgGeometry.point(m,{x:raw[0],y:raw[1]}),svgGeometry.point(m,{x:raw[2],y:raw[3]})];
}
function renderedCenter(f,key){const [a,b]=renderedEnds(f,key);return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function assertEndpointCaps(f){const stem=renderedEnds(f,'e1');for(const [index,key]of ['e2','e3'].entries()){const cap=renderedCenter(f,key);near(cap.x,stem[index].x);near(cap.y,stem[index].y);}}

test('live stem-only resize captures caps across different parents and restores all attached geometry on cancel',()=>{
  const f=fixture({body:ownerInterval});try{
    const other=f.doc.createElementNS(NS,'path');other.setAttribute('data-key','e9');other.setAttribute('data-studio-error-owner','e1');other.setAttribute('d','M45 50 L55 50');other.setAttribute('data-test-box','45,50,10,0');f.svg.querySelector('#content2').append(other);const unrelated=other.outerHTML;
    f.select([f.item()]);assertEndpointCaps(f);const before=f.svg.querySelector('#content1').outerHTML,start=f.down('s'),target={x:start.x,y:start.y+60};
    f.move({x:target.x,y:target.y-30});f.frame();assertEndpointCaps(f);f.move(target);f.frame();assertEndpointCaps(f);near(renderedEnds(f,'e1')[0].y,45);near(renderedEnds(f,'e1')[1].y,165);assert.equal(other.outerHTML,unrelated,'an identically keyed owner in another panel cannot follow this stem');
    assert.equal(f.commits.length,0);assert.equal(f.api.cancel(),true);assert.equal(f.svg.querySelector('#content1').outerHTML,before);assertEndpointCaps(f);assert.equal(f.state.panels.p1.edits[0].e1,undefined);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('live and saved resize agree for stem-only and stem-plus-caps selection without double application',()=>{
  for(const keys of [['e1'],['e1','e2','e3'],['e3','e2','e1']]){
    const f=fixture({body:ownerInterval});try{
      f.select(keys.map(key=>f.item('p1',key)));const start=f.down('s'),target={x:start.x,y:start.y+60};f.move(target);f.frame();assertEndpointCaps(f);near(renderedEnds(f,'e1')[1].y,165);f.up(target);assertEndpointCaps(f);assert.equal(f.commits.length,1);assert.equal(f.errors.length,0);
      assert.deepEqual(Object.keys(f.state.panels.p1.edits[0]).sort(),[...keys].sort(),'only explicitly selected objects need saved records');
      const saved=clone(f.state),reopened=fixture({body:ownerInterval,initial:saved});try{presentation.applyObjectTransforms(reopened.svg.querySelector('[data-panel="p1"]'),saved.panels.p1.edits[0]);assertEndpointCaps(reopened);for(const key of ['e1','e2','e3']){const live=renderedEnds(f,key),restored=renderedEnds(reopened,key);live.forEach((p,i)=>{near(p.x,restored[i].x);near(p.y,restored[i].y);});}}finally{reopened.close();}
    }finally{f.close();}
  }
});

test('an explicitly selected cap resizes independently and never moves its owning stem',()=>{
  const f=fixture({body:ownerInterval});try{
    f.select([f.item('p1','e2')]);const beforeStem=f.find('p1','e1').outerHTML,beforeOther=f.find('p1','e3').outerHTML,center=renderedCenter(f,'e2'),start=f.down('e');const target={x:start.x+6,y:start.y};f.move(target);f.frame();const resized=renderedEnds(f,'e2');near(Math.hypot(resized[1].x-resized[0].x,resized[1].y-resized[0].y),12);assert.equal(f.find('p1','e1').outerHTML,beforeStem);assert.equal(f.find('p1','e3').outerHTML,beforeOther);
    // Ordinary edge resize leaves its opposite edge anchored; the owner must
    // not force the user-controlled cap back to the automatic center.
    near(renderedCenter(f,'e2').x,center.x+3);f.up(target);assert.equal(f.commits.length,1);assert.deepEqual(Object.keys(f.state.panels.p1.edits[0]),['e2']);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('a 142-object release reuses the exact last validated preview without repeated writes or bbox measurements',()=>{
  const count=142,body=Array.from({length:count},(_,i)=>`<rect data-key="e${i+1}" x="${20+i/10}" y="20" width="10" height="40"/>`).join(''),work={persist:0,validate:0,preview:0,writes:0,reads:0},finished=[];
  const f=fixture({body,options:{persistResize(){work.persist++;return false;},validate(){work.validate++;},onFinish:info=>finished.push(info)}});try{
    const items=Array.from({length:count},(_,i)=>f.item('p1','e'+(i+1)));for(const item of items){const get=item.el.getBoundingClientRect.bind(item.el),set=item.el.setAttribute.bind(item.el);item.el.getBoundingClientRect=()=>{work.reads++;return get();};item.el.setAttribute=(key,value)=>{if(key==='transform')work.writes++;return set(key,value);};}
    f.select(items);const start=f.down('se'),target={x:start.x+80,y:start.y+50};f.move(target,{shiftKey:true});f.frame();assert.equal(work.persist,count);assert.equal(work.validate,1);assert.equal(work.writes,count);assert.equal(f.previews.length,1);const exactPreview=f.previews[0],before={...work};
    f.up(target,{shiftKey:true});assert.deepEqual(work,before,'pointerup at already-painted coordinates must not repeat persist, validation, DOM transforms or 142-object layout reads');assert.equal(f.commits.length,1);assert.equal(f.commits[0].next,exactPreview,'commit retains the exact validated preview object');assert.equal(finished.length,1);assert.equal(finished[0].committed,true);assert.equal(finished[0].items.length,count);assert.ok(finished[0].action);assert.equal(f.errors.length,0);
    const saved=clone(f.state),reopened=fixture({body,initial:saved});try{presentation.applyObjectTransforms(reopened.svg.querySelector('[data-panel="p1"]'),saved.panels.p1.edits[0]);for(const key of ['e1','e71','e142']){const a=f.find('p1',key).getBoundingClientRect(),b=reopened.find('p1',key).getBoundingClientRect();for(const field of ['left','right','top','bottom'])near(a[field],b[field]);}}finally{reopened.close();}
  }finally{f.close();}
});

test('release flushes a genuinely new pointer/modifier exactly once instead of committing an earlier frame',()=>{
  const work={persist:0,validate:0};const f=fixture({options:{persistResize(){work.persist++;return false;},validate(){work.validate++;}}});try{
    f.select([f.item()]);const start=f.down('se'),first={x:start.x+80,y:start.y+40},last={x:start.x+80,y:start.y+80};f.move(first);f.frame();assert.equal(f.previews.length,1);
    f.up(last,{shiftKey:true});assert.equal(work.persist,2);assert.equal(work.validate,2);assert.equal(f.previews.length,2);assert.equal(f.commits[0].next,f.previews[1]);matrixNear(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform']),[2,0,0,3,-20,-40]);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

test('a final invalid resize restores the source and cannot commit an earlier successful preview',()=>{
  const finished=[];const f=fixture({options:{validate(next){const value=JSON.parse(next.panels.p1.edits[0].e1['object-transform']);if(value[0]>2.1)throw Error('Synthetic final input rejection');},onFinish:info=>finished.push(info)}});try{
    f.select([f.item()]);const source=f.find('p1').outerHTML,base=f.state;f.down('se');f.move({x:190,y:120});f.frame();assert.notEqual(f.find('p1').outerHTML,source);assert.equal(f.previews.length,1);
    f.up({x:270,y:160});assert.equal(f.commits.length,0);assert.equal(f.state,base);assert.equal(f.find('p1').outerHTML,source);assert.equal(finished[0].committed,false);assert.ok(f.errors.length);assert.equal(f.captured.size,0);
  }finally{f.close();}
});

test('semantic axis hooks are not repeated on identical release and keep their saved geometry without a full render',()=>{
  const work={persist:0,paint:0,restore:0},finished=[];
  const f=fixture({body:'<line data-key="e1" x1="20" x2="20" y1="20" y2="60"/>',options:{
    resizeHandles:()=>['n','s'],captureResize:item=>({axis:'y',end:item.el.getAttribute('y2')}),persistResize(item,delta,next){work.persist++;next.panels[item.id].edits[item.vi][item.key]['axis-extension']=JSON.stringify({axis:'y',end:Number(item.semantic.end)*delta[3]+delta[5]});return true;},previewResize(item,delta){work.paint++;item.el.setAttribute('y2',Number(item.semantic.end)*delta[3]+delta[5]);return true;},restoreResize(item){work.restore++;item.el.setAttribute('y2',item.semantic.end);},onFinish:info=>finished.push(info)
  }});try{
    f.select([f.item()]);f.down('s');f.move({x:30,y:120});f.frame();assert.equal(f.find('p1').getAttribute('y2'),'100');const before={...work};f.up({x:30,y:120});assert.deepEqual(work,before);assert.equal(f.commits.length,1);assert.equal(f.find('p1').getAttribute('transform'),null);assert.equal(f.find('p1').getAttribute('y2'),'100');assert.equal(JSON.parse(f.state.panels.p1.edits[0].e1['axis-extension']).end,100);assert.ok(finished[0].items[0].semantic);assert.equal(finished[0].committed,true);assert.equal(f.errors.length,0);
  }finally{f.close();}
});

function canonicalFixture({width=200,body,contentTransform=null,fitted=false,variant={width:200,viewBox:[0,0,200,100]},panelLock=null}={}){
  let f;const reads={units:0};f=fixture({body,screen:[1,0,0,1,0,0],options:{presentationUnit(item,root){reads.units++;return hostGeometry.panelPresentationUnit(f.state.panels[item.id],item.vi,root,variant,item.el);}}});
  f.state.panels.p1.variant=0;
  const root=f.svg.querySelector('[data-panel="p1"]');root.setAttribute('width',width);root.setAttribute('height',width/2);root.setAttribute('data-grid-panel',JSON.stringify({width:200,height:100,sourceHeight:100,fitted}));
  if(panelLock)f.state.panels.p1.layoutLock={panel:{variant:0,unit:panelLock}};
  if(contentTransform)f.state.panels.p1.contentTransforms={0:[...contentTransform]};
  const markup=root.innerHTML,applyContent=()=>{const value=f.state.panels.p1.contentTransforms?.[0];if(value){const unit=hostGeometry.panelPresentationUnit(f.state.panels.p1,0,root,variant),m=[...value];m[4]*=unit;m[5]*=unit;root.querySelector('[data-panel-content]').setAttribute('transform','matrix('+m.join(' ')+')');}};
  applyContent();
  const compose=()=>{root.innerHTML=markup;presentation.applyObjectTransforms(root,f.state.panels.p1.edits[0],hostGeometry.panelPresentationUnit(f.state.panels.p1,0,root,variant));applyContent();};
  return Object.assign(f,{reads,variant,panelRoot:root,compose});
}
function checkedResize(f,scale=1.5){
  f.select([f.item()]);const start=f.down('e'),box=f.find('p1').getBoundingClientRect(),target={x:start.x+box.width*(scale-1),y:start.y};f.move(target);f.frame();f.up(target);
  const preview=f.find('p1').getBoundingClientRect();f.compose();const restored=f.find('p1').getBoundingClientRect();for(const key of ['left','right','top','bottom'])near(restored[key],preview[key]);assert.equal(f.errors.length,0);return restored;
}
test('manual viewport sizes .5x and 2x preserve resize previews through the next command and repeated resizing',()=>{
  for(const width of [100,400]){const f=canonicalFixture({width});try{
    checkedResize(f);const before=f.find('p1').getBoundingClientRect(),node=f.find('p1'),p=f.state.panels.p1,motionBasis=hostGeometry.panelMotionBasis(p,0,node,f.variant,f.svg),result=hostGeometry.nudgeSelectionState(f.state,[{kind:'element',id:'p1',vi:0,key:'e1',motionBasis}],7,-3,f.geometry);f.state=result.next;f.compose();const moved=f.find('p1').getBoundingClientRect();near(moved.left,before.left+7);near(moved.top,before.top-3);checkedResize(f,1.2);
    const prior=f.find('p1').getBoundingClientRect();f.state=clone(f.state);f.state.panels.p1.edits[0].e1.fill='#ab2468';f.compose();const styled=f.find('p1').getBoundingClientRect();for(const key of ['left','right','top','bottom'])near(styled[key],prior[key]);
  }finally{f.close();}}
});
test('PDF local matrices and rotated/stretched content preserve physical resize and nudge across manual fitting',()=>{
  const body='<g transform="translate(4 3)"><text data-key="e1" data-test-box="0,0,1.6,.8" font-size=".24" x="0 .1 .2" y="0 0 0" transform="matrix(50 0 0 50 20 20)">ABC</text></g>';
  for(const width of [100,400]){const f=canonicalFixture({width,body,contentTransform:[1.2,.15,-.2,.9,4,6]});try{
    checkedResize(f);const node=f.find('p1'),before=node.getBoundingClientRect(),p=f.state.panels.p1,motionBasis=hostGeometry.panelMotionBasis(p,0,node,f.variant,f.svg),result=hostGeometry.nudgeSelectionState(f.state,[{kind:'element',id:'p1',vi:0,key:'e1',motionBasis}],-4,6,f.geometry);f.state=result.next;f.compose();const moved=f.find('p1').getBoundingClientRect();near(moved.left,before.left-4);near(moved.top,before.top+6);checkedResize(f,1.15);assert.equal(f.find('p1').getAttribute('font-size'),'.24');assert.equal(f.find('p1').getAttribute('x'),'0 .1 .2');
  }finally{f.close();}}
});
test('fitted and snapshot presentation units override the source variant without changing the next-render geometry',()=>{
  for(const options of [{fitted:true,variant:{width:100,viewBox:[0,0,200,100]}},{width:400,panelLock:1.5}]){const f=canonicalFixture(options);try{checkedResize(f);checkedResize(f,1.1);}finally{f.close();}}
});
test('whole-content resize uses the same canonical units in smaller and larger cells, including an existing content transform',()=>{
  for(const width of [100,400])for(const contentTransform of [null,[1.2,.15,-.2,.9,4,6]]){const f=canonicalFixture({width,contentTransform});try{
    const el=f.panelRoot.querySelector('[data-panel-content]');f.select([{kind:'content',id:'p1',vi:0,el}]);const start=f.down('e'),target={x:start.x+25,y:start.y};f.move(target);f.frame();f.up(target);const preview=f.find('p1').getBoundingClientRect();f.compose();const reopened=f.find('p1').getBoundingClientRect();for(const key of ['left','right','top','bottom'])near(reopened[key],preview[key]);assert.equal(f.errors.length,0);
  }finally{f.close();}}
});
test('large selections resolve one canonical panel space per capture instead of rereading units for every object',()=>{
  const body=Array.from({length:142},(_,i)=>`<rect data-key="e${i+1}" x="${20+i/10}" y="20" width="10" height="40"/>`).join(''),f=canonicalFixture({width:400,body});try{
    f.select(Array.from({length:142},(_,i)=>f.item('p1','e'+(i+1))));const before=f.reads.units,start=f.down('se');assert.equal(f.reads.units-before,1);f.move({x:start.x+80,y:start.y+40});f.frame();f.up({x:start.x+80,y:start.y+40});assert.equal(f.reads.units-before,1);assert.equal(f.errors.length,0);
  }finally{f.close();}
});
test('actual released panel and element snapshots retain resize previews after style, nudge and saved-state recomposition',()=>{
  const path=require('node:path'),{createRequire}=require('node:module'),file=path.resolve('scripts/test_studio_layout_lock_integration.cjs'),fixtureSource=fs.readFileSync(file,'utf8'),factory={require:createRequire(file),console};vm.createContext(factory);vm.runInContext(fixtureSource.slice(0,fixtureSource.indexOf('const test=(name,fn)=>'))+'\nglobalThis.make=harness;',factory);
  for(const mode of ['panel','element']){
    const h=factory.make(),{ctx,doc,dom}=h,priorStyle=global.getComputedStyle,grid=require(directory+'grid-resize-ui.js'),main=require(directory+'studio.js'),proto=dom.window.SVGElement.prototype;
    vm.runInContext(hostSource.slice(hostSource.indexOf('function panelContentDelta('),hostSource.indexOf('function gridFor(')),ctx);
    const activeRoot=node=>{let root=node;while(root.parentElement?.namespaceURI===NS)root=root.parentElement;return root;},root=()=>doc.querySelector('#artboard > svg'),at=()=>{const svg=root();return svgGeometry.point(svgGeometry.relativeMatrix(svg.querySelector('[data-key="e1"]'),svg),{x:7,y:9});};
    proto.getScreenCTM=function(){const svg=activeRoot(this);return svg===this?object(I):svgGeometry.relativeMatrix(this,svg);};
    Object.defineProperty(proto,'transform',{configurable:true,get(){return {baseVal:{consolidate:()=>{const scratch=doc.createElementNS(NS,'g'),probe=doc.createElementNS(NS,'g');scratch.append(probe);probe.setAttribute('transform',this.getAttribute('transform')||'');return {matrix:svgGeometry.relativeMatrix(probe,scratch)};}}};}});
    proto.getBoundingClientRect=function(){
      let b;if(this.localName==='svg'){const v=this.getAttribute('viewBox').split(/[\s,]+/).map(Number);b={x:v[0],y:v[1],width:v[2],height:v[3]};}
      else if(this.localName==='path'){const n=(this.getAttribute('d').match(/[+-]?(?:\d*\.)?\d+/g)||[]).map(Number),x=n.filter((_,i)=>i%2===0),y=n.filter((_,i)=>i%2);b={x:Math.min(...x),y:Math.min(...y),width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)};}
      else if(this.localName==='text'){const x=(this.getAttribute('x')||'0').split(/[\s,]+/).map(Number),y=(this.getAttribute('y')||'0').split(/[\s,]+/).map(Number),size=parseFloat(this.style.fontSize||this.getAttribute('font-size'))||10;b={x:Math.min(...x),y:Math.min(...y)-size,width:Math.max(...x)-Math.min(...x)+size*.6,height:Math.max(...y)-Math.min(...y)+size*1.2};}
      else if(this.localName==='rect')b={x:+this.getAttribute('x'),y:+this.getAttribute('y'),width:+this.getAttribute('width'),height:+this.getAttribute('height')};
      if(b){const m=this.getScreenCTM(),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>svgGeometry.point(m,{x,y})),left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));return {left,right,top,bottom,width:right-left,height:bottom-top};}
      const children=[...this.children].filter(n=>!['defs','metadata','title','desc'].includes(n.localName)).map(n=>n.getBoundingClientRect());if(!children.length)return {left:0,right:0,top:0,bottom:0,width:0,height:0};const left=Math.min(...children.map(b=>b.left)),right=Math.max(...children.map(b=>b.right)),top=Math.min(...children.map(b=>b.top)),bottom=Math.max(...children.map(b=>b.bottom));return {left,right,top,bottom,width:right-left,height:bottom-top};
    };
    global.getComputedStyle=node=>new Proxy(dom.window.getComputedStyle(node),{get:(style,key)=>key==='opacity'&&!style.opacity?'1':style[key]});
    try{
      if(mode==='element')ctx.info={canLock:true,canUnlock:true,groups:[{id:'a',vi:0,keys:['e1']}],panels:[],overlays:[]};ctx.setLock(true);ctx.commit(grid.planWhole(ctx.state(),ctx.layout(),650,420).state,'grow locked');ctx.setLock(false);ctx.commit(grid.planWhole(ctx.state(),ctx.layout(),800,500).state,'grow released');
      const content=clone(ctx.state());content.panels.a.contentTransforms={0:[1.2,.15,-.2,.9,4,6]};ctx.commit(content,'content stretch');
      const resize=()=>{
        const svg=root(),el=svg.querySelector('[data-key="e1"]'),captured=new Set(),jobs=new Map();let serial=0;svg.setPointerCapture=id=>captured.add(id);svg.hasPointerCapture=id=>captured.has(id);svg.releasePointerCapture=id=>captured.delete(id);
        const api=controller.create({svg,geometry:ctx.layout(),state:ctx.state,selection:()=>[{kind:'element',id:'a',vi:0,key:'e1',el}],presentationUnit:(item,panel)=>ctx.panelPresentationUnit(ctx.state().panels.a,0,panel,h.asset.variants[0],item.el),commit:ctx.commit,requestAnimationFrame:fn=>{jobs.set(++serial,fn);return serial;},cancelAnimationFrame:id=>jobs.delete(id),onError:error=>{throw error;}});
        const fire=(target,type,p)=>{const e=new dom.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,clientX:p.x,clientY:p.y});Object.defineProperty(e,'pointerId',{value:7});target.dispatchEvent(e);};
        try{api.refresh();const handle=svg.querySelector('[data-selection-resize="e"]'),hit=handle.querySelector('rect'),start={x:+hit.getAttribute('x')+ +hit.getAttribute('width')/2,y:+hit.getAttribute('y')+ +hit.getAttribute('height')/2},target={x:start.x+20,y:start.y};fire(handle,'pointerdown',start);fire(svg,'pointermove',target);for(const fn of jobs.values())fn();jobs.clear();const preview=svgGeometry.point(svgGeometry.relativeMatrix(el,svg),{x:7,y:9});fire(svg,'pointerup',target);const after=at();near(after.x,preview.x);near(after.y,preview.y);return after;}finally{api.dispose();}
      };
      resize();const node=root().querySelector('[data-key="e1"]'),before=at(),motionBasis=ctx.panelMotionBasis(ctx.state().panels.a,0,node,h.asset.variants[0],root()),moved=ctx.nudgeSelectionState(ctx.state(),[{kind:'element',id:'a',vi:0,key:'e1',motionBasis}],3,2,ctx.layout());ctx.commit(moved.next,'nudge after resize');near(at().x,before.x+3);near(at().y,before.y+2);resize();
      const final=at(),styled=clone(ctx.state());styled.panels.a.edits[0].e1.stroke='#124578';ctx.commit(styled,'style after resize');near(at().x,final.x);near(at().y,final.y);ctx.history=new main.History(clone(ctx.state()));ctx.render();near(at().x,final.x);near(at().y,final.y);
    }finally{global.getComputedStyle=priorStyle;dom.window.close();}
  }
});
console.log(`${passed} selection resize controller integration tests passed`);
if(failures.length){console.error(`${failures.length} controller integration test(s) failed`);process.exitCode=1;}
