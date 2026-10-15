/* Physical gesture deltas must survive real host recomposition and reopening,
 * including manual fitting and each editable released-lock representation. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const fixtureFile=path.resolve('scripts/test_studio_layout_lock_integration.cjs'),fixture=fs.readFileSync(fixtureFile,'utf8'),factory={require:createRequire(fixtureFile),console};
vm.createContext(factory);vm.runInContext(fixture.slice(0,fixture.indexOf('const test=(name,fn)=>'))+'\nglobalThis.fixture=harness;',factory);
const base=path.resolve('skills/polish-sci-figures/assets/figure-studio'),source=fs.readFileSync(base+'/studio.js','utf8'),geo=require(base+'/image-insets.js'),grid=require(base+'/grid-resize-ui.js'),studio=require(base+'/studio.js'),clone=value=>JSON.parse(JSON.stringify(value));
let checks=0;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`),pointClose=(a,b)=>{close(a.x,b.x);close(a.y,b.y);};
function harness(){const h=factory.fixture(),ctx=h.ctx;vm.runInContext(source.slice(source.indexOf('function panelContentDelta('),source.indexOf('function gridFor(')),ctx);return h;}
function root(h){return h.doc.querySelector('#artboard > svg');}
function at(h,key){const svg=root(h),el=svg.querySelector(`[data-key="${key}"]`);return geo.point(geo.relativeMatrix(el,svg),{x:7,y:9});}
function labelAt(h){const svg=root(h),el=svg.querySelector('[data-panel-label="a"]');return geo.point(geo.relativeMatrix(el,svg),{x:parseFloat(el.getAttribute('x')),y:parseFloat(el.getAttribute('y'))});}
function items(h,keys=['e1'],label=true){const svg=root(h),p=h.ctx.state().panels.a,out=keys.map(key=>{const el=svg.querySelector(`[data-key="${key}"]`);return {kind:'element',id:'a',vi:0,key,el,motionBasis:h.ctx.panelMotionBasis(p,0,el,h.asset.variants[0],svg)};});if(label)out.push({kind:'label',id:'a'});return out;}
function move(h,chosen,dx=15,dy=10){const result=h.ctx.nudgeSelectionState(h.ctx.state(),chosen,dx,dy,h.ctx.layout());close(result.dx,dx);close(result.dy,dy);assert.equal(h.ctx.commit(result.next,'physical move'),true);}
function reopen(h){const saved=clone(h.ctx.state());h.ctx.history=new studio.History(saved);h.ctx.render();}
function resize(h,w=650,height=420){assert.equal(h.ctx.commit(grid.planWhole(h.ctx.state(),h.ctx.layout(),w,height).state,'resize'),true);}
function release(h,mode){if(mode==='element')h.ctx.info={canLock:true,canUnlock:true,groups:[{id:'a',vi:0,keys:['e1']}],panels:[],overlays:[]};else if(mode==='label'){h.ctx.info={canLock:true,canUnlock:true,groups:[],panels:[],overlays:[]};h.ctx.selectedLabelIds=()=>['a'];}h.ctx.setLock(true);resize(h);h.ctx.setLock(false);resize(h,800,500);}
function test(name,fn){const h=harness();try{fn(h);checks++;console.log('PASS',name);}finally{h.dom.window.close();}}
function nestedTextWithMigration(h){
 const ctx=h.ctx,original=ctx.editedSvg;ctx.editedSvg=(id,vi,s)=>{const svg=original(id,vi,s),text=svg.querySelector('[data-key="e2"]'),group=h.doc.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('transform','translate(20 20) scale(1000)');text.removeAttribute('x');text.removeAttribute('y');text.setAttribute('font-size','.003');text.setAttribute('font-family','Arial');text.replaceChildren();for(const [key,y,value]of [['e20','0','Sample'],['e21','.020','Second line']]){const span=h.doc.createElementNS('http://www.w3.org/2000/svg','tspan');span.dataset.key=key;span.setAttribute('x','0');span.setAttribute('y',y);span.textContent=value;text.append(span);}text.replaceWith(group);group.append(text);return svg;};
 const render=ctx.render;ctx.render=()=>{ctx.migrateLegacyLayoutLocks();render();};ctx.render();
}
function expectMove(h,keys=['e1'],label=true){const before=Object.fromEntries(keys.map(key=>[key,at(h,key)])),oldLabel=labelAt(h);move(h,items(h,keys,label));const check=()=>{for(const key of keys)pointClose(at(h,key),{x:before[key].x+15,y:before[key].y+10});pointClose(labelAt(h),label?{x:oldLabel.x+15,y:oldLabel.y+10}:oldLabel);};check();reopen(h);check();}

test('ordinary manually fitted native artwork and label move by the same requested physical delta',h=>expectMove(h));
test('whole-panel release follows later grid changes then preserves exact element and label movement',h=>{release(h,'panel');expectMove(h);});
test('whole-panel release honours later rotated and stretched content transforms without distorting movement',h=>{release(h,'panel');const next=clone(h.ctx.state());next.panels.a.contentTransforms={0:[1.2,.15,-.2,.9,4,6]};assert.equal(h.ctx.commit(next,'content transform'),true);expectMove(h);});
test('independently released element and ordinary sibling share a physical movement with the label',h=>{release(h,'element');expectMove(h,['e1','e2']);assert.equal(root(h).querySelectorAll('[data-studio-error-owner="e1"]').length,1);});
test('independently released element honours a later rotated content transform and saved offsets',h=>{release(h,'element');const next=clone(h.ctx.state());next.panels.a.contentTransforms={0:[.8,.2,-.1,1.1,4,6]};assert.equal(h.ctx.commit(next,'content transform'),true);expectMove(h,['e1','e2']);});
test('independently released label remains editable together with ordinary artwork after grid changes',h=>{release(h,'label');expectMove(h);});
test('released whole-content movement uses the viewport basis and leaves its panel label fixed',h=>{release(h,'panel');const svg=root(h),p=h.ctx.state().panels.a,content=svg.querySelector('[data-panel-content]'),before=at(h,'e1'),oldLabel=labelAt(h),item={kind:'content',id:'a',vi:0,el:content,motionBasis:h.ctx.panelMotionBasis(p,0,content,h.asset.variants[0],svg,true)};move(h,[item]);const expected={x:before.x+15,y:before.y+10};pointClose(at(h,'e1'),expected);pointClose(labelAt(h),oldLabel);reopen(h);pointClose(at(h,'e1'),expected);pointClose(labelAt(h),oldLabel);});
for(const mode of ['panel','label'])test(`released ${mode==='panel'?'panel-owned':'independent'} label preview and committed composition match under screen zoom`,h=>{
 release(h,mode);const ctx=h.ctx,svg=root(h),l=ctx.layout(),zoom=1.7;
 class Matrix{constructor(values){Object.assign(this,Object.fromEntries(['a','b','c','d','e','f'].map((k,i)=>[k,values[i]])));}inverse(){const m=geo.inverse(this);return new Matrix(['a','b','c','d','e','f'].map(k=>m[k]));}transformPoint(p){return geo.point(this,p);}}
 h.dom.window.SVGElement.prototype.getScreenCTM=function(){const local=this===svg?{a:1,b:0,c:0,d:1,e:0,f:0}:geo.relativeMatrix(this,svg);return geo.multiply({a:zoom,b:0,c:0,d:zoom,e:20,f:30},local);};svg.getBoundingClientRect=()=>({left:20,top:30,width:l.width*zoom,height:l.height*zoom});Object.assign(ctx,{svg,l,DOMMatrix:Matrix});
 vm.runInContext(source.slice(source.indexOf('    const captureLabelMotion='),source.indexOf('    const selectedDragItems='))+'\nglobalThis.captureMotion=captureLabelMotion;globalThis.previewMotion=previewLabelMotion;',ctx);
 const node=svg.querySelector('[data-panel-label="a"]'),capture=ctx.captureMotion(node),before=labelAt(h),result=ctx.nudgeSelectionState(ctx.state(),[{kind:'label',id:'a'}],15,10,l),pos=l.positions[0],nextLabel=result.next.panels.a.label;
 assert.ok(capture?.screen);ctx.previewMotion(node,nextLabel,pos,{dx:15,dy:10},capture);const preview=labelAt(h);pointClose(preview,{x:before.x+15,y:before.y+10});ctx.previewMotion(node,nextLabel,pos,{dx:0,dy:0},capture);pointClose(labelAt(h),before);ctx.previewMotion(node,nextLabel,pos,{dx:15,dy:10},capture);assert.equal(ctx.commit(result.next,'label drag'),true);pointClose(labelAt(h),preview);reopen(h);pointClose(labelAt(h),preview);
});
test('actual render migration never recaptures descendants of a locked PDF-style text snapshot',h=>{
 nestedTextWithMigration(h);const ctx=h.ctx;ctx.info={canLock:true,canUnlock:true,groups:[{id:'a',vi:0,keys:['e2']}],panels:[],overlays:[]};ctx.selectedLabelIds=()=>['a'];ctx.setLock(true);
 const check=()=>{const p=ctx.state().panels.a;assert.equal(p.layoutLock.elements[0].length,1,'parent snapshot covers its descendants without another migration');assert.deepEqual([...p.layoutLock.elements[0][0].keys],['e2']);for(const key of ['e2','e20','e21'])assert.equal(root(h).querySelectorAll(`[data-key="${key}"]`).length,1,'each PDF text identity occurs exactly once');};
 check();assert.deepEqual([...ctx.state().panels.a.lockedElements[0]],['e2','e20','e21']);resize(h);check();ctx.setLock(false);assert.deepEqual([...ctx.state().panels.a.lockedElements[0]],[]);resize(h,800,500);check();expectMove(h,['e2']);check();const prior=at(h,'e2');move(h,items(h,['e2'],false),3,2);const position=at(h,'e2');ctx.history.undo();ctx.render();check();pointClose(at(h,'e2'),prior);ctx.history.redo();ctx.render();check();pointClose(at(h,'e2'),position);
});
test('v13 parent and descendant lock flags migrate once and remain fixed through repeat rendering and reopen',h=>{
 nestedTextWithMigration(h);const ctx=h.ctx,next=clone(ctx.state());next.panels.a.lockedElements={0:['e2','e20','e21']};ctx.history.states[ctx.history.index]=next;ctx.render();const before=at(h,'e2'),record=ctx.state().panels.a.layoutLock.elements[0][0].svg;
 for(let i=0;i<3;i++){const updated=clone(ctx.state());ctx.history.states[ctx.history.index]=updated;ctx.render();const records=ctx.state().panels.a.layoutLock.elements[0];assert.equal(records.length,1);assert.equal(records[0].svg,record);for(const key of ['e2','e20','e21'])assert.equal(root(h).querySelectorAll(`[data-key="${key}"]`).length,1);pointClose(at(h,'e2'),before);}resize(h);pointClose(at(h,'e2'),before);reopen(h);pointClose(at(h,'e2'),before);assert.equal(ctx.state().panels.a.layoutLock.elements[0].length,1);
});
console.log(`PASS ${checks} real host physical movement and released-lock checks`);
