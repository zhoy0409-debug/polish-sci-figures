'use strict';
const assert=require('node:assert/strict');
const api=require('../skills/polish-sci-figures/assets/figure-studio/grid-resize-ui.js');
const studio=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const initial={order:['a','b','c','d'],columns:2,gap:12,gapY:10,grid:{rows:2,manualTracks:true,widths:[200,400],heights:[180,270],places:{a:{row:0,col:0,rs:1,cs:1},b:{row:0,col:1,rs:1,cs:1},c:{row:1,col:0,rs:1,cs:1},d:{row:1,col:1,rs:1,cs:1}}},panels:Object.fromEntries(['a','b','c','d'].map(id=>[id,{variant:0,edits:{0:{e0:{'font-size':'12'}}}}]))};
const project={panels:['a','b','c','d'].map((id,i)=>({id,variants:[{width:i%2?150:200,height:i%2?270:100,viewBox:[0,0,i%2?150:200,i%2?270:100],svg:'original scientific vector '+id}]}))};
const base={width:612,height:460,positions:['a','b','c','d'].map(id=>({id,statisticsTop:0,statisticsBand:0,conditionHeight:0})),cells:[]};
const layout=state=>api.positions(state,{...base,positions:base.positions.filter(pos=>state.order.includes(pos.id))},state.grid.widths,state.grid.heights);
const original=JSON.stringify(initial),assets=JSON.stringify(project);
let checks=0;
const close=(a,b,message='numeric equality')=>assert.ok(Math.abs(a-b)<1e-8,`${message}: ${a} != ${b}`);
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};

test('whole right edge resizes every column with its ratio and fixed gaps',()=>{
  const result=api.planWhole(initial,layout(initial),732,460);
  assert.deepEqual(result.state.grid.widths,[240,480]);assert.deepEqual(result.state.grid.heights,[180,270]);
  assert.equal(result.actual.width,732);assert.equal(result.actual.height,460);assert.equal(result.clamped,false);
  assert.equal(result.state.gap,12);assert.equal(result.state.gapY,10);assert.equal(result.state.grid.manualTracks,true);
  assert.equal(result.state.panels,initial.panels,'Pointer planning never clones or changes artwork edits');
  studio.validateState(result.state,project);assert.equal(JSON.stringify(initial),original);
});
test('whole bottom edge resizes every row and preserves original artwork proportions',()=>{
  const result=api.planWhole(initial,layout(initial),612,550);
  assert.deepEqual(result.state.grid.heights,[216,324]);assert.deepEqual(result.state.grid.widths,[200,400]);
  for(const pos of result.layout.positions){const variant=project.panels.find(p=>p.id===pos.id).variants[0],box=api.panelViewport(pos,variant,true);close(box.width/variant.width,box.height/variant.height);close(box.x+box.width/2,pos.x+pos.width/2);close(box.y+box.height/2,pos.y+pos.height/2);}
});
test('corner preserves complete master aspect and supports free width/height planning',()=>{
  const result=api.planWhole(initial,layout(initial),918,690,{proportional:true});close(result.layout.width/result.layout.height,612/460);assert.equal(result.clamped,false);
  const free=api.planWhole(initial,layout(initial),918,460);assert.equal(free.layout.height,460);assert.notEqual(free.layout.width/free.layout.height,612/460);
  const projected=api.planWhole(initial,layout(initial),800,470,{proportional:true});assert.equal(projected.clamped,false,'Diagonal projection is not a minimum-size clamp');
});
test('all tracks clamp at readable minima and remain valid across extreme inputs',()=>{
  const result=api.planWhole(initial,layout(initial),-500,-500);assert.equal(result.clamped,true);assert.deepEqual(result.state.grid.widths,[72,144]);assert.deepEqual(result.state.grid.heights,[72,108]);studio.validateState(result.state,project);
  const maximum=api.planWhole(initial,layout(initial),1e9,1e9);assert.equal(maximum.clamped,true);assert.equal(Math.max(...maximum.state.grid.widths),14400);assert.equal(Math.max(...maximum.state.grid.heights),14400);studio.validateState(maximum.state,project);
  for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>api.planWhole(initial,layout(initial),value,460),/布局/);
  for(let i=0;i<120;i++){const r=api.planWhole(initial,layout(initial),Math.sin(i)*800+800,Math.cos(i)*650+700,{proportional:i%2===0});studio.validateState(r.state,project);for(const key of ['widths','heights'])assert.ok(r.state.grid[key].every(v=>v>=72&&v<=14400));}
});
test('locked panels reject resizing without mutating state',()=>{
  const locked=clone(initial);locked.panels.d.locked=true;const before=JSON.stringify(locked);assert.throws(()=>api.planWhole(locked,layout(locked),732,460),/锁定/);assert.equal(JSON.stringify(locked),before);
});
test('explicit export width follows actual master width and remains within supported bounds',()=>{
  const explicit={...clone(initial),exportSettings:{widthMm:300,dpi:600}},before=JSON.stringify(explicit),result=api.planWhole(explicit,layout(explicit),918,460);
  assert.equal(result.state.exportSettings.widthMm,450);close(studio.exportGeometry(result.layout.width,result.layout.height,result.state.exportSettings).scale,studio.exportGeometry(612,460,explicit.exportSettings).scale);
  const low=api.planWhole(explicit,layout(explicit),0,460),high=api.planWhole(explicit,layout(explicit),1e9,460);assert.ok(low.state.exportSettings.widthMm>=20);close(high.state.exportSettings.widthMm,2000);studio.validateState(high.state,project);assert.equal(JSON.stringify(explicit),before);
});
test('whole layout edits save and restore in one Undo without storing vector assets',()=>{
  const history=new studio.History(initial),result=api.planWhole(history.current,layout(history.current),732,550);history.commit(result.state);assert.equal(history.states.length,2);assert.deepEqual(history.undo(),initial);assert.equal(history.redo().grid.widths[0],240);studio.validateState(JSON.parse(JSON.stringify(history.current)),project);assert.equal(JSON.stringify(history.states).includes('original scientific vector'),false);assert.equal(JSON.stringify(project),assets);
});

