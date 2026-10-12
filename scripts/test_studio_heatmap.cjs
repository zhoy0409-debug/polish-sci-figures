/* Node state checks; --browser additionally checks actual SVG geometry in Chrome. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const sourcePath=path.resolve('skills/polish-sci-figures/assets/figure-studio/studio.js');
const {History,validateState,installPanelState,heatmapCellInfo,heatmapNumber,heatmapContrast,validateHeatmapLabels,validateHeatmapPalette,heatmapPaletteColor,applyHeatmapPalette,heatmapFloat}=require(sourcePath);
const exact=-1.2345678912345678,bytes=Buffer.alloc(8);bytes.writeDoubleBE(exact);
assert.equal(heatmapCellInfo(`studio-heat-value-2-${bytes.toString('hex')}-3f6da3-0-2`).value,exact);
assert.equal(heatmapNumber(-.000001,2),'0.00');assert.equal(heatmapNumber(exact,4),'-1.2346');
assert.equal(heatmapContrast('#ffffff'),'#000000');assert.equal(heatmapContrast('#000000'),'#ffffff');
assert.equal(heatmapContrast('rgb(0, 0, 0)'),'#ffffff');
const diverging={stops:['#0000ff','#ffffff','#ff0000']},sequential={stops:['#ffffff','#000000']};
assert.equal(heatmapPaletteColor(0,diverging,.25),'#0000ff');assert.equal(heatmapPaletteColor(.25,diverging,.25),'#ffffff');assert.equal(heatmapPaletteColor(1,diverging,.25),'#ff0000');
assert.equal(heatmapPaletteColor(.625,diverging,.25),'#ff8080');assert.equal(heatmapPaletteColor(.5,sequential),'#808080');
for(const stops of [[],['#bad'],['red','blue'],['#ffffff','#000000','url(test)']])assert.throws(()=>validateHeatmapPalette({stops}));
// Consume real renderer metadata, checking every destination cell and every
// existing colorbar face without recomputing a range from the displayed cells.
const fixture='.cache/heatmap-qa/clustered_matrix-normal.svg';
if(fs.existsSync(fixture)){
  const raw=fs.readFileSync(fixture,'utf8'),ids=[...raw.matchAll(/id="(studio-heat-[^"]+)"/g)].map(m=>m[1]);
  const groups=ids.filter(id=>id.startsWith('studio-heat-value-')).map(id=>({id})),boxes=new Map(groups.map(g=>[heatmapCellInfo(g.id).index,{style:{opacity:'0',fill:'original'}}]));
  const originals=ids.filter(id=>id.startsWith('studio-heat-source-')).map(id=>({id,style:{opacity:'1'}}));
  const scales=ids.filter(id=>id.startsWith('studio-heat-scale-')).map(id=>{const positions=id.split('-').at(-1).split('_').map(heatmapFloat),paths=positions.map(()=>({style:{fill:'original'},closest:()=>null}));return{id,positions,paths,querySelectorAll:()=>paths};});
  const svg={querySelectorAll:selector=>selector.includes('value-')?groups:selector.includes('source-')?originals:scales,querySelector:selector=>boxes.get(selector.match(/box-(\d+)/)[1])};
  applyHeatmapPalette(svg,null);assert.ok([...boxes.values()].every(b=>b.style.opacity==='0'));
  applyHeatmapPalette(svg,diverging);
  for(const group of groups){const info=heatmapCellInfo(group.id),box=boxes.get(info.index);assert.equal(box.style.opacity,'1');assert.equal(box.style.fill,heatmapPaletteColor(info.normalized,diverging,info.midpoint));}
  assert.ok(originals.length&&originals.every(s=>s.style.opacity==='0'));assert.ok(scales.length);
  for(const scale of scales){const midpoint=heatmapFloat(scale.id.split('-')[4]);scale.paths.forEach((p,i)=>assert.equal(p.style.fill,heatmapPaletteColor(scale.positions[i],diverging,midpoint)));}
}
for(const bad of [{visible:1},{visible:true,decimals:8,fontSize:8,color:'auto'},{visible:true,decimals:2,fontSize:8,color:'url(test)'}])assert.throws(()=>validateHeatmapLabels(bad));
const initial={order:['panel-0'],columns:1,gap:14,panels:{'panel-0':{variant:0,edits:{}}}},project={panels:[{id:'panel-0',variants:[{}]}]},h=new History(initial);
const next=structuredClone(initial);next.panels['panel-0'].heatmapLabels={visible:true,decimals:3,fontSize:11,color:'#394759'};validateState(next,project);h.commit(next);
next.panels['panel-0'].heatmapPalette=diverging;validateState(next,project);h.commit(next);
h.undo();assert.equal(h.current.panels['panel-0'].heatmapPalette,undefined);h.redo();assert.deepEqual(h.current,next);
const restored=History.restore(JSON.parse(JSON.stringify(h.toJSON())),project,h.current);assert.deepEqual(restored.current,next);
const replaced=installPanelState(next,'panel-0','panel-1',0,null);assert.deepEqual(replaced.panels['panel-1'].heatmapLabels,next.panels['panel-0'].heatmapLabels);
assert.deepEqual(replaced.panels['panel-1'].heatmapPalette,diverging);
const production=fs.readFileSync(sourcePath,'utf8');assert.match(production,/\['heatmapFontSize','heatmapDecimals','heatmapColor'\]\.includes\(id\)\)\$\(id\)\.addEventListener\('input',updateHeatmapLabels\)/);
console.log('Heatmap exact-value, formatting, contrast, invalid input, undo/redo, JSON restore and replacement tests passed.');

async function browserChecks(){
  const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,channel:process.env.STUDIO_BROWSER_CHANNEL||'chrome'});
  try{
    const page=await browser.newPage({viewport:{width:1550,height:700}}),source=fs.readFileSync(sourcePath,'utf8');
    const html=fs.readFileSync('.cache/heatmap-qa/heatmap-studio.html','utf8'),project=JSON.parse(html.match(/<script type="application\/json" id="project">([\s\S]*?)<\/script>/)[1]);
    let cases=0;
    for(const size of ['normal','wide','portrait']){
      await page.setContent('<style>body{margin:24px;font-family:Arial;background:#f4f5f7}.grid{display:flex;align-items:flex-start;gap:18px}.card{padding:15px;background:white;border:1px solid #dde1e8;border-radius:8px}.card svg{display:block;width:440px;height:auto}h2{font-size:14px;color:#344054;margin:0 0 10px}</style><main class="grid"></main>');
      await page.addScriptTag({content:source.slice(0,source.indexOf("if (typeof module !== 'undefined')"))});
      for(const panel of project.panels){
        const variant=panel.variants.find(v=>v.size===size||(size==='normal'&&v.size==='original'));
        await page.locator('main').evaluate((main,{name,svg})=>{const card=document.createElement('article');card.className='card';card.innerHTML='<h2></h2>'+svg;card.querySelector('h2').textContent=name;main.append(card);},{name:panel.name,svg:variant.svg});
      }
      const result=await page.evaluate(()=>{
        const results=[];
        for(const svg of document.querySelectorAll('svg')){
          applyHeatmapValueLabels(svg,{visible:true,decimals:3,fontSize:14,color:'auto'});
          for(const group of svg.querySelectorAll('[id*="studio-heat-value-"]')){
            const info=heatmapCellInfo(group.id),text=group.querySelector('text'),box=svg.querySelector(`[id$="studio-heat-box-${info.index}"] path`);
            const a=text.getBoundingClientRect(),b=box.getBoundingClientRect();
            if(text.textContent!==heatmapNumber(info.value,3))throw Error('Rounded value mismatch');
            if(a.left<b.left-.6||a.right>b.right+.6||a.top<b.top-.6||a.bottom>b.bottom+.6)throw Error('Value outside cell '+info.index+': '+JSON.stringify({a:a.toJSON(),b:b.toJSON()}));
          }
          const count=svg.querySelectorAll('[id*="studio-heat-value-"]').length;
          applyHeatmapValueLabels(svg,{visible:false,decimals:2,fontSize:9,color:'auto'});
          if([...svg.querySelectorAll('[id*="studio-heat-value-"] text')].some(t=>getComputedStyle(t).opacity!=='0'))throw Error('Hidden value still visible');
          applyHeatmapValueLabels(svg,{visible:true,decimals:2,fontSize:9,color:'#344054'});
          if([...svg.querySelectorAll('[id*="studio-heat-value-"] text')].some(t=>getComputedStyle(t).fill!=='rgb(52, 64, 84)'))throw Error('Custom color was not applied');
          applyHeatmapValueLabels(svg,{visible:true,decimals:2,fontSize:9,color:'auto'});
          const exported=new DOMParser().parseFromString(new XMLSerializer().serializeToString(svg),'image/svg+xml');
          if(exported.querySelectorAll('[id*="studio-heat-value-"] text').length!==count)throw Error('Export lost editable labels');
          results.push(count);
        }
        return results;
      });
      cases+=result.length;await page.screenshot({path:'.cache/heatmap-qa/values-'+size+'.png',fullPage:true});
    }
    console.log(`${cases} actual SVG tests passed: 3 templates × 3 sizes, show/hide, exact rounding, auto-fitting, custom color, editable export.`);
  }finally{await browser.close();}
}
if(process.argv.includes('--browser'))browserChecks().catch(e=>{console.error(e);process.exitCode=1;});
