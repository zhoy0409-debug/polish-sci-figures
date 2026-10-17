/* Real SVG attributes and public controller adapters. This is not a browser
 * font-layout, pointer-latency or native-PDF visual acceptance test. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/',format=require(base+'text-formatting.js'),ui=require(base+'text-tools-ui.js');
const rich=require(base+'rich-text.js');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(body){const dom=new JSDOM(`<main><div id="tools"></div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${body}</svg></main>`);return {dom,doc:dom.window.document,svg:dom.window.document.querySelector('svg'),text:dom.window.document.querySelector('text')};}
function close(a,b){assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);}
function values(el,key){return el.getAttribute(key).split(/\s+/).map(Number);}
test('bounded spacing, typography schema and literal font families',()=>{
  for(const value of ['0','-.5','1e-3'])assert.ok(format.validateSpacing('letter-spacing',value));
  for(const value of ['',' ','.5em','NaN','Infinity','1e10'])assert.equal(format.validateSpacing('letter-spacing',value),false);
  assert.ok(format.validateSpacing('line-height','.5'));assert.ok(format.validateSpacing('line-height','5'));assert.equal(format.validateSpacing('line-height','.49'),false);
  assert.ok(format.fontFamily('Helvetica Neue, Arial, sans-serif'));assert.ok(format.fontFamily('宋体'));for(const family of ['url(https://x)','Arial;fill:red','<image>','x\nfont'])assert.equal(format.fontFamily(family),false);
  const {text}=fixture('<text font-size="12">A</text>'),record=format.capture(text);assert.ok(format.validTypography(record));assert.equal(format.validTypography({...record,text:'injection'}),false);assert.equal(format.validTypography({...record,fill:'url(#g)'}),false);
});
test('PDF per-glyph positions use local spacing while transform and baseline remain exact',()=>{
  const {text}=fixture('<text font-size=".012" transform="matrix(1000 0 0 1000 20 30)" x="0 .008 .016" y="0 0 0">ABC</text>');
  format.applySpacing(text,{letterSpacing:.001});assert.deepEqual(values(text,'x'),[0,.009,.018]);assert.equal(text.getAttribute('y'),'0 0 0');assert.equal(text.getAttribute('transform'),'matrix(1000 0 0 1000 20 30)');
  assert.equal(text.textContent,'ABC');assert.equal(text.style.letterSpacing,'0.001px');const record=format.capture(text,{pointFactor:1000});close(record.fontSize,12);close(record.letterSpacing,1);
});
test('spacing across explicit PDF runs retains relative scripts and fixed textLength meaning',()=>{
  const {text}=fixture('<text font-size="10" textLength="24" lengthAdjust="spacingAndGlyphs"><tspan x="10 16">AB</tspan><tspan x="22 28" font-size="7" baseline-shift="super">23</tspan></text>');
  format.applySpacing(text,{letterSpacing:1});const spans=text.querySelectorAll('tspan');assert.deepEqual(values(spans[0],'x'),[10,17]);assert.deepEqual(values(spans[1],'x'),[24,31]);assert.equal(spans[1].getAttribute('baseline-shift'),'super');assert.equal(spans[1].getAttribute('font-size'),'7');assert.equal(text.getAttribute('textLength'),'27');
});
test('existing spacing can decrease and negative spacing is not accumulated twice',()=>{
  const {text}=fixture('<text x="0 6 12" y="20" font-size="10" letter-spacing="1">ABC</text>');format.applySpacing(text,{letterSpacing:-1});assert.deepEqual(values(text,'x'),[0,4,8]);assert.equal(text.style.letterSpacing,'-1px');
});
test('letter spacing uses its horizontal physical scale independently of font height',()=>{
  const {text}=fixture('<text font-size=".012" letter-spacing=".001" transform="scale(500 1000)" x="0 .008 .016">ABC</text>'),record=format.capture(text,{pointFactor:1000,letterPointFactor:500});close(record.fontSize,12);close(record.letterSpacing,.5);const plan=format.plan(text,record,{pointFactor:2000,letterPointFactor:250});assert.equal(plan.props['font-size'],'0.006');assert.equal(plan.props['letter-spacing'],'0.002');let draw;const preview=format.createPreview([{el:text,pointFactor:1000,letterPointFactor:500}],{requestFrame:fn=>(draw=fn,1),cancelFrame(){}});preview.update({letterSpacing:1});draw();assert.equal(text.style.letterSpacing,'0.002px');preview.finish();
});
test('absolute multi-line spans retain superscript offsets and text contents',()=>{
  const {text}=fixture('<text x="10" y="20" font-size="10"><tspan x="10" y="20">H</tspan><tspan font-size="7" x="17" y="23">2</tspan><tspan x="10" y="35">x</tspan><tspan x="17" y="32" font-size="7">2</tspan></text>');
  close(format.readSpacing(text).lineHeight,1.5);format.applySpacing(text,{lineHeight:2});const spans=text.querySelectorAll('tspan');assert.deepEqual([...spans].map(n=>+n.getAttribute('y')),[20,23,40,37]);assert.equal(text.textContent,'H2x2');assert.equal(text.getAttribute('x'),'10');assert.equal(text.style.lineHeight,'2');
});
test('relative line spans and script dy preserve native rich-text structure',()=>{
  const {text}=fixture('<text x="8" y="20" font-size="10"><tspan>Line1</tspan>\n<tspan x="8" dy="1.25em">H<tspan dy="-2" font-size="7">2</tspan></tspan></text>');
  format.applySpacing(text,{lineHeight:2});const spans=text.querySelectorAll('tspan');assert.equal(spans[1].getAttribute('dy'),'20');assert.equal(spans[2].getAttribute('dy'),'-2');assert.equal(spans[2].getAttribute('font-size'),'7');assert.equal(text.textContent,'Line1\nH2');
});
test('single explicit y list has line-height without flattening coordinates',()=>{
  const {text}=fixture('<text x="0 6 0 6" y="10 10 25 25" font-size="10">ABCD</text>');format.applySpacing(text,{lineHeight:2,letterSpacing:1});assert.deepEqual(values(text,'y'),[10,10,30,30]);assert.deepEqual(values(text,'x'),[0,7,0,7]);assert.equal(text.textContent,'ABCD');
});
test('typography capture uses dominant native base, excluding a P-only italic run',()=>{
  const {text}=fixture('<text><tspan font-size="10" font-family="Times New Roman" font-style="italic">P</tspan><tspan font-size="10" font-family="Times New Roman"> = 0.032</tspan></text>');const record=format.capture(text,{pointFactor:2});assert.equal(record.fontFamily,'Times New Roman');assert.equal(record.fontStyle,'normal');close(record.fontSize,20);
});
test('format plans use target physical coordinates and retain semantic runs',()=>{
  const source=fixture('<text font-size="12" font-family="Times New Roman" font-weight="700" fill="#123456" letter-spacing=".5">Source</text>'),target=fixture('<text data-key="e1" x="7" y="13" transform="scale(1000)" font-size=".006">H<tspan data-key="e2" x=".004" y=".002" font-size=".0042" font-style="italic" font-family="Arial" fill="#000000">2</tspan></text>'),before=target.svg.outerHTML,record=format.capture(source.text),plan=format.plan(target.text,record,{pointFactor:1000});
  assert.equal(plan.props['font-size'],'0.012');assert.equal(plan.props['letter-spacing'],'0.0005');assert.equal(plan.children[0].props['font-size'],'0.0084');assert.equal(plan.children[0].props['font-family'],'Times New Roman');assert.equal(plan.children[0].props.fill,'#123456');assert.equal(plan.children[0].props['font-style'],undefined);assert.equal(plan.props.text,undefined);assert.equal(plan.props.transform,undefined);assert.equal(plan.props.x,undefined);assert.equal(target.svg.outerHTML,before);
});
test('regular brush clears whole-text rich bold while retaining P-only italic and target scripts',()=>{
  const {text}=fixture('<text font-size="10" x="10 16 22 28 34 40" y="20 20 20 20 20 20">P = H2</text>'),source=fixture('<text font-size="12">Regular</text>');let stored=rich.format(null,text.textContent,0,text.textContent.length,'bold',true);stored=rich.format(stored,text.textContent,0,1,'italic',true);stored=rich.format(stored,text.textContent,5,6,'script','sub');rich.apply(text,stored);
  const record=format.capture(source.text),before=JSON.stringify(stored),plan=format.plan(text,record,{richText:stored}),next=rich.parse(plan.props['rich-text']);assert.equal(JSON.stringify(stored),before);assert.ok(next.runs.every(run=>run.style.bold===false));assert.equal(next.runs[0].style.italic,true);assert.equal(next.runs.at(-1).style.script,'sub');assert.equal(next.baseText,'P = H2');
});
test('uniform native bold override is cleared without encoding or flattening PDF math',()=>{
  const target=fixture('<text x="0 .008 .016" y="0 0 0" transform="scale(1000)" font-size=".012" font-weight="700">AB<tspan font-size=".0084" y="-.004">2</tspan></text>'),source=fixture('<text font-size="12">Regular</text>'),original=target.text.getAttribute('x'),beforeScript=target.text.querySelector('tspan').outerHTML,plan=format.plan(target.text,format.capture(source.text),{pointFactor:1000}),record=rich.parse(plan.props['rich-text']);
  assert.ok(record.runs.every(run=>run.style.script===undefined));rich.apply(target.text,record);assert.equal(target.text.getAttribute('x'),original);assert.equal(target.text.getAttribute('transform'),'scale(1000)');assert.equal(target.text.querySelector('tspan[font-size]').getAttribute('y'),'-.004');assert.ok(beforeScript.includes('font-size=".0084"'));assert.equal(target.text.textContent,'AB2');
});
test('painter snapshot is immutable, locked/hidden targets are excluded, commit is one batch',()=>{
  const {doc}=fixture('<text id="source" font-size="12" fill="#123456">Source</text><text id="one">One</text><text id="locked">Locked</text><text id="hidden" display="none">Hidden</text>'),source={identity:'source',el:doc.getElementById('source')},one={identity:'one',el:doc.getElementById('one')},locked={identity:'locked',el:doc.getElementById('locked'),locked:true},hidden={identity:'hidden',el:doc.getElementById('hidden')};let calls=0,chosen;
  const painter=format.createPainter({write(items,record){calls++;chosen=items;assert.equal(record.fill,'#123456');return true;}});assert.ok(painter.arm(source));source.el.style.fill='#abcdef';assert.equal(painter.apply([locked,hidden]),false);assert.equal(painter.status().active,true);assert.ok(painter.apply([one,one,locked]));assert.equal(calls,1);assert.deepEqual(chosen,[one]);assert.equal(painter.status().active,false);
});
test('painter keeps mode after stale/rejected target and can cancel without changes',()=>{
  const {text}=fixture('<text>A</text>');let current=true,calls=0;const target={el:text},painter=format.createPainter({valid:()=>current,write(){calls++;return false;}});assert.ok(painter.arm(target));current=false;assert.equal(painter.apply(target),false);current=true;assert.equal(painter.apply(target),false);assert.equal(painter.status().active,true);assert.equal(calls,1);assert.ok(painter.cancel());assert.equal(painter.status().active,false);
});
test('cached spacing preview coalesces inputs, restores exact source and rejects stale session',()=>{
  const {text}=fixture('<text font-size="10" x="0 6 12">ABC</text>'),before=text.outerHTML;let callback=null,frames=0,valid=true;const preview=format.createPreview([{el:text,pointFactor:2}],{requestFrame(fn){frames++;callback=fn;return frames;},cancelFrame(){callback=null;},valid:()=>valid});
  assert.ok(preview.update({letterSpacing:1}));assert.ok(preview.update({letterSpacing:2}));assert.equal(frames,1);callback();assert.deepEqual(values(text,'x'),[0,7,14]);assert.ok(preview.update({letterSpacing:4}));callback();assert.deepEqual(values(text,'x'),[0,8,16]);assert.equal(preview.count,1);valid=false;assert.equal(preview.update({letterSpacing:6}),false);preview.finish();assert.equal(text.outerHTML,before);
});
function uiFixture(){
  const {dom,doc}=fixture('<text id="source" font-size="12" font-family="Arial" fill="#112233">Source</text><text id="target" x="0 6 12" font-size="10">ABC</text><path id="shape" d="M0 0L10 10" fill="none" stroke="#444444"/><rect id="red" fill="#ff0000" width="10" height="10"/>'),item=id=>({identity:id,kind:'element',id:'p',vi:0,key:id,el:doc.getElementById(id)});let selection=[item('source')],active=true,frames=[],calls=[];
  const controller=ui.create({toolbar:doc.getElementById('tools'),t:x=>x,selected:()=>selection,captureOptions:()=>({pointFactor:2}),target:event=>event.item,valid:()=>active,requestFrame:fn=>(frames.push(fn),frames.length),cancelFrame(){},apply(items,plans,message){calls.push({items,plans,message});for(let i=0;i<items.length;i++)for(const [key,value]of Object.entries(plans[i].props))if(key==='letter-spacing'||key==='line-height')format.applySpacing(items[i].el,{[key==='letter-spacing'?'letterSpacing':'lineHeight']:+value});else items[i].el.style.setProperty(key,key==='font-size'?value+'px':value);return true;}});
  return {dom,doc,item,controller,calls,setSelection(items){selection=items;controller.sync();},setActive(v){active=v;},frame(){const fn=frames.shift();fn?.();},get frames(){return frames.length;}};
}
test('text UI brush selects source then applies target once without copying content or geometry',()=>{
  const f=uiFixture(),target=f.item('target'),before={text:target.el.textContent,x:target.el.getAttribute('x')};f.doc.querySelector('.text-format-painter').click();assert.equal(f.controller.active,true);assert.ok(f.controller.handlePointer({button:0,item:target,preventDefault(){},stopPropagation(){}}));assert.equal(f.calls.length,1);assert.equal(f.calls[0].plans[0].props.fill,'#112233');assert.equal(target.el.textContent,before.text);assert.equal(target.el.getAttribute('x'),before.x);assert.equal(f.controller.active,false);f.controller.destroy();
});
test('numeric spacing previews are coalesced and blur applies exactly once',()=>{
  const f=uiFixture(),target=f.item('target');f.setSelection([target]);f.doc.querySelector('.text-spacing-toggle').click();const input=f.doc.querySelector('[name="letterSpacing"]');input.value='2';input.dispatchEvent(new f.dom.window.Event('input'));input.value='4';input.dispatchEvent(new f.dom.window.Event('input'));assert.equal(f.frames,1);assert.equal(f.calls.length,0);f.frame();assert.deepEqual(values(target.el,'x'),[0,8,16]);input.dispatchEvent(new f.dom.window.Event('change'));input.dispatchEvent(new f.dom.window.Event('blur'));assert.equal(f.calls.length,1);assert.equal(f.calls[0].plans[0].props['letter-spacing'],'2');assert.deepEqual(values(target.el,'x'),[0,8,16]);f.controller.destroy();
});
test('invalid spacing input is visibly marked and Escape restores uncommitted source',()=>{
  const f=uiFixture(),target=f.item('target'),before=target.el.outerHTML;f.setSelection([target]);f.doc.querySelector('.text-spacing-toggle').click();const input=f.doc.querySelector('[name="lineHeight"]');input.value='0';input.dispatchEvent(new f.dom.window.Event('input'));assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(f.calls.length,0);input.value='2';input.dispatchEvent(new f.dom.window.Event('input'));f.frame();assert.ok(f.controller.handleKey({key:'Escape',preventDefault(){}}));assert.equal(target.el.outerHTML,before);assert.equal(f.calls.length,0);assert.equal(f.doc.querySelector('.text-spacing-popover').hidden,true);f.controller.destroy();
});
test('a valid spacing preview followed by invalid input never commits the stale value on blur',()=>{
  const f=uiFixture(),target=f.item('target'),before=target.el.outerHTML;f.setSelection([target]);f.doc.querySelector('.text-spacing-toggle').click();const input=f.doc.querySelector('[name="letterSpacing"]');input.value='4';input.dispatchEvent(new f.dom.window.Event('input'));f.frame();const lastValid=target.el.outerHTML;assert.notEqual(lastValid,before);input.value='';input.dispatchEvent(new f.dom.window.Event('input'));input.dispatchEvent(new f.dom.window.Event('blur'));assert.equal(target.el.outerHTML,lastValid);assert.equal(f.calls.length,0);assert.equal(input.getAttribute('aria-invalid'),'true');f.controller.refresh();assert.equal(input.value,'');assert.equal(input.getAttribute('aria-invalid'),'true');f.controller.cancel();assert.equal(target.el.outerHTML,before);f.controller.destroy();
});
test('graphics eyedropper skips text and replaces only existing stroke, never text typography',()=>{
  const f=uiFixture(),shape=f.item('shape'),source=f.item('red');f.setSelection([shape]);f.doc.querySelector('.shape-eyedropper').click();assert.equal(f.controller.active,true);f.controller.handlePointer({button:0,item:f.item('source')});assert.equal(f.calls.length,0);assert.equal(f.controller.active,true);f.controller.handlePointer({button:0,item:source});assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].plans[0].props,{stroke:'#ff0000'});assert.equal(shape.el.getAttribute('fill'),'none');assert.equal(shape.el.style.stroke,'#ff0000');assert.equal(f.controller.active,false);f.controller.destroy();
});
test('selection changes cancel pending previews and locked text cannot receive a brush',()=>{
  const f=uiFixture(),target=f.item('target'),before=target.el.outerHTML;f.setSelection([target]);f.doc.querySelector('.text-spacing-toggle').click();const input=f.doc.querySelector('[name="letterSpacing"]');input.value='3';input.dispatchEvent(new f.dom.window.Event('input'));f.frame();f.setSelection([f.item('source')]);assert.equal(target.el.outerHTML,before);assert.equal(f.calls.length,0);f.doc.querySelector('.text-format-painter').click();f.controller.handlePointer({button:0,item:{...target,locked:true}});assert.equal(f.calls.length,0);assert.equal(f.controller.active,true);f.controller.handleKey({key:'Escape'});assert.equal(f.controller.active,false);f.controller.destroy();
});
test('actual locale changes relabel text tools, spacing captions and accessibility without remount or history',()=>{
  const i18n=require(base+'i18n.js'),previous=i18n.language,{dom,doc,text}=fixture('<text font-size="12">Text</text>');let callback=null,commits=0;const selected=[{kind:'element',id:'p',vi:0,key:'e1',el:text,text:'Text'}];i18n.setLanguage('en');
  const controller=ui.create({toolbar:doc.getElementById('tools'),t:i18n.t,selected:()=>selected,apply(){commits++;return true;},requestFrame:fn=>(callback=fn,1),cancelFrame(){callback=null;}});
  try{
    const buttons=[...doc.querySelectorAll('.text-tools > button')],popover=doc.querySelector('.text-spacing-popover'),letter=doc.querySelector('[name="letterSpacing"]'),line=doc.querySelector('[name="lineHeight"]');assert.deepEqual(buttons.map(b=>b.textContent),['Text spacing','Format painter','Eyedropper']);buttons[0].click();letter.value='2';letter.dispatchEvent(new dom.window.Event('input'));assert.equal(doc.activeElement,letter);
    i18n.setLanguage('zh-CN');controller.refresh();assert.deepEqual(buttons.map(b=>b.textContent),['文字间距','格式刷','吸色笔']);assert.deepEqual(buttons.map(b=>b.getAttribute('aria-label')),['文字间距','格式刷','吸色笔']);assert.deepEqual(buttons.map(b=>b.title),['文字间距','格式刷','吸色笔']);assert.equal(letter.previousElementSibling.textContent,'字间距（pt）');assert.equal(line.previousElementSibling.textContent,'行距（倍）');assert.equal(letter.getAttribute('aria-label'),'字间距（pt）');assert.equal(popover.getAttribute('aria-label'),'文字间距');assert.ok(popover.querySelector('p').textContent.startsWith('输入即预览'));assert.equal(doc.activeElement,letter);assert.equal(letter.value,'2');assert.equal(commits,0);
    i18n.setLanguage('en');callback();assert.deepEqual(buttons.map(b=>b.textContent),['Text spacing','Format painter','Eyedropper']);assert.equal(line.getAttribute('aria-label'),'Line spacing (×)');assert.equal(commits,0);controller.cancel();i18n.setLanguage('zh-CN');buttons[1].click();assert.equal(buttons[1].textContent,'格式刷');assert.equal(controller.active,true);assert.equal(commits,0);controller.handleKey({key:'Escape'});assert.equal(controller.active,false);assert.equal(commits,0);
  }finally{controller.destroy();i18n.setLanguage(previous);dom.window.close();}
});
test('enabled text tools have readable quick-control colours and distinct disabled styling',()=>{
  const f=uiFixture(),style=f.doc.createElement('style');style.textContent=require('node:fs').readFileSync(require.resolve(base+'studio.css'),'utf8');f.doc.head.append(style);f.doc.getElementById('tools').parentElement.classList.add('canvas-tools');f.doc.getElementById('tools').className='canvasbar canvas-quickbar';const spacing=f.doc.querySelector('.text-spacing-toggle'),eye=f.doc.querySelector('.shape-eyedropper'),computed=node=>f.dom.window.getComputedStyle(node);
  // JSDOM preserves custom-property references; real resolved colours and
  // contrast in both themes are checked by test_studio_theme_tokens.cjs.
  assert.equal(spacing.disabled,false);assert.equal(computed(spacing).color,'var(--fs-text-primary)');assert.equal(computed(spacing).opacity,'1');assert.equal(eye.disabled,true);assert.equal(computed(eye).color,'var(--fs-text-disabled)');assert.equal([...style.sheet.cssRules].find(rule=>rule.selectorText==='.canvas-tools .text-tools>button:disabled').style.getPropertyValue('background'),'var(--fs-control-bg)');assert.equal(computed(eye).opacity,'1');f.setSelection([f.item('shape')]);assert.equal(eye.disabled,false);assert.equal(computed(eye).color,'var(--fs-text-primary)');assert.equal(spacing.disabled,true);assert.equal(computed(spacing).color,'var(--fs-text-disabled)');f.controller.destroy();
});
console.log(`PASS ${passed} text spacing, physical typography brush, shape eyedropper and one-commit DOM preview tests.`);
