'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const theme=require('../skills/polish-sci-figures/assets/figure-studio/theme-controller.js');
const html=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.html','utf8');
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
function fixture(preference, storage){
  const dom=new JSDOM(html,{url:'http://127.0.0.1:18961',pretendToBeVisual:true}),doc=dom.window.document;
  if(preference)dom.window.localStorage.setItem(theme.storageKey,JSON.stringify(preference));
  let language='zh-CN';const options={document:doc,language:()=>language};if(storage!==undefined)options.storage=storage;
  const ui=theme.mount(options);return {dom,doc,ui,language:value=>{language=value;ui.refresh();},close:()=>{ui.destroy();dom.window.close();}};
}
(async()=>{
  await test('default Carbon and persisted Pearl use device appearance without project writes',()=>{const f=fixture();try{
    const scientific=f.doc.getElementById('project').textContent;
    assert.equal(f.doc.documentElement.dataset.theme,'carbon');
    f.doc.getElementById('studioTheme').value='pearl';f.doc.getElementById('studioTheme').dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(f.doc.documentElement.dataset.theme,'pearl');
    assert.deepEqual(JSON.parse(f.dom.window.localStorage.getItem(theme.storageKey)),{theme:'pearl',surround:'neutral'});
    assert.equal(f.doc.getElementById('project').textContent,scientific);
    assert.equal(f.dom.window.localStorage.length,1);
    const reloaded=fixture(JSON.parse(f.dom.window.localStorage.getItem(theme.storageKey)));try{assert.equal(reloaded.doc.documentElement.dataset.theme,'pearl');}finally{reloaded.close();}
  }finally{f.close();}});
  await test('surround is separate from theme and survives switch while source artwork stays intact',()=>{const f=fixture();try{
    const svg=f.doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.innerHTML='<rect width="10" height="10" fill="#49c3a5"/><text fill="#102030">sample</text>';
    f.doc.getElementById('artboard').append(svg);const before=svg.outerHTML;
    f.ui.update({surround:'dark'});f.ui.update({theme:'pearl'});
    assert.equal(f.doc.documentElement.dataset.canvasSurround,'dark');assert.equal(svg.outerHTML,before);
    assert.deepEqual(theme.normalize({theme:'unknown',surround:'invalid'}),{theme:'carbon',surround:'neutral'});
  }finally{f.close();}});
  await test('storage denial applies preference and tells the truth about persistence',()=>{const f=fixture(null,{getItem(){throw Error('denied');},setItem(){throw Error('denied');}});try{
    f.ui.update({theme:'pearl'});assert.equal(f.doc.documentElement.dataset.theme,'pearl');
    assert.equal(f.doc.querySelector('.appearance-feedback').dataset.state,'warning');
    assert.match(f.doc.querySelector('.appearance-feedback').textContent,/未能保存/);
  }finally{f.close();}});
  await test('context changes expand one relevant existing group and preserve manual expansion until kind changes',()=>{const f=fixture();try{
    f.ui.selection({kind:'text',count:1});assert.equal(f.doc.getElementById('paragraphPanel').open,true);assert.equal(f.doc.getElementById('componentStyle').open,false);
    f.doc.getElementById('componentStyle').open=true;f.ui.selection({kind:'text',count:2});assert.equal(f.doc.getElementById('componentStyle').open,true);
    f.ui.selection({kind:'image',count:1});assert.equal(f.doc.getElementById('paragraphPanel').open,false);assert.equal(f.doc.getElementById('componentStyle').open,false);
    assert.equal(f.doc.getElementById('inspectorSelectionKind').textContent,'图片');
    f.language('en');assert.equal(f.doc.getElementById('inspectorSelectionKind').textContent,'Image');
  }finally{f.close();}});
  await test('header mirrors real title and discrete save states without inventing saved state',async()=>{const f=fixture();try{
    const status=f.doc.getElementById('autosaveStatus'),flush=()=>new Promise(resolve=>setTimeout(resolve,0));
    f.doc.getElementById('projectTitle').textContent='Real local figure';status.textContent='正在保存…';await flush();
    assert.equal(f.doc.getElementById('headerProjectTitle').textContent,'Real local figure');assert.equal(status.dataset.saveState,'saving');
    status.textContent='自动保存失败 · 请下载工程';await flush();assert.equal(status.dataset.saveState,'error');assert.equal(f.doc.querySelector('.project-identity').dataset.saveState,'error','the styled parent must carry the actual failure state');
    status.textContent='已自动保存 · 含撤销记录';await flush();assert.equal(status.dataset.saveState,'saved');
    status.textContent='其他窗口已更新 · 请先下载当前工程';await flush();assert.equal(status.dataset.saveState,'conflict');
    status.textContent='';await flush();assert.equal(status.dataset.saveState,'idle');
  }finally{f.close();}});
  await test('drawer selections preserve explicit disclosure choices across object kinds',()=>{const f=fixture();try{
    f.doc.body.classList.add('studio-drawers');const paragraph=f.doc.getElementById('paragraphPanel');paragraph.open=false;
    f.ui.selection({kind:'text',count:1});assert.equal(paragraph.open,false,'Selecting text must not expand advanced paragraph settings');
    paragraph.open=true;f.ui.selection({kind:'image',count:1});f.ui.selection({kind:'text',count:1});assert.equal(paragraph.open,true,'Explicit expansion must survive selection changes');
  }finally{f.close();}});
  await test('appearance menu supports Escape and restores existing status node on teardown',()=>{const f=fixture();try{
    const menu=f.doc.getElementById('appearanceMenu');menu.open=true;f.doc.getElementById('studioTheme').focus();
    f.doc.getElementById('studioTheme').dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(menu.open,false);
    assert.equal(f.doc.activeElement,menu.querySelector('summary'));
  }finally{f.close();}});
  console.log(`${passed} theme controller tests passed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
