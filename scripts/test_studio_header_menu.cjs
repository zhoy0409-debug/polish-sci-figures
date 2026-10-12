/* Exercise production disclosure menus without duplicating the menu logic. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8');
const start=source.indexOf('function bindHeaderMenus(root){'),end=source.indexOf("\nif (typeof document !== 'undefined')",start);
assert.ok(start>=0&&end>start);
let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
class Item{
  constructor(menu,kind){this.menu=menu;this.kind=kind;this.disabled=false;}
  closest(selector){return selector==='button'&&this.kind==='button'?this:selector==='header .header-menu'?this.menu:null;}
  focus(){root.activeElement=this;}
}
class Menu{
  constructor(){this.open=false;this.listeners={};this.summary=new Item(this,'summary');this.buttons=Array.from({length:3},()=>new Item(this,'button'));}
  addEventListener(name,handler,capture){this.listeners[name]={handler,capture};}
  querySelector(selector){assert.equal(selector,'summary');return this.summary;}
  querySelectorAll(){return this.buttons.filter(button=>!button.disabled);}
  emit(name,event){this.listeners[name].handler(event);}
}
const menus=[new Menu(),new Menu()],listeners={};
const root={activeElement:null,dialog:false,querySelectorAll:()=>menus,querySelector:()=>root.dialog?{}:null,addEventListener(name,handler,capture){listeners[name]={handler,capture};}};
const context={};vm.runInNewContext(source.slice(start,end),context);context.bindHeaderMenus(root);
const key=(value)=>({key:value,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
menus[0].open=true;menus[1].open=true;menus[1].emit('toggle');eq(menus.map(menu=>menu.open),[false,true],'Opening one disclosure closes its peer');
root.activeElement=menus[0].summary;menus[0].emit('keydown',key('ArrowDown'));eq(menus.map(menu=>menu.open),[true,false]);eq(root.activeElement,menus[0].buttons[0]);
menus[0].buttons[1].disabled=true;menus[0].emit('keydown',key('ArrowDown'));eq(root.activeElement,menus[0].buttons[2],'Arrow navigation skips disabled exports');
menus[0].emit('keydown',key('ArrowDown'));eq(root.activeElement,menus[0].buttons[0]);
menus[0].emit('keydown',key('ArrowUp'));eq(root.activeElement,menus[0].buttons[2]);
menus[0].emit('keydown',key('Home'));eq(root.activeElement,menus[0].buttons[0]);
menus[0].emit('keydown',key('End'));eq(root.activeElement,menus[0].buttons[2]);
const escape=key('Escape');listeners.keydown.handler(escape);eq(menus[0].open,false);eq(root.activeElement,menus[0].summary);eq([escape.prevented,escape.stopped],[true,true]);eq(listeners.keydown.capture,true);
menus[1].open=true;root.dialog=true;const modalEscape=key('Escape');listeners.keydown.handler(modalEscape);eq(menus[1].open,true);eq(modalEscape.prevented,undefined,'Open dialogs retain their own Escape handler');root.dialog=false;
listeners.pointerdown.handler({target:menus[1].summary});eq(menus[1].open,true,'Pointer inside keeps the disclosure open');
listeners.pointerdown.handler({target:{closest:()=>null}});eq(menus[1].open,false,'Pointer outside dismisses');
menus[0].open=true;menus[0].emit('click',{target:menus[0].buttons[1]});eq(menus[0].open,true,'Disabled actions remain inert');
menus[0].emit('click',{target:menus[0].buttons[0]});eq(menus[0].open,false);eq(root.activeElement,menus[0].summary);eq(menus[0].listeners.click.capture,true,'Dismiss before the existing action handler opens a dialog');
const html=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.html','utf8'),header=html.slice(html.indexOf('<header>'),html.indexOf('</header>'));
const css=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.css','utf8'),splitCss=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/workspace-layout.css','utf8');
const headerLayer=Number(css.match(/body>header\{[^}]*z-index:(\d+)/)?.[1]),splitLayer=Number(splitCss.match(/\.workspace-splitter\{[^}]*z-index:(\d+)/)?.[1]);
eq(headerLayer>splitLayer,true,'Header disclosures must paint above the pane resize handles');
eq([...header.matchAll(/<summary role="button">/g)].length,2,'Native disclosure controls expose an explicit accessible button role');
for(const id of ['language','undo','redo','compare','reset','openLibrary','newProject','save','load','export','png','tiff','autosaveStatus'])eq([...header.matchAll(new RegExp(`id="${id}"`,'g'))].length,1,`${id} keeps one original action target`);
const i18n=require('../skills/polish-sci-figures/assets/figure-studio/i18n.js');
for(const lang of ['en','zh-CN','en']){i18n.setLanguage(lang);for(const [cn,en]of [['撤销','Undo'],['重做','Redo'],['项目','Project'],['保存','Save'],['导出','Export'],['对照原图','Compare']])eq(i18n.t(cn),lang==='en'?en:cn);}
console.log(`PASS header menus: ${checks} assertions; mutual dismissal, keyboard navigation, disabled actions, capture ordering, dialog Escape, stable action IDs and bilingual labels.`);
