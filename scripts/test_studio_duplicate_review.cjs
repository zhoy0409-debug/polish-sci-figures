'use strict';
const assert=require('node:assert/strict');
const review=require('../skills/polish-sci-figures/assets/figure-studio/duplicate-review.js');
const png='data:image/png;base64,YWJj';
const source=(id)=>({id,label:id,data:png});
const image=id=>({id,label:id,width:400,height:300,analysisWidth:400,analysisHeight:300,thumbnail:png,reviewPreview:png});
const refs={a:{panelId:'panel-0',vi:0,key:'e4',sourceId:'a'},b:{panelId:'panel-1',vi:0,key:'e8',sourceId:'b'}};
const record={format:'figure-studio-image-check-v2',projectId:'abc123',createdAt:'2026-10-13',updatedAt:'2026-10-13',scope:'all',sources:[source('a'),source('b')],refs,reviews:{'["a","b"]':{status:'legitimate',note:'Shared control — verified against source experiment.',updatedAt:'2026-10-13'}},result:{images:[image('a'),image('b')],matches:[{a:'a',b:'b',kind:'exact',evidence:png}]}};
const restored=JSON.parse(JSON.stringify(record));
assert.deepEqual(review.validate(restored,'abc123'),record,'review survives saved project JSON with statuses, notes and sources');
assert.throws(()=>review.validate(restored,'other'),'cannot import a review into the wrong project');
for(const change of [r=>r.sources[0].data='https://example.invalid/img.png',r=>r.reviews['["a","b"]'].note='x'.repeat(2001),r=>r.reviews['["a","b"]'].status='cleared',r=>r.result.matches[0].a='missing',r=>r.result.matches[0].pointsA=[[Infinity,0]],r=>r.refs.a.sourceId='b']){
  const bad=JSON.parse(JSON.stringify(record));change(bad);assert.throws(()=>review.validate(bad,'abc123'));
}
const savedRefs=Object.values(refs).map(ref=>({...ref,data:png}));
const live={refs:{'canvas-5':{panelId:'panel-1',vi:1,key:'e8',data:png},'canvas-2':{panelId:'panel-0',vi:0,key:'e4',data:png}}};
assert.equal(review.resolve(savedRefs,live)[1].vi,1,'layout/size variant changes and inventory order retain matching source identities');
assert.equal(review.resolve(savedRefs,{refs:{a:live.refs['canvas-2']}}),null,'deleted image does not select an unrelated remaining source');
assert.equal(review.resolve(savedRefs,{refs:{...live.refs,'canvas-5':{...live.refs['canvas-5'],data:'data:image/png;base64,ZGVm'}}}),null,'replaced content invalidates pair location');
assert.equal(review.resolve([savedRefs[0]],live).length,1,'mixed local/canvas pair can locate the single canvas source');
assert.deepEqual(review.bounds([{left:20,top:10,right:100,bottom:150},{left:700,top:450,right:820,bottom:620}]),{left:20,top:10,right:820,bottom:620,width:800,height:610},'fit uses both distant images');
assert.equal(review.bounds([]),null);
console.log('Persisted image review, safe input and layout-independent source identity tests passed');
