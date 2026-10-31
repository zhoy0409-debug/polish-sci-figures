'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const experience=require('../skills/polish-sci-figures/assets/figure-studio/experience-tools.js');
const source=fs.readFileSync(path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.html'),'utf8');
const dom=new JSDOM(source),doc=dom.window.document;dom.window.matchMedia=()=>({matches:true});dom.window.HTMLElement.prototype.scrollIntoView=function(){};
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const originalFields=new Map([...doc.querySelectorAll('input[id],select[id],textarea[id],button[id]')].map(n=>[n.id,n]));let language='zh-CN';
const host={document:doc,language:()=>language,say(){},images:()=>[],context:()=>({selected:false}),discovery(){},edit(){},axes(){},export(){},borders(){},duplicates(){},color(){},links(){},inset(){},review(){},submissionProfiles(){}};
const ui=experience.create(host);
for(const [id,node]of originalFields){assert.equal(doc.getElementById(id),node,id+' must retain the original node, value and event bindings');assert.equal(doc.querySelectorAll('[id="'+id+'"]').length,1,id+' must not be cloned');}
assert.equal(doc.getElementById('workspaceLayout').open,false);assert.equal(doc.getElementById('typePanel').parentElement,doc.querySelector('.inspector'),'image tool mounting still uses the same inspector parent');
assert.equal(doc.getElementById('paragraphPanel').open,false);assert.equal(doc.getElementById('componentStyle').open,false);
const seen=new Set();for(const action of ui.actions){assert(!seen.has(action.id));seen.add(action.id);assert(action.category);if(action.target)assert(doc.getElementById(action.target),'No nonexistent search target: '+action.id);}
for(const [id,category]of [['rectify','image'],['color','image'],['colour-lines','style'],['scale-bar','annotation'],['statistics','data'],['axes','data'],['history-redo','project']])assert.equal(ui.actions.find(a=>a.id===id).category,category);
ui.openCommands();doc.querySelector('[data-category="style"]').click();assert(doc.getElementById('command-fonts'));assert(doc.getElementById('command-paragraph'));assert(doc.getElementById('command-border'));assert.equal(doc.getElementById('command-color'),null,'Photo pixel display is not object paint');
doc.querySelector('[data-category="image"]').click();assert(doc.getElementById('command-rectify'));assert(doc.getElementById('command-color'));assert.equal(doc.getElementById('command-scale-bar'),null,'Physical calibration is separate from a straightening ruler');
const query=doc.getElementById('commandQuery');query.value='图间距';query.dispatchEvent(new dom.window.Event('input'));assert(doc.getElementById('command-layout'));doc.getElementById('command-layout').click();assert.equal(doc.getElementById('workspaceLayout').open,true);assert.equal(doc.activeElement.id,'rows');
language='en';ui.refresh();assert.equal(doc.getElementById('workspaceLayout').firstElementChild.textContent,'Layout & spacing');ui.openCommands();doc.querySelector('[data-category="style"]').click();assert.match(doc.querySelector('#command-fonts').closest('section').querySelector('h3').textContent,/Text & object style/);assert.equal(doc.querySelector('#command-fonts .command-path'),null,'Category heading already supplies the path; do not repeat the tool name');
doc.getElementById('commandDialog').close();doc.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'k',ctrlKey:true,isComposing:true,bubbles:true,cancelable:true}));assert.equal(doc.getElementById('commandDialog').open,false,'Composition must not trigger function search');
dom.window.close();console.log('Workspace hierarchy: original control identities, real targets, task categories, direct reveal, bilingual paths and composition guard passed');
