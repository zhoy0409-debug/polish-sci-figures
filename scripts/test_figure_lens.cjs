'use strict';
const assert=require('node:assert/strict'),assets='../skills/polish-sci-figures/assets/figure-studio/',lens=require(assets+'figure-lens.js'),quality=require(assets+'figure-quality.js');
// Matching is literal and replacement text is never a pattern.
assert.equal(lens.occurrences('a.b axb','a.b').length,1);assert.equal(lens.occurrences('anything','.*').length,0);
assert.equal(lens.replaceAll('Control / control','control','$& [x]'),'$& [x] / $& [x]');
assert.equal(lens.replaceAll('Control / control','control','Vehicle',{caseSensitive:true}),'Control / Vehicle');
assert.equal(lens.replaceAll('KPC KPC-2 blaKPC','KPC','NDM',{wholeWord:true}),'NDM NDM-2 blaKPC');
assert.equal(lens.replaceAll('对照组 对照','对照','处理'),'处理组 处理');assert.equal(lens.replaceAll('a','','b'),'a');
for(const special of ['/','\\','$','^','(','[','{','|','+','?','*'])assert.equal(lens.replaceAll('x'+special+'y',special,'-'),'x-y',special);
for(const [id,matrix]of Object.entries(quality.VISION)){
  assert.equal(lens.filterValues(matrix).split(' ').length,20,id);
  for(const row of matrix)assert(Math.abs(row.reduce((a,b)=>a+b)-1)<1e-5,'Neutral colours must stay neutral: '+id);
}
const text=(id,value,extra={})=>({id,kind:'text',target:{panel:'panel-0',variant:0,key:'e'+id},text:value,sizePt:10,box:{x:10,y:20*id,width:30,height:12},...extra});
const inspect=items=>quality.inspect({paper:{x:0,y:0,width:400,height:400},items,panels:[]}),codes=r=>r.issues.map(i=>i.code);
assert.deepEqual(codes(inspect([text(1,'IC50',{plain:true})])),['notation']);
assert.deepEqual(codes(inspect([text(1,'IC50',{plain:false})])),[],'A semantic subscript must not be reported');
assert.deepEqual(codes(inspect([text(1,'A',{family:'Arial'}),text(2,'B',{family:'arial'})])),[]);
assert.deepEqual(codes(inspect([text(1,'A',{family:'Arial'}),text(2,'B',{family:'Times New Roman'})])),['mixed-fonts']);
const mark=(id,color)=>({id:'m'+id,kind:'graphic',target:null,box:{x:100,y:20*id,width:5,height:5},paints:[color]});
const merged=inspect([mark(1,'#376795'),mark(2,'#b72230')]);assert.deepEqual(merged.issues.map(i=>[i.code,i.vision]),[['color-merge','grayscale']]);
assert.deepEqual(codes(inspect([mark(1,'#222222'),mark(2,'#333333')])),[],'Neutral inks are not group colours');
assert.equal(inspect(Array.from({length:30},(_,i)=>mark(i,'#'+(i*8).toString(16).padStart(2,'0')+'00ff'))).coverage.find(c=>c.check==='色觉与灰度区分').status,'partial');
console.log('PASS literal find/replace, neutral-preserving vision filters, notation, font and colour-merge review');
