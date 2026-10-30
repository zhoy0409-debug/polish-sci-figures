'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const experience=require('../skills/polish-sci-figures/assets/figure-studio/experience-tools.js'),drawers=require('../skills/polish-sci-figures/assets/figure-studio/drawer-workspace.js');
const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.html'),'utf8')),doc=dom.window.document;
dom.window.matchMedia=query=>({matches:query==='(min-width: 751px)'});dom.window.HTMLElement.prototype.scrollIntoView=function(){};
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
let language='zh-CN';const host={document:doc,drawerWorkspace:drawers,language:()=>language,images:()=>[],context:()=>({}),say(){}};
for(const key of ['discovery','edit','axes','export','borders','duplicates','color','links','inset','review','submissionProfiles'])host[key]=()=>{};
const original=[...doc.querySelectorAll('input[id],select[id],textarea[id],button[id]')],ui=experience.create(host),bank=ui.workbench.bank,owners=new Map();
for(const node of original){assert(node.isConnected,'Lost original control '+node.id);assert.equal(doc.getElementById(node.id),node);assert.equal(doc.querySelectorAll('[id="'+node.id+'"]').length,1);}
for(const item of ui.workbench.menus)for(const root of ui.workbench.roots(item.id)){assert(!owners.has(root),`Shared root between ${owners.get(root)} and ${item.id}: ${root.id}`);owners.set(root,item.id);}
const uncovered=[...bank.children].filter(n=>n.querySelector('input,select,textarea,button')&&!owners.has(n)&&!n.matches('.inspector-heading,.inspector-tabs')&&n.id!=='drawerFormattingTools');
assert.deepEqual(uncovered.map(n=>n.id||n.textContent.slice(0,40)),[],'Every retained functional root needs one canonical owner');
const tree=[...doc.querySelectorAll('[data-drawer-category]')];assert.equal(tree.length,6);assert.equal(doc.querySelector('[data-drawer-category="project"]'),null);
ui.openCommands();doc.querySelector('[data-category="style"]').click();assert(doc.getElementById('command-fonts'));assert.equal(doc.getElementById('command-paragraph'),null);assert.equal(doc.getElementById('command-typography'),null);
const q=doc.getElementById('commandQuery');q.value='行距';q.dispatchEvent(new dom.window.Event('input'));assert.equal(doc.querySelectorAll('#command-fonts').length,1);doc.getElementById('command-fonts').click();assert.equal(doc.activeElement.id,'para-line-height');
ui.openCommands();doc.getElementById('commandQuery').value='字体';doc.getElementById('commandQuery').dispatchEvent(new dom.window.Event('input'));doc.getElementById('command-fonts').click();assert.equal(doc.activeElement.id,'font','An exact tool label must beat a broad edit synonym and focus the actual font field');
const list=doc.querySelector('.studio-tool-list');ui.workbench.openCategory('style');const rows=[...list.children];ui.refresh();ui.refresh();assert.deepEqual([...list.children],rows,'Selection refresh must not rebuild the catalog or disturb focus');
const before=bank.querySelector('#para-line-height');ui.workbench.openTool('fonts');ui.workbench.openCategory('style');ui.workbench.openTool('fonts');assert.equal(doc.getElementById('para-line-height'),before);
language='en';ui.refresh();assert.match(doc.querySelector('.inspector .studio-drawer-heading').textContent,/Fonts/);
dom.window.close();console.log('Drawer workspace: original control identities, complete unique ownership, canonical search, retained focus and language-only refresh passed');
