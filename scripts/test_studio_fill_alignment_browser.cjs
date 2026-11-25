'use strict';
// Data-coordinate fills must follow axis alignment; marker symbols must not resize.
// Real Chrome + production editor from synthetic SVGs written here:
//   node scripts/test_studio_fill_alignment_browser.cjs output-folder [python]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const out=path.resolve(process.argv[2]),python=process.argv[3]||'python',root=path.resolve(__dirname,'..');fs.mkdirSync(out,{recursive:true});
// Matplotlib writes fill_between as <use x="0" y="figure height"> of a path in
// absolute coordinates, and scatter markers as <use> anchored at each point.
const svg=(axes,name)=>`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="345.6pt" height="244.8pt" viewBox="0 0 345.6 244.8"><g id="figure_1"><g id="patch_1"><path d="M0 244.8L345.6 244.8L345.6 0L0 0z" style="fill:#fff"/></g><g id="axes_1">
<g id="${name}"><defs><path id="band" d="M 60 -60 L 320 -200 L 320 -160 L 60 -20 z" style="stroke: none"/></defs><g clip-path="url(#clip)"><use xlink:href="#band" x="0" y="244.8" style="fill:#c9603f;fill-opacity:.2"/></g></g>
<g id="line2d_9"><path d="M 60 204.8 L 320 64.8" clip-path="url(#clip)" style="fill:none;stroke:#c9603f;stroke-width:2"/></g>
<g id="PathCollection_1"><defs><path id="dot" d="M 0 3 L 3 0 L 0 -3 L -3 0 z"/></defs><g clip-path="url(#clip)"><use xlink:href="#dot" x="60" y="204.8" style="fill:#3f5bd9"/><use xlink:href="#dot" x="320" y="64.8" style="fill:#3f5bd9"/></g></g>
<g id="text_1"><text x="${axes}" y="236" style="font:10px 'Arial'">Time (h)</text></g></g></g><defs><clipPath id="clip"><rect x="50" y="20" width="280" height="200"/></clipPath></defs></svg>`;
for(const [i,name]of ['FillBetweenPolyCollection_1','PolyCollection_1','studio-mark-fill','FillBetweenPolyCollection_1'].entries())fs.writeFileSync(path.join(out,`p${i}.svg`),svg(150+i*4,name));
const html=path.join(out,'editor.html');fs.rmSync(html,{force:true});
const built=spawnSync(python,['-X','utf8',path.join(root,'sci_figures.py'),'studio',...[0,1,2,3].map(i=>path.join(out,`p${i}.svg`)),'--out',html,'--columns','2'],{encoding:'utf8'});assert.equal(built.status,0,built.stderr);
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(pathToFileURL(html).href);await page.waitForFunction(()=>!document.body.inert&&document.querySelector('#artboard svg'));await page.waitForTimeout(500);
    const panels=await page.evaluate(()=>[...document.querySelectorAll('#artboard svg[data-panel]')].map(p=>{const r=n=>{const b=n.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom];},uses=[...p.querySelectorAll('use')].filter(n=>!n.closest('defs'));return {aligned:p.hasAttribute('data-aligned-plot'),band:r(uses[0]),line:r(p.querySelector('[id*="line2d_9"] path')),dots:uses.slice(1).map(r)};}));
    assert.equal(panels.length,4);assert(panels.some(p=>p.aligned),'The fixture must exercise axis alignment');
    for(const [i,p]of panels.entries()){
      const [l,t,r,b]=p.band,[ll,lt,lr,lb]=p.line,h=lb-lt;
      // The band spans the line horizontally and 20 units above/below of 140.
      assert(Math.abs(l-ll)<1.5&&Math.abs(r-lr)<1.5,`panel ${i}: fill is horizontally detached ${JSON.stringify(p)}`);
      assert(Math.abs((lt-t)/h-20/140)<.02&&Math.abs((b-lb)/h-20/140)<.02,`panel ${i}: fill is vertically detached ${JSON.stringify(p)}`);
      for(const d of p.dots)assert(Math.abs((d[2]-d[0])-(d[3]-d[1]))<.6,`panel ${i}: marker symbol was distorted`);
    }
    // Figure Discovery opens inside the tool body, not a collapsed grid track.
    await page.locator('#drawerTaskbar [data-drawer-category]').first().click();await page.locator('button:visible',{hasText:'数据与智能选图'}).first().click();await page.waitForTimeout(400);
    if(await page.locator('#figureDiscoveryDialog[open]').count()===0)await page.locator('#openDiscovery').click();
    await page.locator('#figureDiscoveryDialog').waitFor({state:'visible'});const box=await page.locator('#figureDiscoveryDialog').boundingBox();assert(box.width>200,'Discovery panel width '+box.width);
    await page.screenshot({path:path.join(out,'discovery.png')});assert.deepEqual(errors,[]);
    console.log('PASS data-coordinate fills follow aligned axes, markers keep shape, and Discovery keeps a usable width');
  }finally{await page.screenshot({path:path.join(out,'last.png')}).catch(()=>{});await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
