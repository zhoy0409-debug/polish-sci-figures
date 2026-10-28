'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const tools=require('../skills/polish-sci-figures/assets/figure-studio/experience-tools.js');
const dom=new JSDOM('<body><header class="toolbar"></header><main class="workspace"><div id="canvasQuickToolbar"></div><div id="artboard"><svg><image data-key="e1"/><image data-key="e2"/></svg></div><button id="openObjectBorder"></button><button id="openImageTools"></button></main></body>');
const doc=dom.window.document;
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
let lang='zh',messages=[],calls=[],images=[],context={selected:true,image:false};
const invoke=id=>(...args)=>calls.push([id,...args]);
const ui=tools.create({document:doc,language:()=>lang,say:m=>messages.push(m),images:()=>images,selectedImage:()=>null,selectImage:invoke('select'),context:()=>context,duplicateStatus:()=>({state:'idle'}),discovery:invoke('discovery'),edit:invoke('edit'),axes:invoke('axes'),export:invoke('export'),review:invoke('review'),submissionProfiles:invoke('submission-profile'),borders:invoke('borders'),duplicates:invoke('duplicates'),color:invoke('color'),links:invoke('links'),inset:invoke('inset')});
assert.equal(doc.querySelectorAll('[data-workflow]').length,5);
assert.equal(doc.getElementById('imageScreeningHint').hidden,false);
assert.equal(calls.length,0,'rendering the multi-image hint never starts a scan');
context={selected:true,image:true};ui.refresh();for(const id of ['quickImageDisplay','quickImageDuplicates','quickImageLinks'])assert.ok(doc.getElementById(id),'image selection exposes '+id);
context={selected:true,image:false};ui.refresh();assert.equal(doc.getElementById('quickImageDisplay'),null,'non-image selection removes image-only actions');
doc.getElementById('imageScreeningHint').click();
assert.deepEqual(calls.pop(),['duplicates','all']);
ui.openCommands();const query=doc.getElementById('commandQuery');query.value='给病理图加边框';query.dispatchEvent(new dom.window.Event('input'));
assert.ok(doc.getElementById('command-border'),'ordinary-language Chinese finds the border command');
doc.getElementById('command-border').click();assert.deepEqual(calls.pop(),['borders']);
for(const [term,id]of [['图形质检','review'],['投稿配置','submission-profile']]){ui.openCommands();const q=doc.getElementById('commandQuery');q.value=term;q.dispatchEvent(new dom.window.Event('input'));assert.ok(doc.getElementById('command-'+id),term+' must find its actual entry');doc.getElementById('command-'+id).click();assert.deepEqual(calls.pop(),[id]);}
for(const [term,id]of [['WB','rectify'],['荧光','images']]){ui.openCommands();const q=doc.getElementById('commandQuery');q.value=term;q.dispatchEvent(new dom.window.Event('input'));assert.ok(doc.getElementById('command-'+id),term+' should find the existing scientific image tool, without advertising a new detector');if(term==='荧光')assert.equal(doc.getElementById('command-color'),null,'Fluorescence search must not directly suggest the generic photo-colour action');doc.getElementById('commandDialog').close();}
ui.openImages();doc.getElementById('imageTool-duplicates').click();assert.deepEqual(calls.pop(),['duplicates','files'],'empty workspace offers explicit local-file/demo flow');
ui.openImages();doc.getElementById('imageTool-color').click();assert.match(doc.querySelector('#imageTool-color').parentElement.textContent,/请先导入图片/);assert.equal(calls.length,0);
doc.getElementById('imageToolsDialog').close();lang='en';ui.refresh();
assert.equal(doc.getElementById('openObjectBorder').textContent,'Object borders');
assert.equal(doc.getElementById('openImageTools').textContent,'Image tools');
doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));
assert.equal(doc.getElementById('commandDialog').open,true);assert.equal(doc.getElementById('commandQuery').getAttribute('aria-label'),'Search commands');
for(const [term,id]of [['figure review','review'],['submission profile','submission-profile']]){ui.openCommands();const q=doc.getElementById('commandQuery');q.value=term;q.dispatchEvent(new dom.window.Event('input'));assert.ok(doc.getElementById('command-'+id),'English search: '+term);doc.getElementById('command-'+id).click();assert.deepEqual(calls.pop(),[id]);}
doc.getElementById('commandDialog').close();doc.querySelectorAll('#artboard image').forEach(n=>n.remove());ui.refresh();assert.equal(doc.getElementById('imageScreeningHint').hidden,true);
assert.deepEqual(messages,[]);console.log('Experience navigation, local search, bilingual context and explicit scan-entry regression passed');
