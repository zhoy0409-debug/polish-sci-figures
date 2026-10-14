'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const links=require('../skills/polish-sci-figures/assets/figure-studio/image-links.js');
const parent={panelId:'panel-a',variant:0,key:'e0'},child={panelId:'panel-b',variant:0,key:'e0'};
const poly=[{x:.25,y:.25},{x:.5,y:.25},{x:.5,y:.5},{x:.25,y:.5}],record={id:'link-1',parent,child,polygon:poly};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('relationships validate references, convex geometry, styles, uniqueness and cycles',()=>{
  const a=links.validate(record);assert.equal(a.visible,true);assert.equal(a.color,'#202020');assert.equal(a.dash,'short');
  for(const bad of [{...record,polygon:[poly[0],poly[2],poly[1],poly[3]]},{...record,child:parent},{...record,stroke:0},{...record,evidence:{source:'guessed'}},{...record,id:'bad id'},{...record,color:'url(x)'}])assert.throws(()=>links.validate(bad));
  assert.throws(()=>links.validateAll([record,record]),/重复/);
  assert.throws(()=>links.validateAll([record,{...record,id:'link-2',parent:child,child:parent}]),/循环/);
});
test('display-to-original coordinates are reversible for every orthogonal rotation and reflection',()=>{
  for(const orientation of ['normal','rotate90','rotate180','rotate270','flipX','flipY','transpose','transverse']){const p={x:.21,y:.63},restored=links.displayToRaw(links.rawToDisplay(p,orientation),orientation);near(restored.x,p.x);near(restored.y,p.y);}
  assert.deepEqual(links.rawToDisplay({x:0,y:0},'rotate90'),{x:1,y:0});
});
test('anchor snapshots are bounded and clamp only insignificant normalized crop roundoff',()=>{
  const snapshot={roi:{x:-1e-10,y:0,w:1+2e-10,h:1},orientation:'normal',widthPx:1000,heightPx:500,signature:'fnv1a:20000:aabbccdd'};
  const saved=links.validate({...record,anchors:{parent:snapshot,child:snapshot}});assert.deepEqual(saved.anchors.parent.roi,{x:0,y:0,w:1,h:1});
  for(const bad of [{...snapshot,signature:''},{...snapshot,signature:'data:image/png;base64,original'},{...snapshot,orientation:'rotate15'},{...snapshot,roi:{x:-.001,y:0,w:1,h:1}},{...snapshot,widthPx:1.5}])assert.throws(()=>links.validate({...record,anchors:{parent:bad,child:snapshot}}));
  assert.throws(()=>links.validate({...record,anchors:{parent:snapshot}}));assert.equal(links.validate(record).anchors,undefined);
});
test('same-source genuine nested crops create evidence without a matching algorithm',()=>{
  const image={localName:'image',getAttribute:()=> 'data:image/png;base64,abc'},p={image,roi:{x:.1,y:.2,w:.8,h:.6},widthPx:1000,heightPx:500,orientation:'flipX'},c={...p,roi:{x:.3,y:.3,w:.2,h:.1}};
  const match=links.knownCropMatch(p,c);assert.equal(match.evidence.source,'known-crop');near(match.polygon[0].x,.75);near(match.polygon[0].y,1/6);
  assert.equal(links.knownCropMatch(p,p),null);assert.equal(links.knownCropMatch(c,p),null);
  assert.equal(links.knownCropMatch(p,{...c,image:{localName:'image',getAttribute:()=> 'data:image/png;base64,other'}}),null);
});
test('connecting lines select the nearest distinct corners without crossing or passing through the rectangles',()=>{
  const p=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],c=p.map(q=>({x:q.x+30,y:q.y})),lines=links.connections(p,c);
  assert.equal(lines.length,2);assert.ok(lines.every(([a,b])=>a.x===10&&b.x===30&&a.y===b.y));
  assert.equal(links.connections(p,p).length,0);
});
if(process.argv.includes('--dom')){
  const {JSDOM}=require('jsdom');global.StudioImageInsets=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
  function fixture(){const doc=new JSDOM('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300"><svg data-panel="panel-a" data-variant="0" width="200" height="100" viewBox="0 0 200 100"><image data-key="e0" x="0" y="0" width="200" height="100" href="data:image/png;base64,abc"/></svg><svg data-panel="panel-b" data-variant="0" x="300" width="100" height="100" viewBox="0 0 100 100"><image data-key="e0" width="100" height="100" href="data:image/png;base64,other"/></svg></svg>',{contentType:'image/svg+xml'}).window.document,root=doc.documentElement;return {doc,root,resolve:ref=>({image:root.querySelector(`[data-panel="${ref.panelId}"] image`),roi:{x:0,y:0,w:1,h:1},widthPx:1000,heightPx:ref.panelId==='panel-a'?500:1000})};}
  test('render uses current image transforms and follows movement without changing source pixels',()=>{
    const f=fixture(),image=f.resolve(parent).image,before=image.outerHTML;
    const g=links.render(f.root,[record],{resolve:f.resolve,unit:1});assert.equal(g.querySelectorAll('polygon').length,1);assert.equal(g.querySelectorAll('line').length,2);assert.equal(image.outerHTML,before);
    assert.equal(g.querySelector('polygon').getAttribute('points'),'50,25 100,25 100,50 50,50');
    image.setAttribute('transform','translate(20 30)');const moved=links.render(f.root,[record],{resolve:f.resolve});assert.equal(moved.querySelector('polygon').getAttribute('points'),'70,55 120,55 120,80 70,80');
  });
  test('flipped and nested inset crop coordinates remain linked in original pixels',()=>{
    const f=fixture(),image=f.resolve(parent).image;image.setAttribute('transform','translate(200 0) scale(-1 1)');
    const resolve=ref=>({...f.resolve(ref),orientation:ref.panelId==='panel-a'?'flipX':'normal'});
    const g=links.render(f.root,[record],{resolve});assert.equal(g.querySelector('polygon').getAttribute('points'),'50,25 100,25 100,50 50,50');
    const crop=f.doc.createElementNS(f.root.namespaceURI,'svg');crop.setAttribute('x','300');crop.setAttribute('y','150');crop.setAttribute('width','100');crop.setAttribute('height','50');crop.setAttribute('viewBox','250 125 250 125');
    const cropped=image.cloneNode();cropped.removeAttribute('transform');cropped.setAttribute('width','1000');cropped.setAttribute('height','500');crop.append(cropped);f.root.append(crop);
    const insetResolve=ref=>ref.insetId?{image:cropped,roi:{x:.25,y:.25,w:.25,h:.25},widthPx:1000,heightPx:500}:resolve(ref);
    const result=links.render(f.root,[{...record,child:{insetId:'detail'}}],{resolve:insetResolve});assert.equal(result.querySelectorAll('polygon').length,1);assert.equal(result.querySelectorAll('line').length,2);
    assert.ok([...result.querySelectorAll('line')].every(n=>+n.getAttribute('x2')>=300&&+n.getAttribute('x2')<=400));
  });
  test('hidden, changed variant, missing and ambiguously transformed sources never draw stale lines',()=>{
    for(const change of [f=>f.resolve(parent).image.setAttribute('display','none'),f=>f.resolve(parent).image.parentElement.setAttribute('data-variant','1'),f=>f.resolve(parent).image.remove(),f=>f.resolve(parent).image.setAttribute('transform','rotate(15)')]){
      const f=fixture();change(f);const result=links.render(f.root,[record],{resolve:f.resolve});assert.equal(result.querySelectorAll('polygon,line').length,0);assert.ok(result.querySelector('[data-image-link-unavailable]'));
    }
    const f=fixture();assert.equal(links.render(f.root,[{...record,visible:false}],{resolve:f.resolve}).children.length,0);
  });
  test('simple compact clip is accepted only when the declared visible crop is fully contained',()=>{
    const f=fixture(),owner=f.resolve(parent).image.parentElement;owner.insertAdjacentHTML('afterbegin','<defs><clipPath id="clip" clipPathUnits="userSpaceOnUse"><rect x="20" y="10" width="100" height="60"/></clipPath></defs>');owner.setAttribute('clip-path','url(#clip)');
    const invalid=links.render(f.root,[record],{resolve:f.resolve});assert.ok(invalid.querySelector('[data-image-link-unavailable]'));
    const resolve=ref=>({...f.resolve(ref),roi:ref.panelId==='panel-a'?{x:.1,y:.1,w:.5,h:.6}:{x:0,y:0,w:1,h:1}});
    const valid=links.render(f.root,[record],{resolve});assert.equal(valid.querySelectorAll('polygon').length,1);
    owner.querySelector('rect').setAttribute('rx','3');assert.ok(links.render(f.root,[record],{resolve}).querySelector('[data-image-link-unavailable]'));
  });
  test('anchored matches reject crop, direction, pixel-dimension and source changes but follow movement and resizing',()=>{
    const f=fixture(),describe=ref=>({...f.resolve(ref),orientation:'normal',signature:ref.panelId==='panel-a'?'sha256:parent-original':'sha256:child-original'});
    const snapshot=desc=>({roi:{...desc.roi},orientation:desc.orientation,widthPx:desc.widthPx,heightPx:desc.heightPx,signature:desc.signature});
    const anchored=links.validate({...record,anchors:{parent:snapshot(describe(parent)),child:snapshot(describe(child))}});
    assert.equal(links.render(f.root,[anchored],{resolve:describe}).querySelectorAll('polygon').length,1);
    const changed=[desc=>({...desc,roi:{x:.1,y:0,w:.9,h:1}}),desc=>({...desc,orientation:'flipX'}),desc=>({...desc,widthPx:2000}),desc=>({...desc,signature:'sha256:replaced-image'}),desc=>({...desc,signature:undefined})];
    for(const key of ['panel-a','panel-b'])for(const mutate of changed){const result=links.render(f.root,[anchored],{resolve:ref=>ref.panelId===key?mutate(describe(ref)):describe(ref)});assert.equal(result.querySelectorAll('polygon,line').length,0);assert.match(result.querySelector('[data-image-link-unavailable]').getAttribute('data-image-link-unavailable'),/重新匹配/);}
    const owner=f.resolve(parent).image.parentElement;owner.setAttribute('x','20');owner.setAttribute('width','220');owner.setAttribute('height','110');
    const moved=links.render(f.root,[anchored],{resolve:describe});assert.equal(moved.querySelectorAll('polygon').length,1);moved.querySelector('polygon').getAttribute('points').split(/[ ,]/).map(Number).forEach((n,i)=>near(n,[75,27.5,130,27.5,130,55,75,55][i]));
    // Legacy saved relationships remain readable; new host-created ones carry snapshots.
    assert.equal(links.render(f.root,[record],{resolve:describe}).querySelectorAll('polygon').length,1);
  });
  test('single-parent export retains its verified ROI without resolving an out-of-panel child',()=>{
    const f=fixture(),snapshot={roi:{x:0,y:0,w:1,h:1},orientation:'normal',widthPx:1000,heightPx:500,signature:'original-parent'},recordWithAnchors={...record,anchors:{parent:snapshot,child:{...snapshot,heightPx:1000,signature:'absent-child'}}};
    f.resolve(child).image.parentElement.remove();let childRequests=0;
    const resolve=ref=>{if(ref.panelId===child.panelId){childRequests++;return null;}return {...f.resolve(ref),signature:'original-parent'};};
    const exported=links.render(f.root,[recordWithAnchors],{resolve,parentOnly:true});assert.equal(childRequests,0);assert.equal(exported.querySelectorAll('polygon').length,1);assert.equal(exported.querySelectorAll('line').length,0);
    const whole=links.render(f.root,[recordWithAnchors],{resolve});assert.equal(childRequests,1);assert.ok(whole.querySelector('[data-image-link-unavailable]'));assert.equal(whole.querySelectorAll('polygon,line').length,0);
    assert.ok(links.render(f.root,[recordWithAnchors],{resolve:ref=>({...resolve(ref),signature:'changed-parent'}),parentOnly:true}).querySelector('[data-image-link-unavailable]'));
  });
}
