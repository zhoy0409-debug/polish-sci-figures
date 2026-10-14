'use strict';
const assert=require('node:assert/strict');
const marks=require('../skills/polish-sci-figures/assets/figure-studio/mark-style.js');
const asymmetric={axis:'y',ends:[[50,20],[50,90]],center:[50,72]};
assert.deepEqual(marks.interval(asymmetric,'positive'),[[50,72],[50,20]]);
assert.deepEqual(marks.interval(asymmetric,'negative'),[[50,90],[50,72]]);
assert.deepEqual(marks.interval({...asymmetric,center:null},'positive'),asymmetric.ends);
assert.deepEqual(marks.interval({...asymmetric,axis:'x'},'positive'),asymmetric.ends);
assert.deepEqual(asymmetric.ends,[[50,20],[50,90]],'direction changes must preserve source geometry');
assert.ok(marks.validateMetadata(JSON.stringify({version:1,points:['points-1'],errors:[{id:'error-1',caps:[],segments:[asymmetric]}]})));
assert.equal(marks.validateMetadata(JSON.stringify({version:1,points:['<script>'],errors:[]})),false);
assert.equal(marks.validateMetadata(JSON.stringify({version:1,points:[],errors:[{id:'a',caps:[],segments:[{...asymmetric,center:[0,Infinity]}]}]})),false);
const colorMetadata={version:1,points:['points-1'],pointColors:[{id:'points-1',kind:'collection',colorSource:{id:'bar-1',paint:'fill'}}],errors:[{id:'error-1',caps:[],segments:[asymmetric],colorSource:{id:'bar-1',paint:'fill'}}]};
assert.equal(marks.validateMetadata(JSON.stringify(colorMetadata)),true);
for(const mutate of [m=>m.pointColors[0].kind='foreign',m=>m.pointColors[0].colorSource.id='external"],script',m=>m.pointColors[0].centers=[[12,null]],m=>m.pointColors[0].centers=[[12,'24']],m=>m.pointColors[0].centers=[[1e9,24]],m=>m.errors[0].colorSource.paint='url(https://bad.invalid)',m=>m.errors[0].segments[0].colorSource={id:'https://bad.invalid/palette',paint:'stroke'}]){
  const invalid=JSON.parse(JSON.stringify(colorMetadata));mutate(invalid);assert.equal(marks.validateMetadata(JSON.stringify(invalid)),false,'color metadata must keep all references local and typed');
}
console.log('Asymmetric intervals, horizontal interval preservation, immutable geometry and metadata validation passed');

