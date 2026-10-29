'use strict';
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs'),{fs,path,assert}=H;
const url=H.localUrl(process.argv[2]),out=path.resolve(process.argv[3]);assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({channel:process.env.STUDIO_TIFF_BROWSER||'chrome',headless:true});
  const {page,context,errors,remote}=await H.browserPage(browser,{recordVideo:{dir:path.join(out,'video')}});
  const report={author:'a',date:'2026-10-29',scope:'Real production browser keyboard/canvas/project regression; not Windows physical input or native IME acceptance',browser:browser.version(),checks:[]};
  async function save(name){const payload=await H.save(page);fs.writeFileSync(path.join(out,name),JSON.stringify(payload));return payload;}
  async function canvasKey(key){await page.locator('#viewport').click({position:{x:12,y:12}});await page.keyboard.press(key);}
  try{
    await page.goto(url);await page.waitForFunction(()=>document.body.inert===false&&!!document.getElementById('save'));await H.dismiss(page);
    const irisFile=path.join(H.ROOT,'.cache/axis-real-data-qa/iris-axis-project.json');
    if(fs.existsSync(irisFile)){await H.loadProject(page,H.publicIris());report.publicIris150=true;}
    else{await H.newProject(page,'PUBLIC shortcut regression');report.publicIris150=false;}
    const source=await save('original.json');
    await page.locator('#quickInsertText').click();await page.locator('#artboard').click({position:{x:150,y:100}});
    const editor=page.locator('.canvas-text-editor');await editor.waitFor({state:'visible'});await editor.fill('实验组');await page.locator('#viewport').click({position:{x:12,y:12}});await editor.waitFor({state:'hidden'});
    const before=await save('experiment.json'),annotation=before.state.overlays.find(a=>a.text==='实验组');assert(annotation);
    await page.locator('[data-annotation="'+annotation.id+'"] text').dblclick();await editor.waitFor({state:'visible'});await editor.fill('对照组');await page.locator('#viewport').click({position:{x:12,y:12}});await editor.waitFor({state:'hidden'});
    const after=await save('control.json');assert.equal(after.history.index,before.history.index+1);assert.equal(after.state.overlays.find(a=>a.id===annotation.id).text,'对照组');assert.deepEqual(after.project,source.project,'All original SVGs, observations and analysis remain exact');
    await canvasKey('Control+z');const undone=await save('undo.json');assert.deepEqual(undone.state,before.state);assert.equal(undone.history.states.length,after.history.states.length);
    await canvasKey('Control+y');const redone=await save('redo-ctrl-y.json');assert.deepEqual(redone.state,after.state);assert.deepEqual(redone.history,after.history);assert.deepEqual(redone.project,source.project);await page.screenshot({path:path.join(out,'ctrl-y-redone.png')});
    report.checks.push('Actual inserted Chinese text, outside-click confirmation, one Ctrl+Z and Ctrl+Y restore exact canvas/project/history with original observations and analysis intact');
    await canvasKey('Control+z');await canvasKey('Control+Shift+z');assert.deepEqual((await save('redo-ctrl-shift-z.json')).history,after.history);
    await canvasKey('Control+z');await page.locator('#redo').click();assert.deepEqual((await save('redo-toolbar.json')).state,after.state);
    report.checks.push('Ctrl+Shift+Z and toolbar Redo restore the same committed text without another undo record');
    await canvasKey('Control+z');await page.locator('#dimensions').click();await page.locator('#exportWidth').focus();assert.equal(await page.evaluate(()=>document.activeElement.id),'exportWidth','The property field must actually have focus');await page.keyboard.press('Control+y');assert.deepEqual((await save('input-shortcut.json')).state,before.state,'Focused property input cannot redo project history');
    await canvasKey('Control+y');await H.loadProject(page,await save('before-reopen.json'));assert.deepEqual((await save('after-reopen.json')).state,after.state);
    await page.locator('#language').selectOption('en');assert((await page.locator('#redo').getAttribute('title')).includes('Ctrl + Y'));await page.locator('#language').selectOption('zh-CN');assert((await page.locator('#redo').getAttribute('title')).includes('Ctrl + Y'));
    report.checks.push('Native field shortcuts do not alter project history; saved project reopens intact; Chinese/English toolbar exposes Ctrl+Y');
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.passed=true;
  }catch(error){report.passed=false;report.error=error.stack;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
  finally{report.errors=errors;report.remote=remote;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await context.close();await browser.close();}
  console.log(report.checks.map(x=>'PASS '+x).join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;});
