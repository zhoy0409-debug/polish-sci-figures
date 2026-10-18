/* Real SVG DOM + production editor helpers. This is not a browser layout test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/';
const source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8');
const html=fs.readFileSync(require.resolve(base+'studio.html'),'utf8');
const rich=require(base+'rich-text.js'),{History,validateState,preparePositionedTextEdit,selectionAlignmentPlan}=require(base+'studio.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function chunk(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`production block ${start}`);return source.slice(a,b);}
const edits=chunk('    // Prepare all positioned text before styles change inherited font bases.','    // Work on complete category groups');
const helpers=[
  source.match(/^  const DRAW = .*;$/m)[0],
  chunk('  function isVisibleObject(', '  // Editor-only hit areas'),
  chunk('function richTextAPI(){','function imageInsetsAPI(){'),
  chunk('  let labelSelections=[];','  const sizeNames='),
  chunk('  function selectionCommandInfo(){','  function renderSelectionCommands(){'),
  chunk('function validValue(','function heatmapCellInfo('),
  chunk('  function textPointSize(','  async function ensureReflows('),
  chunk('  function setEdit(','  let statisticalLineGesture='),
  chunk('  function targetObjects(','  function paletteHeatmapInfo('),
  chunk('  function quickSelectedObjects(','  function cancelQuickPreview('),
  chunk('  function renderQuickToolbar(','  function setupQuickToolbar('),
  chunk('  function renderSelectionProperties(','  let literatureBrowser='),
  `function applyStoredEdits(svg,id,vi,s){const raw=false;${edits}return svg;}`
].join('\n');
let passed=0;
const close=(actual,expected,message='')=>assert.ok(Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),`${message}: ${actual} != ${expected}`);
function test(name,run){run();passed++;console.log('PASS '+name);}
function harness(body,{width=400,viewWidth=400,scale=1,keys=['e1']}={}){
  const dom=new JSDOM(html),document=dom.window.document,$=id=>document.getElementById(id);
  const raw=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="200pt" viewBox="0 0 ${viewWidth} 200">${body}</svg>`;
  const asset={id:'p0',name:'Imported PDF',provenance:'user-import',variants:[{width,height:200,viewBox:[0,0,viewWidth,200],svg:raw}]};
  const project={id:'pdf-text-test',panels:[asset]},initial={order:['p0'],columns:1,gap:12,panels:{p0:{variant:0,edits:{}}}};
  let current=copy(initial),outputScale=scale;const history=new History(current),messages=[];
  const parse=()=>new dom.window.DOMParser().parseFromString(raw,'image/svg+xml').documentElement;
  const ctx={copy,document,$,selectionAlignmentPlan,StudioRichText:rich,StudioTextFormatting:require(base+'text-formatting.js'),StudioI18n:{panelName:p=>p.name},project,preparePositionedTextEdit,
    original:false,selectedPanel:'p0',selected:[...keys],selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,panelSelection:[],contentSelection:null,selectedEmptyCell:null,textTools:null,
    state:()=>current,panel:()=>asset,currentOutput:()=>({scale:outputScale}),
    selectionGroups:()=>[{id:'p0',vi:0,keys:[...ctx.selected]}],
    editsFor:(id,vi,s=current)=>s.panels[id].edits[vi]||{},
    paint:(el,prop)=>el.style.getPropertyValue(prop)||el.getAttribute(prop)|| (prop==='fill'?'#000000':'none'),
    hex:value=>/^#[a-f0-9]{6}$/i.test(value||'')?value:null,chromatic:()=>false,
    T:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[i]),say:text=>messages.push(text),
    renderSelectionCommands(){},renderEditingPanels(){},syncColorControls(){},renderFontTargets(){},renderHeatmapControls(){},renderRichTextControls(){},renderStatisticalLineControls(){},renderComponentStyle(){},
    commit(next){validateState(next,project);history.commit(next);current=copy(next);render();return true;},
    renderCanvas:next=>render(next||current)
  };
  vm.createContext(ctx);vm.runInContext(helpers,ctx);
  ctx.editableSource=(id,vi,s=current)=>ctx.applyStoredEdits(parse(),id,vi,s);ctx.editableSourceSnapshot=ctx.editableSource;
  function render(s=current){const root=ctx.editableSource('p0',0,s);root.setAttribute('data-panel','p0');root.setAttribute('width',String(width));$('artboard').replaceChildren(root);return root;}
  $('scope').value='element';render();
  const node=key=>$('artboard').querySelector(`[data-key="${key||ctx.selected[0]}"]`);
  function readings(){ctx.renderSelectionProperties();return {sidebar:$('fontSize').value,quick:$('quickFontSize').value};}
  function quick(value){ctx.commit(ctx.quickStyleState(current,ctx.quickSelectedObjects(),'font-size',String(value)));}
  return {ctx,asset,project,history,initial,raw,node,readings,quick,render,current:()=>current,scale(value){outputScale=value;},close(){dom.window.close();}};
}

test('PDF 50× text: sidebar and quick toolbar read and write physical pt',()=>{
  const h=harness('<text data-key="e1" font-family="Arial" font-size="1" transform="matrix(50 0 0 50 30 40)" x="0 .556 1.112" y="0 0 0">123</text>');
  close(h.ctx.textPointSize(h.node()),1);close(h.ctx.textPointFactor(h.node(),'p0',0),50);
  assert.deepEqual(h.readings(),{sidebar:'50',quick:'50'});
  h.ctx.updateStyle('font-size','8','text');close(+h.current().panels.p0.edits[0].e1['font-size'],.16);
  assert.deepEqual(h.readings(),{sidebar:'8',quick:'8'});
  const positions=h.node().getAttribute('x').split(' ').map(Number);close(positions[1]*50,4.448);close(positions[2]*50,8.896);
  assert.equal(h.node().getAttribute('transform'),'matrix(50 0 0 50 30 40)');
  h.quick(24);assert.deepEqual(h.readings(),{sidebar:'24',quick:'24'});h.quick(8);assert.deepEqual(h.readings(),{sidebar:'8',quick:'8'});
  close(Number(h.node().getAttribute('x').split(' ')[2])*50,8.896,'resizing never compounds source character spacing');
  assert.equal(h.asset.variants[0].svg,h.raw,'source SVG is untouched');h.close();
});

test('1000× text: 1→8→24→8 edits, tiny local units and saved history remain exact',()=>{
  const h=harness('<text data-key="e1" font-size="0.001" transform="matrix(1000 0 0 1000 30 40)" x="0 .000556 .001112" y="0 0 0">123</text>');
  assert.deepEqual(h.readings(),{sidebar:'1',quick:'1'});
  h.ctx.updateStyle('font-size','1','text');close(+h.current().panels.p0.edits[0].e1['font-size'],.001);
  validateState(h.current(),h.project);
  const tiny=copy(h.current()),savedTiny=JSON.parse(JSON.stringify(h.history));
  assert.deepEqual(History.restore(savedTiny,h.project,tiny).current,tiny);
  for(const [method,value]of [['sidebar',8],['quick',24],['sidebar',8]]){
    if(method==='sidebar')h.ctx.updateStyle('font-size',String(value),'text');else h.quick(value);
    close(+h.current().panels.p0.edits[0].e1['font-size'],value/1000);
    assert.deepEqual(h.readings(),{sidebar:String(value),quick:String(value)});
    close(Number(h.node().getAttribute('x').split(' ')[2])*1000,value*1.112);
  }
  const saved=JSON.parse(JSON.stringify({state:h.current(),history:h.history})),restored=History.restore(saved.history,h.project,saved.state);
  close(+restored.undo().panels.p0.edits[0].e1['font-size'],.024);
  close(+restored.redo().panels.p0.edits[0].e1['font-size'],.008);
  assert.deepEqual(restored.current,saved.state);h.close();
});

test('ancestor stretch + rotated text uses the composed vertical em vector',()=>{
  const h=harness('<g transform="translate(60 40) scale(2 5)"><text data-key="e1" font-size="6" transform="rotate(90)" x="0 3">AB</text></g>');
  close(h.ctx.textPointFactor(h.node(),'p0',0),2);assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});
  h.quick(24);close(+h.current().panels.p0.edits[0].e1['font-size'],12);
  close(h.ctx.textOutputSize(h.node(),'p0',0),24);assert.equal(h.node().getAttribute('transform'),'rotate(90)');h.close();
});

test('equivalent 12 pt texts are uniform despite different local matrices',()=>{
  const h=harness('<text data-key="e1" font-size="1" transform="scale(12)">A</text><text data-key="e2" font-size="12">B</text><path data-key="e3" d="M0 0L10 10"/>',{keys:['e1','e2','e3']});
  assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});
  h.ctx.updateStyle('font-size','24','text');close(+h.current().panels.p0.edits[0].e1['font-size'],2);close(+h.current().panels.p0.edits[0].e2['font-size'],24);
  assert.equal(h.current().panels.p0.edits[0].e3,undefined,'shapes cannot receive text sizing');
  assert.deepEqual(h.readings(),{sidebar:'24',quick:'24'});h.close();
});

test('panel viewport and export scale are included once in both controls',()=>{
  const h=harness('<text data-key="e1" font-size=".012" transform="scale(1000)">ABC</text>',{width:200,viewWidth:400,scale:2});
  close(h.ctx.textPointFactor(h.node(),'p0',0),500);assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});
  h.ctx.updateStyle('font-size','24','text');close(+h.current().panels.p0.edits[0].e1['font-size'],.024);
  assert.deepEqual(h.readings(),{sidebar:'24',quick:'24'});
  h.scale(1);assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});h.scale(2);
  h.quick(8);close(+h.current().panels.p0.edits[0].e1['font-size'],.008);assert.deepEqual(h.readings(),{sidebar:'8',quick:'8'});h.close();
});

test('parent sizes and absolute subscript sizes retain ratios through both edit paths',()=>{
  const h=harness('<text data-key="e1" font-size="1" transform="scale(12)"><tspan data-key="e2" x="0 .5" font-size="1">Ca</tspan><tspan data-key="e3" x="1" y=".2" font-size=".7">2</tspan></text>');
  h.ctx.updateStyle('font-size','24','text');close(+h.current().panels.p0.edits[0].e2['font-size'],2);close(+h.current().panels.p0.edits[0].e3['font-size'],1.4);
  h.quick(12);close(+h.current().panels.p0.edits[0].e2['font-size'],1);close(+h.current().panels.p0.edits[0].e3['font-size'],.7);
  assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});h.close();
});

test('font summary skips hidden definitions and unreliable geometry without interrupting rendering',()=>{
  const h=harness('<text data-key="e1" font-size="6" transform="scale(2)">Visible</text><g display="none" transform="scale(0)"><text font-size="1">Hidden singular text</text></g><defs><text transform="scale(0)">Unused definition</text></defs><g visibility="hidden"><text font-size="1">Hidden</text></g><g opacity="0"><text font-size="1">Transparent</text></g><text transform="scale(0)">Unreliable</text><text font-size="2"> </text>');
  const root=h.node().closest('svg'),before=root.outerHTML;
  assert.deepEqual(Array.from(h.ctx.visibleTextOutputSizes(root,2)),[24]);
  assert.equal(root.outerHTML,before,'informational geometry reads must not alter source text');
  root.querySelector('[data-key="e1"]').style.display='none';
  assert.deepEqual(Array.from(h.ctx.visibleTextOutputSizes(root,2)),[],'all hidden or unreliable text produces no misleading minimum');
  assert.match(source,/const textSizes=visibleTextOutputSizes\(svg,output\.scale\)/,'canvas uses the guarded summary before installing pointer handlers');
  h.close();
});

test('annotation and label fields enforce physical limits before preview or history commits',()=>{
  const dom=new JSDOM(html),document=dom.window.document,$=id=>document.getElementById(id),messages=[];
  const project={panels:[{id:'p0',variants:[{}]}]},initial={order:['p0'],columns:1,gap:0,panels:{p0:{variant:0,edits:{},label:{text:'A',x:2,y:5,size:.012,font:'Arial',bold:true}}},overlays:[{id:'annotation-1',type:'text',x:.1,y:.1,w:.2,h:.1,text:'Text',font:'Arial',size:.012,color:'#000000',stroke:.001,opacity:1,fill:false,locked:false}]};
  let current=copy(initial),commits=0,previews=0;const history=new History(current);
  const ctx={copy,$,state:()=>current,currentOutput:()=>({scale:1000}),project,validateState,selectedPanel:'p0',selectedPanelLabel:'p0',selectedAnnotations:['annotation-1'],panelNumberStyle:()=>false,displayedPanelLabel:s=>s.panels.p0.label,numberPanelLabels:require(base+'studio.js').numberPanelLabels,T:x=>x,say:m=>messages.push(m),renderCanvas:()=>previews++,commit(next){validateState(next,project);history.commit(next);current=copy(next);commits++;return true;}};
  vm.createContext(ctx);
  vm.runInContext(chunk('  function renderLabelControls(','  function selectPanelLabel(')+chunk('  const labelValues=text=>',"  $('deleteElements').onclick=")+source.split('\n').find(line=>line.startsWith('  const updateOverlay=')),ctx);
  ctx.renderLabelControls();assert.equal($('labelSize').value,'12','label inspector displays final pt rather than the tiny stored value');
  $('font').value='Arial';$('overlayFont').value='Arial';$('overlayColor').value='#000000';$('overlayStroke').value='1';$('overlayOpacity').value='1';$('overlayText').value='Text';
  for(const value of ['',3,73,1e8,'NaN']){$('overlaySize').value=String(value);vm.runInContext('updateOverlay();updateOverlay(true);',ctx);assert.equal(commits,0);assert.equal(previews,0);}
  for(const value of ['',5,37,1e8,'NaN']){$('labelSize').value=String(value);$('applyPanelLabel').onclick();$('numberPanels').onclick();assert.equal(commits,0);}
  assert.equal(JSON.stringify(current),JSON.stringify(initial));assert.ok(messages.some(m=>m.includes('4–72 pt')));assert.ok(messages.some(m=>m.includes('6–36 pt')));
  for(const value of [4,72]){$('overlaySize').value=String(value);vm.runInContext('updateOverlay();',ctx);close(current.overlays[0].size,value/1000);}
  for(const value of [6,36]){$('labelSize').value=String(value);$('applyPanelLabel').onclick();close(current.panels.p0.label.size,value/1000);ctx.renderLabelControls();assert.equal($('labelSize').value,String(value));}
  assert.equal(commits,4);const restored=History.restore(JSON.parse(JSON.stringify(history)),project,current);close(restored.undo().panels.p0.label.size,.006);close(restored.redo().panels.p0.label.size,.036);dom.window.close();
});
console.log(`PASS ${passed} PDF text editing integrations: production size/read/write/apply, real SVG DOM, history and physical output units.`);

