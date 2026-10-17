/* Uses real SVG text attributes and the shared lifecycle. This is a DOM
 * correctness fixture, not a browser font-layout or latency measurement. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/';
const UI=require(base+'text-tools-ui.js'),Format=require(base+'text-formatting.js'),Sessions=require(base+'preview-sessions.js');
function fixture(){
  const dom=new JSDOM('<html lang="en"><body><div id="tools"></div><svg xmlns="http://www.w3.org/2000/svg"><text id="a" x="0 6 12" y="10" font-size="10">ABC</text><text id="b" x="0 6 12" y="20" font-size="10">XYZ</text></svg></body></html>'),doc=dom.window.document;
  let epoch=0,serial=0,selected='a',language='en',accepted=true,applyResult=true,replaceBoard=false,api;
  const frames=new Map(),calls=[],frame=fn=>{frames.set(++serial,fn);return serial;},unframe=id=>frames.delete(id),item=id=>({kind:'element',id:'p',vi:0,key:id,identity:'p/0/'+id,el:doc.getElementById(id)});
  const manager=Sessions.create({identity:()=>[epoch,selected],requestFrame:frame,cancelFrame:unframe,beforeBegin(){if(replaceBoard){replaceBoard=false;const svg=doc.querySelector('svg');svg.replaceWith(svg.cloneNode(true));}}});
  api=UI.create({toolbar:doc.getElementById('tools'),selected:()=>[item(selected)],language:()=>language,t:x=>x,previewSessions:manager,requestFrame:frame,cancelFrame:unframe,captureOptions:()=>({pointFactor:2}),valid:()=>accepted,
    apply(items,plans){calls.push({items,plans});if(applyResult===false)return false;for(let i=0;i<items.length;i++)for(const [key,value]of Object.entries(plans[i].props))Format.applySpacing(items[i].el,{[key==='letter-spacing'?'letterSpacing':'lineHeight']:+value});epoch++;api.sync();return true;}});
  const field=name=>doc.querySelector('[name="'+name+'"]'),input=(name,value)=>{const el=field(name);el.value=value;el.dispatchEvent(new dom.window.Event('input'));return el;};
  return {dom,doc,api,manager,calls,item,field,input,get epoch(){return epoch;},open(){doc.querySelector('.text-spacing-toggle').click();},flush(){while(frames.size){const [id,fn]=frames.entries().next().value;frames.delete(id);fn();}},change(name){field(name).dispatchEvent(new dom.window.Event('change'));},blur(name){field(name).dispatchEvent(new dom.window.Event('blur'));},key(name,key){field(name).dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true}));},select(id){selected=id;epoch++;manager.sync();api.sync();},locale(value){language=value;api.refresh();},rejectCommit(){applyResult=false;},replaceBoardOnBegin(){replaceBoard=true;},lock(){accepted=false;manager.sync();api.sync();},finish(){api.destroy();dom.window.close();}};
}
async function settle(){await new Promise(resolve=>setImmediate(resolve));}
async function main(){
  let count=0;
  {
    const f=fixture(),text=f.item('a').el,before=text.outerHTML;f.open();f.input('letterSpacing','2');f.input('letterSpacing','4');assert.equal(f.calls.length,0);assert.equal(f.epoch,0);f.flush();const last=text.outerHTML;assert.notEqual(last,before);assert.equal(text.getAttribute('x'),'0 8 16');
    f.input('letterSpacing','');assert.equal(text.outerHTML,last);assert.equal(f.manager.active.status,'error');f.change('letterSpacing');f.blur('letterSpacing');f.key('letterSpacing','Enter');await settle();assert.equal(f.calls.length,0);assert.equal(text.outerHTML,last);assert.equal(f.field('letterSpacing').getAttribute('aria-invalid'),'true');
    f.locale('zh-CN');assert.equal(f.field('letterSpacing').value,'');assert.equal(f.field('letterSpacing').getAttribute('aria-invalid'),'true');assert.match(f.doc.querySelector('.text-spacing-status').textContent,/保留上次有效预览/);f.api.cancel();assert.equal(text.outerHTML,before);assert.equal(f.manager.active,null);f.finish();count++;
  }
  {
    const f=fixture(),text=f.item('a').el;f.open();f.input('letterSpacing','2');f.flush();f.input('lineHeight','0');f.input('letterSpacing','6');const last=text.outerHTML;assert.equal(text.getAttribute('x'),'0 9 18');f.blur('letterSpacing');await settle();assert.equal(f.calls.length,0);assert.equal(text.outerHTML,last);
    f.input('lineHeight','1.5');f.flush();f.key('lineHeight','Enter');f.change('lineHeight');f.blur('lineHeight');await settle();assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0].plans[0].props,{'letter-spacing':'3','line-height':'1.5'});assert.equal(f.manager.active,null);assert.equal(f.epoch,1);f.finish();count++;
  }
  {
    const f=fixture(),a=f.item('a').el,before=a.outerHTML;f.open();f.input('letterSpacing','6');f.flush();f.select('b');f.flush();assert.equal(a.outerHTML,before);assert.equal(f.calls.length,0);assert.equal(f.manager.active,null);f.change('letterSpacing');f.blur('letterSpacing');await settle();assert.equal(f.calls.length,0);f.finish();count++;
  }
  {
    const f=fixture(),a=f.item('a').el,before=a.outerHTML;let restored=0;f.manager.begin({kind:'other',render(){},restore(){restored++;},commit(){throw Error('must not commit');}});f.open();f.input('letterSpacing','4');f.flush();assert.equal(restored,1);assert.equal(f.manager.active.kind,'text-spacing');f.lock();f.flush();assert.equal(a.outerHTML,before);assert.equal(f.calls.length,0);assert.equal(f.manager.active,null);f.finish();count++;
  }
  {
    const f=fixture(),a=f.item('a').el,before=a.outerHTML;f.open();f.input('letterSpacing','4');f.flush();const last=a.outerHTML;f.rejectCommit();f.change('letterSpacing');await settle();assert.equal(f.calls.length,1);assert.equal(a.outerHTML,last);assert.equal(f.manager.active.status,'error');assert.equal(f.doc.querySelector('.text-tools').dataset.previewState,'error');assert.equal(f.doc.querySelector('.text-spacing-status').hidden,false);f.api.cancel();assert.equal(a.outerHTML,before);f.finish();count++;
  }
  {
    const f=fixture(),old=f.item('a').el,before=old.outerHTML;f.replaceBoardOnBegin();f.open();f.input('letterSpacing','4');f.flush();const live=f.item('a').el;assert.notEqual(live,old);assert.equal(old.outerHTML,before);assert.equal(live.getAttribute('x'),'0 8 16');f.api.cancel();assert.equal(live.outerHTML,before);assert.equal(f.calls.length,0);f.finish();count++;
  }
  console.log(`PASS ${count} shared text-spacing preview isolation, last-valid, invalid blur, one-commit and context tests.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
