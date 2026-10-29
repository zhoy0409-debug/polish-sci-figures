/* Real Chromium / loopback acceptance. Default table is an explicit engineering
 * fixture. STUDIO_AXES_PROJECT accepts a locally prepared native-data project;
 * private projects/proofs must remain local and are never sent to remote hosts. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.STUDIO_AXES_PROOF||path.join(root,'.cache/axis-settings-qa');fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_BROWSER?{executablePath:process.env.STUDIO_BROWSER}:{channel:'chrome'})});
 const remote=[],errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:Number(process.env.STUDIO_AXES_WIDTH)||1280,height:900}});
  page.on('dialog',dialog=>dialog.accept());
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol.startsWith('http')&&!['127.0.0.1','localhost'].includes(url.hostname)){remote.push(url.href);route.abort();}else route.continue();});
  await page.goto(process.env.STUDIO_AXES_URL||'http://127.0.0.1:18944/');await page.locator('#language').selectOption('en');
  if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();
  let payload;
  if(process.env.STUDIO_AXES_PROJECT)payload=JSON.parse(fs.readFileSync(process.env.STUDIO_AXES_PROJECT,'utf8'));
  else payload=await page.evaluate(async()=>{
   const engine=JSON.parse(document.getElementById('local-engine').textContent),recipe={family:'gallery',parameters:{view:'relation_scatter'}},rows=[['unit','x','y'],['a','.1','.2'],['b','.5','.9'],['c','1','2.4'],['d','5','8'],['e','10','20']];
   const response=await fetch(engine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':engine.token},body:JSON.stringify({recipe,rows})}),result=await response.json();if(!response.ok)throw Error(result.error);
   const project=JSON.parse(document.getElementById('project').textContent);project.id='aaccee00998877665544';project.title='EXAMPLE DATA - axis engineering acceptance';const asset=result.panel;asset.id='panel-0';project.panels=[asset];project.initialState={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:asset.initialVariant||0,edits:{}}}};return {project,state:project.initialState,checkpoints:[]};
  });
  await page.locator('#projectFile').setInputFiles({name:'local-axis-acceptance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
  await page.waitForFunction(()=>document.querySelectorAll('#artboard g[id*="axes_"]').length>0);
  if(await page.locator('.studio-drawers').count()){await page.locator('#commandSearch').click();await page.locator('#commandQuery').fill('axis settings');await page.locator('#command-axes').click();}
  else{await page.locator('[data-tab="detail"]').click();await page.locator('#professionalAxes').waitFor({state:'visible'});await page.locator('#professionalAxes').click();}
  const host=page.locator('#professionalAxesHost'),field=key=>host.locator('[data-axis-field="'+key+'"]');
  await host.locator('.axis-settings-live input').uncheck();assert.equal(await host.locator('details').count(),4);
  async function openSection(index){const section=host.locator('details').nth(index);if(!await section.evaluate(node=>node.open))await section.locator('summary').click();}
  async function save(){const next=page.waitForEvent('download');await page.locator('#save').click();return JSON.parse(fs.readFileSync(await (await next).path(),'utf8'));}
  const before=await save(),beforeId=before.state.order[0],source=before.project.panels.find(p=>p.id===beforeId),table=source.table.rows;
  await field('min').fill('0');await field('max').fill('25');await openSection(1);await field('major_step').fill('5');await field('tick_format').selectOption('decimal');await field('decimals').fill('1');
  await openSection(2);await field('plot_width_pt').fill('240');await field('plot_height_pt').fill('180');
  await openSection(3);await field('axis_width_pt').fill('1.8');await field('tick_label_size_pt').fill('11');await field('axis_box').selectOption('full');
  await host.getByRole('button',{name:'Apply',exact:true}).click();await host.locator('[role=status]').getByText('Axis settings applied.',{exact:true}).waitFor({timeout:90000});
  const applied=await save(),id=applied.state.order[0],asset=applied.project.panels.find(p=>p.id===id);assert.notEqual(id,beforeId);assert.deepEqual(asset.table.rows,table);assert.equal(asset.recipe.axis_settings.y_min,0);assert.equal(asset.recipe.axis_settings.y_max,25);assert.equal(asset.recipe.axis_settings.y_major_step,5);assert.equal(asset.recipe.axis_settings.plot_width_pt,240);assert.equal(asset.recipe.axis_settings.plot_height_pt,180);
  assert.ok(await page.locator('#artboard text').filter({hasText:/^25\.0$/}).count());checks.push('discoverable professional axis entry; four sections; real local range/ticks/appearance/physical frame redraw');
  await page.screenshot({path:path.join(out,'axes-native-editor.png')});
  await page.locator('#undo').click();const undone=await save();assert.equal(undone.state.order[0],beforeId);await page.locator('#redo').click();const redone=await save();assert.equal(redone.state.order[0],id);checks.push('single undo/redo restores original artwork and new recipe');
  await page.locator('#projectFile').setInputFiles({name:'axis-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(redone))});const reopened=await save();assert.deepEqual(reopened.project.panels.find(p=>p.id===id).table.rows,table);assert.deepEqual(reopened.project.panels.find(p=>p.id===id).recipe.axis_settings,asset.recipe.axis_settings);checks.push('save/reopen retains unchanged source observations and declarative axis settings');
  const numericTick=page.locator('#artboard g[id*="ytick_"] text').first();await numericTick.dblclick();await host.locator('.axis-settings').waitFor({state:'visible'});checks.push('double-click a recognized numeric axis tick opens settings');
  for(const [button,extension]of [['export','svg'],['png','png']]){await page.locator('#exportMenu summary').click();const next=page.waitForEvent('download');await page.locator('#'+button).click();const download=await next,bytes=fs.readFileSync(await download.path());assert.ok(bytes.length>500);if(extension==='svg'){assert.match(bytes.toString(),/>25\.0</);fs.writeFileSync(path.join(out,'native-axis-export.svg'),bytes);}else assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
  checks.push('SVG and PNG export reflect actual data-axis redraw');assert.equal(remote.length,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',source:process.env.STUDIO_AXES_PROJECT?'explicit local native-data project':'deterministic engineering fixture; not scientific validation',checks,remoteRequests:remote,errors},null,2));console.log('PASS '+checks.join('; '));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
