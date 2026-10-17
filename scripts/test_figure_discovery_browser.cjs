/* Real Chromium + loopback engine: upload -> recommend -> apply -> undo/redo -> save/reopen.
 * Run with STUDIO_DISCOVERY_URL pointing to a newly generated local starter. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),out=process.env.STUDIO_DISCOVERY_PROOF||path.join(ROOT,'.cache/discovery-qa');fs.mkdirSync(out,{recursive:true});
async function main(){
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_BROWSER?{executablePath:process.env.STUDIO_BROWSER}:{channel:'chrome'})});
 try{
 const page=await browser.newPage({viewport:{width:1700,height:1200}}),errors=[],remote=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.protocol.startsWith('http')&&!['127.0.0.1','localhost'].includes(url.hostname)){remote.push(url.href);route.abort();}else route.continue();});
 await page.goto(process.env.STUDIO_DISCOVERY_URL||'http://127.0.0.1:18941/');
 await page.locator('#language').selectOption('en');await page.locator('#startDiscovery').click();
 await page.locator('#discoveryFile').setInputFiles(process.env.STUDIO_DISCOVERY_TABLE||path.join(ROOT,'scripts/fixtures/discovery/independent.csv'));
 await page.locator('#discoverySummary').getByText(/6 rows/).waitFor();
 for(const [key,value]of Object.entries({data_level:'raw',design:'independent',outcome_type:'continuous',technical_replicates:'no',nesting:'none'}))await page.locator('#discovery-'+key).selectOption(value);
 await page.locator('#discovery-unit_confirmed').check();await page.locator('#discoveryRun').click();
 await page.waitForFunction(()=>/Generated [3-6] actual-data views/.test(document.getElementById('discoveryStatus').textContent),{},{timeout:90000});
 assert.ok(await page.locator('.discovery-card svg').count()>=3);assert.equal(remote.length,0,'no remote request before a user starts literature search');
 const literature=page.locator('#discoveryEvidence');await literature.locator('summary').click();await literature.locator('.literature-topic').fill('Control');await literature.getByRole('button',{name:'Find examples',exact:true}).click();assert.equal(remote.length,0,'local table values are blocked even after a search click');assert.match(await literature.locator('.literature-status').textContent(),/short topic keywords/);
 await page.locator('#discoveryCards').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'independent-en.png')});
 await page.locator('.discovery-apply').first().click();
 async function saved(){const pending=page.waitForEvent('download');await page.locator('#save').click();const download=await pending;return JSON.parse(fs.readFileSync(await download.path(),'utf8'));}
 const applied=await saved();assert.equal(applied.state.order.length,1);let id=applied.state.order[0];assert.equal(applied.project.panels.find(p=>p.id===id).provenance,'user-data');
 await page.locator('#undo').click();const undone=await saved();assert.equal(undone.state.order[0],'panel-0');
 await page.locator('#redo').click();const redone=await saved();assert.equal(redone.state.order[0],id);
 await page.locator('#projectFile').setInputFiles({name:'discovery-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(redone))});
 const reopened=await saved();assert.equal(reopened.state.order[0],id);assert.deepEqual(reopened.project.panels.find(p=>p.id===id).table.rows,redone.project.panels.find(p=>p.id===id).table.rows);
 for(const [button,extension]of [['export','svg'],['png','png']]){
  await page.locator('#exportMenu summary').click();const pending=page.waitForEvent('download');await page.locator('#'+button).click();const download=await pending;const bytes=fs.readFileSync(await download.path());
  assert.ok(bytes.length>500,'nonempty '+extension+' export');if(extension==='svg')assert.match(bytes.toString(),/<svg[\s>]/);else assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  fs.writeFileSync(path.join(out,'actual-data-export.'+extension),bytes);
 }
 await page.locator('[data-tab="explore"]').click();await page.locator('#openDiscovery').click();await page.locator('#discoveryRun').click();await page.waitForFunction(()=>/Generated/.test(document.getElementById('discoveryStatus').textContent),{},{timeout:90000});
 await page.locator('#discovery-design').selectOption('paired');assert.equal(await page.locator('.discovery-card').count(),0,'design edits invalidate all previews immediately');
 await page.locator('#discoveryRun').click();assert.match(await page.locator('#discoveryStatus').textContent(),/No eligible/);
 await page.locator('#figureDiscoveryDialog .dialog-head button').click();
 await page.locator('#language').selectOption('zh-CN');await page.locator('[data-tab="explore"]').click();await page.locator('#openDiscovery').click();
 await page.locator('#discoveryFile').setInputFiles(path.join(ROOT,'scripts/fixtures/discovery/paired.csv'));
 await page.locator('#discoverySummary').getByText(/6 行/).waitFor();
 for(const [key,value]of Object.entries({data_level:'raw',design:'paired',outcome_type:'continuous',technical_replicates:'no',nesting:'none'}))await page.locator('#discovery-'+key).selectOption(value);
 await page.locator('#discovery-pair_before').fill('Before');await page.locator('#discovery-pair_after').fill('After');await page.locator('#discovery-unit_confirmed').check();await page.locator('#discoveryRun').click();
 await page.waitForFunction(()=>/已生成 [1-6] 个真实数据方案/.test(document.getElementById('discoveryStatus').textContent),{},{timeout:90000});
 assert.equal(await page.locator('.discovery-card').count(),2,'paired semantic alternatives are not padded');
 await page.locator('#discoveryCards').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'paired-zh.png')});
 assert.equal(remote.length,0);assert.deepEqual(errors,[]);
 // Standalone file tests the no-Python/no-WASM fallback, with all network blocked.
 const offline=await browser.newPage({viewport:{width:1400,height:1000}});let offlineRequests=0;await offline.route('http**://**',r=>{offlineRequests++;r.abort();});
 const {pathToFileURL}=require('node:url');await offline.goto(pathToFileURL(path.join(ROOT,'.cache/discovery-starter.html')).href);await offline.locator('#language').selectOption('en');await offline.locator('#startDiscovery').click();
 await offline.locator('#discoveryFile').setInputFiles(path.join(ROOT,'scripts/fixtures/discovery/summary.csv'));await offline.locator('#discoverySummary').getByText(/2 rows/).waitFor();await offline.locator('#discovery-data_level').selectOption('summary');await offline.locator('#discoveryRun').click();await offline.waitForFunction(()=>/Generated 1 actual-data/.test(document.getElementById('discoveryStatus').textContent));
 assert.equal(await offline.locator('.discovery-card svg').count(),1);await offline.locator('.discovery-apply').click();assert.equal(offlineRequests,0);await offline.screenshot({path:path.join(out,'offline-editor.png')});
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,url:process.env.STUDIO_DISCOVERY_URL,table:process.env.STUDIO_DISCOVERY_TABLE?path.basename(process.env.STUDIO_DISCOVERY_TABLE):'independent.csv',checks:['table upload','shared core','>=3 real independent previews','paired long-table pivot','Chinese and English','apply','undo','redo','save/reopen','SVG export','PNG export','design invalidation','zero unauthorized remote requests','private table value blocked on search click','standalone offline summary render and apply'],remoteRequests:remote,errors},null,2));
 console.log('PASS real Chromium discovery flow, editor history/project roundtrip, Chinese/English, local actual-data rendering, offline fallback and zero unauthorized remote requests');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
