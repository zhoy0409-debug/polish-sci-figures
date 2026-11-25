'use strict';
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert}=H,[,,url,outArg,mode='candidate']=process.argv,out=path.resolve(outArg);assert(outArg);
fs.mkdirSync(out,{recursive:true});
const fixture={href:'data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'fixtures/feedback-five-image.png')).toString('base64')};
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="500pt" height="300pt" viewBox="0 0 500 300"><image width="320" height="160" href="${fixture.href}"/><text x="30" y="230" font-family="Arial" font-size="20">Reference</text></svg>`;
const report={author:'a',mode,url,synthetic:true,cases:[]};
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:process.env.STUDIO_TIFF_BROWSER||'chrome'})});
async function run(name,action){
 const {context,page,errors,remote}=await H.browserPage(browser,{viewport:{width:1600,height:1000}}),result={name};
 try{await page.goto(url);await page.waitForFunction(()=>!document.body.inert);await page.locator('#language').selectOption('zh-CN');await H.newProject(page,'SYNTHETIC feedback '+name);await H.loadSvg(page,svg,'SYNTHETIC-'+name+'.svg');await action(page,result);result.errors=errors;result.remote=remote;assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);result.completed=true;}
 catch(e){result.error=e.message;result.completed=false;console.log(JSON.stringify(result));}
 finally{await page.screenshot({path:path.join(out,name+'.png'),timeout:5000,animations:'disabled'}).catch(()=>{});report.cases.push(result);console.log(JSON.stringify(result));await context.close();}
}
async function annotations(page){await page.locator('#drawerTaskbar [data-drawer-category="annotation"]').click();await page.locator('[data-drawer-tool="annotations"]').click();}
async function addText(page,value){
 await annotations(page);await page.locator('#overlayType').selectOption('text');const board=await page.locator('#artboard>svg').boundingBox();
 await page.mouse.click(board.x+board.width*.4,board.y+board.height*.65);
 const input=page.locator('.canvas-text-editor');await input.waitFor();await input.fill(value);await input.press('Enter');
 await page.waitForFunction(text=>[...document.querySelectorAll('[data-annotation] text')].some(n=>n.textContent===text),value);
 return page.locator('[data-annotation] text').filter({hasText:value});
}
await run('calibration',async(page,r)=>{
 const image=page.locator('#artboard image[data-key]');await image.click();await H.revealTool(page,'imageInsetsControls');if(await page.locator('#imageToolsDialog[open]').count()){await page.locator('#imageTool-inset').click();await page.keyboard.press('Escape');}await page.locator('#imageInsetsControls .inset-calibrate').click();
 await page.waitForFunction(()=>document.querySelector('#viewport').style.cursor==='crosshair');const box=await image.boundingBox();
 await page.mouse.move(box.x+box.width*.3,box.y+box.height*.2);await page.mouse.down();await page.mouse.move(box.x+box.width*.3,box.y+box.height*.8,{steps:5});
 r.guide=await page.locator('[data-inset-gesture] polyline').getAttribute('points');await page.mouse.up();
 try{await page.locator('.image-insets-dialog[open]').waitFor({timeout:1500});r.verticalDialog=true;r.pixelText=await page.locator('.image-insets-dialog').innerText();await page.screenshot({path:path.join(out,'calibration-preview.png')});await page.locator('.image-insets-dialog input').fill('24');await page.locator('.image-insets-dialog button.primary').click();const saved=await H.save(page);r.calibrations=saved.state.panels[saved.state.order[0]].imageCalibrations;assert(Math.abs(Object.values(r.calibrations[0])[0]-80)<.001);await page.locator('#undo').click();assert(!(await H.save(page)).state.panels[saved.state.order[0]].imageCalibrations);await H.loadProject(page,saved);assert.deepEqual((await H.save(page)).state,saved.state);}
 catch(e){r.verticalDialog=false;if(mode!=='baseline')throw e;}
});
await run('spaces',async(page,r)=>{
 const text=page.locator('#artboard text[data-key]').filter({hasText:'Reference'});await text.dblclick();const input=page.locator('.canvas-text-editor');await input.fill('A   B  C');await input.press('Enter');
 r.native=await page.locator('#artboard text[data-key]').filter({hasText:'A   B  C'}).evaluate(n=>({text:n.textContent,chars:n.getNumberOfChars(),space:n.getAttribute('xml:space'),style:n.style.whiteSpace}));
 const annotation=await addText(page,'A   B  C');r.annotation=await annotation.evaluate(n=>({text:n.textContent,chars:n.getNumberOfChars(),space:n.getAttribute('xml:space'),style:n.style.whiteSpace}));
 if(mode!=='baseline'){assert.equal(r.native.chars,8);assert.equal(r.annotation.chars,8);const saved=await H.save(page),svg=await H.exportBytes(page,'export');assert.match(svg.toString(),/xml:space="preserve"/);await H.loadProject(page,saved);assert.deepEqual((await H.save(page)).state,saved.state);assert.equal(await page.locator('#artboard [data-annotation] text').evaluate(n=>n.getNumberOfChars()),8);}
});
await run('arrows',async(page,r)=>{
 r.options=await page.locator('#overlayType option').evaluateAll(nodes=>nodes.map(n=>n.value));
 if(!r.options.includes('arrow')){assert.equal(mode,'baseline');return;}
 await annotations(page);await page.locator('#overlayType').selectOption('arrow');const board=await page.locator('#artboard>svg').boundingBox();
 await page.mouse.move(board.x+board.width*.35,board.y+board.height*.3);await page.mouse.down();await page.mouse.move(board.x+board.width*.6,board.y+board.height*.5,{steps:4});await page.mouse.up();
 r.heads=await page.locator('#artboard [data-arrowhead]').count();r.overlays=(await H.save(page)).state.overlays;assert.equal(r.heads,1);const saved=await H.save(page);await H.loadProject(page,saved);assert.equal(await page.locator('#artboard [data-arrowhead]').count(),1);await annotations(page);await page.locator('#overlayType').selectOption('arrowBoth');const b=await page.locator('#artboard>svg').boundingBox();await page.mouse.move(b.x+b.width*.7,b.y+b.height*.7);await page.mouse.down();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.8,{steps:3});await page.mouse.up();assert.equal(await page.locator('#artboard [data-arrowhead]').count(),3);await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,saved.state);const exported=await H.exportBytes(page,'export');assert.match(exported.toString(),/<polygon/);
});
await run('groups',async(page,r)=>{
 const text=await addText(page,'Group label');await page.locator('#artboard image[data-key]').click({modifiers:['Shift']});
 r.canGroup=await page.locator('#groupSelection').isEnabled();if(!r.canGroup){assert.equal(mode,'baseline');return;}
 await page.keyboard.press('Control+g');const grouped=await H.save(page);r.groups=grouped.state.objectGroups;
 await page.locator('#viewport').click({position:{x:5,y:5}});const image=page.locator('#artboard image[data-key]'),beforeI=await image.boundingBox(),beforeT=await text.boundingBox();
 await page.mouse.move(beforeI.x+beforeI.width*.6,beforeI.y+beforeI.height*.5);await page.mouse.down();await page.mouse.move(beforeI.x+beforeI.width*.6+25,beforeI.y+beforeI.height*.5+12,{steps:3});await page.mouse.up();
 const afterI=await image.boundingBox(),afterT=await text.boundingBox();r.delta={image:[afterI.x-beforeI.x,afterI.y-beforeI.y],text:[afterT.x-beforeT.x,afterT.y-beforeT.y]};r.history=(await H.save(page)).history.index-grouped.history.index;await page.screenshot({path:path.join(out,'group-preview.png')});
 assert(Math.abs(r.delta.image[0])>5);assert(Math.abs(r.delta.image[0]-r.delta.text[0])<1);assert(Math.abs(r.delta.image[1]-r.delta.text[1])<1);assert.equal(r.history,1);
 r.stage='reopen';const moved=await H.save(page);await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,grouped.state);await H.loadProject(page,moved);assert.deepEqual((await H.save(page)).state,moved.state);
 await page.locator('#artboard image[data-key]').click();const corner=page.locator('[data-selection-resize="se"]');const c=await corner.boundingBox(),bi=await page.locator('#artboard image[data-key]').boundingBox();assert(c);await page.mouse.move(c.x+c.width/2,c.y+c.height/2);await page.mouse.down();await page.mouse.move(c.x+c.width/2+25,c.y+c.height/2+15,{steps:3});await page.mouse.up();const resized=await H.save(page);assert.equal(resized.history.index,moved.history.index+1);assert((await page.locator('#artboard image[data-key]').boundingBox()).width>bi.width);await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,moved.state);await page.locator('#artboard image[data-key]').click();r.resizeOneUndo=true;
 r.stage='lock';await H.clickQuick(page,'quickLock');const locked=await H.save(page);assert(locked.state.overlays[0].locked);const members=locked.state.objectGroups[0],native=members.find(r=>r.kind==='element');assert(locked.state.panels[native.id].lockedElements[native.vi].includes(native.key));await page.keyboard.press('ArrowRight');assert.deepEqual((await H.save(page)).state,locked.state);
 await page.locator('#artboard image[data-key]').click();r.stage='unlock';await H.clickQuick(page,'quickLock');await page.locator('#artboard image[data-key]').click();await page.keyboard.press('Control+Shift+g');assert(!(await H.save(page)).state.objectGroups);
 await H.loadProject(page,moved);const bad=JSON.parse(JSON.stringify(moved));bad.state.objectGroups[0].push({...bad.state.objectGroups[0][0]});await H.loadProject(page,bad,'INVALID-duplicate-group.json',{expectReplacement:false});assert.deepEqual((await H.save(page)).state,moved.state);r.undoReopenLockUngroupInvalid=true;

});
await browser.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));if(mode!=='baseline'&&report.cases.some(c=>!c.completed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
