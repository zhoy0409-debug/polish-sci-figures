'use strict';
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert}=H,url=H.localUrl(process.argv[2]),out=path.resolve(process.argv[3]);
assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const report={author:'a',date:'2026-10-31',scope:'Isolated source Chrome; CSS viewport and emulated DPR only, not OS scale, native window, installed editing, IME or user discoverability timing.',cases:[],errors:[],remote:[]};
(async()=>{
const browser=await chromium.launch({channel:process.env.STUDIO_TIFF_BROWSER||'chrome',headless:true});report.browser=browser.version();
try{for(const scale of [1,1.25,1.5])for(const theme of ['carbon','pearl']){
 const viewport={width:Math.floor(1280/scale),height:Math.floor(720/scale)};
 const {context,page,errors,remote}=await H.browserPage(browser,{viewport,deviceScaleFactor:scale});
 const item={theme,emulatedDpr:scale,viewport,checks:[],issues:[]};report.cases.push(item);
 try{
  await page.goto(url);await page.waitForFunction(()=>!document.body.inert);if(process.env.STUDIO_HIERARCHY_SYNTHETIC!=='1'&&fs.existsSync(path.join(H.ROOT,'.cache/axis-real-data-qa/iris-axis-project.json')))await H.loadProject(page,H.publicIris());else{await H.newProject(page,'SYNTHETIC compact workspace regression');await H.loadSvg(page,H.pressureSvg(100));}
  await page.waitForTimeout(400);
  assert(!await page.locator('body.studio-mobile').count(),'Fine-pointer desktop drawers must not also enable touch workspace');
  if(theme==='pearl'){await page.locator('#appearanceMenu summary').click();await page.locator('#studioTheme').selectOption(theme);await page.locator('#appearanceMenu summary').click();}
  await page.locator('#artboard text[data-key]').first().click({force:true});const before=await H.save(page);
  async function find(query,id,target){await page.locator('#commandSearch').click();await page.locator('#commandQuery').fill(query);await page.locator('#command-'+id).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));if(target){assert(await page.locator(target).isVisible());await page.waitForFunction(id=>document.activeElement.id===id,target.slice(1),{timeout:5000});}item.checks.push({query,id,target});}
  await find('行距','fonts','#para-line-height');
  assert(await page.locator('#paragraphPanel').evaluate(n=>n.open));
  await page.locator('#artboard rect[data-key],#artboard path[data-key],#artboard circle[data-key]').first().click({force:true});
  await page.locator('#artboard text[data-key]').first().click({force:true});assert(await page.locator('#paragraphPanel').evaluate(n=>n.open));
  await page.locator('#drawerCloseTools').click();await page.locator('#drawerTools').click();assert(await page.locator('#paragraphPanel').evaluate(n=>n.open));
  await find('字体','fonts','#font');
  item.geometry=await page.evaluate(()=>{
   const ids=['commandSearch','drawerTools','drawerCloseTools','font','fontSize','viewport'];
   return {innerWidth,innerHeight,bodyScrollWidth:document.body.scrollWidth,rootScrollWidth:document.documentElement.scrollWidth,
    elements:ids.map(id=>{const n=document.getElementById(id),r=n.getBoundingClientRect();return{id,left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth};})};
  });
  if(item.geometry.bodyScrollWidth>viewport.width+1||item.geometry.rootScrollWidth>viewport.width+1)item.issues.push('Page horizontal overflow');
  for(const x of item.geometry.elements.filter(x=>x.id!=='viewport'))if(x.left<0||x.right>viewport.width+1||x.top<0||x.bottom>viewport.height+1)item.issues.push(x.id+' outside viewport');
  const fontHit=await page.locator('#font').evaluate(n=>{const r=n.getBoundingClientRect();return {visible:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)===n};});
  if(!fontHit.visible)item.issues.push('Focused font field occluded');
  const fontLabel=await page.locator('#font').evaluate(n=>({top:n.closest('label').getBoundingClientRect().top,headingBottom:n.closest('.studio-drawer-body').querySelector('.studio-drawer-heading').getBoundingClientRect().bottom}));
  if(fontLabel.top<fontLabel.headingBottom-1)item.issues.push('Font label hidden under sticky heading');
  await page.screenshot({path:path.join(out,theme+'-'+scale+'-fonts.png')});
  await find('边框','border');await page.locator('#border-width').fill('2');await page.locator('#drawerCloseTools').click();await page.locator('#drawerTools').click();assert.equal(await page.locator('#border-width').inputValue(),'2');await page.locator('#borderCancel').click();
  assert.deepEqual((await H.save(page)).state,before.state);assert.deepEqual((await H.save(page)).project,before.project);
  await page.locator('#language').selectOption('en');await find('text spacing','fonts','#para-line-height');
  const english=await page.evaluate(()=>({width:innerWidth,body:document.body.scrollWidth,root:document.documentElement.scrollWidth}));
  if(english.body>english.width+1||english.root>english.width+1)item.issues.push('English page horizontal overflow');
  item.english=english;assert.deepEqual((await H.save(page)).state,before.state);assert.deepEqual((await H.save(page)).project,before.project);
  item.passed=item.issues.length===0;
 }catch(e){item.passed=false;item.error=e.stack;await page.screenshot({path:path.join(out,theme+'-'+scale+'-failure.png')}).catch(()=>{});}
 finally{report.errors.push(...errors);report.remote.push(...remote);await context.close();}
}
for(const [width,coarse]of [[750,false],[751,false],[1024,true]]){
 const {context,page,errors,remote}=await H.browserPage(browser,{viewport:{width,height:650},hasTouch:coarse});
 try{await page.goto(url);await page.waitForFunction(()=>!document.body.inert);const mode=await page.evaluate(()=>({drawers:document.body.classList.contains('studio-drawers'),touch:document.body.classList.contains('studio-mobile'),coarse:matchMedia('(pointer: coarse)').matches}));assert.equal(mode.coarse,coarse);assert.equal(mode.drawers,width>750&&!coarse);assert.equal(mode.touch,width<=750||coarse);report.cases.push({viewport:{width,height:650},emulatedTouch:coarse,mode,passed:true});}
 finally{report.errors.push(...errors);report.remote.push(...remote);await context.close();}
}
report.passed=report.cases.every(x=>x.passed)&&!report.errors.length&&!report.remote.length;
}finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(x=>({theme:x.theme,emulatedDpr:x.emulatedDpr,passed:x.passed,issues:x.issues,error:x.error?.split('\n')[0]})),errors:report.errors,remote:report.remote}));if(!report.passed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
