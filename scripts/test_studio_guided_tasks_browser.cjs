'use strict';
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H,[,,url,outArg]=process.argv,out=path.resolve(outArg);
assert(url&&outArg);assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const report={author:'a',scope:'Actual Chrome, synthetic artwork, real user controls; no physical Mac UI claim',rounds:[],errors:[]};
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/feedback-five-image.png')).toString('base64');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="500pt" height="300pt" viewBox="0 0 500 300"><image width="320" height="160" href="data:image/png;base64,${fixture}"/><text x="30" y="230" font-family="Arial" font-size="20">Reference</text></svg>`;
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const [width,height,lang]of [[1440,900,'zh-CN'],[910,512,'en'],[1280,720,'zh-CN']]){
 const {page:p,context,errors,remote}=await H.browserPage(browser,{viewport:{width,height},recordVideo:{dir:path.join(out,'video')}});p.setDefaultTimeout(12000);
 const r={width,height,lang};report.rounds.push(r);
 try{
  await p.goto(url);await H.newProject(p,'SYNTHETIC guided acceptance');await H.loadSvg(p,svg);await p.locator('#language').selectOption(lang);
  const before=await H.save(p),guide=p.locator('#studioUsageGuide');
  async function open(id){await p.locator('#studioHelpMenu summary').click();await p.locator('#openStudioGuide').click();if(id)await guide.locator('[data-guide-topic="'+id+'"]').click();}
  async function find(query,id){await p.locator('#usageGuideQuery').fill(query);await p.locator('[data-guide-action="'+id+'"]').click();}
  await open('all');const ids=await p.locator('[data-guide-action]').evaluateAll(nodes=>nodes.map(n=>n.dataset.guideAction));assert(ids.length>=50);
  for(const id of ids){await p.locator('[data-guide-action="'+id+'"]').click();assert.equal(await p.locator('#usageGuideInstructions li').count(),3);assert(await p.locator('#usageGuideLaunch').isEnabled());}
  r.documentedCommands=ids.length;
  await find('TIFF','tiff-import');assert.match(await p.locator('#usageGuideInstructions').innerText(),/TIFF/);
  await p.screenshot({path:path.join(out,'directory-'+width+'.png')});await p.keyboard.press('Escape');
  let current=await H.save(p);assert.deepEqual(current.state,before.state);assert.deepEqual(current.history,before.history,'Browsing guides never changes undo history');
  // Use the guide to open the real arrow insertion path, then save/reopen/undo.
  await open('all');await find(lang==='en'?'double arrows':'双向箭头','arrow');await p.locator('#usageGuideLaunch').click();assert(await p.locator('#studioTaskCoach').isVisible());assert.equal(await p.locator('#overlayType').inputValue(),'arrow');
  const board=await p.locator('#artboard>svg').boundingBox();await p.mouse.move(board.x+board.width*.45,board.y+board.height*.3);await p.mouse.down();await p.mouse.move(board.x+board.width*.7,board.y+board.height*.5,{steps:5});await p.mouse.up();assert.equal(await p.locator('#artboard [data-arrowhead]').count(),1);
  const arrow=await H.save(p);assert.equal(arrow.history.index,before.history.index+1);await H.loadProject(p,arrow);assert.equal(await p.locator('#artboard [data-arrowhead]').count(),1);await p.locator('#undo').click();assert.deepEqual((await H.save(p)).state,before.state);
  await p.locator('#taskCoachClose').click();assert(await p.locator('#studioTaskCoach').isHidden());
  // Contextual help opens the matching instructions, with original tool fields intact.
  await p.locator('#artboard text[data-key]').click();await p.locator('[data-drawer-category="style"]').click();await p.locator('[data-drawer-tool="fonts"]').click();await p.locator('#drawerToolHelp').click();assert.equal(await p.locator('[data-guide-action="fonts"]').getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');assert(await p.locator('#font').isVisible());
  await p.locator('[data-drawer-category="layout"]').click();await p.locator('[data-drawer-tool="organization"]').click();await p.locator('#drawerToolHelp').click();assert.equal(await p.locator('[data-guide-action="group"]').getAttribute('aria-pressed'),'true','Canonical group drawer opens grouping help');await p.keyboard.press('Escape');
  // Starting a new tool from help cannot discard an uncommitted image preview.
  await p.locator('#artboard image[data-key]').click();await H.clickQuick(p,'quickImageDisplay');await p.locator('#imageColorDialog').waitFor();
  await open('all');await find(lang==='en'?'arrows':'箭头','arrow');await p.locator('#usageGuideLaunch').click();assert(await guide.isVisible());assert((await p.locator('#usageGuideStatus').innerText()).length>10);await p.keyboard.press('Escape');assert(await p.locator('#imageColorDialog').isVisible());
  const cancel=p.locator('#imageColorDialog button').filter({hasText:lang==='en'?'Cancel':'取消'}).first();await cancel.click();
  // Direct two-point calibration from the guide no longer starts an inset ROI first.
  await open('all');await find(lang==='en'?'calibration':'两点标定','calibrate');await p.locator('#usageGuideLaunch').click();await p.waitForFunction(()=>document.querySelector('#viewport').style.cursor==='crosshair');const image=await p.locator('#artboard image[data-key]').boundingBox();await p.mouse.move(image.x+image.width*.3,image.y+image.height*.2);await p.mouse.down();await p.mouse.move(image.x+image.width*.3,image.y+image.height*.8,{steps:4});await p.mouse.up();await p.locator('.image-insets-dialog[open]').waitFor();await p.screenshot({path:path.join(out,'calibration-'+width+'.png')});await p.keyboard.press('Escape');await p.locator('#taskCoachClose').click();
  current=await H.save(p);assert.deepEqual(current.state,before.state);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);r.passed=true;
 }catch(e){r.error=e.stack;await p.screenshot({path:path.join(out,'failure-'+width+'.png')});throw e;}finally{report.errors.push(...errors);await context.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));}
}report.passed=true;}finally{await browser.close();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));}console.log(JSON.stringify(report));})().catch(e=>{console.error(e);process.exitCode=1;});
