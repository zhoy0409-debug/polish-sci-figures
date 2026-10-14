/* Production component handlers against an SVG DOM. Browser layout is checked
 * separately; this suite exercises persistence and the exact input handlers. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const base='../skills/polish-sci-figures/assets/figure-studio/';
const source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8');
const studio=require(base+'studio.js'),axis=require(base+'axis-editing.js');
let passed=0;const test=(name,run)=>{run();passed++;console.log('PASS '+name);};
const copy=value=>JSON.parse(JSON.stringify(value));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('variant changes discard obsolete numeric bounds without discarding appearance',()=>{
  const original={variant:0,edits:{0:{e1:{'axis-extension':JSON.stringify({version:1,axis:'y',scale:'linear',min:0,max:20}),stroke:'#334455','stroke-width':'2'}}}};
  const next=studio.transferVariantEdits(original,0,1,new Map([['e1','e8']]),{width:200,viewBox:[0,0,400,300]},{width:400,viewBox:[0,0,400,300]});
  assert.equal(next.edits[1].e8['axis-extension'],undefined);assert.equal(next.edits[1].e8.stroke,'#334455');assert.equal(next.edits[1].e8['stroke-width'],'1');assert.ok(original.edits[0].e1['axis-extension']);
});
if(!process.argv.includes('--dom')){console.log(`${passed} component controls state test passed; use --dom for production handlers`);process.exit(0);}
const {JSDOM}=require('jsdom'),html=fs.readFileSync(require.resolve(base+'studio.html'),'utf8');
const Style=require(base+'component-style.js'),Rich=require(base+'rich-text.js');
function chunk(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`production block ${start}`);return source.slice(a,b);}
const stored=chunk('    // Prepare all positioned text before styles change inherited font bases.','    // Work on complete category groups');
const helpers=[chunk('function validValue(','function heatmapCellInfo('),chunk('  function textPointSize(','  function visibleTextOutputSizes('),chunk('  function paint(','  function chromatic('),chunk('  function setEdit(','  let statisticalLineGesture='),chunk('  function applyAxisGeneratedEdits(','  function applyElementOffsets('),chunk('  let componentGesture=null','  // Rich-text adapters'),`function applyStored(svg,id,vi,s){const raw=false;${stored}return svg;}`].join('\n');
function rawSvg(){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><path id="tick" d="M 0 0 L -3 0"/></defs><g id="axes_1"><g id="patch_3"><path data-key="e1" d="M 40 160 L 40 60" stroke="#202020" stroke-width="1" fill="none"/></g><g id="matplotlib.axis_2">${[0,5,10].map((n,i)=>`<g id="ytick_${i+1}"><use data-key="e${10+i*10}" href="#tick" x="40" y="${160-i*50}" stroke="#202020" stroke-width="1"/><text data-key="e${11+i*10}" x="33" y="${163-i*50}" font-size="8" font-family="Arial" fill="#202020">${n}</text></g>`).join('')}<text data-key="e40" x="12" y="110" font-size="9" font-family="Arial" fill="#202020" transform="rotate(-90 12 110)">Response</text></g><g id="legend_1"><text data-key="e50" x="150" y="50" font-size="10" font-family="Arial" fill="#202020">Treatment <tspan data-key="e51" font-size="50%">A</tspan><tspan data-key="e52" font-size="5">2</tspan></text></g><path data-key="e60" d="M 50 150 L 130 80" stroke="#336699" fill="none"/><text data-key="e61" x="110" y="20" font-size="8">P = 0.032</text></g></svg>`;}
function harness({units=[1],scale=1,extend=false,locked={},manual=null}={}){
  const dom=new JSDOM(html),document=dom.window.document,$=id=>document.getElementById(id);
  const assets=units.map((unit,i)=>({id:'p'+i,name:'Plot '+i,variants:[{width:400/unit,height:300/unit,viewBox:[0,0,400,300],svg:rawSvg()}]}));
  const project={id:'component-control-test',panels:assets},initial={order:assets.map(p=>p.id),columns:units.length,gap:12,panels:Object.fromEntries(assets.map(p=>[p.id,{variant:0,edits:{},...locked[p.id]}]))};
  if(manual)initial.grid={rows:1,widths:assets.map(p=>p.variants[0].width*manual),heights:[300/units[0]*manual],manualTracks:true,places:Object.fromEntries(assets.map((p,i)=>[p.id,{row:0,col:i,rs:1,cs:1}]))};
  if(extend)initial.panels.p0.edits={0:{e1:{'axis-extension':JSON.stringify({version:1,axis:'y',scale:'linear',min:0,max:20})}}};
  let history=new studio.History(initial),calls=0,commits=0,refreshes=0,frameId=0;const frames=new Map();
  const ctx={document,$,project,copy,original:false,selectedPanel:'p0',StudioRichText:Rich,StudioAxisEditing:axis,StudioImageInsets:require(base+'image-insets.js'),StudioSelectionTransform:require(base+'selection-transform.js'),
    StudioComponentStyle:{targets(...args){calls++;return Style.targets(...args);}},preparePositionedTextEdit:studio.preparePositionedTextEdit,NS:'http://www.w3.org/2000/svg',
    state:()=>history.current,panel:id=>assets.find(p=>p.id===id),editsFor:(id,vi,s=history.current)=>s.panels[id].edits[vi]||{},currentOutput:()=>({scale}),T:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,n)=>args[n]),
    layout:()=>({positions:assets.map(p=>({id:p.id,width:p.variants[0].width*(manual||1),height:p.variants[0].height*(manual||1)}))}),
    zoomView:{refreshSelection(){refreshes++;}},requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    commit(next){studio.validateState(next,project);if(history.commit(next)){commits++;render();ctx.renderComponentStyle();}return true;}
  };
  vm.createContext(ctx);vm.runInContext(helpers,ctx);
  ctx.editableSource=(id,vi,s=history.current)=>{const node=new dom.window.DOMParser().parseFromString(assets.find(p=>p.id===id).variants[vi].svg,'image/svg+xml').documentElement;node.setAttribute('data-editable-source','true');return ctx.applyStored(node,id,vi,s);};
  function render(){const nodes=history.current.order.map(id=>{const node=ctx.editableSource(id,0),v=ctx.panel(id).variants[0];axis.apply(node,ctx.editsFor(id,0),v.viewBox[2]/v.width);ctx.applyAxisGeneratedEdits(node,id,0,history.current);node.removeAttribute('data-editable-source');node.setAttribute('data-panel',id);node.setAttribute('width',v.width*(manual||1));node.setAttribute('height',v.height*(manual||1));return node;});$('artboard').replaceChildren(...nodes);}
  function flush(){while(frames.size){const list=[...frames.values()];frames.clear();list.forEach(fn=>fn());}}
  function field(id,value,event='input'){const el=$(id);if(value!==null)el.value=String(value);el.dispatchEvent(new dom.window.Event(event,{bubbles:true}));}
  function role(value,scope='panel'){$('componentRole').value=value;$('componentScope').value=scope;ctx.renderComponentStyle();}
  function key(id,name){$(id).dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true}));}
  render();ctx.bindComponentStyle();role('ticks');
  return {ctx,$,dom,project,initial,current:()=>history.current,node:(key,id='p0')=>$('artboard').querySelector(`[data-panel="${id}"] [data-key="${key}"]`),root:id=>$('artboard').querySelector(`[data-panel="${id||'p0'}"]`),role,field,key,flush,render,calls:()=>calls,commits:()=>commits,refreshes:()=>refreshes,
    undo(){history.undo();render();ctx.renderComponentStyle();},redo(){history.redo();render();ctx.renderComponentStyle();},reopen(){const saved=copy({state:history.current,history:history.toJSON()});history=studio.History.restore(saved.history,project,saved.state);render();ctx.renderComponentStyle();},close(){dom.window.close();}};
}
test('typing previews all recognized tick labels and blur commits one undo without changing values',()=>{
  const h=harness({scale:2});try{const data=h.node('e60').outerHTML,p=h.node('e61').outerHTML;assert.match(h.$('componentStyleStatus').textContent,/3/);assert.equal(h.$('componentFontSize').value,'16');
    h.field('componentFontSize',18);h.field('componentFontSize',20);h.field('componentFontSize',24);assert.equal(h.commits(),0);h.flush();
    for(const key of ['e11','e21','e31'])near(h.ctx.textOutputSize(h.node(key),'p0',0),24);assert.equal(h.current().panels.p0.edits[0],undefined);assert.equal(h.refreshes(),1,'one frame coalesces repeated slider/number events');
    h.field('componentFontSize',null,'blur');h.field('componentFontSize',null,'change');assert.equal(h.commits(),1,'change after blur does not create a second undo');assert.deepEqual(['e11','e21','e31'].map(k=>h.node(k).textContent),['0','5','10']);assert.equal(h.node('e60').outerHTML,data);assert.equal(h.node('e61').outerHTML,p);
    h.undo();assert.equal(h.$('componentFontSize').value,'16');h.redo();assert.equal(h.$('componentFontSize').value,'24');h.reopen();assert.equal(h.$('componentFontSize').value,'24');
  }finally{h.close();}
});
test('Escape restores exact live attributes and the displayed value with no history entry',()=>{
  const h=harness();try{const before=h.root().outerHTML;h.field('componentFontSize',18);h.flush();assert.notEqual(h.root().outerHTML,before);h.key('componentFontSize','Escape');assert.equal(h.root().outerHTML,before);assert.equal(h.$('componentFontSize').value,'8');h.field('componentFontSize',null,'blur');assert.equal(h.commits(),0);
    for(const value of ['',0,-1,1001]){h.field('componentFontSize',value);h.flush();h.field('componentFontSize',null,'blur');}assert.equal(h.commits(),0);assert.equal(h.root().outerHTML,before);
  }finally{h.close();}
});
test('whole-figure scope respects panel and descendant locks and converts physical pt per panel',()=>{
  const h=harness({units:[1,2,1],scale:2,locked:{p1:{lockedElements:{0:['e21']}},p2:{locked:true}}});try{h.role('ticks','all');assert.match(h.$('componentStyleStatus').textContent,/5/);h.field('componentFontSize',12);h.flush();h.field('componentFontSize',null,'blur');
    for(const id of ['p0','p1'])for(const key of ['e11','e31']){near(h.ctx.textOutputSize(h.node(key,id),id,0),12);near(+h.current().panels[id].edits[0][key]['font-size'],id==='p0'?6:12);}
    assert.equal(h.current().panels.p1.edits[0].e21,undefined);assert.deepEqual(h.current().panels.p2.edits,{});assert.equal(h.node('e21','p1').getAttribute('font-size'),'8');assert.equal(h.commits(),1);
    h.role('legend','all');const next=copy(h.current());next.panels.p0.lockedElements={0:['e51']};h.ctx.commit(next);assert.equal(h.ctx.componentStyleTargets().length,1,'a locked child prevents parent text changes');
  }finally{h.close();}
});
test('axis stroke preview applies to spines and tick strokes, not observations or grid/data paths',()=>{
  const h=harness({units:[2],scale:2});try{h.role('axes');assert.equal(h.ctx.componentStyleTargets().length,4);const data=h.node('e60').outerHTML;h.field('componentStroke',3);h.flush();for(const key of ['e1','e10','e20','e30'])assert.equal(h.node(key).style.strokeWidth,'3px');h.key('componentStroke','Enter');assert.equal(h.commits(),1);assert.equal(h.node('e60').outerHTML,data);assert.equal(h.$('componentStroke').value,'3');h.undo();assert.equal(h.$('componentStroke').value,'1');
  }finally{h.close();}
});
test('manual contain scale and export scale preserve final physical stroke widths through preview, save and undo',()=>{
  for(const manual of [.5,2]){
    const h=harness({units:[2],scale:1.5,manual});try{h.role('axes');const initial=h.$('componentStroke').value,data=h.node('e60').outerHTML,physical=key=>parseFloat(h.node(key).style.strokeWidth||h.node(key).getAttribute('stroke-width'))*manual/2*1.5;
      near(Number(initial),manual/2*1.5);h.field('componentStroke',2);h.flush();for(const key of ['e1','e10','e20','e30'])near(physical(key),2);
      h.field('componentStroke',null,'blur');assert.equal(h.commits(),1);near(+h.current().panels.p0.edits[0].e1['stroke-width'],2*2/manual/1.5);assert.equal(h.$('componentStroke').value,'2');h.reopen();near(physical('e1'),2);assert.equal(h.$('componentStroke').value,'2');assert.equal(h.node('e60').outerHTML,data);
      h.undo();assert.equal(h.$('componentStroke').value,initial);h.redo();near(physical('e1'),2);
      const before=h.root().outerHTML;h.field('componentStroke',3);h.flush();h.key('componentStroke','Escape');assert.equal(h.root().outerHTML,before);assert.equal(h.$('componentStroke').value,'2');
    }finally{h.close();}
  }
});
test('rich legend sizes preserve relative runs and all number/P text remains untouched',()=>{
  const h=harness();try{h.role('legend');const numeric=['e11','e21','e31','e61'].map(k=>h.node(k).outerHTML);h.field('componentFontSize',20);h.flush();assert.equal(h.node('e51').getAttribute('font-size'),'50%');assert.equal(h.node('e51').style.fontSize,'');assert.equal(h.node('e52').style.fontSize,'10px');h.field('componentFontSize',null,'blur');assert.equal(h.current().panels.p0.edits[0].e51,undefined);assert.equal(h.current().panels.p0.edits[0].e52['font-size'],'10');h.reopen();near(h.ctx.textPointSize(h.node('e51')),10);near(h.ctx.textPointSize(h.node('e52')),10);assert.deepEqual(['e11','e21','e31','e61'].map(k=>h.node(k).outerHTML),numeric);
  }finally{h.close();}
});
test('generated ticks join bulk formatting and retain the same saved edits after reopen and further extension',()=>{
  const h=harness({extend:true});try{const generated=[...h.root().querySelectorAll('[data-axis-generated] text')],keys=generated.map(n=>n.dataset.key);assert.deepEqual(generated.map(n=>n.textContent),['15','20']);assert.equal(h.ctx.componentStyleTargets().length,5);assert.match(h.$('componentStyleStatus').textContent,/5/);
    h.field('componentFontSize',12);h.flush();for(const key of keys)assert.equal(h.node(key).style.fontSize,'12px');h.field('componentFontSize',null,'blur');h.field('componentColor','#cc3344');h.flush();h.field('componentColor',null,'blur');for(const key of keys){assert.equal(h.current().panels.p0.edits[0][key].fill,'#cc3344');assert.equal(h.current().panels.p0.edits[0][key]['font-size'],'12');}h.reopen();for(const key of keys){assert.equal(h.node(key).style.fontSize,'12px');assert.equal(h.node(key).style.fill,'#cc3344');}
    const next=copy(h.current());next.panels.p0.edits[0].e1['axis-extension']=JSON.stringify({version:1,axis:'y',scale:'linear',min:0,max:25});h.ctx.commit(next);assert.equal(h.ctx.componentStyleTargets().length,6);for(const key of keys){assert.equal(h.node(key).style.fontSize,'12px');assert.equal(h.node(key).style.fill,'#cc3344');}assert.deepEqual([...h.root().querySelectorAll('[data-axis-generated] text')].map(n=>n.textContent),['15','20','25']);
  }finally{h.close();}
});
test('selection-only inspector refresh reuses classification; state, scope and live replacements invalidate it',()=>{
  const h=harness({units:[1,1]});try{const initial=h.calls();for(let i=0;i<5;i++){h.ctx.selected=['e60','e61'];h.ctx.renderComponentStyle();}assert.equal(h.calls(),initial);h.role('axis');assert.equal(h.calls(),initial+1);h.role('axis','all');assert.equal(h.calls(),initial+3);h.render();h.ctx.renderComponentStyle();assert.equal(h.calls(),initial+5);const next=copy(h.current());next.panels.p1.locked=true;h.ctx.commit(next);assert.equal(h.calls(),initial+6);h.ctx.original=true;h.ctx.renderComponentStyle();assert.equal(h.$('componentFontSize').disabled,true);
  }finally{h.close();}
});
test('an in-flight preview cannot commit after project or history state changes',()=>{
  const h=harness();try{h.field('componentFontSize',24);h.ctx.project={...h.project,id:'different-project'};h.flush();h.field('componentFontSize',null,'blur');assert.equal(h.commits(),0);assert.equal(h.node('e11').style.fontSize,'');
  }finally{h.close();}
});
console.log(`${passed} component control regressions passed`);
