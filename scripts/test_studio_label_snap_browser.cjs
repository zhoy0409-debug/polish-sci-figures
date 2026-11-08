'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

(async()=>{
  const [, , html, destination, mode, projectFile]=process.argv;
  const out=path.resolve(destination);
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1520,height:1000}});
  const errors=[];
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>errors.push(error.message));
  const label=id=>page.locator(`[data-panel-label="panel-${id}"]`);
  const baseline=id=>label(id).evaluate(node=>{
    const p=node.getStartPositionOfChar(0).matrixTransform(node.getScreenCTM());
    return {x:p.x,y:p.y};
  });
  const line=()=>page.locator('[data-editor-snap] line').evaluateAll(nodes=>nodes.map(node=>{
    const p=new DOMPoint(+node.getAttribute('x1'),+node.getAttribute('y1')).matrixTransform(node.getScreenCTM());
    return {horizontal:node.getAttribute('y1')===node.getAttribute('y2'),y:p.y};
  }));
  const atFrame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const near=(actual,expected,message)=>assert(Math.abs(actual-expected)<.15,`${message}: ${actual} / ${expected}`);
  const shot=name=>page.locator('#artboard').screenshot({path:path.join(out,name+'.png')});
  async function save(name){
    const event=page.waitForEvent('download');
    await page.locator('#save').click();
    const download=await event;
    const file=path.join(out,name+'.json');
    await download.saveAs(file);
    return {file,data:JSON.parse(fs.readFileSync(file,'utf8'))};
  }
  async function dragStart(id){
    const a=await baseline(0),moving=await baseline(id),box=await label(id).boundingBox();
    const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);
    await page.mouse.down();
    return {a,moving,x,y,nearY:y+a.y-moving.y+3};
  }
  try{
    await page.goto(/^[a-z]+:\/\//i.test(html)?html:pathToFileURL(path.resolve(html)).href);
    if(projectFile){
      await page.waitForFunction(()=>!document.body.inert&&document.querySelector('#artboard>svg'));
      if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();
      await page.locator('#projectFile').setInputFiles(projectFile);
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('工程已恢复'));
    }
    await page.waitForFunction(()=>!document.body.inert&&document.querySelectorAll('[data-panel-label]').length===3);
    await page.locator('#zoom').selectOption('1');
    await atFrame();
    const before=await save('before');
    await shot('01-before');
    let drag=await dragStart(1);
    await page.mouse.move(drag.x+21,drag.nearY);
    await atFrame();
    const observed={reference:await baseline(0),moving:await baseline(1),guides:await line()};
    await shot('02-b-preview');
    if(mode==='baseline'){
      fs.writeFileSync(path.join(out,'baseline.json'),JSON.stringify(observed,null,2));
      assert(Math.abs(observed.reference.y-observed.moving.y)>.15,'The baseline fixture should reproduce the defect');
      console.log(JSON.stringify(observed));
      return;
    }
    near(observed.moving.y,drag.a.y,'B preview snaps to A baseline');
    near(observed.moving.x,drag.moving.x+21,'B horizontal position remains free');
    assert(observed.guides.some(guide=>guide.horizontal&&Math.abs(guide.y-drag.a.y)<.15));
    await page.mouse.move(drag.x+21,drag.nearY+14);
    await atFrame();
    assert(!(await line()).some(guide=>guide.horizontal&&Math.abs(guide.y-drag.a.y)<.15));
    await page.keyboard.down('Alt');
    await page.mouse.move(drag.x+21,drag.nearY);
    await atFrame();
    assert.equal((await line()).length,0);
    near((await baseline(1)).y,drag.a.y+3,'Alt leaves B unsnapped');
    await page.keyboard.up('Alt');
    await page.mouse.move(drag.x+21,drag.nearY+14);
    await atFrame();
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,x:drag.x+24,y:drag.nearY,clickCount:1});
    near((await baseline(1)).y,drag.a.y,'B commits the pointerup coordinates');
    near((await baseline(1)).x,drag.moving.x+24,'B commits final horizontal coordinates');
    assert.equal((await line()).length,0);
    const afterB=await save('after-b');
    assert.equal(afterB.data.history.index,before.data.history.index+1);
    assert.deepEqual(afterB.data.state.panels['panel-0'],before.data.state.panels['panel-0']);

    await shot('03-b-released');
    await page.locator('#zoom').selectOption('0.75');
    await atFrame();
    drag=await dragStart(2);
    await page.mouse.move(drag.x+12,drag.nearY);
    await atFrame();
    near((await baseline(2)).y,drag.a.y,'C preview snaps at 75% zoom');
    await shot('04-c-preview');
    await page.mouse.up();
    const afterC=await save('after-c');
    assert.equal(afterC.data.history.index,afterB.data.history.index+1);
    assert.deepEqual(afterC.data.state.panels['panel-0'],before.data.state.panels['panel-0']);
    assert.deepEqual(afterC.data.project,before.data.project);
    await page.locator('#projectFile').setInputFiles(afterC.file);
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('工程已恢复'));
    await atFrame();
    const reopened=await save('reopened');
    assert.deepEqual(reopened.data.state,afterC.data.state);
    assert.deepEqual(reopened.data.history,afterC.data.history);
    const restored=[await baseline(0),await baseline(1),await baseline(2)];
    near(restored[1].y,restored[0].y,'B reopens on A baseline');
    near(restored[2].y,restored[0].y,'C reopens on A baseline');
    assert.equal((await line()).length,0);
    await shot('05-reopened');
    const ordinary=page.locator('#artboard [data-panel="panel-0"] rect[fill="#225e8c"][data-key]').first();
    const from=await ordinary.boundingBox();
    const stationary=await page.locator('#artboard [data-panel="panel-1"] [data-key], #artboard [data-panel="panel-2"] [data-key]').evaluateAll(nodes=>nodes.flatMap(node=>{
      const box=node.getBoundingClientRect();
      return [box.top,box.top+box.height/2,box.bottom];
    }));
    const x=from.x+from.width/2,y=from.y+from.height/2;
    await page.mouse.move(x,y);
    await page.mouse.down();
    await page.mouse.move(x+13,y+3);
    await atFrame();
    const moving=await ordinary.boundingBox();
    const ordinaryY=(await line()).filter(guide=>guide.horizontal).map(guide=>guide.y);
    const anchors=box=>[box.y,box.y+box.height/2,box.y+box.height];
    assert(ordinaryY.some(y=>anchors(moving).some(anchor=>Math.abs(anchor-y)<.15)));
    assert(ordinaryY.some(y=>stationary.some(anchor=>Math.abs(anchor-y)<.15)),'Ordinary guide aligns a moving edge or centre with stationary geometry');
    await page.locator('#artboard>svg').dispatchEvent('pointercancel',{pointerId:1});
    await page.mouse.up();
    assert.equal((await line()).length,0);
    assert.deepEqual((await save('cancelled-ordinary')).data.state,reopened.data.state);

    const lowerRow=structuredClone(reopened.data);
    lowerRow.state.columns=2;
    delete lowerRow.state.grid;
    delete lowerRow.history;
    const lowerRowFile=path.join(out,'lower-row.json');
    fs.writeFileSync(lowerRowFile,JSON.stringify(lowerRow));
    await page.locator('#projectFile').setInputFiles(lowerRowFile);
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('工程已恢复'));
    await page.locator('#zoom').selectOption('0.75');
    await atFrame();
    drag=await dragStart(2);
    await page.mouse.move(drag.x,drag.nearY);
    await atFrame();
    assert((await baseline(2)).y>drag.a.y+6,'The lower row constrains the label to its panel');
    assert.equal((await line()).length,0,'An unreachable baseline must not show a guide');
    await page.locator('#artboard>svg').dispatchEvent('pointercancel',{pointerId:1});
    await page.mouse.up();
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({observed,restored,history:[before.data.history.index,afterB.data.history.index,afterC.data.history.index],browser:browser.version()},null,2));
    console.log('A/B/C live baseline, zoom, free x, Alt, fast pointerup, one undo per drag and saved reopen passed.');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
