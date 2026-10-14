/* Actual SVG DOM recovery. No file, saved observation or analysis is modified. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const cleanup=require('../skills/polish-sci-figures/assets/figure-studio/legacy-stat-cleanup.js');
const dom=new JSDOM(''),NS='http://www.w3.org/2000/svg';let passed=0;
const parse=text=>new dom.window.DOMParser().parseFromString(text,'image/svg+xml').documentElement;
const serialize=node=>new dom.window.XMLSerializer().serializeToString(node);
const footer=(prefix='',marker=true,results=true)=>`<g ${marker?'data-'+prefix+'stat-band="whole-panel"':''} transform="translate(0 200)"><path d="M 12 4 H 288" fill="none" stroke="#d7dfe9" stroke-width="0.6" data-${prefix}stat-decoration="true"/><text ${results?'data-'+prefix+'stat-result="true"':''} x="12" y="30">本小图组间比较 · Value</text><text ${results?'data-'+prefix+'stat-result="true"':''} x="12" y="52">Line 1</text><text ${results?'data-'+prefix+'stat-result="true"':''} x="12" y="74">Control — Stress</text><text ${results?'data-'+prefix+'stat-result="true"':''} x="230" y="74"><tspan font-style="italic">P</tspan> = 0.003</text><path d="M 230 83 L 230 82 L 288 82 L 288 83" fill="none" stroke="#8290a3" data-${prefix}stat-result="true" data-${prefix}stat-bracket="{}"/></g>`;
const fixture=(band=footer(),height='200pt',attrs='data-stat-source-height="200" data-stat-band-height="160"',extra='')=>`<svg xmlns="${NS}" width="300pt" height="${height}" viewBox="0 0 300 360" ${attrs}><metadata id="studio-stat-anchors">{"version":1,"keep":"analysis"}</metadata><defs><path id="marker" d="M 0 0 L 1 1"/></defs><g id="axes_1" data-key="e7"><path id="actual-data" data-key="e8" d="M 40 100 L 60 80" stroke="#000"/><text data-key="e9" x="30" y="190">Time</text></g>${band}${extra}</svg>`;
function test(name,run){run();passed++;console.log('PASS '+name);}
test('marked footer restores canvas without modifying existing data or keys',()=>{
 const root=parse(fixture()),data=root.querySelector('#actual-data'),axis=root.querySelector('#axes_1'),metadata=serialize(root.querySelector('metadata')),before=serialize(axis),result=cleanup.clean(root);
 assert.equal(result.changed,true);assert.equal(result.removedBands,1);assert.deepEqual(result.canvases[0].viewBox,[0,0,300,200]);assert.equal(root.getAttribute('height'),'200pt');assert.equal(root.querySelector('#actual-data'),data);assert.equal(serialize(axis),before);assert.equal(serialize(root.querySelector('metadata')),metadata);assert.equal(root.querySelector('g[data-stat-band]'),null);assert.equal(result.ordinals.get(axis),3);assert.equal(result.keyEnd,14);assert.equal(cleanup.clean(root).changed,false);
});
test('already-expanded physical height and millimeter dimensions return to original aspect',()=>{
 const root=parse(fixture(footer(),'360pt'));cleanup.clean(root);assert.equal(root.getAttribute('height'),'200pt');
 const metric=parse(fixture().replace('width="300pt"','width="105.83333333333333mm"').replace('height="200pt"','height="127mm"'));cleanup.clean(metric);assert.ok(Math.abs(parseFloat(metric.getAttribute('height'))-70.55555555555556)<1e-9);assert.ok(metric.getAttribute('height').endsWith('mm'));
});
test('prefixed markers and namespaced artist IDs remain recognizable',()=>{
 const root=parse(fixture(footer('f27-'),'200pt','data-f27-stat-source-height="200" data-f27-stat-band-height="160"').replace('id="axes_1"','id="f27-axes_1"'));const result=cleanup.clean(root);assert.equal(result.removedBands,1);assert.equal(root.hasAttribute('data-f27-stat-band-height'),false);assert.equal(root.querySelector('#f27-axes_1').getAttribute('data-key'),'e7');
});
test('missing band marker has conservative title/result/table detection',()=>{
 const root=parse(fixture(footer('',false), '360pt',''));assert.equal(cleanup.clean(root).removedBands,1);assert.equal(root.getAttribute('viewBox'),'0 0 300 200');
 for(const band of [footer('',false,false),footer('',false).replace('本小图组间比较 · Value','A custom appendix'),footer('',false).replace('#d7dfe9','#123456')]){const input=parse(fixture(band,'360pt','')),before=serialize(input);assert.equal(cleanup.clean(input).changed,false);assert.equal(serialize(input),before);}
});
test('user-added image/shape/group or unrelated text remains untouched',()=>{
 for(const inserted of ['<image width="10" height="10" href="data:image/png;base64,AA=="/>','<circle cx="10" cy="10" r="2"/>','<g><text>Custom</text></g>','<text x="12" y="110">User-added body note</text>']){const raw=fixture(footer().replace('</g>',inserted+'</g>')),root=parse(raw),before=serialize(root);assert.equal(cleanup.clean(root).changed,false);assert.equal(serialize(root),before);}
 const root=parse(fixture(footer(),'360pt',undefined,'<text id="user-note" data-key="e99" x="5" y="40">My retained caption</text>')),note=root.querySelector('#user-note'),before=serialize(note);cleanup.clean(root);assert.equal(root.querySelector('#user-note'),note);assert.equal(serialize(note),before);
});
test('nested exported panel restores only its own viewport',()=>{
 const panel=parse(fixture()),root=parse(`<svg xmlns="${NS}" width="800pt" height="500pt" viewBox="0 0 800 500"><text x="0" y="20">Outer title</text></svg>`);root.append(root.ownerDocument.importNode(panel,true));const result=cleanup.clean(root);assert.equal(result.removedBands,1);assert.equal(root.getAttribute('viewBox'),'0 0 800 500');assert.equal(root.querySelector('svg').getAttribute('height'),'200pt');assert.equal(root.querySelector('svg').getAttribute('viewBox'),'0 0 300 200');
});
test('invalid canvas, fake marker or unowned rotated/translated user content never guessed',()=>{
 for(const root of [parse(fixture().replace('viewBox="0 0 300 360"','viewBox="0 0 300 NaN"')),parse(fixture(footer().replace('whole-panel','my-section'))),parse(fixture(footer('',false).replace('translate(0 200)','rotate(30)'))),parse(fixture(footer('',false).replace('translate(0 200)','translate(3 200)')))]){const before=serialize(root);assert.equal(cleanup.clean(root).changed,false);assert.equal(serialize(root),before);}
});
// Captured from the actual retired production generator before removal. Tests
// still exercise authentic SVGs after production can no longer create a footer.
const retired=require('./fixtures/legacy-statistical-band.json');
test('actual retired SVGs: stars, P values, letters and Unicode group labels',()=>{
 for(const {style,svg}of retired.fixtures){
   const root=parse(svg),data=root.querySelector('#data'),before=serialize(data),metadata=serialize(root.querySelector('metadata')),result=cleanup.clean(root);assert.equal(result.removedBands,1,style);assert.equal(root.getAttribute('height'),'200pt');assert.equal(root.getAttribute('viewBox'),'0 0 300 200');assert.equal(root.querySelector('#data'),data);assert.equal(serialize(data),before);assert.equal(serialize(root.querySelector('metadata')),metadata);
 }
});
test('fully exported old SVGs lose all data markers but retain exact footer proof',()=>{
 for(const {style,svg}of retired.fixtures){
   const root=parse(svg);for(const node of [root,...root.querySelectorAll('*')])for(const a of [...node.attributes])if(a.name.startsWith('data-'))node.removeAttributeNode(a);
   const data=root.querySelector('#data'),before=serialize(data),result=cleanup.clean(root);assert.equal(result.removedBands,1,style);assert.equal(serialize(data),before);assert.equal(root.getAttribute('viewBox'),'0 0 300 200');
 }
});
test('caller uses original ordinals to retain source eN identities across removal',()=>{
 const root=parse(fixture(footer(),'360pt',undefined,'<text id="later-note" x="12" y="20">Kept after the footer in DOM order</text>')),beforeNodes=[root,...root.querySelectorAll('*')].filter(n=>n.localName!=='metadata'),note=root.querySelector('#later-note'),ordinal=beforeNodes.indexOf(note),result=cleanup.clean(root,{keyEligible:node=>node.localName!=='metadata'});
 const retained=[root,...root.querySelectorAll('*')].filter(n=>n.localName!=='metadata');retained.forEach((node,index)=>node.setAttribute('data-key','e'+(result.ordinals?.get(node)??index)));assert.equal(note.getAttribute('data-key'),'e'+ordinal);assert.ok(ordinal>retained.indexOf(note),'removed-footer indices remain unused');assert.equal(root.querySelector('#actual-data').getAttribute('data-key'),'e4');
});
test('ordinary user table sharing a title does not establish automatic-footer proof',()=>{
 const plain=footer('',false,false).replace('<text  x="12" y="52">Line 1</text>','<text font-weight="700" x="12" y="52">Line 1</text>');
 for(const band of [plain.replace('Control — Stress','Our comparison').replace('P</tspan> = 0.003','Text</tspan>'),plain.replace('stroke="#8290a3"','stroke="#000000"'),plain.replace('x="230" y="74"','x="40" y="74"')]){const root=parse(fixture(band,'360pt','')),before=serialize(root);assert.equal(cleanup.clean(root).changed,false);assert.equal(serialize(root),before);}
});
test('non-unit viewBox coordinates and translated wrappers use calibrated physical size',()=>{
 const root=parse(fixture(footer().replace('translate(0 200)','translate(10 420)').replace('M 12 4 H 288','M 24 8 H 576'),'200pt').replace('viewBox="0 0 300 360"','viewBox="10 20 600 720"'));
 const result=cleanup.clean(root);assert.equal(result.removedBands,1);assert.deepEqual(result.canvases[0].viewBox,[10,20,600,400]);assert.equal(root.getAttribute('height'),'200pt');
});
test('pure matrix transforms and two old result bands are retired together',()=>{
 const first=footer().replace('translate(0 200)','matrix(1 0 0 1 0 200)'),second=footer().replace('translate(0 200)','translate(0 280)'),root=parse(fixture(first+second,'360pt'));
 const result=cleanup.clean(root);assert.equal(result.removedBands,2);assert.equal(root.getAttribute('viewBox'),'0 0 300 200');assert.equal(root.querySelectorAll('[data-stat-band]').length,0);
});
test('manual wording of known generated result nodes cannot resurrect an old footer',()=>{
 for(const marker of [true,false]){const root=parse(fixture(footer('',marker),'360pt')),texts=[...root.querySelectorAll('g[transform] text')];for(const node of texts.slice(1))node.textContent='User wording';assert.equal(cleanup.clean(root).removedBands,1);assert.equal(root.getAttribute('height'),'200pt');}
});
test('explicit owner and physical source records survive recoloring, font/title and geometry edits',()=>{
 for(const {svg}of retired.fixtures){const root=parse(svg),group=root.querySelector('[data-stat-band]'),data=root.querySelector('#data'),before=serialize(data);for(const node of group.querySelectorAll('path,text')){node.setAttribute('fill','#00ffaa');node.setAttribute('stroke','#aa00ff');node.setAttribute('font-size','42');node.setAttribute('font-family','Custom Font');}group.querySelector('text').textContent='My edited results heading';group.querySelector('path').setAttribute('d','M 10 3 L 40 30');assert.equal(cleanup.clean(root).removedBands,1);assert.equal(root.getAttribute('height'),'200pt');assert.equal(root.getAttribute('viewBox'),'0 0 300 200');assert.equal(serialize(data),before);}
});
test('retiring the result footer preserves a separately generated condition matrix',()=>{
 const conditions='<g data-condition-matrix="true" id="conditions"><text data-key="e100" x="10" y="230">PBS +</text><text data-key="e101" x="80" y="230">Dose 20</text></g>',root=parse(fixture(footer().replace('translate(0 200)','translate(0 250)'),'410pt','data-stat-source-height="200" data-stat-band-height="160" data-condition-height="50"',conditions).replace('viewBox="0 0 300 360"','viewBox="0 0 300 410"')),matrix=root.querySelector('#conditions'),before=serialize(matrix);
 assert.equal(cleanup.clean(root).removedBands,1);assert.equal(root.getAttribute('viewBox'),'0 0 300 250');assert.equal(root.getAttribute('height'),'250pt');assert.equal(root.querySelector('#conditions'),matrix);assert.equal(serialize(matrix),before);
});
dom.window.close();console.log(`PASS legacy statistical cleanup: ${passed} DOM regression scenarios`);
