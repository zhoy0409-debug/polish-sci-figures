const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Compact=require('../skills/polish-sci-figures/assets/figure-studio/compact-whitespace.js');
const {validateState,History}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
function fixture(gapX=12,gapY=12){
  const cells=[],positions=[],places={},ink={};
  for(let row=0;row<2;row++)for(let col=0;col<2;col++){
    const id='panel-'+(row*2+col),box={x:col*(300+gapX),y:row*(240+gapY),width:300,height:240};
    cells.push({row,col,...box});positions.push({id,...box,statisticsTop:12,conditionHeight:16});places[id]={row,col,rs:1,cs:1};
    ink[id]={x:box.x+40,y:box.y+30,width:220,height:170};
  }
  return {layout:{width:600+gapX,height:480+gapY,cells,positions},places,ink};
}
for(const [gapX,gapY]of [[0,0],[12,12],[0,30],[40,0]]){
  const data=fixture(gapX,gapY),before=JSON.stringify(data),result=Compact.plan(data);assert.equal(result.available,true);
  assert.equal(JSON.stringify(data),before,'Measurement must not rewrite source geometry');
  const l=result.layout;assert.equal(l.width,data.layout.width-144);assert.equal(l.height,data.layout.height-124);
  assert.equal(l.positions[1].x-l.positions[0].x-l.positions[0].width,gapX);assert.equal(l.positions[2].y-l.positions[0].y-l.positions[0].height,gapY);
  for(const pos of l.positions){const old=data.layout.positions.find(p=>p.id===pos.id);assert.equal(pos.renderBox.width,old.width);assert.equal(pos.renderBox.height,old.height);assert.equal(pos.renderBox.statisticsTop,12);assert.equal(pos.renderBox.conditionHeight,16);const box=data.ink[pos.id],moved={...box,x:box.x+pos.renderBox.x-old.x,y:box.y+pos.renderBox.y-old.y};assert.equal(Compact.contains(pos,moved),true);}
  assert.equal(l.positions[0].renderBox.x,l.positions[2].renderBox.x,'Same-column plot frames retain alignment');
  assert.equal(l.positions[0].renderBox.y,l.positions[1].renderBox.y,'Same-row plot frames retain alignment');
}
{
  const data=fixture(),result=Compact.plan({...data,overlays:[{id:'annotation-1',box:{x:322,y:280,width:50,height:150}}]});assert.equal(result.available,true);
  assert.equal(result.layout.compact.overlayOwners['annotation-1'],'panel-3');
  const g=Compact.overlayGeometry(result.layout,'annotation-1');assert.equal(g.width,data.layout.width);assert.equal(g.height,data.layout.height);
  const pos=result.layout.positions[3];assert.equal(g.dx,pos.renderBox.x-data.layout.positions[3].x);assert.equal(g.dy,pos.renderBox.y-data.layout.positions[3].y);
  assert.equal(pos.trim.left,6,'Overlay protects unused space it occupies');
}
{
  const data=fixture();data.places['panel-0'].cs=2;assert.equal(Compact.plan(data).reason,'spanning-panels');
  const across=Compact.plan({...fixture(),overlays:[{id:'annotation-1',box:{x:280,y:40,width:80,height:20}}]});assert.equal(across.reason,'cross-panel-overlay');
  const outside=fixture();outside.ink['panel-0'].x=-12;assert.equal(Compact.plan(outside).reason,'outside-panel-content');
  const missing=fixture();delete missing.ink['panel-1'];assert.equal(Compact.plan(missing).reason,'unmeasurable');
}
{
  const old=fixture(),changed=structuredClone(old);changed.ink['panel-0']={x:12,y:10,width:270,height:215};
  const a=Compact.plan(old).layout,b=Compact.plan(changed).layout;assert.ok(b.width>a.width);assert.ok(b.height>a.height,'Longer text/content expands safe bounds');
  assert.equal(b.positions[0].renderBox.x,b.positions[2].renderBox.x);assert.equal(b.positions[0].renderBox.y,b.positions[1].renderBox.y);
}
{
  const initial={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}},project={panels:[{id:'panel-0',variants:[{}]}]},history=new History(initial),next=structuredClone(initial);next.compactWhitespace=true;
  validateState(next,project);history.commit(next);assert.equal(history.current.compactWhitespace,true);history.undo();assert.equal(history.current.compactWhitespace,undefined);history.redo();assert.equal(history.current.compactWhitespace,true);
  for(const value of ['true',1,null,{}])assert.throws(()=>validateState({...initial,compactWhitespace:value},project));
}
// Execute the production layout tail: disabled mode never invokes DOM measurement.
{
  const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8'),fn=source.slice(source.indexOf('  function layout(s=state(),skipCompact=false)'),source.indexOf('  function plotFrame('));
  const fixtureState={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0}}},context={panel:()=>({variants:[{width:300,height:240}]}),gridFor:()=>({rows:1,places:{'panel-0':{row:0,col:0,rs:1,cs:1}}}),annotationTopHeight:()=>0,annotationFirstTopHeight:()=>0,conditionMatrixHeight:()=>0,StudioCompactWhitespace:Compact,compactLayout:(base)=>({...base,testCompacted:true})};
  vm.createContext(context);vm.runInContext(fn+';this.layout=layout;',context);
  assert.equal(context.layout(fixtureState).testCompacted,undefined);assert.equal(context.layout({...fixtureState,compactWhitespace:true}).testCompacted,true);assert.equal(context.layout({...fixtureState,compactWhitespace:true},true).testCompacted,undefined);
}
console.log('PASS compact whitespace: conservative per-track trim, four gutter combinations, physical geometry, overlays, expanded content, blocked spans, undo, production layout hook');
{
  const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8'),fn=source.slice(source.indexOf('  let compactLayoutCache='),source.indexOf('  function renderCompactWhitespaceControls('));
  const data=fixture(),variants=data.layout.positions.map(()=>({svg:'same SVG'})),state={order:data.layout.positions.map(p=>p.id),columns:2,gap:12,compactWhitespace:true,panels:Object.fromEntries(data.layout.positions.map(p=>[p.id,{variant:0,edits:{}}]))};let calls=0;
  const context={project:{},StudioI18n:{language:'en'},panel:id=>({variants:[variants[+id.slice(6)]]}),gridFor:()=>({places:data.places}),composite:(_a,_b,s)=>({state:s}),StudioCompactWhitespace:{...Compact,measure:svg=>{calls++;const d=fixture(svg.state.gapX??svg.state.gap,svg.state.gapY??svg.state.gap);return {ink:d.ink,overlays:[]};}}};
  vm.createContext(context);vm.runInContext(fn+';this.compactLayout=compactLayout;',context);
  const original=context.compactLayout(data.layout,state);assert.equal(calls,1);
  assert.equal(context.compactLayout(data.layout,state),original);assert.equal(calls,1);
  for(const value of [0,5,10,20,40]){const next={...state,gapX:value,gapY:6};const l=context.compactLayout(fixture(value,6).layout,next);assert.equal(l.compactStatus.available,true);assert.equal(l.positions[1].x-l.positions[0].x-l.positions[0].width,value);}
  assert.equal(calls,1,'Gutter slider frames reuse local content measurements');
  const changed=structuredClone(state);changed.panels['panel-0'].edits={0:{e1:{'font-size':'18'}}};context.compactLayout(data.layout,changed);assert.equal(calls,2,'Typography edits invalidate bounds');
  context.project.layoutRenders={fresh:{sha256:'changed'}};context.compactLayout(data.layout,changed);assert.equal(calls,3,'Reflow invalidates bounds');
  vm.runInContext('compactFontEpoch++;',context);context.compactLayout(data.layout,changed);assert.equal(calls,4,'Loaded fonts invalidate bounds');
  console.log('PASS production compact cache: five live gutter frames without DOM remeasurement; text, reflow and font invalidation');
}
{
  const create=tag=>({tag,attrs:{},children:[],setAttribute(k,v){this.attrs[k]=String(v);},append(...nodes){this.children.push(...nodes);}}),oldDocument=global.document;
  global.document={createElementNS:(_,tag)=>create(tag)};
  try{
    const root=create('svg'),source=create('svg'),position=Compact.plan(fixture()).layout.positions[1],before=JSON.stringify(source);
    const wrapper=Compact.appendPanel(root,source,position),clip=root.children[0].children[0],rect=clip.children[0];
    assert.equal(wrapper.attrs['clip-path'],`url(#${clip.attrs.id})`);assert.equal(clip.attrs.clipPathUnits,'userSpaceOnUse');
    for(const key of ['x','y','width','height'])assert.equal(Number(rect.attrs[key]),position[key]);
    assert.equal(wrapper.children[0],source);assert.equal(JSON.stringify(source),before,'Cell crop does not rewrite artist geometry');
    assert.equal(wrapper.attrs.transform,undefined,'Cell crop adds no scaling or translation');
    const plain=create('svg'),plainRoot=create('svg');assert.equal(Compact.appendPanel(plainRoot,plain,{x:0,y:0,width:30,height:20}),plain);assert.deepEqual(plainRoot.children,[plain]);
    console.log('PASS compact SVG clipping: original page backgrounds cannot paint neighbouring cells; source geometry unchanged');
  }finally{global.document=oldDocument;}
}
