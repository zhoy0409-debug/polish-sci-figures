'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(root),'utf8');
const {overlayLineEndpoints:ends,overlayLineGeometry:line,resizeOverlayGeometry:resize,orientOverlayLine:orient,validateState,arrange,nudgeSelectionState,removeSelectedItems}=require(root);
const space={width:600,height:300},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const base={id:'annotation-123',type:'line',x:.2,y:.3,w:.4,h:.3,font:'Arial',size:10,stroke:1,color:'#253247',opacity:1,fill:false,text:'',locked:false,direction:'free'};
// Both ends are usable in all quadrants, including crossing the fixed endpoint.
for(const reverseY of [false,true])for(const endpoint of [0,1])for(const delta of [[24,17],[-270,-60],[270,80]]){
  const old={...base,reverseY},anchor=ends(old,space)[1-endpoint],result=resize(old,endpoint,...delta,space),newEnds=ends(result,space);
  assert.ok(newEnds.some(p=>Math.hypot(p.x-anchor.x,p.y-anchor.y)<1e-8),'opposite endpoint stays anchored');
  assert.ok(result.x>=0&&result.y>=0&&result.x+result.w<=1+1e-10&&result.y+result.h<=1+1e-10,'line stays on the page');
}
for(const direction of ['horizontal','vertical'])for(const endpoint of [0,1]){
  const old=orient(base,direction,space),result=resize(old,endpoint,36,17,space);assert.equal(direction==='horizontal'?result.h:result.w,0);
  const anchor=ends(old,space)[1-endpoint];assert.ok(ends(result,space).some(p=>Math.hypot(p.x-anchor.x,p.y-anchor.y)<1e-8));
}
let a=line({x:100,y:100},{x:350,y:104},space);assert.equal(a.h,0,'near-horizontal drag snaps without modifier');
a=line({x:100,y:100},{x:102,y:200},space);assert.equal(a.w,0,'near-vertical drag snaps without modifier');
a=line({x:100,y:100},{x:250,y:200},space,'free',true);near(a.w*space.width,a.h*space.height);
a=line({x:100,y:100},{x:800,y:900},space,'free',true);near(a.w*space.width,a.h*space.height);assert.ok(a.y+a.h<=1,'boundary clipping preserves diagonal angle');
for(const direction of ['horizontal','vertical']){const result=orient(base,direction,space);near(result.x+result.w/2,base.x+base.w/2);near(result.y+result.h/2,base.y+base.h/2);assert.equal(result.direction,direction);}
const bracket={...base,type:'bracket',h:5/space.height};a=resize(bracket,0,36,90,space);near(a.h,bracket.h);near(a.y,bracket.y);near(a.x+a.w,bracket.x+bracket.w);
// New geometry round-trips through the existing project validator and all
// inserted objects retain shared keyboard movement/deletion behavior.
const project={panels:[{id:'p',variants:[{}]}]},state=arrange({order:['p'],columns:1,gap:0,panels:{p:{variant:0,edits:{}}},overlays:[bracket]},1,1);
validateState(JSON.parse(JSON.stringify(state)),project);
const geometry={...space,positions:[],cells:[]},moved=nudgeSelectionState(state,[{kind:'overlay',id:bracket.id}],1,-1,geometry).next;
near(moved.overlays[0].x-state.overlays[0].x,1/space.width);near(moved.overlays[0].y-state.overlays[0].y,-1/space.height);
assert.equal(removeSelectedItems(state,{annotations:[bracket.id]}).next.overlays.length,0);
// Export contains the actual vector bracket, without hit targets or handles.
function node(name){return {localName:name,attrs:{},dataset:{},children:[],style:{},setAttribute(k,v){this.attrs[k]=String(v);},append(n){this.children.push(n);}};}
const context={NS:'http://www.w3.org/2000/svg',document:{createElementNS:(_,name)=>node(name)},selectedAnnotations:[bracket.id]};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  function overlayNode('),source.indexOf('  function refreshOverlaySelection(')),context);
const exported=context.overlayNode(bracket,space,false);assert.equal(exported.children.length,1);assert.equal(exported.children[0].localName,'path');assert.equal(exported.children[0].attrs.d,'M 120 95 V 90 H 360 V 95');
console.log('PASS line controls: anchored endpoints, crossing, straight tools, physical-angle snaps, page boundaries, one-click orientation, bracket vector export, save validation, keyboard nudge and deletion.');
