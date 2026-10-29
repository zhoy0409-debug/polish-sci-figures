'use strict';
// Actual document bindings, toolbar handlers and History; no replacement key handler.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js',api=require(file),source=fs.readFileSync(require.resolve(file),'utf8');
function harness(){
  const dom=new JSDOM('<body><div id="viewport" tabindex="0"></div><input id="field"><textarea></textarea><select><option>Value</option></select><div contenteditable="true"></div><div role="textbox"></div><button id="undo"></button><button id="redo"></button></body>',{pretendToBeVisual:true});
  const document=dom.window.document,$=id=>document.getElementById(id),science={table:{rows:[['sample','value'],['S1','2.5']]},analysis:{unit:'confirmed biological sample',result:{P:.032}}};
  const history=new api.History({text:'实验组',science});history.commit({text:'对照组',science});let persists=0;
  const render=()=>{$('viewport').textContent=history.current.text;$('undo').disabled=history.index===0;$('redo').disabled=history.index===history.states.length-1;};
  const ctx={...api,document,$,history,render,persist(){persists++;},say(){},T:x=>x,selected:[],original:false,selectionGroups:()=>[],selectedAlignmentGuide:null,selectedAnnotations:[],selectedPanelLabel:null,panelSelection:[],selectedEmptyCell:null};
  vm.createContext(ctx);
  const lines=source.split('\n'),bindings=[lines.find(l=>l.includes("document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]")),...lines.filter(l=>l.includes("$('undo').onclick=")||l.includes("$('redo').onclick=")),lines.find(l=>l.includes("document.addEventListener('keydown',e=>{if(e.isComposing||editingTextTarget"))];
  assert.ok(bindings.every(Boolean));vm.runInContext(bindings.join('\n'),ctx);render();
  const press=(key,options={},target=$('viewport'))=>{const event=new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options});target.dispatchEvent(event);return event;};
  return {dom,document,$,history,science,press,get persists(){return persists;},close:()=>dom.window.close()};
}
{
  const h=harness();try{
    h.press('z',{ctrlKey:true});assert.equal(h.$('viewport').textContent,'实验组');
    h.press('y',{ctrlKey:true});assert.equal(h.$('viewport').textContent,'对照组','Windows Ctrl+Y must redo a confirmed text edit');
    assert.equal(h.history.states.length,2,'Undo/Redo must not create another history state');assert.deepEqual(h.history.current.science,h.science);
    h.press('Z',{ctrlKey:true});h.press('Z',{ctrlKey:true,shiftKey:true});assert.equal(h.history.index,1,'Ctrl+Shift+Z remains available');
    h.press('z',{metaKey:true});h.press('z',{metaKey:true,shiftKey:true});assert.equal(h.history.index,1,'Cmd+Shift+Z remains available');
    h.$('undo').click();h.$('redo').click();assert.equal(h.history.index,1,'Toolbar uses the same history');
    h.press('z',{ctrlKey:true});h.history.commit({text:'新分支',science:h.science});h.$('redo').disabled=true;h.press('y',{ctrlKey:true});assert.equal(h.history.current.text,'新分支','Redo cannot resurrect discarded branches');
  }finally{h.close();}
}
for(const selector of ['input','textarea','select','[contenteditable]','[role=textbox]']){
  const h=harness();try{h.$('undo').click();const before=h.persists,e=h.press('y',{ctrlKey:true},h.document.querySelector(selector));assert.equal(e.defaultPrevented,false,selector+' retains native input shortcuts');assert.equal(h.history.index,0);assert.equal(h.persists,before);}finally{h.close();}
}
for(const options of [{ctrlKey:true,isComposing:true},{ctrlKey:true,keyCode:229},{ctrlKey:true,altKey:true},{ctrlKey:true,shiftKey:true},{metaKey:true},{}]){
  const h=harness();try{h.$('undo').click();const e=h.press('y',options);assert.equal(e.defaultPrevented,false,JSON.stringify(options));assert.equal(h.history.index,0);}finally{h.close();}
}
{
  const h=harness();try{
    h.$('undo').click();const modal=h.document.createElement('dialog');modal.setAttribute('open','');h.document.body.append(modal);
    const e=h.press('y',{ctrlKey:true});assert.equal(e.defaultPrevented,true,'Modal prevents commands behind it');assert.equal(h.history.index,0);modal.remove();
    h.$('viewport').addEventListener('keydown',e=>e.preventDefault(),{once:true});h.press('y',{ctrlKey:true});assert.equal(h.history.index,0,'Already handled shortcuts do not leak into project history');
  }finally{h.close();}
}
console.log('PASS Windows Ctrl+Y, Ctrl/Cmd+Shift+Z, actual toolbar/history, input/IME/AltGr/modal guards and discarded-branch preservation');
