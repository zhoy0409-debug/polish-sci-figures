'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const icons=require('../skills/polish-sci-figures/assets/figure-studio/alignment-icons.js');
const html=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.html','utf8');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(){
  const dom=new JSDOM(html,{pretendToBeVisual:true}),doc=dom.window.document,select=doc.getElementById('quickAlignAction'),commands=[],selection=['a','b','c'];let language='zh';
  select.onchange=()=>{commands.push(select.value);select.value='';};
  doc.querySelectorAll('[data-align-objects]').forEach(button=>button.onclick=()=>commands.push(button.dataset.alignObjects));
  for(const id of ['textAlign','overlayAlign'])doc.getElementById(id).onchange=()=>commands.push(id+':'+doc.getElementById(id).value);
  const ui=icons.create({document:doc,t:text=>language==='en'&&text==='对齐'?'Align':text});
  return {dom,doc,select,ui,commands,selection,language(value){language=value;ui.sync();},close(){ui.destroy();dom.window.close();}};
}
test('compact toolbar uses eight accessible icons and one existing host command per choice',()=>{const f=fixture();try{
  assert.equal(f.select.hidden,true);const toggle=f.doc.getElementById('quickAlignmentToggle'),popup=f.doc.getElementById('quickAlignmentPopover');assert.equal(toggle.getAttribute('aria-haspopup'),'menu');assert.equal(popup.querySelectorAll('button').length,8);
  toggle.click();assert.equal(popup.hidden,false);popup.querySelector('[data-alignment-action="right"]').click();assert.deepEqual(f.commands,['right']);assert.equal(f.select.value,'');assert.equal(popup.hidden,true);assert.deepEqual(f.selection,['a','b','c']);
  for(const button of popup.querySelectorAll('button')){assert.ok(button.querySelector('svg[aria-hidden="true"]'));assert.match(button.getAttribute('aria-label'),/[a-zA-Z]+/);assert.match(button.title,/[\u3400-\u9fff]/);assert.equal(button.textContent,'');}
}finally{f.close();}});
test('sidebar icons retain the original click handlers and share distribution commands',()=>{const f=fixture();try{
  for(const group of f.doc.querySelectorAll('.object-align')){assert.equal(group.querySelectorAll('button').length,8);group.querySelector('[data-align-objects="left"]').click();group.querySelector('[data-align-objects="distribute-y"]').click();}
  assert.deepEqual(f.commands,['left','distribute-y','left','distribute-y']);
}finally{f.close();}});
test('disabled whole-command and distribution availability mirror host state without re-enabling invalid choices',()=>{const f=fixture();try{
  f.select.querySelector('[value="distribute-x"]').disabled=true;f.select.querySelector('[value="distribute-y"]').disabled=true;f.ui.sync();
  for(const button of f.doc.querySelectorAll('[data-alignment-icon^="distribute-"]'))assert.equal(button.disabled,true);
  assert.equal(f.doc.querySelector('[data-alignment-action="left"]').disabled,false);f.select.disabled=true;f.ui.sync();assert.equal(f.doc.getElementById('quickAlignmentToggle').disabled,true);for(const button of f.doc.querySelectorAll('.object-align button'))assert.equal(button.disabled,true);
  f.select.disabled=false;f.select.querySelector('[value="distribute-x"]').disabled=false;f.ui.sync();assert.equal(f.doc.querySelector('[data-alignment-action="distribute-x"]').disabled,false);assert.equal(f.doc.querySelector('[data-alignment-action="distribute-y"]').disabled,true);
}finally{f.close();}});
test('text anchor buttons update their own select and preserve object-alignment semantics',()=>{const f=fixture();try{
  const input=f.doc.getElementById('textAlign'),group=input.nextElementSibling;assert.equal(input.hidden,true);group.querySelector('[data-text-align="middle"]').click();assert.equal(input.value,'middle');assert.deepEqual(f.commands,['textAlign:middle']);assert.equal(group.querySelector('[data-text-align="middle"]').getAttribute('aria-pressed'),'true');
  input.value='end';input.disabled=true;f.ui.sync();assert.equal(group.querySelector('[data-text-align="end"]').getAttribute('aria-pressed'),'true');assert.ok([...group.children].every(button=>button.disabled));
  f.doc.getElementById('overlayAlign').nextElementSibling.querySelector('[data-text-align="start"]').click();assert.deepEqual(f.commands,['textAlign:middle','overlayAlign:start']);
}finally{f.close();}});
test('language switching refreshes visible labels and all bilingual accessible names',()=>{const f=fixture();try{
  assert.match(f.doc.querySelector('[data-alignment-action="left"]').title,/^左对齐/);f.language('en');assert.equal(f.doc.querySelector('.alignment-popover-heading').textContent,'Align');assert.match(f.doc.querySelector('[data-alignment-action="left"]').title,/^Align left/);assert.match(f.doc.getElementById('quickAlignmentToggle').getAttribute('aria-label'),/^Align objects/);assert.match(f.doc.getElementById('textAlign').nextElementSibling.getAttribute('aria-label'),/^Text alignment/);
}finally{f.close();}});
test('keyboard menu skips disabled items and Escape restores toggle focus',()=>{const f=fixture();try{
  const toggle=f.doc.getElementById('quickAlignmentToggle'),popup=f.doc.getElementById('quickAlignmentPopover');f.select.querySelector('[value="distribute-y"]').disabled=true;f.ui.sync();toggle.focus();toggle.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement.dataset.alignmentAction,'left');f.doc.activeElement.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));assert.equal(f.doc.activeElement.dataset.alignmentAction,'distribute-x');f.doc.activeElement.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(popup.hidden,true);assert.equal(f.doc.activeElement,toggle);
}finally{f.close();}});
test('click-away, scroll and selection loss close the popover while pointer commands retain canvas focus',()=>{const f=fixture();try{
  const toggle=f.doc.getElementById('quickAlignmentToggle'),popup=f.doc.getElementById('quickAlignmentPopover'),canvas=f.doc.getElementById('viewport');canvas.tabIndex=-1;canvas.focus();toggle.click();const event=new f.dom.window.Event('pointerdown',{bubbles:true,cancelable:true});popup.querySelector('button').dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.equal(f.doc.activeElement,canvas);
  f.doc.body.dispatchEvent(new f.dom.window.Event('pointerdown',{bubbles:true}));assert.equal(popup.hidden,true);toggle.click();f.doc.getElementById('viewport').dispatchEvent(new f.dom.window.Event('scroll',{bubbles:false}));assert.equal(popup.hidden,true);toggle.click();f.select.disabled=true;f.ui.sync();assert.equal(popup.hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');
}finally{f.close();}});
test('lifecycle restores native fallback selects and bundler includes the module before its host',()=>{const f=fixture();try{
  f.ui.destroy();assert.equal(f.select.hidden,false);assert.equal(f.doc.getElementById('quickAlignmentPopover'),null);assert.equal(f.doc.getElementById('textAlign').hidden,false);
  const builder=fs.readFileSync('skills/polish-sci-figures/scripts/figure_studio.py','utf8'),bundleLines=builder.split(/\r?\n/).filter(line=>line.includes('/*__STUDIO_JS__*/'));
  assert.ok(bundleLines.length,'the builder declares its JavaScript bundle');
  const modules=Array.from(bundleLines.join('\n').matchAll(/'([^']+\.js)'/g),match=>match[1]);
  for(const name of ['alignment-icons.js','studio.js'])assert.equal(modules.filter(module=>module===name).length,1,`${name} is bundled exactly once`);
  assert.ok(modules.indexOf('alignment-icons.js')<modules.indexOf('studio.js'),'alignment icons load before the host; other modules may load between them');
}finally{f.dom.window.close();}});
console.log(`${passed} alignment icon tests passed`);
