/* Production axis canvas restoration under controlled renderer exceptions.
 * DOM ownership and persistence isolation only, not a scientific render. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/',Sessions=require(base+'preview-sessions.js'),Core=require(base+'studio.js'),source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8');
const from=source.indexOf('  function restoreProfessionalAxisCanvas('),to=source.indexOf('  function beginProfessionalAxisDraft(',from);assert.ok(from>=0&&to>from);
function fixture(){
 const dom=new JSDOM('<div id="viewport"><div id="artboard"><svg xmlns="http://www.w3.org/2000/svg" id="original"><text>Original chart</text></svg></div></div>'),document=dom.window.document,$=id=>document.getElementById(id),owner={id:'owner'},history=new Core.History({value:1}),original=$('original'),originalView={svg:original,zoom:.5,fit:false,width:200,height:100},messages=[];
 let clickCount=0,fail=false;original.addEventListener('click',()=>clickCount++);const box={id:'axis-fixture',owner,base:history.current,originalCanvas:original,originalView};
 const ctx={document,$,project:owner,state:()=>history.current,zoomView:originalView,previewPaintDepth:0,professionalAxisDraft:box,T:x=>x,say:value=>messages.push(value),renderCanvas(){if(fail)throw Error('Controlled canvas render failure');const svg=original.cloneNode(true);svg.id='committed';$('artboard').replaceChildren(svg);ctx.zoomView={...originalView,svg};$('viewport').scrollLeft=0;$('viewport').scrollTop=0;}};
 vm.createContext(ctx);vm.runInContext(source.slice(from,to),ctx);$('viewport').scrollLeft=37;$('viewport').scrollTop=53;
 const paint=()=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.dataset.previewSession=box.id;svg.dataset.previewKind='axes';svg.innerHTML='<text>Last valid axis draft</text>';$('artboard').replaceChildren(svg);ctx.zoomView={svg,zoom:.7};return svg;};
 return {dom,document,$,owner,history,original,originalView,box,ctx,messages,paint,fail(){fail=true;},foreign(){ctx.project={id:'new-owner'};history.commit({value:99});},get clicks(){return clickCount;},close(){dom.window.close();}};
}
async function main(){let count=0;
 {
  const f=fixture();f.paint();f.ctx.restoreProfessionalAxisCanvas(f.box,'cancel');assert.equal(f.$('artboard').firstElementChild.id,'committed');assert.equal(f.ctx.professionalAxisDraft,null);assert.equal(f.ctx.previewPaintDepth,0);assert.equal(f.$('viewport').scrollLeft,37);assert.equal(f.$('viewport').scrollTop,53);assert.equal(f.history.index,0);f.close();count++;
 }
 {
  const f=fixture();f.paint();f.fail();assert.throws(()=>f.ctx.restoreProfessionalAxisCanvas(f.box,'cancel'),/Controlled canvas/);assert.equal(f.$('artboard').firstElementChild,f.original,'the actual original node and its event handlers survive');assert.equal(f.ctx.zoomView,f.originalView);f.original.dispatchEvent(new f.dom.window.Event('click'));assert.equal(f.clicks,1);assert.equal(f.ctx.professionalAxisDraft,null);assert.equal(f.ctx.previewPaintDepth,0);assert.equal(f.$('viewport').scrollLeft,37);assert.equal(f.$('viewport').scrollTop,53);assert.match(f.messages[0],/Controlled canvas render failure/);assert.equal(f.history.index,0);f.close();count++;
 }
 {
  const f=fixture(),foreign=f.document.createElementNS('http://www.w3.org/2000/svg','svg');foreign.id='new-project';f.paint();f.$('artboard').append(foreign);f.foreign();f.fail();assert.throws(()=>f.ctx.restoreProfessionalAxisCanvas(f.box,'context-changed'),/Controlled canvas/);assert.equal(f.$('artboard').firstElementChild,foreign);assert.equal(f.$('artboard').children.length,1);assert.equal(f.original.isConnected,false,'an old project cannot be restored into a new project');assert.equal(f.ctx.professionalAxisDraft,null);assert.equal(f.history.current.value,99);f.close();count++;
 }
 {
  const f=fixture();let commits=0;const manager=Sessions.create({identity:()=>[f.ctx.project,f.history.current],requestFrame:()=>1,cancelFrame(){}}),session=manager.begin({kind:'axes',originalValue:1,render:()=>f.paint(),restore:reason=>f.ctx.restoreProfessionalAxisCanvas(f.box,reason),commit(){commits++;f.history.commit({value:2});return true;}});session.update(2);session.flush();f.fail();assert.equal(await session.commit(),false);assert.equal(commits,0);assert.equal(f.history.index,0);assert.equal(session.status,'error');assert.match(session.error,/Controlled canvas/);assert.equal(f.ctx.professionalAxisDraft,f.box,'failed commit retains a cancellable draft');session.cancel('cancel');assert.equal(f.$('artboard').firstElementChild,f.original);assert.equal(f.ctx.professionalAxisDraft,null);assert.equal(manager.active,null);assert.equal(f.ctx.previewPaintDepth,0);f.close();count++;
 }
 console.log(`PASS ${count} production axis canvas restore guards: original node/view/scroll, foreign owner isolation, explicit error and failed commit without persistence.`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