// Actual SVG DOM integration uses the existing CI jsdom environment. Keep the
// default geometry checks dependency-free; run --dom for all appearance checks.
function domChecks(){
  const {JSDOM}=require('jsdom');
  const {History,validateState,resizePanel,arrange,splitPanelState}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
  const clone=value=>JSON.parse(JSON.stringify(value));
  const source=`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
    <defs><path id="shared-point" d="M -3 0 A 3 3 0 1 0 3 0 A 3 3 0 1 0 -3 0" style="fill:#eeddcc;stroke:#151515"/><path id="shared-cap" d="M -3 0 L 3 0" style="stroke:#20242a"/></defs>
    <g id="axes_1">
      <g id="studio-bar-0"><path id="bar" data-key="e1" d="M 20 140 L 45 140 L 45 80 L 20 80 Z" style="fill:#4477aa;stroke:none"/></g>
      <g id="points-a"><use id="sample-a" data-key="e2" href="#shared-point" x="32" y="70" style="fill:#ffffff;stroke:#4477aa;stroke-width:0.8px"/></g>
      <g id="line-a"><path id="data-line" data-key="e3" d="M 70 100 L 95 55" style="fill:none;stroke:#aa3377;stroke-width:1.5px"/><use id="sample-b" data-key="e4" href="#shared-point" x="70" y="100" style="fill:#aa3377;stroke:#aa3377;stroke-width:0.8px"/></g>
      <g id="errors-a"><path id="stem" data-key="e5" d="M 32 50 L 32 100" style="fill:none;stroke:#20242a;stroke-width:1px"/></g>
      <g id="caps-a"><use id="cap-upper" data-key="e6" href="#shared-cap" x="32" y="50" style="fill:none;stroke:#20242a;stroke-width:1px"/><use id="cap-lower" data-key="e7" href="#shared-cap" x="32" y="100" style="fill:none;stroke:#20242a;stroke-width:1px"/></g>
      <g id="matplotlib.axis_1"><path id="axis" d="M 10 140 L 210 140" style="fill:none;stroke:#20242a"/></g>
      <g id="legend_1"><use id="legend-marker" href="#shared-point" x="175" y="15" style="fill:#4477aa;stroke:#4477aa"/></g>
    </g>
    <metadata id="studio-mark-styles">${JSON.stringify({version:1,points:['points-a','line-a'],pointColors:[{id:'points-a',kind:'collection',colorSource:{id:'bar',paint:'fill'}},{id:'line-a',kind:'line',colorSource:{id:'data-line',paint:'stroke'}}],errors:[{id:'errors-a',colorSource:{id:'bar',paint:'fill'},caps:['caps-a'],segments:[{axis:'y',ends:[[32,50],[32,100]],center:[32,70]}],capWidth:6,lineWidth:1}]})}</metadata>
  </svg>`;
  function fixture(){
    const dom=new JSDOM('<!doctype html><body>'+source+'</body>',{pretendToBeVisual:true});
    const svg=dom.window.document.querySelector('svg');
    return {dom,svg,by:id=>svg.querySelector('[id="'+id+'"]')};
  }
  function paint(node,key){
    // jsdom has a real CSS declaration model, but does not implement SVG use
    // instance trees. Resolve only their explicit reference presentation here.
    for(let p=node;p;p=p.parentElement){const value=p.style?.getPropertyValue(key)||p.getAttribute?.(key);if(value)return value.toLowerCase();}
    const href=node.getAttribute('href')||node.getAttribute('xlink:href');
    return href?.startsWith('#')?paint(node.ownerDocument.getElementById(href.slice(1)),key):'';
  }
  const hidden=node=>{for(let p=node;p;p=p.parentElement)if(p.style.display==='none'||p.style.visibility==='hidden')return true;return false;};
  const geometry=svg=>[...svg.querySelectorAll('path,use')].filter(n=>!n.closest('defs')&&!n.hasAttribute('data-studio-cap')).map(n=>[n.id,...['d','x','y','transform'].map(a=>n.getAttribute(a))]);
  const protectedNodes=f=>['shared-point','shared-cap','data-line','bar','axis','legend-marker'].map(id=>f.by(id).outerHTML);
  function render(style={},direction='both'){
    const f=fixture(),before=protectedNodes(f),positions=geometry(f.svg);marks.apply(f.svg,style,direction);
    assert.deepEqual(protectedNodes(f),before,'point/error styling must not mutate shared defs, the data line, bars, axes or legends');
    if(direction==='both'&&style.pointScale===undefined)assert.deepEqual(geometry(f.svg),positions,'appearance-only edits must leave every observation and source geometry unchanged');
    return f;
  }
  const original=fixture(),unchanged=original.svg.outerHTML;marks.apply(original.svg,{},'both');
  for(const cap of original.svg.querySelectorAll('[data-studio-error-owner]'))cap.removeAttribute('data-studio-error-owner');
  assert.equal(original.svg.outerHTML,unchanged,'opening an old/default project preserves artwork; only nonvisual cap ownership is added');original.dom.window.close();
  for(const mode of ['solid','hollow']){
    const f=render({pointMode:mode});
    for(const [id,color]of [['sample-a','#4477aa'],['sample-b','#aa3377']]){
      assert.equal(paint(f.by(id),'fill'),mode==='hollow'?'none':color,mode+' preserves each point series color');
      assert.equal(paint(f.by(id),'stroke'),color,'hollow/solid presets preserve each group outline');
    }
    f.dom.window.close();
  }
  const custom={pointMode:'custom',pointFill:'#f4a261',pointStroke:'#264653',pointStrokeWidth:2,errorColor:'#596579'};
  function clonedPaintReference(f,id,sourceId,properties){
    const use=f.by(id),href=use.getAttribute('href')||use.getAttribute('xlink:href');
    assert.notEqual(href,'#'+sourceId,'a shared definition with explicit paint must be cloned before overriding');
    const target=f.by(href.slice(1));assert.ok(target,'the use reference must resolve to a real local definition');
    for(const node of [target,...target.querySelectorAll('*')])for(const property of properties){assert.equal(node.style.getPropertyValue(property),'','cloned glyph cannot override its use paint');assert.equal(node.hasAttribute(property),false,'cloned glyph paint attribute must be removed');}
    assert.equal(target.getAttribute('d'),f.by(sourceId).getAttribute('d'),'cloning a glyph must not alter its shape');
  }
  for(const capWidth of [undefined,9]){
    const f=render({...custom,...(capWidth===undefined?{}:{capWidth})});
    for(const id of ['sample-a','sample-b']){
      assert.equal(paint(f.by(id),'fill'),'#f4a261');assert.equal(paint(f.by(id),'stroke'),'#264653');assert.equal(parseFloat(paint(f.by(id),'stroke-width')),2);
      clonedPaintReference(f,id,'shared-point',['fill','stroke']);
    }
    assert.equal(paint(f.by('stem'),'stroke'),'#596579');
    const caps=capWidth===undefined?[f.by('cap-upper'),f.by('cap-lower')]:[...f.svg.querySelectorAll('[data-studio-cap]')];
    assert.equal(caps.length,2);for(const cap of caps)assert.equal(paint(cap,'stroke'),'#596579','both original and regenerated caps must follow the error color');
    if(capWidth===undefined)for(const id of ['cap-upper','cap-lower'])clonedPaintReference(f,id,'shared-cap',['stroke']);
    f.dom.window.close();
  }
  for(const palette of [{e1:{fill:'#008877'},e3:{stroke:'#ddaa33'}},{e1:{fill:'#882288'},e3:{stroke:'#332288'}}]){
    const followed=fixture();marks.apply(followed.svg,{pointMode:'custom',pointFill:'group',pointStroke:'group',errorColor:'group'},'both',{edits:palette});
    assert.equal(paint(followed.by('sample-a'),'fill'),palette.e1.fill);assert.equal(paint(followed.by('sample-b'),'fill'),palette.e3.stroke);assert.equal(paint(followed.by('stem'),'stroke'),palette.e1.fill);
    for(const id of ['cap-upper','cap-lower'])assert.equal(paint(followed.by(id),'stroke'),palette.e1.fill,'group-colored error caps follow current palette source');
    followed.dom.window.close();
    const fixed=fixture(),info=marks.apply(fixed.svg,custom,'both',{edits:palette});
    for(const id of ['sample-a','sample-b'])assert.equal(paint(fixed.by(id),'fill'),custom.pointFill,'a palette change must not replace custom point color');
    assert.equal(paint(fixed.by('stem'),'stroke'),custom.errorColor);
    assert.ok(info.paintChanges.some(change=>change.key==='e2'&&change.property==='fill'&&change.value===custom.pointFill),'quick style reports concrete point override for palette/element-edit reconciliation');
    fixed.dom.window.close();
  }
  // Some estimates use their actual sampling points, or a marker-only line,
  // as the semantic group source. Re-render with the quick controls' saved
  // edits to catch colour leaking between independently styled marks.
  for(const kind of ['collection','marker-only']){
    function sourced(){
      const f=fixture(),node=f.by('studio-mark-styles'),m=JSON.parse(node.textContent);
      if(kind==='collection'){
        delete m.pointColors[0].colorSource;
        f.by('sample-a').style.fill='#4477aa';
        m.pointColors[1].colorSource={id:'points-a',paint:'fill'};
        m.errors[0].colorSource={id:'points-a',paint:'fill'};
      }else{
        f.by('data-line').remove();
        m.pointColors[1].colorSource={id:'line-a',paint:'stroke'};
        m.errors[0].colorSource={id:'line-a',paint:'stroke'};
      }
      node.textContent=JSON.stringify(m);return f;
    }
    const original=kind==='collection'?'#4477aa':'#aa3377',initial=sourced(),style={pointMode:'custom',pointFill:'#ffff00',pointStroke:'#ff00ff',errorColor:'group'},savedEdits={};
    const first=marks.apply(initial.svg,style,'both',{palette:{[original]:'#008877'},edits:{[kind==='collection'?'e2':'e4']:{fill:'#008877',stroke:'#008877'}}});
    for(const change of first.paintChanges)(savedEdits[change.key]??={})[change.property]=change.value;
    assert.equal(paint(initial.by('stem'),'stroke'),'#008877');initial.dom.window.close();
    for(const color of ['#008877','#ddaa33']){
      const f=sourced();marks.apply(f.svg,style,'both',{edits:savedEdits,palette:{[original]:color}});
      assert.equal(paint(f.by('stem'),'stroke'),color,kind+' saved custom point color must not contaminate group-colored intervals');
      for(const id of ['cap-upper','cap-lower'])assert.equal(paint(f.by(id),'stroke'),color);
      assert.equal(paint(f.by('sample-b'),'fill'),'#ffff00','palette changes retain independent custom point colors');f.dom.window.close();
      const restored=sourced();marks.apply(restored.svg,{pointMode:'hollow',errorColor:'group'},'both',{edits:savedEdits,palette:{[original]:color}});
      assert.equal(paint(restored.by('sample-b'),'stroke'),color,'returning to group color restores the saved palette');
      assert.equal(paint(restored.by('sample-b'),'fill'),'none');
      assert.equal(paint(restored.by('stem'),'stroke'),color);restored.dom.window.close();
    }
  }
  const scatter=fixture(),scatterMeta=scatter.by('studio-mark-styles'),scatterData=JSON.parse(scatterMeta.textContent);
  scatterData.points=['points-a'];scatterData.pointColors=[{id:'points-a',kind:'collection'}];scatterData.errors=[];scatterMeta.textContent=JSON.stringify(scatterData);
  const other=scatter.by('sample-a').cloneNode(true);other.id='sample-c';other.setAttribute('data-key','e8');other.setAttribute('x','46');other.style.fill='#cc6677';other.style.stroke='#cc6677';scatter.by('points-a').append(other);
  const fixedEdits={e2:{fill:'#ffff00',stroke:'#ff00ff'},e8:{fill:'#ffff00',stroke:'#ff00ff'}},groupPalette={'#4477aa':'#008877','#cc6677':'#ddaa33'};
  marks.apply(scatter.svg,{pointMode:'hollow'},'both',{edits:fixedEdits,palette:groupPalette});
  assert.equal(paint(scatter.by('sample-a'),'stroke'),'#008877','restoring group color uses the original scatter series and saved palette, not its prior custom override');
  assert.equal(paint(scatter.by('sample-c'),'stroke'),'#ddaa33','a multicolor collection retains separate point colors');
  assert.equal(paint(scatter.by('sample-a'),'fill'),'none');assert.equal(paint(scatter.by('sample-c'),'fill'),'none');scatter.dom.window.close();
  for(const mode of ['solid','hollow','custom']){
    const f=fixture(),node=f.by('studio-mark-styles'),m=JSON.parse(node.textContent);m.pointColors=[{id:'points-a',kind:'collection'}];m.points=['points-a'];m.errors=[];node.textContent=JSON.stringify(m);
    marks.apply(f.svg,{pointMode:mode,pointFill:'group',pointStroke:'group'},'both',{edits:fixedEdits,palette:{}});
    assert.equal(paint(f.by('sample-a'),'fill'),mode==='hollow'?'none':'#4477aa','group restoration with no palette entry must use the source colour, not a shortcut custom edit');
    assert.equal(paint(f.by('sample-a'),'stroke'),'#4477aa');f.dom.window.close();
  }
  for(const capWidth of [undefined,10]){
    const multi=fixture(),meta=multi.by('studio-mark-styles'),data=JSON.parse(meta.textContent),record=data.errors[0];delete record.colorSource;
    record.segments[0].colorSource={id:'bar',paint:'fill'};record.segments.push({axis:'y',ends:[[95,35],[95,85]],center:[95,55],colorSource:{id:'data-line',paint:'stroke'}});meta.textContent=JSON.stringify(data);
    const stem=multi.by('stem').cloneNode(true);stem.id='stem-b';stem.setAttribute('data-key','e9');stem.setAttribute('d','M 95 35 L 95 85');multi.by('errors-a').append(stem);
    for(const [id,y]of [['cap-b-upper',35],['cap-b-lower',85]]){const cap=multi.by('cap-upper').cloneNode(true);cap.id=id;cap.removeAttribute('data-key');cap.setAttribute('x','95');cap.setAttribute('y',String(y));multi.by('caps-a').append(cap);}
    marks.apply(multi.svg,{errorColor:'group',...(capWidth===undefined?{}:{capWidth})},'both',{edits:{e1:{fill:'#008877'},e3:{stroke:'#ddaa33'}}});
    assert.equal(paint(multi.by('stem'),'stroke'),'#008877');assert.equal(paint(multi.by('stem-b'),'stroke'),'#ddaa33');
    const caps=capWidth===undefined?[...multi.by('caps-a').querySelectorAll('use')]:[...multi.svg.querySelectorAll('[data-studio-cap]')];
    assert.equal(caps.length,4);for(const cap of caps)assert.equal(paint(cap,'stroke'),Number(cap.getAttribute('x'))===32?'#008877':'#ddaa33','error caps must inherit their own segment group');
    multi.dom.window.close();
  }
  for(const [fill,stroke,width]of [['none','#000000',1],['#00aa88','none',0]]){
    const f=render({pointMode:'custom',pointFill:fill,pointStroke:stroke,pointStrokeWidth:width});
    for(const id of ['sample-a','sample-b']){assert.equal(paint(f.by(id),'fill'),fill);assert.equal(paint(f.by(id),'stroke'),stroke);assert.equal(parseFloat(paint(f.by(id),'stroke-width')),width);}
    f.dom.window.close();
  }
  for(const direction of ['both','positive','negative'])for(const capWidth of [undefined,8]){
    const style={...custom,pointsVisible:false,errorsVisible:false,...(capWidth===undefined?{}:{capWidth})},f=render(style,direction);
    for(const id of ['sample-a','sample-b','stem','cap-upper','cap-lower'])assert.equal(hidden(f.by(id)),true,id+' must be hidden by its own section toggle');
    for(const cap of f.svg.querySelectorAll('[data-studio-cap]'))assert.equal(hidden(cap),true,'new caps must also be hidden');
    assert.equal(hidden(f.by('data-line')),false,'hiding line markers must keep the connecting data line visible');
    f.dom.window.close();
    const restored=render({...style,pointsVisible:true,errorsVisible:true},direction);
    for(const id of ['sample-a','sample-b','stem'])assert.equal(hidden(restored.by(id)),false,'restoring visibility brings back marks');
    assert.equal(paint(restored.by('sample-a'),'fill'),custom.pointFill);assert.equal(paint(restored.by('stem'),'stroke'),custom.errorColor);
    restored.dom.window.close();
  }
  // Matplotlib can emit a small PathCollection as direct paths, without any
  // <use> glyphs. Verify actual DOM transform results, not a transform string.
  // jsdom lacks SVG matrices, so evaluate this fixture's SVG affine commands
  // independently in right-to-left point order as required by SVG transforms.
  function transformedPoint(raw,point){
    let [x,y]=point;
    for(const match of [...String(raw||'').matchAll(/(matrix|translate|scale)\(([^)]+)\)/g)].reverse()){
      const v=match[2].trim().split(/[ ,]+/).map(Number);
      if(match[1]==='translate'){x+=v[0];y+=v[1]||0;}
      else if(match[1]==='scale'){x*=v[0];y*=v[1]??v[0];}
      else [x,y]=[v[0]*x+v[2]*y+v[4],v[1]*x+v[3]*y+v[5]];
    }
    return [x,y];
  }
  const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-8,message+': '+actual+' vs '+expected);
  // The real Matplotlib cap is a <use x/y> whose symbol is shared. The stem
  // and use need not have the same SVG parent after category-spacing edits.
  // Check displayed geometry through a separate affine evaluator, including
  // repeated previews, a local stem transform and subsequent group movement.
  function screenPoint(node,point){
    for(let own=node;own&&own.localName!=='svg';own=own.parentElement)point=transformedPoint(own.getAttribute('transform'),point);
    return point;
  }
  function pathEnds(node){const values=node.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/ig).map(Number);assert.equal(values.length,4);return [[values[0],values[1]],[values[2],values[3]]];}
  const anchored=fixture(),stem=anchored.by('stem'),nested=anchored.svg.ownerDocument.createElementNS(anchored.svg.namespaceURI,'g');
  nested.setAttribute('transform','translate(13 -8) scale(1.3 .85)');stem.parentNode.append(nested);nested.append(stem);
  stem.setAttribute('transform','matrix(1.2 .15 -.08 .9 7 -3)');
  anchored.by('axes_1').setAttribute('transform','translate(-18 12)');
  const beforeStem=stem.getAttribute('d'),beforeMetadata=anchored.by('studio-mark-styles').textContent;
  const stableKeys=[];
  for(const [style,direction]of [[{capWidth:8.5,errorWidth:1.5},'both'],[{capWidth:3,errorWidth:.5,errorColor:'#882288'},'positive'],[{capWidth:14,errorWidth:3,errorColor:'#008877'},'negative'],[{capWidth:8.5,errorWidth:1.5},'both']]){
    marks.apply(anchored.svg,style,direction);
    const caps=[...anchored.svg.querySelectorAll('[data-studio-cap]')],ends=pathEnds(stem).map(point=>screenPoint(stem,point));
    assert.equal(caps.length,direction==='both'?2:1,'repeated styling replaces previous caps without duplicating intervals');
    for(const cap of caps){
      assert.equal(cap.parentElement,stem.parentElement,'each cap shares the stem coordinate basis');
      const capEnds=pathEnds(cap),midpoint=capEnds[0].map((value,i)=>(value+capEnds[1][i])/2),shown=screenPoint(cap,midpoint);
      assert.ok(ends.some(end=>end.every((value,i)=>Math.abs(value-shown[i])<1e-8)),'a cap remains exactly on a visible stem endpoint after direction/width/color edits');
      assert.equal(Number(cap.getAttribute('stroke-width')),style.errorWidth);assert.equal(cap.getAttribute('data-studio-error-owner'),'e5');
    }
    if(direction==='both')stableKeys.push(caps.map(cap=>cap.getAttribute('data-key')));
    anchored.by('axes_1').setAttribute('transform','translate(45 -6) scale(.85 1.1)');
    nested.setAttribute('transform','translate(-11 9) scale(.7 1.8)');
    for(const cap of caps){const capEnds=pathEnds(cap),shown=screenPoint(cap,capEnds[0].map((v,i)=>(v+capEnds[1][i])/2));assert.ok(pathEnds(stem).map(p=>screenPoint(stem,p)).some(end=>end.every((v,i)=>Math.abs(v-shown[i])<1e-8)),'moving/scaling a whole data group preserves cap-to-stem attachment');}
  }
  assert.deepEqual(stableKeys[0],stableKeys[1],'both ends retain stable edit keys through direction changes');
  assert.equal(stem.getAttribute('d'),beforeStem,'returning to both restores the original asymmetric interval');
  marks.apply(anchored.svg,{capWidth:0},'both');assert.equal(anchored.svg.querySelectorAll('[data-studio-cap]').length,0,'zero cap width removes both generated ends');
  marks.apply(anchored.svg,{errorsVisible:false,capWidth:6},'both');assert.equal(hidden(stem),true);
  marks.apply(anchored.svg,{errorsVisible:true},'both');assert.equal(hidden(stem),false);assert.equal(anchored.svg.querySelectorAll('[data-studio-cap]').length,0);
  for(const id of ['caps-a','cap-upper','cap-lower'])assert.equal(hidden(anchored.by(id)),false,'reset restores original Matplotlib cap instances');
  assert.equal(stem.getAttribute('d'),beforeStem);assert.equal(anchored.by('studio-mark-styles').textContent,beforeMetadata,'appearance edits never overwrite measurement metadata');anchored.dom.window.close();
  // In an imported SVG local Y can increase upward; positive/negative still
  // follows the declared measurement direction rather than local Y sorting.
  const inverted=fixture(),inverseStem=inverted.by('stem');inverseStem.setAttribute('d','M 32 -50 L 32 -100');inverseStem.setAttribute('transform','scale(1 -1)');
  marks.apply(inverted.svg,{capWidth:8},'positive');assert.deepEqual(pathEnds(inverseStem),[[32,-70],[32,-50]]);marks.apply(inverted.svg,{capWidth:8},'negative');assert.deepEqual(pathEnds(inverseStem),[[32,-100],[32,-70]]);marks.apply(inverted.svg,{},'both');assert.deepEqual(pathEnds(inverseStem),[[32,-50],[32,-100]]);inverted.dom.window.close();
  const live=fixture();marks.apply(live.svg,{capWidth:8.5,errorWidth:.8},'both');
  live.by('axes_1').setAttribute('transform','translate(30 -12) scale(.85 1.4)');
  for(const cap of live.svg.querySelectorAll('[data-studio-cap]'))cap.setAttribute('transform','matrix(1.2 .1 -.05 .8 4 -2)');
  const liveBefore=live.svg.outerHTML,protectedBefore=protectedNodes(live),metadataBefore=live.by('studio-mark-styles').textContent;let matrixReads=0;
  const matrix=node=>{matrixReads++;const o=screenPoint(node,[0,0]),x=screenPoint(node,[1,0]),y=screenPoint(node,[0,1]);return {a:x[0]-o[0],b:x[1]-o[1],c:y[0]-o[0],d:y[1]-o[1],e:o[0],f:o[1]};};
  const preview=marks.createPreview(live.svg,{unit:.75,style:{capWidth:8.5,errorWidth:.8,pointScale:1},matrix}),capturedReads=matrixReads;
  assert.equal(preview.supported.capWidth,true);assert.equal(preview.supported.pointScale,true);assert.deepEqual(preview.counts,{points:2,errors:1,caps:2});
  const originalCenters=['sample-a','sample-b'].map(id=>({id,point:screenPoint(live.by(id),[Number(live.by(id).getAttribute('x')),Number(live.by(id).getAttribute('y'))])}));
  // After the one-time capture, a slider frame must never measure or inspect.
  const originalSelector=live.svg.querySelectorAll.bind(live.svg);live.svg.querySelectorAll=()=>{throw Error('Live slider queried the SVG again');};
  for(const width of [3,12,0,8.5]){
    const result=preview.apply({capWidth:width,errorWidth:1.6,errorColor:'#008877',pointScale:1.8,pointMode:'custom',pointFill:'#ffcc00',pointStroke:'#123456',pointStrokeWidth:1.2});assert.equal(result.applied,true);assert.equal(matrixReads,capturedReads,'no CTM or layout measurements occur on repeated slider frames');
    for(const cap of originalSelector('[data-studio-cap]')){const [a,b]=pathEnds(cap).map(p=>screenPoint(cap,p));near(Math.hypot(b[0]-a[0],b[1]-a[1]),width*.75,'preview length is the requested final pt under nonuniform transforms');assert.equal(paint(cap,'stroke'),'#008877');near(parseFloat(paint(cap,'stroke-width')),1.2,'preview line width uses the output unit');}
    for(const {id,point}of originalCenters){const node=live.by(id),shown=screenPoint(node,[Number(node.getAttribute('x')),Number(node.getAttribute('y'))]);shown.forEach((value,i)=>near(value,point[i],'sample resize does not move its measurement position'));assert.equal(paint(node,'fill'),'#ffcc00');assert.equal(paint(node,'stroke'),'#123456');}
  }
  live.svg.querySelectorAll=originalSelector;assert.ok(live.svg.querySelectorAll('[id^="studio-mark-preview-"]').length<=5,'repeated frames reuse bounded symbol copies rather than growing the SVG');
  assert.deepEqual(protectedNodes(live),protectedBefore);assert.equal(live.by('studio-mark-styles').textContent,metadataBefore);preview.cancel();assert.equal(live.svg.outerHTML,liveBefore,'cancel restores exact geometry, colors, references and definitions');
  // Native caps also preview without replacing Matplotlib's shared marker.
  const native=fixture();native.by('axes_1').setAttribute('transform','scale(2 1)');const nativeBefore=native.svg.outerHTML,nativePreview=marks.createPreview(native.svg,{unit:1,matrix:()=>({a:2,b:0,c:0,d:1,e:0,f:0})});
  assert.equal(nativePreview.supported.capWidth,true);nativePreview.apply({capWidth:8,errorColor:'#cc6677'});for(const id of ['cap-upper','cap-lower']){const node=native.by(id),shown=transformedPoint(node.getAttribute('transform'),[Number(node.getAttribute('x')),Number(node.getAttribute('y'))]);assert.deepEqual(shown,[32,Number(node.getAttribute('y'))],'native use cap center does not move');const symbol=native.by((node.getAttribute('href')||node.getAttribute('xlink:href')).slice(1)),[a,b]=pathEnds(symbol).map(p=>screenPoint(node,[p[0]+Number(node.getAttribute('x')),p[1]+Number(node.getAttribute('y'))]));near(Math.hypot(b[0]-a[0],b[1]-a[1]),8,'native shared use cap also previews exact final pt');assert.equal(paint(node,'stroke'),'#cc6677');}nativePreview.restore();assert.equal(native.svg.outerHTML,nativeBefore);native.dom.window.close();live.dom.window.close();
  const independent=fixture(),independentMeta=independent.by('studio-mark-styles'),independentData=JSON.parse(independentMeta.textContent);delete independentData.pointColors[0].colorSource;independentData.errors[0].colorSource={id:'points-a',paint:'fill'};independent.by('sample-a').style.fill='#4477aa';independentMeta.textContent=JSON.stringify(independentData);
  const independentStyle={pointMode:'custom',pointFill:'#ffff00',pointStroke:'#ff00ff',errorColor:'group',capWidth:8};marks.apply(independent.svg,independentStyle);const independentPreview=marks.createPreview(independent.svg,{style:independentStyle,matrix:()=>({a:1,b:0,c:0,d:1,e:0,f:0})});independentPreview.apply({...independentStyle,capWidth:12});assert.equal(paint(independent.by('stem'),'stroke'),'#4477aa','a width preview cannot let custom point colors contaminate existing group-colored intervals');for(const cap of independent.svg.querySelectorAll('[data-studio-cap]'))assert.equal(paint(cap,'stroke'),'#4477aa');independentPreview.restore();independent.dom.window.close();
  function directFixture(centers){
    const f=fixture(),group=f.by('points-a');group.replaceChildren();
    const defs=f.svg.ownerDocument.createElementNS(f.svg.namespaceURI,'defs');defs.innerHTML='<path id="local-unused-symbol" d="M -2 0 L 2 0"/>';group.append(defs);
    centers.forEach(([x,y],i)=>{const p=f.svg.ownerDocument.createElementNS(f.svg.namespaceURI,'path');p.id='direct-point-'+i;p.setAttribute('data-key','direct'+i);p.setAttribute('d',`M ${x-3} ${y-3} L ${x+3} ${y-3} L ${x+3} ${y+3} L ${x-3} ${y+3} Z`);p.setAttribute('transform','matrix(1.1 0 0 0.9 7 -4)');p.style.fill='#4477aa';group.append(p);});
    const meta=f.by('studio-mark-styles'),data=JSON.parse(meta.textContent);data.pointColors[0].centers=centers;meta.textContent=JSON.stringify(data);
    return f;
  }
  for(const centers of [[[32,70]],[[32,70],[65,41],[104,92]]])for(const factor of [.25,1.75,3]){
    const f=directFixture(centers),before=protectedNodes(f),symbol=f.by('local-unused-symbol').outerHTML,meta=f.by('studio-mark-styles').textContent;
    const paths=centers.map((center,i)=>{const node=f.by('direct-point-'+i);return {node,center,d:node.getAttribute('d'),transform:node.getAttribute('transform')};});
    marks.apply(f.svg,{pointScale:factor,pointMode:'custom',pointFill:'#e76f51',pointStroke:'#264653'},'both');
    assert.deepEqual(protectedNodes(f),before,'direct collection scaling must leave axes, connecting lines, bars and shared symbols untouched');
    assert.equal(f.by('local-unused-symbol').outerHTML,symbol,'a collection definition is not a visible sample');assert.equal(f.by('studio-mark-styles').textContent,meta,'resizing marks must preserve source centers');
    for(const {node,center,d,transform}of paths){
      assert.equal(node.getAttribute('d'),d,'marker scaling must not rewrite source path data');
      const oldCenter=transformedPoint(transform,center),newCenter=transformedPoint(node.getAttribute('transform'),center);
      newCenter.forEach((value,i)=>near(value,oldCenter[i],'direct point center must not move'));
      for(const vertex of [[center[0]+3,center[1]],[center[0],center[1]+3]]){
        const oldVertex=transformedPoint(transform,vertex),newVertex=transformedPoint(node.getAttribute('transform'),vertex);
        near(Math.hypot(newVertex[0]-newCenter[0],newVertex[1]-newCenter[1]),factor*Math.hypot(oldVertex[0]-oldCenter[0],oldVertex[1]-oldCenter[1]),'direct point radius must follow the requested factor');
      }
      assert.equal(paint(node,'fill'),'#e76f51');assert.equal(paint(node,'stroke'),'#264653');
    }
    f.dom.window.close();
  }
  const ambiguous=directFixture([[32,70],[65,41]]),ambiguousMeta=ambiguous.by('studio-mark-styles'),ambiguousData=JSON.parse(ambiguousMeta.textContent);ambiguousData.pointColors[0].centers=[[32,70]];ambiguousMeta.textContent=JSON.stringify(ambiguousData);
  const directBefore=[0,1].map(i=>ambiguous.by('direct-point-'+i).getAttribute('transform'));marks.apply(ambiguous.svg,{pointScale:2},'both');
  assert.deepEqual([0,1].map(i=>ambiguous.by('direct-point-'+i).getAttribute('transform')),directBefore,'a mismatched center count must never scale a direct path around a guessed origin');
  const fallbackBefore=ambiguous.svg.outerHTML,fallback=marks.createPreview(ambiguous.svg,{matrix:()=>({a:1,b:0,c:0,d:1,e:0,f:0})}),captured=ambiguous.svg.outerHTML;assert.equal(fallback.supported.pointScale,false);assert.equal(fallback.apply({pointScale:2}).fallback,true);assert.equal(ambiguous.svg.outerHTML,captured,'unsupported direct-path scaling refuses before partial DOM changes');fallback.restore();assert.equal(ambiguous.svg.outerHTML,fallbackBefore);ambiguous.dom.window.close();
  // These values belong to panel appearance and must survive both a new SVG
  // size and saved undo history; they are never sent as measurement data.
  const initial={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}},project={panels:[{id:'panel-0',variants:[{},{}]}]},history=new History(initial);
  const style={...custom,pointScale:1.35,capWidth:9,errorWidth:1.75,pointsVisible:false,errorsVisible:false},changed=clone(initial);changed.panels['panel-0'].markStyle=style;
  const palette={'#4477aa':'#008877','#aa3377':'#ddaa33'};changed.panels['panel-0'].markPalette=palette;
  validateState(changed,project);history.commit(changed);history.undo();assert.equal(history.current.panels['panel-0'].markStyle,undefined);history.redo();
  const restored=History.restore(JSON.parse(JSON.stringify(history.toJSON())),project,history.current);assert.deepEqual(restored.current.panels['panel-0'].markStyle,style,'save/reopen preserves hidden sections and their custom colors/sizes');assert.deepEqual(restored.current.panels['panel-0'].markPalette,palette,'save/reopen preserves original-to-group palette identity');
  const resized=resizePanel(arrange(history.current,2,2),'panel-0',1,2);assert.deepEqual(resized.panels['panel-0'].markStyle,style,'panel resizing retains the complete appearance');
  const assets=[{id:'panel-1',initialVariant:0},{id:'panel-2',initialVariant:0}],split=splitPanelState(history.current,'panel-0',assets);
  for(const asset of assets){assert.deepEqual(split.panels[asset.id].markStyle,style,'split facets retain point/error appearance');assert.deepEqual(split.panels[asset.id].markPalette,palette,'split facets retain the group palette');}
  for(const bad of [{pointsVisible:1},{errorsVisible:'false'},{pointMode:'gradient'},{pointFill:'url(https://bad.invalid)'},{pointStroke:'red'},{pointStrokeWidth:-1},{pointStrokeWidth:5},{errorColor:'none'},{errorColor:'url(#foreign)'},{unknown:true}]){
    const invalid=clone(initial);invalid.panels['panel-0'].markStyle=bad;assert.throws(()=>validateState(invalid,project),'unsafe or malformed appearance must be rejected: '+JSON.stringify(bad));
  }
  console.log('PASS SVG DOM mark appearance: independent fill/stroke, shared defs and connecting lines preserved, anchored caps across nested/group transforms and repeated width/direction/color edits; direct preview has exact pt, zero frame measurements, bounded defs, cancel restore and direct-path fallback; original/new error caps, hidden/restored sections, direct-path centers fixed across 6 scaling cases, immutable geometry, resize/facet/history persistence and validation.');
}
if(process.argv.includes('--dom'))domChecks();