if(process.argv.includes('--dom')){
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<div id="controls"></div><div id="viewport"><div id="artboard"></div></div>',{pretendToBeVisual:true}),d=dom.window.document,viewport=d.getElementById('viewport'),board=d.getElementById('artboard'),history=new studio.History(initial);
  let ui,pending=null,scheduled=0,commits=0,repaints=0,previewCalls=0,mappingReads=0,enabled=true;
  const render=next=>{
    repaints++;const state=next||history.current,l=layout(state);board.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${l.width} ${l.height}" width="${l.width}pt" height="${l.height}pt">${l.positions.map(pos=>{const v=project.panels.find(p=>p.id===pos.id).variants[0],metrics={width:v.width,height:v.height,sourceHeight:v.height,fitted:false},box=api.panelViewport(pos,metrics,true);return `<svg data-panel="${pos.id}" data-grid-panel='${JSON.stringify(metrics)}' x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${v.viewBox.join(' ')}" preserveAspectRatio="xMidYMid meet"><path d="M 10 10 L 90 90"/><text x="10" y="20">Scientific label</text></svg>`;}).join('')}</svg>`;
    const svg=board.firstElementChild;svg.style.width=l.width*1.25+'px';svg.style.height=l.height*1.25+'px';svg.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,width:parseFloat(svg.style.width),height:parseFloat(svg.style.height)});svg.getScreenCTM=()=>{mappingReads++;return {inverse:()=>({a:.8,b:0,c:0,d:.8,e:0,f:0})};};svg.setPointerCapture=()=>{};svg.releasePointerCapture=()=>{};ui?.refresh();
  };
  render();ui=api.create({controls:d.getElementById('controls'),viewport,root:()=>board.firstElementChild,state:()=>history.current,project:()=>project,layout:()=>layout(history.current),enabled:()=>enabled,repaint:render,raf:fn=>{pending=fn;scheduled++;return scheduled;},caf:()=>pending=null,previewCanvas:(svg,l)=>{previewCalls++;assert.equal(svg.getAttribute('viewBox'),`0 0 ${l.width} ${l.height}`);},commit:next=>{studio.validateState(next,project);commits++;history.commit(next);render();return true;}});ui.refresh();
  const handle=edge=>board.querySelector(`[data-grid-resize="outer"][data-grid-edge="${edge}"]`),flush=()=>{const fn=pending;pending=null;fn?.();},fire=(target,type,values={})=>{const event=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{button:0,pointerId:1,clientX:0,clientY:0,shiftKey:false,...values});target.dispatchEvent(event);return event;},coords=(edge,l=layout(history.current))=>({clientX:(edge==='bottom'?l.width/2:l.width)*1.25,clientY:(edge==='right'?l.height/2:l.height)*1.25});
  test('top, left, right, bottom and corner handles exist with grips and hit targets',()=>{
    assert.equal(board.querySelectorAll('[data-grid-resize="outer"]').length,5);
    for(const edge of ['right','bottom','corner']){const g=handle(edge),rects=g.querySelectorAll('rect');assert.ok(g.getAttribute('aria-label'));assert.equal(g.getAttribute('tabindex'),'0');close(Number(rects[0].getAttribute('width'))*1.25,28);close(Number(rects[0].getAttribute('height'))*1.25,28);close(Math.max(Number(rects[1].getAttribute('width')),Number(rects[1].getAttribute('height')))*1.25,28);assert.equal(g.closest('[data-editor-guides]').getAttribute('data-editor-guides'),'true');}
  });
  test('many pointer updates coalesce to one DOM frame, preserve nodes, and commit one Undo',()=>{
    const s=history.current,before=repaints,baseLayout=layout(s),start=coords('right'),nodes=[...board.querySelectorAll('svg[data-panel]')],path=nodes[0].querySelector('path').outerHTML,reads=mappingReads;
    fire(handle('right'),'pointerdown',start);for(let i=1;i<=36;i++)fire(viewport,'pointermove',{...start,clientX:start.clientX+i*5});assert.equal(commits,0);assert.ok(pending);assert.equal(scheduled,1);flush();assert.equal(repaints,before);assert.equal(history.current,s);assert.deepEqual([...board.querySelectorAll('svg[data-panel]')],nodes);assert.equal(mappingReads,reads+1,'Screen mapping is captured once, never derived from the growing root');assert.equal(nodes[0].querySelector('path').outerHTML,path);const preview=nodes.map(node=>Object.fromEntries(['x','y','width','height','viewBox'].map(k=>[k,node.getAttribute(k)])));close(parseFloat(board.firstElementChild.style.width),(baseLayout.width+144)*1.25);assert.equal(previewCalls,1);
    fire(viewport,'pointerup',{...start,clientX:start.clientX+180});assert.equal(commits,1);assert.equal(history.states.length,2);close(layout(history.current).width,baseLayout.width+144);assert.deepEqual([...board.querySelectorAll('svg[data-panel]')].map(node=>Object.fromEntries(['x','y','width','height','viewBox'].map(k=>[k,node.getAttribute(k)]))),preview,'Release must preserve exact preview viewports');
  });
  test('corner pointer defaults to uniform master ratio, Shift allows free aspect without stretching panels',()=>{
    let before=layout(history.current),start=coords('corner');fire(handle('corner'),'pointerdown',start);fire(viewport,'pointermove',{...start,clientX:start.clientX+100,clientY:start.clientY+50});flush();close(board.firstElementChild.viewBox?.baseVal?.width||Number(board.firstElementChild.getAttribute('viewBox').split(' ')[2]),api.planWhole(history.current,before,before.width+80,before.height+40,{proportional:true}).layout.width);fire(viewport,'pointerup',{...start,clientX:start.clientX+100,clientY:start.clientY+50});close(layout(history.current).width/layout(history.current).height,before.width/before.height);
    before=layout(history.current);start=coords('corner');fire(handle('corner'),'pointerdown',{...start,shiftKey:true});fire(viewport,'pointermove',{...start,clientX:start.clientX+125,clientY:start.clientY,shiftKey:true});flush();const previews=[...board.querySelectorAll('svg[data-panel]')].map(node=>({node,width:Number(node.getAttribute('width')),height:Number(node.getAttribute('height')),viewBox:node.getAttribute('viewBox').split(' ').map(Number)}));for(const p of previews)close(p.width/p.viewBox[2],p.height/p.viewBox[3]);fire(viewport,'pointerup',{...start,clientX:start.clientX+125,clientY:start.clientY,shiftKey:true});close(layout(history.current).width,before.width+100);close(layout(history.current).height,before.height);
  });
  test('pointer cancellation and Escape restore root and panel geometry without committing',()=>{
    for(const reason of ['escape','cancel','lost','blur','second']){const current=history.current,root=board.firstElementChild,snapshot=root.getAttribute('viewBox')+'|'+root.style.width+'|'+root.style.height,start=coords('bottom'),before=commits;fire(handle('bottom'),'pointerdown',start);fire(viewport,'pointermove',{...start,clientY:start.clientY+150});flush();if(reason==='escape')fire(dom.window,'keydown',{key:'Escape'});else if(reason==='blur')fire(dom.window,'blur');else if(reason==='second')fire(viewport,'pointerdown',{pointerId:2});else fire(viewport,reason==='cancel'?'pointercancel':'lostpointercapture');assert.equal(history.current,current);assert.equal(commits,before);const restored=board.firstElementChild;assert.equal(restored.getAttribute('viewBox')+'|'+restored.style.width+'|'+restored.style.height,snapshot);}
  });
  test('outer keyboard supports one/ten-point changes, focus restoration, and disabled state',()=>{
    let l=layout(history.current);fire(handle('right'),'keydown',{key:'ArrowRight'});close(layout(history.current).width,l.width+1);assert.equal(d.activeElement,handle('right'));l=layout(history.current);fire(handle('bottom'),'keydown',{key:'ArrowUp',shiftKey:true});close(layout(history.current).height,l.height-10);l=layout(history.current);fire(handle('corner'),'keydown',{key:'ArrowRight',shiftKey:true});close(layout(history.current).width,l.width+10);close(layout(history.current).width/layout(history.current).height,l.width/l.height);const before=commits;enabled=false;fire(handle('right'),'keydown',{key:'ArrowRight'});fire(handle('right'),'pointerdown',coords('right'));assert.equal(commits,before);enabled=true;
  });
  test('one-cell masters expose outer grips and guide visibility never enters saved state',()=>{
    const single={...clone(initial),order:['a'],columns:1,panels:{a:clone(initial.panels.a)},grid:{rows:1,manualTracks:true,widths:[200],heights:[180],places:{a:{row:0,col:0,rs:1,cs:1}}}};history.commit(single);render();assert.equal(board.querySelectorAll('[data-grid-resize="outer"]').length,5);assert.equal(board.querySelectorAll('[data-grid-resize="widths"],[data-grid-resize="heights"]').length,0);const before=JSON.stringify(history.current),check=d.querySelector('#controls input[type=checkbox]');check.checked=false;fire(check,'change');assert.equal(board.querySelectorAll('[data-grid-resize]').length,0);assert.equal(JSON.stringify(history.current),before);check.checked=true;fire(check,'change');assert.equal(board.querySelectorAll('[data-grid-resize="outer"]').length,5);ui.destroy();assert.equal(board.querySelector('[data-grid-resize-guides]'),null);assert.equal(JSON.stringify(project),assets);
  });
  dom.window.close();
}
console.log(`PASS ${checks} outer grid resizing checks`);

