'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const [fixture, destination, installedUrl] = process.argv.slice(2);
  assert(fixture && destination, 'Usage: node scripts/test_studio_label_match_browser.cjs FIXTURE_DIR OUTPUT_DIR [INSTALLED_URL]');
  const out = path.resolve(destination);
  fs.mkdirSync(out, {recursive: true});
  const source = JSON.parse(fs.readFileSync(path.join(fixture, 'skill-project.json'), 'utf8'));
  const ids = source.state.order;
  const [a, b, c] = ids;
  assert(source.project.panels[0].table.rows.length > 1 && source.project.panels[0].analysis);
  for (let i = 0; i < ids.length; i++) {
    const panel = source.state.panels[ids[i]];
    panel.label = {text: 'ABC'[i], x: 12 + i, y: [29, 48, 64][i], size: [13, 23, 17][i],
      font: 'Arial', bold: true, color: ['#20242A', '#99574E', '#367260'][i]};
    if (i) panel.frameOffset = {x: 0, y: [0, 26, -19][i]};
  }
  const browser = await chromium.launch(process.env.STUDIO_TIFF_BROWSER === 'chromium' ? {} : {channel: 'chrome'});
  const errors = [];
  const url = installedUrl ? new URL(installedUrl) : pathToFileURL(path.resolve(fixture, 'canvas.html'));
  if (installedUrl) assert.equal(url.origin, `http://127.0.0.1:${url.port}`, 'Use the installed loopback service');
  const jsonFile = (name, value) => ({name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value))});
  const review = page => page.locator('#qualityWorkspace');
  async function open(project) {
    const page = await browser.newPage({viewport: {width: 1520, height: 1000}});
    page.setDefaultTimeout(12000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.goto(url.href);
    await page.waitForFunction(() => !document.body.inert && document.querySelector('#artboard>svg'));
    if (await page.locator('#dismissProjectStart').isVisible()) await page.locator('#dismissProjectStart').click();
    await page.locator('#projectFile').setInputFiles(project);
    await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('工程已恢复'));
    await page.locator('#zoom').selectOption('1');
    return page;
  }
  async function download(page, trigger, filename) {
    const event = page.waitForEvent('download');
    await trigger.click();
    const file = path.join(out, filename);
    await (await event).saveAs(file);
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const save = (page, name) => download(page, page.locator('#save'), name + '.json');
  const shot = (page, name) => page.locator('#artboard').screenshot({path: path.join(out, name + '.png')});
  const importPatch = (page, patch) => review(page).locator('input[type=file]').setInputFiles(jsonFile('operations.json', patch));
  async function renderLabels(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return page.locator('#artboard text[data-panel-label]').evaluateAll(nodes => nodes.map(node => {
      const point = node.getStartPositionOfChar(0).matrixTransform(node.getScreenCTM());
      return {id: node.dataset.panelLabel, text: node.textContent, x: point.x, y: point.y,
        sizePt: Number(node.getAttribute('font-size'))};
    }));
  }
  function assertAligned(labels) {
    assert.deepEqual(labels.map(label => label.text), ['A', 'B', 'C']);
    for (const label of labels) {
      assert.equal(label.sizePt, 13);
      assert(Math.abs(label.y - labels[0].y) < 0.002, `Baseline for ${label.text}: ${label.y} / ${labels[0].y}`);
    }
  }
  async function assertRejected(project, patch, message, name) {
    const page = await open(jsonFile('edited-project.json', project));
    const before = await save(page, name + '-before');
    await page.locator('#openQualityWorkspace').click();
    await importPatch(page, patch);
    await page.waitForFunction(text => document.querySelector('#qualityWorkspace [role=status]')?.textContent.includes(text), message);
    assert.equal(await review(page).locator('.quality-preview-bar').isVisible(), false);
    const after = await save(page, name + '-after');
    assert.deepEqual(after.state, before.state);
    assert.deepEqual(after.history, before.history);
    await page.close();
  }
  try {
    const page = await open(jsonFile('figure-project.json', source));
    const before = await save(page, 'before');
    const beforeLabels = await renderLabels(page);
    assert.deepEqual(beforeLabels.map(label => label.sizePt), [13, 23, 17]);
    assert.equal(new Set(beforeLabels.map(label => label.y)).size, 3);
    await shot(page, '01-before');
    await page.locator('#openQualityWorkspace').click();
    await review(page).getByText('与 Skill 协作', {exact: true}).click();
    const inspection = await download(page, review(page).getByRole('button', {name: '导出检查清单'}), 'inspection.json');
    assert(inspection.capabilities.operations.includes('panel.label.match'));
    const byLabel = Object.fromEntries(inspection.panels.map(panel => [panel.displayLabel, panel]));
    const targets = [byLabel.B, byLabel.C];
    const patch = {
      schema: 'figure-studio-operations/1', projectId: inspection.projectId,
      base: Object.fromEntries(targets.map(panel => [panel.id, panel.revision])),
      operations: targets.map(panel => ({type: 'panel.label.match', panel: panel.id,
        reference: byLabel.A.id, referenceRevision: byLabel.A.revision}))
    };
    fs.writeFileSync(path.join(out, 'operations.json'), JSON.stringify(patch, null, 2));
    await importPatch(page, patch);
    await review(page).locator('.quality-preview-bar').waitFor();
    const preview = await renderLabels(page);
    assertAligned(preview);
    assert.deepEqual(preview.map(label => label.x), beforeLabels.map(label => label.x));
    await shot(page, '02-preview');
    const during = await save(page, 'during-preview');
    assert.deepEqual(during.state, before.state);
    assert.deepEqual(during.history, before.history);
    await review(page).getByRole('button', {name: '取消预览'}).click();
    assert.deepEqual(await renderLabels(page), beforeLabels);

    await importPatch(page, patch);
    await review(page).getByRole('button', {name: '保留修改'}).click();
    const kept = await save(page, 'kept');
    assert.equal(kept.history.index, before.history.index + 1);
    assert.deepEqual(kept.project.panels, before.project.panels);
    const expected = structuredClone(before.state);
    for (const id of [b, c]) {
      expected.panels[id].label.size = 13;
      expected.panels[id].label.y = kept.state.panels[id].label.y;
    }
    assert.notEqual(expected.panels[b].label.y, expected.panels[a].label.y);
    assert.notEqual(expected.panels[c].label.y, expected.panels[a].label.y);
    assert.deepEqual(kept.state, expected);
    await page.close();

    const reopened = await open(path.join(out, 'kept.json'));
    const afterReopen = await renderLabels(reopened);
    assertAligned(afterReopen);
    await shot(reopened, '03-reopened');
    const reopenedProject = await save(reopened, 'reopened');
    assert.deepEqual(reopenedProject.state, kept.state);
    assert.deepEqual(reopenedProject.history, kept.history);
    await reopened.locator('#undo').click();
    const undone = await save(reopened, 'one-undo');
    assert.equal(undone.history.index, before.history.index);
    assert.deepEqual(undone.state, before.state);
    assert.deepEqual(undone.project.panels, before.project.panels);
    assert.deepEqual(await renderLabels(reopened), beforeLabels);
    await reopened.close();

    const direct = await open(jsonFile('figure-project.json', source));
    const label = id => direct.locator(`#artboard [data-panel-label="${id}"]`);
    await label(a).click();
    await label(b).click({modifiers:['Shift']});
    await label(c).click({modifiers:['Shift']});
    const alignToggle=direct.locator('#quickAlignmentToggle');
    if(!await alignToggle.isVisible())await direct.locator('#drawerQuickMore').click();
    await alignToggle.click();
    await direct.locator('[data-alignment-action="match-labels"]').click();
    await review(direct).locator('.quality-preview-bar').waitFor();
    assertAligned(await renderLabels(direct));
    await review(direct).getByRole('button', {name:'取消预览'}).click();
    assert.deepEqual(await renderLabels(direct),beforeLabels);

    await label(c).click();
    await review(direct).getByText('与 Skill 协作', {exact:true}).click();
    await review(direct).getByRole('textbox',{name:'这次想改什么？'}).fill('只把图号 C 的颜色改为 #176b5d。');
    await review(direct).getByRole('button', {name:'复制局部 Skill 任务（含图中文字）'}).click();
    const prompt = review(direct).locator('.quality-handoff textarea');
    await prompt.waitFor();
    const instructionText = await prompt.inputValue();
    const task = JSON.parse(instructionText.split('\n\n')[1]);
    assert.deepEqual(task.panels.map(panel=>panel.id),[c]);
    assert(!task.panels[0].table && !task.panels[0].analysis);
    assert.equal(task.task.description,'只把图号 C 的颜色改为 #176b5d。');
    assert.equal(task.task.scope,'label');
    assert.deepEqual(task.panels[0].elements,[]);
    assert.match(instructionText,/base.*revision.*operations/);
    await review(direct).getByText('粘贴 Skill 修改',{exact:true}).click();
    const field=review(direct).getByRole('textbox',{name:'粘贴 Skill 修改'});
    const previewPaste=review(direct).getByRole('button',{name:'预览粘贴的修改'});
    await field.fill('invalid');
    await previewPaste.click();
    await direct.waitForFunction(()=>document.querySelector('#qualityWorkspace [role=status]')?.textContent.includes('不是有效的 JSON'));
    assert.equal(await review(direct).locator('.quality-preview-bar').isVisible(), false);
    await field.fill('```json\n'+JSON.stringify(patch)+'\n```');
    await previewPaste.click();
    await review(direct).getByText('小图 B、C · 2 项修改',{exact:true}).waitFor();
    assert.equal(await prompt.isVisible(),false);
    await review(direct).getByRole('button',{name:'保留修改'}).click();
    assertAligned(await renderLabels(direct));
    assert.equal((await save(direct,'pasted-kept')).history.index,before.history.index+1);
    await direct.close();

    const handoff = await open(jsonFile('figure-project.json',source));
    const q = review(handoff);
    const color = () => handoff.locator(`#artboard [data-panel-label="${c}"]`).getAttribute('fill');
    const changed = {schema:patch.schema,projectId:patch.projectId,base:{[c]:byLabel.C.revision},
      operations:[{type:'panel.label.style',panel:c,style:{fill:'#176b5d'}}]};
    const json = JSON.stringify(changed);
    const reply = 'Here are the changes.\n\n```json\n'+json+'\n```\n\nPreview before keeping.';
    const invalid = reply+'\n```json\n'+json+'\n```';
    await handoff.locator('#openQualityWorkspace').click();
    const paste = q.getByRole('textbox',{name:'粘贴 Skill 修改'});
    const clipboardButton = q.getByRole('button',{name:'从剪贴板预览'});
    if(installedUrl){
      await handoff.context().grantPermissions(['clipboard-read','clipboard-write']);
      await handoff.evaluate(text=>navigator.clipboard.writeText(text),invalid);
      await clipboardButton.click();
    }else{
      await q.getByText('与 Skill 协作',{exact:true}).click();
      await q.getByText('粘贴 Skill 修改',{exact:true}).click();
      await paste.fill(invalid);
      await q.getByRole('button',{name:'预览粘贴的修改'}).click();
    }
    await q.getByText(/只含一个 JSON 代码块/).waitFor();
    assert.equal(await paste.inputValue(),invalid);
    assert.equal(await color(),source.state.panels[c].label.color);
    if(installedUrl){
      await handoff.evaluate(text=>navigator.clipboard.writeText(text),reply);
      await clipboardButton.click();
    }else{
      await paste.fill(reply);
      await q.getByRole('button',{name:'预览粘贴的修改'}).click();
    }
    await q.getByText('小图 C · 1 项修改',{exact:true}).waitFor();
    await q.getByText('C · 填充色：#367260 → #176b5d',{exact:true}).waitFor();
    await handoff.waitForFunction(id=>document.querySelector(`#artboard [data-panel-label="${id}"]`)?.getAttribute('fill')==='#176b5d',c);
    const compare=q.getByRole('button',{name:'对照修改前'});
    await compare.click();
    assert.equal(await compare.getAttribute('aria-pressed'),'true');
    assert.equal(await color(),'#367260');
    await compare.click();
    assert.equal(await color(),'#176b5d');
    await q.getByRole('button',{name:'收起侧栏'}).click();
    assert.equal(await q.isVisible(),false);
    assert.equal(await color(),'#176b5d');
    await handoff.getByRole('button',{name:'继续质检预览'}).click();
    await q.getByText('C · 填充色：#367260 → #176b5d',{exact:true}).waitFor();
    await compare.click();
    await q.getByRole('button',{name:'保留修改'}).click();
    const colorKept=await save(handoff,'chat-keep-after-comparison');
    assert.equal(colorKept.history.index,before.history.index+1);
    assert.equal(colorKept.state.panels[c].label.color,'#176b5d');
    await q.getByText('粘贴 Skill 修改',{exact:true}).click();
    await paste.fill(reply);
    await q.getByRole('button',{name:'预览粘贴的修改'}).click();
    await q.getByRole('button',{name:'按当前状态重新复制小图 C 的任务'}).click();
    const refreshed=JSON.parse((await q.locator('.quality-handoff textarea').inputValue()).split('\n\n')[1]);
    assert.deepEqual(refreshed.panels.map(panel=>panel.id),[c]);
    assert.notEqual(refreshed.panels[0].revision,byLabel.C.revision);
    assert.equal(await paste.inputValue(),reply);
    assert.equal(await color(),'#176b5d');
    await handoff.locator('#undo').click();
    assert.deepEqual((await save(handoff,'chat-undo')).state,before.state);
    if(installedUrl){
      await handoff.evaluate(()=>navigator.clipboard.writeText(''));
      await clipboardButton.click();
      await q.getByText('请在输入框粘贴回复，再点预览。',{exact:true}).waitFor();
      assert.equal(await paste.inputValue(),reply,'A failed clipboard read must keep the manual reply');
    }
    await handoff.close();

    const staleReference = structuredClone(source);
    staleReference.state.panels[a].label.size = 15;
    await assertRejected(staleReference, patch, '参照小图已变化', 'stale-reference');
    const staleTarget = structuredClone(source);
    staleTarget.state.panels[c].label.y = 51;
    await assertRejected(staleTarget, patch, '目标小图已变化', 'stale-target');
    assert.deepEqual(errors, []);
    const result = {entry: installedUrl ? 'installed-loopback' : 'source-html', browser: browser.version(), before: beforeLabels, preview, reopened: afterReopen,
      history: {before: before.history.index, kept: kept.history.index, undone: undone.history.index},
      verified: ['preview', 'save during preview', 'cancel', 'keep', 'save and reopen', 'one undo', 'direct alignment', 'scoped inline task', 'paste and preview', 'stale reference', 'stale target', 'source equality','reply with prose','reject ambiguous reply','show exact difference','compare original without losing draft','hide and resume preview','recopy fresh scoped task']};
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
