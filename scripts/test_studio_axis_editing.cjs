'use strict';
const assert=require('node:assert/strict'),api=require('../skills/polish-sci-figures/assets/figure-studio/axis-editing.js');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
test('persistent ranges are finite data values with an explicit scale',()=>{
  assert.deepEqual(api.validate('{"version":1,"axis":"y","scale":"log","min":0.01,"max":1000}'),{version:1,axis:'y',scale:'log',min:.01,max:1000});
  for(const value of [null,'{}','invalid',{version:1,axis:'z',scale:'linear',min:0,max:10},{version:1,axis:'y',scale:'log',min:0,max:10},{version:1,axis:'y',scale:'linear',min:2,max:1},{version:1,axis:'y',scale:'linear',min:0,max:Infinity}])assert.throws(()=>api.validate(value));
});
if(!process.argv.includes('--dom')){console.log(`${passed} axis editing validation test passed; use --dom for SVG integration`);process.exit(0);}
const {JSDOM}=require('jsdom'),G=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
const parse=source=>new JSDOM(source,{contentType:'image/svg+xml'}).window.document.documentElement;
function fixture({values=[0,5,10],positions,axis='y',scale,transform='',minor=false,prefix='',line=false,unit=1}={}){
  positions??=values.map((_,i)=>i*100/(values.length-1));
  const p=n=>axis==='y'?{x:40*unit,y:(160-n)*unit}:{x:(40+n)*unit,y:160*unit};
  const ticks=values.map((value,i)=>({value,pos:positions[i]}));if(minor)ticks.push(...[25,75].map(pos=>({value:null,pos})));
  const a=p(0),b=p(100),id=s=>prefix+s;
  const body=`<defs><clipPath id="crop"><rect x="40" y="60" width="100" height="100"/></clipPath></defs><g id="${id('figure_1')}" transform="${transform}"><g id="${id('axes_1')}"><g id="data" clip-path="url(#crop)"><path data-key="e2" d="M40 150L70 120L90 80"/><image data-key="e3" href="data:image/png;base64,AAAA" width="10" height="10"/></g><g id="${id('matplotlib.axis_2')}">${ticks.map((t,i)=>{const p0=p(t.pos);return `<g id="${id(axis+'tick_'+(i+1))}" data-key="e${10+i*10}"><g id="${id('line2d_'+i)}"><defs><path id="${id('tick'+i)}" d="M 0 0 L ${axis==='y'?'-3 0':'0 3'}"/></defs><g><use href="#${id('tick'+i)}" x="${p0.x}" y="${p0.y}" stroke="black"/></g><path d="M ${p0.x} ${p0.y} L ${p0.x+(axis==='y'?100:0)} ${p0.y-(axis==='x'?100:0)}" clip-path="url(#crop)" stroke="#ccc"/></g>${t.value===null?'':`<g id="${id('text_'+i)}"><text data-key="e${11+i*10}" x="${p0.x-(axis==='y'?7:0)}" y="${p0.y+(axis==='x'?12:3)}" text-anchor="${axis==='y'?'end':'middle'}" font-size="8">${t.value}</text></g>`}</g>`;}).join('')}<g id="title"><text data-key="e8" x="12" y="110" transform="rotate(-90 12 110)" font-size="9">Response</text></g></g><g id="${id('patch_3')}">${line?`<line data-key="e1" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="black"/>`:`<path data-key="e1" d="M ${a.x} ${a.y} L ${b.x} ${b.y}" stroke="black"/>`}</g></g></g>`;
  return parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${scale?`<metadata id="studio-axis-controls">${JSON.stringify({effective:[{[axis+'_scale']:scale}]})}</metadata>`:''}${body}</svg>`);
}
const edit=(record,key='e1')=>({[key]:{'axis-extension':JSON.stringify(record)}});
const record=(min=0,max=15,axis='y',scale='linear')=>({version:1,axis,scale,min,max});
const generated=root=>[...root.querySelectorAll('[data-axis-generated]')];
const textFor=root=>generated(root).map(n=>n.querySelector('text')?.textContent).filter(Boolean);
test('vertical extension adds correctly placed ticks and leaves observations and original ticks byte-identical',()=>{
  const root=fixture(),data=root.querySelector('#data').outerHTML,ticks=[...root.querySelectorAll('[id^="ytick"]')].map(n=>n.outerHTML),info=api.inspect(root,'e1');assert.equal(info.supported,true);assert.equal(info.scale,'linear');near(info.min,0);near(info.max,10);
  const result=api.apply(root,edit(record()));assert.deepEqual(result,{changed:1,generated:1});assert.deepEqual(textFor(root),['15']);assert.equal(root.querySelector('#data').outerHTML,data);assert.deepEqual([...root.querySelectorAll('[id^="ytick"]')].map(n=>n.outerHTML),ticks);
  const copy=generated(root)[0],marker=copy.querySelector('use'),position=G.point(G.relativeMatrix(marker,root),{x:+marker.getAttribute('x'),y:+marker.getAttribute('y')});near(position.x,40);near(position.y,10);assert.equal(root.querySelector('[data-key="e1"]').getAttribute('d'),'M 40 160 L 40 10');assert.ok(!copy.querySelector('[clip-path]'));assert.equal(root.querySelector('#data').getAttribute('clip-path'),'url(#crop)');assert.equal(api.inspect(root,'e1').max,15);
});
test('resize plan converts panel-pt translation and keeps the same original scale',()=>{
  const root=fixture({unit:2}),planned=api.planResize(root,'e1',[1,0,0,1.5,0,-80],{unit:2});near(planned.min,0);near(planned.max,15);api.apply(root,edit(planned),2);assert.deepEqual(textFor(root),['15']);
  assert.throws(()=>api.planResize(fixture(),'e1',[1,0,0,1,5,0]),/direction/);assert.throws(()=>api.planResize(fixture(),'e1',[1,0,0,-1,0,0]),/direction/);
});
test('horizontal, descending and negative axes use numeric mapping rather than screen direction',()=>{
  const horizontal=fixture({axis:'x',values:[-10,-5,0],line:true});api.apply(horizontal,edit(record(-15,5,'x')));assert.deepEqual(textFor(horizontal),['−15','5']);near(+horizontal.querySelector('[data-key="e1"]').getAttribute('x1'),-10);near(+horizontal.querySelector('[data-key="e1"]').getAttribute('x2'),190);
  const descending=fixture({values:[10,5,0]});api.apply(descending,edit(record(-5,15)));assert.deepEqual(textFor(descending),['−5','15']);assert.equal(descending.querySelector('[data-key="e1"]').getAttribute('d'),'M 40 210 L 40 10');
});
test('explicit logarithmic axes generate powers at equal distances, not linear values',()=>{
  const root=fixture({values:[1,10,100],scale:'log'});const info=api.inspect(root,'e1');assert.equal(info.supported,true);assert.equal(info.scale,'log');api.apply(root,edit(record(1,10000,'y','log')));assert.deepEqual(textFor(root),['1000','10000']);
  const points=generated(root).map(n=>{const use=n.querySelector('use');return G.point(G.relativeMatrix(use,root),{x:+use.getAttribute('x'),y:+use.getAttribute('y')}).y;});near(points[0],10);near(points[1],-40);
  assert.equal(api.inspect(fixture({values:[1,10,100]}),'e1').supported,false);assert.equal(api.apply(fixture({scale:'log'}),edit(record())).skipped[0].reason,'axis-scale');
});
test('two ticks require explicit scale metadata; ambiguous imported PDF paths remain ordinary objects',()=>{
  assert.equal(api.inspect(fixture({values:[0,10]}),'e1').supported,false);assert.equal(api.inspect(fixture({values:[0,10],scale:'linear'}),'e1').supported,true);
  assert.equal(api.inspect(parse('<svg xmlns="http://www.w3.org/2000/svg"><g><path data-key="e1" d="M40 160L40 60"/><text>0</text><text>10</text></g></svg>'),'e1').supported,false);
});
test('renderer-declared category axes cannot invent additional numeric-looking groups',()=>{
  const controls={supported:true,x_range:false,y_range:true,effective:[{x_scale:'linear',y_scale:'linear'}]},category=fixture({axis:'x',values:[0,5,10]}),value=fixture();
  assert.equal(api.inspect(category,'e1',{controls}).supported,false);assert.equal(api.inspect(value,'e1',{controls}).supported,true);
  const before=category.outerHTML,result=api.apply(category,edit(record(0,15,'x')),1,{controls});assert.equal(result.changed,0);assert.equal(result.skipped[0].reason,'axis-scale');assert.equal(category.querySelectorAll('[data-axis-generated]').length,0);category.removeAttribute('data-axis-extension-warning');assert.equal(category.outerHTML,before);
  const metadata=category.ownerDocument.createElementNS(category.namespaceURI,'metadata');metadata.id='studio-axis-controls';metadata.textContent=JSON.stringify(controls);category.prepend(metadata);assert.equal(api.inspect(category,'e1').supported,false,'embedded and supplied capability paths agree');
  assert.equal(api.inspect(value,'e1',{controls:{supported:false,x_range:false,y_range:false,defaults:{},effective:[]}}).supported,true,'unavailable recipe range controls do not deny a reliably recognized numeric SVG axis');
});
test('regular minor ticks are continued without inventing labels for them',()=>{
  const root=fixture({minor:true});api.apply(root,edit(record(0,20)));assert.equal(generated(root).length,4);assert.deepEqual(textFor(root),['15','20']);assert.equal(generated(root).filter(n=>!n.querySelector('text')).length,2);
  const irregular=fixture({minor:true});irregular.querySelector('#ytick_5').remove();assert.equal(api.inspect(irregular,'e1').supported,false);
});
test('nested viewport and fit transforms preserve the physical numeric mapping',()=>{
  const root=fixture({transform:'translate(10 20) scale(2 .5)',prefix:'panel-'});const data=root.querySelector('#data').outerHTML;api.apply(root,edit(record(0,20)));assert.equal(root.querySelector('#data').outerHTML,data);
  const last=generated(root).find(n=>n.querySelector('text')?.textContent==='20'),use=last.querySelector('use'),p=G.point(G.relativeMatrix(use,root),{x:+use.getAttribute('x'),y:+use.getAttribute('y')});near(p.x,90);near(p.y,0);
});
test('persistent bounds survive save/reopen and different fitted sizes with stable tick edit keys',()=>{
  const saved=JSON.stringify(edit(record(0,20))),one=fixture(),two=fixture({transform:'scale(2 3)'}),short=fixture();api.apply(one,JSON.parse(saved));api.apply(two,JSON.parse(saved));api.apply(short,edit(record(0,15)));
  const key=root=>generated(root).find(n=>n.querySelector('text')?.textContent==='15').querySelector('text').getAttribute('data-key');assert.equal(key(one),key(two));assert.equal(key(one),key(short));assert.ok(/^e\d+$/.test(key(one)));assert.ok(Number.isSafeInteger(Number(key(one).slice(1))));assert.equal(JSON.stringify(JSON.parse(saved)),saved);
  const reopened=parse(one.outerHTML);assert.equal(api.inspect(reopened,'e1').supported,true);near(api.inspect(reopened,'e1').max,20);
  for(const node of reopened.querySelectorAll('*'))for(const a of [...node.attributes])if(a.name.startsWith('data-')&&a.name!=='data-key')node.removeAttribute(a.name);
  assert.equal(api.inspect(reopened,'e1').supported,true);api.apply(reopened,edit(record(0,25)));assert.deepEqual(textFor(reopened),['25']);
});
test('stale ranges and manually changed labels preserve the base plot with an explicit warning',()=>{
  for(const range of [record(1,15),record(0,1e6),record(0,15,'x')]){const root=fixture(),before=root.innerHTML;const result=api.apply(root,edit(range));assert.equal(result.changed,0);assert.equal(result.skipped.length,1);assert.ok(root.hasAttribute('data-axis-extension-warning'));assert.equal(root.innerHTML,before);}
  assert.throws(()=>api.apply(fixture(),edit(record(-1,15,'y','log'))));
  const root=fixture();root.querySelector('#ytick_2 text').textContent='seven';assert.equal(api.inspect(root,'e1').supported,false);
  const offset=fixture();offset.querySelector('#title text').textContent='+1e6';assert.equal(api.inspect(offset,'e1').supported,false);
  assert.equal(api.inspect(fixture({positions:[0,60,100]}),'e1').supported,false);
  assert.equal(api.inspect(fixture({transform:'rotate(20)'}),'e1').supported,false);
  const clipped=fixture();clipped.querySelector('#axes_1').setAttribute('clip-path','url(#crop)');assert.equal(api.inspect(clipped,'e1').supported,false);
  const large=fixture({values:[1e10,1e10+5,1e10+10]});api.apply(large,edit(record(1e10,1e10+15)));assert.deepEqual(textFor(large),['10000000015']);assert.equal(api.inspect(fixture({values:[1e10,1e10+5,1e10+11]}),'e1').supported,false);
});
test('rich mathematical tick runs are rejected instead of being misread as concatenated integers',()=>{
  const root=fixture({values:[1,10,100],scale:'log'});root.querySelector('#ytick_2 text').innerHTML='<tspan>10</tspan><tspan dy="-3">1</tspan>';assert.equal(api.inspect(root,'e1').supported,false);
});
test('captured preview keeps the live spine and data nodes, restores, and does not accumulate ticks',()=>{
  const root=fixture(),before=root.outerHTML,spine=root.querySelector('[data-key="e1"]'),data=root.querySelector('#data'),gesture=api.capture(root,'e1');
  for(const max of [15,20,15,30]){gesture.preview(root,record(0,max));assert.equal(root.querySelector('[data-key="e1"]'),spine);assert.equal(root.querySelector('#data'),data);assert.equal(generated(root).length,(max-10)/5);near(api.inspect(root,'e1').max,max);}
  gesture.restore(root);assert.equal(root.outerHTML,before);assert.equal(root.querySelector('[data-key="e1"]'),spine);
  api.apply(root,edit(record(0,20)));const second=api.capture(root,'e1');second.preview(root,record(0,15));assert.deepEqual(textFor(root),['15']);second.preview(root,record(0,10));assert.equal(generated(root).length,0);assert.throws(()=>second.planResize([1,0,0,.4,0,96]),/original axis/);
});
test('production state/history and post-fit rendering preserve editable generated text and offsets',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),studio=require('../skills/polish-sci-figures/assets/figure-studio/studio.js'),source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8'),project={panels:[{id:'p',variants:[{}]}]},initial={order:['p'],columns:1,gap:12,panels:{p:{variant:0,edits:{}}}},next=JSON.parse(JSON.stringify(initial));
  next.panels.p.edits={0:edit(record())};studio.validateState(next,project);const history=new studio.History(initial);history.commit(next);assert.deepEqual(history.undo(),initial);history.redo();assert.deepEqual(studio.History.restore(history.toJSON(),project,next).current,next);
  const probe=fixture();api.apply(probe,next.panels.p.edits[0]);const textKey=generated(probe)[0].querySelector('text').getAttribute('data-key');next.panels.p.edits[0][textKey]={'font-size':'12','offset-x':'3',fill:'#cc0033'};
  const context={StudioAxisEditing:api,StudioSelectionTransformDOM:require('../skills/polish-sci-figures/assets/figure-studio/selection-transform-dom.js'),StudioRichText:require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js'),preparePositionedTextEdit:studio.preparePositionedTextEdit,editsFor:(id,vi,s)=>s.panels[id].edits[vi],panel:()=>({variants:[{}]})};vm.createContext(context);vm.runInContext(source.slice(source.indexOf('  function applyAxisGeneratedEdits('),source.indexOf('  function wrapPanelContent(')),context);
  const root=fixture();context.applyElementOffsets(root,'p',0,next,1);const label=root.querySelector(`[data-key="${textKey}"]`);assert.equal(label.style.fontSize,'12px');assert.equal(label.style.fill,'#cc0033');assert.ok(label.getAttribute('transform'));const old=G.point(G.relativeMatrix(generated(probe)[0].querySelector('text'),probe),{x:33,y:163}),moved=G.point(G.relativeMatrix(label,root),{x:33,y:163});near(moved.x,old.x+3);near(moved.y,old.y);
});
if(process.argv.includes('--real')){
  const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),repo=path.resolve(__dirname,'..'),python=process.env.PYTHON||[path.join(repo,'.venv/Scripts/python.exe'),path.join(repo,'.venv/bin/python')].find(fs.existsSync)||'python';
  const code=String.raw`import io,json,sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import ScalarFormatter
out=[]
for log in (False,True):
 fig,ax=plt.subplots(figsize=(4.8,3.6));ax.plot([0,1,2],[1,10,100] if log else [2,6,9]);ax.spines[['top','right']].set_visible(False)
 if log: ax.set_yscale('log');ax.set_ylim(1,100);ax.set_yticks([1,10,100]);ax.yaxis.set_major_formatter(ScalarFormatter());ax.minorticks_off()
 else: ax.set_ylim(0,10);ax.set_yticks([0,5,10])
 with plt.rc_context({'svg.fonttype':'none'}):
  stream=io.StringIO();fig.savefig(stream,format='svg');out.append({'log':log,'svg':stream.getvalue()})
 plt.close(fig)
print(json.dumps(out))`;
  const run=cp.spawnSync(python,['-X','utf8','-c',code],{cwd:repo,encoding:'utf8',maxBuffer:5e6});assert.equal(run.status,0,run.stderr);
  test('actual Matplotlib linear and logarithmic SVGs extend without changing plot artist markup',()=>{
    for(const fixture of JSON.parse(run.stdout)){const root=parse(fixture.svg);[...root.querySelectorAll('*')].forEach((n,i)=>n.setAttribute('data-key','e'+i));const spine=root.querySelector('#patch_3 path'),key=spine.getAttribute('data-key'),controls={effective:[{y_scale:fixture.log?'log':'linear'}]},info=api.inspect(root,key,{controls});assert.equal(info.supported,true,JSON.stringify(info));const artist=root.querySelector('#axes_1 > g[id^="line2d"]'),before=artist.outerHTML;api.apply(root,edit(record(fixture.log?1:0,fixture.log?1000:15,'y',fixture.log?'log':'linear'),key),1,{controls});assert.equal(artist.outerHTML,before);assert.deepEqual(textFor(root),[fixture.log?'1000':'15']);}
  });
}
console.log(`${passed} axis editing regressions passed`);
