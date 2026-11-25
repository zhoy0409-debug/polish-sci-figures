'use strict';
// Real Chrome + production, self-contained editor built from synthetic demo bundles:
//   python sci_figures.py studio demo/workbench demo/multigroup_workbench --out editor.html
//   node scripts/test_studio_figure_lens_browser.cjs editor.html out
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const [,,htmlArg,outArg]=process.argv;
if(!htmlArg||!outArg)throw Error('Usage: node scripts/test_studio_figure_lens_browser.cjs editor.html output-folder');
const html=path.resolve(htmlArg),out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  const save=async name=>{const waiting=page.waitForEvent('download');await page.locator('#save').click();const file=path.join(out,name);await(await waiting).saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));};
  const texts=()=>page.evaluate(()=>[...document.querySelectorAll('#artboard svg text')].map(n=>n.textContent));
  const pixel=async()=>(await page.locator('#artboard').screenshot()).toString('base64');
  try{
    await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>!document.body.inert&&document.querySelector('#artboard svg'));
    const before=await save('before.json'),normal=await pixel();
    // Colour-vision lens: pixels change, nothing that can be saved does.
    await page.locator('#openQualityWorkspace').click();await page.locator('#figureLens > summary').click();
    const shots=new Set([normal]);
    for(const id of ['protan','deutan','tritan','grayscale']){
      await page.locator(`#figureLens [data-vision="${id}"]`).click();await page.waitForTimeout(80);shots.add(await pixel());
      assert.equal(await page.locator('#figureLensBadge').isVisible(),true);
    }
    assert.equal(shots.size,5,'Every vision mode must render differently from normal and from each other');
    await page.screenshot({path:path.join(out,'lens-grayscale.png')});
    const filtered=await save('lens-on.json');assert.deepEqual(filtered.state,before.state);assert.deepEqual(filtered.history,before.history);
    const exported=await page.evaluate(()=>document.querySelector('#artboard svg').outerHTML);assert(!exported.includes('figureLens'),'The lens must not enter artwork');
    await page.locator('#figureLensBadge').click();assert.equal(await page.locator('#artboard').evaluate(n=>n.style.filter),'');
    // Review: grayscale merge is reported, coverage stays honest.
    await page.locator('#qualityScan').click();await page.waitForFunction(()=>document.querySelector('#qualityStatus').textContent.startsWith('检查完成'));
    const found=await page.locator('.quality-results').innerText();assert(found.includes('颜色难以区分'),found.slice(0,500));assert(found.includes('#376795'));
    // Find and replace: shortcut, literal matching, preview, cancel, keep, one undo.
    await page.locator('#viewport').click({position:{x:4,y:4}});await page.keyboard.press('Control+h');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'figureFind');
    const original=await texts(),word=original.find(t=>/^[A-Za-z]{4,}$/.test(t.trim())).trim();
    await page.locator('#figureFind').fill('.*');assert.match(await page.locator('#figureFindStatus').innerText(),/没有匹配/);assert.equal(await page.locator('#figureReplaceAll').isDisabled(),true);
    await page.locator('#figureFind').fill(word);const count=original.filter(t=>t.toLowerCase().includes(word.toLowerCase())).length;
    assert.match(await page.locator('#figureFindStatus').innerText(),new RegExp('^'+count+' 段文字匹配'));
    await page.locator('.figure-find-results button').first().click();await page.waitForTimeout(80);
    await page.locator('#figureReplace').fill('IC50 $& log2');await page.locator('#figureReplaceAll').click();await page.waitForFunction(()=>!document.querySelector('.quality-preview-bar').hidden);await page.waitForTimeout(200);
    assert((await texts()).some(t=>t.includes('IC50 $& log2')),'Replacement must be literal and visible on the real canvas');
    await page.screenshot({path:path.join(out,'replace-preview.png')});
    const draft=await save('draft.json');assert.deepEqual(draft.state,before.state);
    const panel=page.locator('#qualityWorkspace');await panel.getByRole('button',{name:'取消预览',exact:true}).click();await page.waitForTimeout(120);assert.deepEqual(await texts(),original);
    await page.locator('#figureReplaceAll').click();await page.waitForTimeout(150);await panel.getByRole('button',{name:'保留修改',exact:true}).click();await page.waitForTimeout(200);
    const kept=await save('kept.json');assert.equal(kept.history.index,before.history.index+1);assert.deepEqual(kept.project,before.project,'Bound data and analysis must not change');
    // The same text now trips the notation rule and can be corrected in one step.
    await page.locator('#qualityScan').click();await page.waitForFunction(()=>document.querySelector('#qualityStatus').textContent.startsWith('检查完成'));
    await page.locator('#qualityFixNotation').click();await page.waitForTimeout(200);assert((await texts()).some(t=>t.includes('IC₅₀ $& log₂')));
    await panel.getByRole('button',{name:'保留修改',exact:true}).click();await page.waitForTimeout(200);
    await page.locator('#figureFind').fill('IC₅₀');assert.match(await page.locator('#figureFindStatus').innerText(),/^1 段文字匹配，1 段可替换/,'Edited text must stay replaceable');
    await page.locator('#undo').click();await page.locator('#undo').click();await page.waitForTimeout(150);
    assert.deepEqual((await save('undone.json')).state,before.state);
    // Language switch retitles the new controls.
    await page.locator('#language').selectOption('en');await page.waitForTimeout(150);
    assert.equal(await page.locator('#figureFindReplace > summary').innerText(),'Find and replace text');
    await page.screenshot({path:path.join(out,'english.png')});
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    console.log('PASS colour-vision lens, colour and notation review, literal find/replace, cancel/keep/undo, saved-state isolation');
  }catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});console.error(errors);throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
