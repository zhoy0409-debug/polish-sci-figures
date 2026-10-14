'use strict';
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const inset=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-7,`${label||'value'}: ${actual} != ${expected}`);
function node(tag,attrs={},parent=null){return {localName:tag,parentElement:parent,getAttribute:k=>Object.hasOwn(attrs,k)?String(attrs[k]):null,style:{getPropertyValue:()=>''}};}
function crc(buffer){let c=0xffffffff;for(const v of buffer){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function chunk(kind,body){const type=Buffer.from(kind),n=Buffer.alloc(4),sum=Buffer.alloc(4);n.writeUInt32BE(body.length);sum.writeUInt32BE(crc(Buffer.concat([type,body])));return Buffer.concat([n,type,body,sum]);}
function png(width,height,{animated=false}={}){
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
  const scan=Buffer.alloc((width*3+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*(width*3+1)+1+x*3;scan[i]=(x*7+y*3)%256;scan[i+1]=(x*5)%256;scan[i+2]=(y*11)%256;}
  return 'data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),...(animated?[chunk('acTL',Buffer.from([0,0,0,2,0,0,0,0]))]:[]),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]).toString('base64');
}
const href=png(1000,500),root=node('svg',{viewBox:'0 0 400 300'});
const image=node('image',{x:10,y:20,width:200,height:200},root);
const a={id:'annotation-1',type:'inset',x:.5,y:.5,w:.4,h:.3,text:'',font:'Arial',size:9,stroke:1,color:'#ffffff',opacity:1,fill:false,bold:false,locked:false,source:{panelId:'panel-1',variant:0,key:'e3',widthPx:1000,heightPx:500},roi:{x:.2,y:.2,w:.4,h:.4},connector:true,showScale:true};
const geometry={width:600,height:400,dx:0,dy:0};
const project={panels:[{id:'panel-1',variants:[{svg:href}]}]};
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
test('strict source and normalized ROI record validation',()=>{
  assert.equal(inset.validate(a,project,{order:['panel-1'],panels:{'panel-1':{variant:0}}}),true);
  for(const mutate of [v=>v.roi.x=.9,v=>v.roi.w=NaN,v=>v.roi.w=.0001,v=>v.source.widthPx=32768,v=>v.source.widthPx=3.5,v=>v.source.key='e3"',v=>v.source.panelId='external',v=>v.connector=1,v=>v.scaleLengthUm=-1,v=>v.source.orientation='rotate45',v=>v.source.orientation='__proto__']){const bad=clone(a);mutate(bad);assert.throws(()=>inset.validate(bad,project));}
  assert.throws(()=>inset.validate({...a,source:{...a.source,variant:3}},project));
  assert.ok(JSON.stringify(a).length<650,'history state contains geometry and asset reference only');assert.equal(JSON.stringify(a).includes('data:image'),false);
});
test('meet letterbox, alignment, slice visible ROI, and none stretching are explicit',()=>{
  assert.deepEqual(inset.imageRect(image,1000,500),{x:10,y:70,width:200,height:100,sx:.2,sy:.2,viewport:{x:10,y:20,width:200,height:200},visible:{x:0,y:0,w:1,h:1}});
  const aligned=node('image',{width:200,height:200,preserveAspectRatio:'xMaxYMax meet'},root);assert.equal(inset.imageRect(aligned,1000,500).y,100);
  const slice=node('image',{width:200,height:200,preserveAspectRatio:'xMidYMid slice'},root);const r=inset.imageRect(slice,1000,500);assert.equal(r.x,-100);assert.deepEqual(r.visible,{x:.25,y:0,w:.5,h:1});
  const none=node('image',{width:200,height:200,preserveAspectRatio:'none'},root);assert.equal(inset.imageRect(none,1000,500).sx,.2);assert.equal(inset.imageRect(none,1000,500).sy,.4);
  assert.throws(()=>inset.imageRect(node('image',{width:'calc(20px)',height:20},root),1000,500));
});
test('nested viewBox affine rotation/flip and source coordinates are reversible',()=>{
  const panel=node('svg',{x:40,y:50,width:200,height:100,viewBox:'10 20 100 50'},root),g=node('g',{transform:'translate(10,5) rotate(90)'},panel),source=node('image',{transform:'scale(-2,1)'},g),m=inset.relativeMatrix(source,root);
  near(m.a,0);near(m.b,-4);near(m.c,-2);near(m.d,0);near(m.e,40);near(m.f,20);
  const p=inset.point(m,{x:7,y:9}),back=inset.point(inset.inverse(m),p);near(back.x,7);near(back.y,9);
  assert.throws(()=>inset.relativeMatrix(node('image',{transform:'scale(0)'},root),root));
  assert.throws(()=>inset.relativeMatrix(node('image',{transform:'rotate(1); alert(1)'},root),root));
  const css=node('image',{},root);css.style.getPropertyValue=k=>k==='transform'?'rotate(1deg)':'';assert.throws(()=>inset.relativeMatrix(css,root));
});
test('percentage dimensions resolve in SVG user coordinates, not CSS pixels',()=>{
  const r=inset.imageRect(node('image',{x:'25%',y:'10%',width:'50%',height:'80%',preserveAspectRatio:'none'},root),1000,500);
  assert.deepEqual({x:r.x,y:r.y,w:r.width,h:r.height},{x:100,y:30,w:200,h:240});
});
test('quality uses ROI original pixels and final physical inches, including letterbox',()=>{
  const q=inset.quality(a,{geometry});assert.equal(q.pixelWidth,400);assert.equal(q.pixelHeight,200);near(q.widthInches,240/72);near(q.heightInches,120/72);near(q.effectiveDpi,120);
  near(inset.quality(a,{geometry,outputScale:2}).effectiveDpi,60);
  const tall={...a,y:.3,h:.6};near(inset.quality(tall,{geometry}).effectiveDpi,120,'extra letterbox does not invent additional pixels');
  assert.throws(()=>inset.quality(a,{geometry,outputScale:0}));
});
test('nice scale chooses truthful 1/2/5 distances and derives exact line length',()=>{
  const scale=inset.scaleInfo(a,{geometry,calibration:166.75});assert.equal(scale.lengthUm,5);near(scale.physicalWidth,66.7);near(scale.length,240*5/66.7);assert.equal(scale.label,'5 μm');assert.equal(scale.automatic,true);
  assert.equal(inset.scaleInfo(a,{geometry,calibration:100}).lengthUm,5);
  const manual=inset.scaleInfo({...a,scaleLengthUm:7.5},{geometry,calibration:100});near(manual.length,45);assert.equal(manual.label,'7.5 μm');assert.equal(manual.automatic,false);
  assert.throws(()=>inset.scaleInfo({...a,scaleLengthUm:33},{geometry,calibration:100}));
  assert.equal(inset.scaleInfo(a,{geometry,calibration:NaN}),null);
});
test('scale display units stay readable without changing physical values',()=>{
  const nm=inset.scaleInfo(a,{geometry,calibration:2});assert.equal(nm.lengthUm,.1);assert.equal(nm.label,'100 nm');
  const mm=inset.scaleInfo(a,{geometry,calibration:20000});assert.equal(mm.lengthUm,1000);assert.equal(mm.label,'1 mm');
  for(const physical of [1e-5,.01,.12,1,2.7,6.67,40,500,1e6]){const s=inset.scaleInfo(a,{geometry,calibration:physical/.4});assert.ok(s.length<=240*.35*(1+1e-8));near(s.length/240,s.lengthUm/physical);}
});
test('threefold display magnification updates nice distance label without tripling the line',()=>{
  const wide={width:1500,height:1000},small={...a,w:.2,h:.15},large={...a,x:0,y:0,w:.6,h:.45};
  const before=inset.scaleInfo(small,{geometry:wide,calibration:100}),after=inset.scaleInfo(large,{geometry:wide,calibration:100});
  assert.equal(before.label,'2 μm');assert.equal(after.label,'1 μm');assert.ok(after.length<=36);assert.notEqual(after.length,before.length*3);near(after.length/900,after.lengthUm/40);
  near(inset.quality(large,{geometry:wide}).effectiveDpi,inset.quality(small,{geometry:wide}).effectiveDpi/3);
});
test('encoded raster dimensions are authoritative and unsupported data never fetches',()=>{
  assert.deepEqual(inset.dimensionsFromHref(href),{widthPx:1000,heightPx:500,orientation:'display'});
  for(const invalid of ['https://example.invalid/x.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,AAAA','file:///x.png',png(10,10,{animated:true})])assert.throws(()=>inset.dimensionsFromHref(invalid));
  const huge=Buffer.from(href.split(',')[1],'base64');huge.writeUInt32BE(50000,16);assert.throws(()=>inset.dimensionsFromHref('data:image/png;base64,'+huge.toString('base64')));
  const cached=inset.dimensionsFromHref(href);cached.widthPx=1;assert.equal(inset.dimensionsFromHref(href).widthPx,1000,'callers cannot mutate cached dimensions');
});
test('JPEG EXIF orientation swaps the intrinsic coordinate dimensions once',()=>{
  const exif=Buffer.alloc(34);exif.write('Exif\0\0');exif.write('II',6);exif.writeUInt16LE(42,8);exif.writeUInt32LE(8,10);exif.writeUInt16LE(1,14);exif.writeUInt16LE(274,16);exif.writeUInt16LE(3,18);exif.writeUInt32LE(1,20);exif.writeUInt16LE(6,24);
  const segment=(marker,payload)=>{const len=Buffer.alloc(2);len.writeUInt16BE(payload.length+2);return Buffer.concat([Buffer.from([255,marker]),len,payload]);};
  const sof=Buffer.from([8,0,50,0,100,1,1,17,0]),jpg=Buffer.concat([Buffer.from([255,216]),segment(225,exif),segment(192,sof),Buffer.from([255,217])]);
  assert.deepEqual(inset.dimensionsFromHref('data:image/jpeg;base64,'+jpg.toString('base64')),{widthPx:50,heightPx:100,orientation:'display'});
});
test('decoding is serialized, shared, and releases image buffers after metadata extraction',async()=>{
  inset.clearCache();let constructed=0,active=0,maxActive=0,cleared=0;
  class ImageMock{constructor(){constructed++;this.naturalWidth=1000;this.naturalHeight=500;}set src(value){if(!value){cleared++;active--;return;}active++;maxActive=Math.max(maxActive,active);setTimeout(()=>this.onload(),3);}}
  const source=node('image',{href},root);source.ownerDocument={defaultView:{Image:ImageMock}};
  const first=inset.decodeSource(source),second=inset.decodeSource(source);assert.strictEqual(first,second);
  const another=node('image',{href:href+'\n'},root);another.ownerDocument=source.ownerDocument;
  const both=await Promise.all([first,inset.decodeSource(another)]);assert.equal(constructed,2);assert.equal(maxActive,1);assert.equal(cleared,2);assert.equal(both[0].widthPx,1000);assert.equal(both[0].href,href);
  inset.clearCache();
});
function domChecks(){
  const {JSDOM}=require('jsdom');
  function fixture(attrs=''){
    const dom=new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><svg data-panel="panel-1" data-variant="0" x="20" y="30" width="300" height="150" viewBox="0 0 1000 500" overflow="visible"><image data-key="e3" width="1000" height="500" href="${href}" ${attrs}/></svg></svg>`,{contentType:'image/svg+xml'});
    return {root:dom.window.document.documentElement,image:dom.window.document.querySelector('image')};
  }
  test('actual DOM render preserves original image and ROI pixel crop without preview canvases',()=>{
    const f=fixture(),original=f.root.outerHTML,content=inset.renderContent(a,{root:f.root,geometry,calibration:100});
    assert.equal(content.hasAttribute('data-inset-unavailable'),false);assert.equal(content.querySelectorAll('[data-inset-window]').length,1);
    assert.equal(content.querySelector('[data-inset-frame]').getAttribute('pointer-events'),'all','the full inset window can be selected and dragged even with no background fill');
    const raster=content.querySelector('image');assert.equal(raster.getAttribute('href'),href);assert.equal(raster.getAttribute('width'),'1000');assert.equal(raster.getAttribute('height'),'500');assert.equal(raster.parentElement.getAttribute('viewBox'),'200 100 400 200');assert.equal(raster.parentElement.getAttribute('overflow'),'hidden');assert.equal(content.querySelectorAll('canvas').length,0);assert.equal(f.root.outerHTML,original,'source geometry and encoded bytes stay immutable');
    assert.equal(content.querySelector('[data-inset-scale-label]').textContent,'5 μm');assert.equal(content.querySelector('[data-inset-roi]').getAttribute('pointer-events'),'none');assert.equal(content.querySelector('[data-inset-connector]').getAttribute('pointer-events'),'none');
    assert.equal(content.querySelector('[data-inset-roi]').getAttribute('points'),'80,60 200.00000000000003,60 200.00000000000003,120.00000000000001 80,120.00000000000001');
  });
  test('compact layout translation does not offset source ROI twice',()=>{
    const f=fixture(),normal=inset.renderContent(a,{root:f.root,geometry}),shifted=inset.renderContent(a,{root:f.root,geometry:{...geometry,dx:17,dy:23}});
    const coords=g=>g.querySelector('[data-inset-roi]').getAttribute('points').split(' ').map(v=>v.split(',').map(Number)),base=coords(normal),moved=coords(shifted);for(let i=0;i<4;i++){near(moved[i][0]+17,base[i][0]);near(moved[i][1]+23,base[i][1]);}
    assert.equal(normal.querySelector('svg').getAttribute('x'),shifted.querySelector('svg').getAttribute('x'));
  });
  test('unlocked aspect ratio clips exactly the ROI, never reveals extra source pixels in bars',()=>{
    const f=fixture(),content=inset.renderContent({...a,y:.3,h:.6},{root:f.root,geometry}),crop=content.querySelector('svg');assert.equal(crop.getAttribute('width'),'240');assert.equal(crop.getAttribute('height'),'120');assert.equal(crop.getAttribute('y'),'180');assert.equal(crop.getAttribute('viewBox'),'200 100 400 200');
  });
  test('all eight quarter-turn/flip orientations preserve displayed source direction and exact original ROI',()=>{
    const transforms={normal:'matrix(1 0 0 1 0 0)',rotate90:'matrix(0 1 -1 0 500 0)',rotate180:'matrix(-1 0 0 -1 1000 500)',rotate270:'matrix(0 -1 1 0 0 1000)',flipX:'matrix(-1 0 0 1 1000 0)',flipY:'matrix(1 0 0 -1 0 500)',transpose:'matrix(0 1 1 0 0 0)',transverse:'matrix(0 -1 -1 0 500 1000)'};
    for(const [orientation,transform]of Object.entries(transforms)){
      const f=fixture();f.image.setAttribute('transform',transform);const item={...a,source:{...a.source,orientation}},info=inset.sourceInfo(item,f.root),content=inset.renderContent(item,{root:f.root,geometry});assert.equal(content.hasAttribute('data-inset-unavailable'),false,orientation);f.root.append(content);
      const raster=content.querySelector('image'),m=inset.relativeMatrix(raster,f.root),unit=v=>[v.a/Math.hypot(v.a,v.b),v.b/Math.hypot(v.a,v.b),v.c/Math.hypot(v.c,v.d),v.d/Math.hypot(v.c,v.d)];unit(m).forEach((n,i)=>near(n,unit(info.matrix)[i],orientation));assert.equal(raster.getAttribute('href'),href);assert.equal(raster.getAttribute('width'),'1000');assert.equal(raster.getAttribute('height'),'500');
      const size=inset.displayPixels(item),crop=content.querySelector('svg'),box=crop.getAttribute('viewBox').split(' ').map(Number);near(box[2],size.width);near(box[3],size.height);assert.equal(inset.sourceOrientation(f.image,f.root),orientation);near(Number(crop.getAttribute('width'))/Number(crop.getAttribute('height')),size.width/size.height);
      const transformPoint=(x,y)=>inset.point(inset.relativeMatrix(raster,crop),{x,y}),corners=[[200,100],[600,100],[600,300],[200,300]].map(([x,y])=>transformPoint(x,y));near(Math.min(...corners.map(p=>p.x)),box[0]);near(Math.max(...corners.map(p=>p.x)),box[0]+box[2]);near(Math.min(...corners.map(p=>p.y)),box[1]);near(Math.max(...corners.map(p=>p.y)),box[1]+box[3]);
    }
  });
  test('quarter-turn DPI and horizontal scale use rotated pixel dimensions and the original micrometres per pixel',()=>{
    const rotated={...a,y:.2,w:.2,h:.6,source:{...a.source,orientation:'rotate90'},scaleLengthUm:5},q=inset.quality(rotated,{geometry}),bar=inset.scaleInfo(rotated,{geometry,calibration:100});assert.equal(q.pixelWidth,200);assert.equal(q.pixelHeight,400);near(q.effectiveDpiX,120);near(q.effectiveDpiY,120);near(bar.physicalWidth,20);near(bar.length,30);assert.equal(bar.label,'5 μm');near(bar.length/120,5/(100/1000*200));
    assert.throws(()=>inset.scaleInfo({...rotated,scaleLengthUm:17},{geometry,calibration:100}),/比例尺/);
  });
  test('arbitrary rotation, skew and a changed saved orientation are explicitly rejected',()=>{
    for(const transform of ['rotate(15)','skewX(10)','matrix(1 .1 0 1 0 0)','scale(-1 1)']){const f=fixture();f.image.setAttribute('transform',transform);assert.equal(inset.renderContent(a,{root:f.root,geometry}).getAttribute('data-inset-unavailable'),'orientation');}
    const f=fixture();f.image.setAttribute('transform','rotate(90)');const stale={...a,source:{...a.source,orientation:'flipX'}};assert.throws(()=>inset.sourceInfo(stale,f.root,{checkVisibility:false}),/方向已变化/);
  });
  test('verified image color is inherited into isolated inset filters without changing original pixels',()=>{
    const color=require('../skills/polish-sci-figures/assets/figure-studio/image-color.js'),f=fixture(),adjustment={mode:'fluorescence',exposureEv:.4,contrast:1.1};
    color.apply(f.image,adjustment,{root:f.root,id:'source-color'});const before=f.root.outerHTML,content=inset.renderContent(a,{root:f.root,geometry}),crop=content.querySelector('svg'),copy=content.querySelector('image');
    assert.equal(content.hasAttribute('data-inset-unavailable'),false);assert.deepEqual(color.inspect(copy,crop),color.validate(adjustment));assert.equal(copy.getAttribute('href'),href);assert.notEqual(copy.getAttribute('filter'),f.image.getAttribute('filter'));assert.equal(f.root.outerHTML,before);assert.equal(crop.querySelectorAll('filter').length,1);
    const updated={mode:'fluorescence',exposureEv:-.2};color.apply(f.image,updated,{root:f.root,id:'source-color'});const rerender=inset.renderContent(a,{root:f.root,geometry});assert.deepEqual(color.inspect(rerender.querySelector('image'),rerender.querySelector('svg')),color.validate(updated));assert.deepEqual(color.inspect(copy,crop),color.validate(adjustment),'prior snapshot is not mutated by later source settings');
  });
  test('image color metadata never bypasses unknown, tampered, or ancestor filters',()=>{
    const color=require('../skills/polish-sci-figures/assets/figure-studio/image-color.js');
    for(const tamper of [f=>f.root.querySelector('feFuncR').setAttribute('slope','999'),f=>f.image.setAttribute('filter','blur(2px)'),f=>f.image.parentElement.setAttribute('filter','url(#source-color)'),f=>f.image.removeAttribute('data-studio-image-color')]){const f=fixture();color.apply(f.image,{mode:'fluorescence',exposureEv:.4},{root:f.root,id:'source-color'});tamper(f);const result=inset.renderContent(a,{root:f.root,geometry});assert.equal(result.getAttribute('data-inset-unavailable'),'clip');assert.equal(result.querySelector('image'),null);}
  });
  test('missing, hidden, replaced, clipped or mismatched source gives explicit empty result',()=>{
    for(const change of [f=>f.image.remove(),f=>f.image.setAttribute('display','none'),f=>f.image.parentElement.setAttribute('data-variant','1'),f=>f.image.setAttribute('clip-path','url(#clip)'),f=>f.image.setAttribute('href',png(100,50)),f=>f.image.setAttribute('href','https://example.invalid/a.png')]){
      const f=fixture();change(f);const g=inset.renderContent(a,{root:f.root,geometry});assert.ok(g.hasAttribute('data-inset-unavailable'));assert.equal(g.children.length,0,'no stale image is rendered on an unavailable source');assert.ok(g.getAttribute('data-inset-error'));
    }
  });
  test('slice crops and nested viewport clips reject ROI outside visible original pixels',()=>{
    const f=fixture();f.image.setAttribute('width','500');f.image.setAttribute('preserveAspectRatio','xMidYMid slice');
    const good={...a,roi:{x:.3,y:.2,w:.3,h:.3}};assert.equal(inset.renderContent(good,{root:f.root,geometry}).hasAttribute('data-inset-unavailable'),false);
    assert.equal(inset.renderContent(a,{root:f.root,geometry}).getAttribute('data-inset-unavailable'),'clip');
    const f2=fixture();f2.image.parentElement.setAttribute('overflow','hidden');f2.image.setAttribute('transform','translate(900 0)');assert.equal(inset.renderContent(a,{root:f2.root,geometry}).getAttribute('data-inset-unavailable'),'clip');
  });
  test('compact whitespace single-rectangle clipping preserves exact ROI and rejects partial loss',()=>{
    const f=fixture(),doc=f.root.ownerDocument,NS=f.root.namespaceURI,defs=doc.createElementNS(NS,'defs'),clip=doc.createElementNS(NS,'clipPath'),rect=doc.createElementNS(NS,'rect'),wrapper=doc.createElementNS(NS,'g');
    clip.id='studio-compact-clip-1';clip.setAttribute('clipPathUnits','userSpaceOnUse');for(const [k,v]of Object.entries({x:75,y:55,width:130,height:75}))rect.setAttribute(k,v);clip.append(rect);defs.append(clip);wrapper.setAttribute('clip-path','url(#studio-compact-clip-1)');wrapper.append(f.image.parentElement);f.root.append(defs,wrapper);
    assert.equal(inset.renderContent(a,{root:f.root,geometry}).hasAttribute('data-inset-unavailable'),false,'known rectangular crop fully contains ROI');
    rect.setAttribute('width','100');assert.equal(inset.renderContent(a,{root:f.root,geometry}).getAttribute('data-inset-unavailable'),'clip','partially clipped ROI is not silently reconstructed from hidden pixels');
    assert.ok(inset.sourceInfo({...a,roi:{x:0,y:0,w:1,h:1}},f.root,{checkVisibility:false}).image,'source geometry can be inspected before the user draws the actual ROI');
    rect.setAttribute('width','130');
    for(const [key,value]of [['clipPathUnits','objectBoundingBox'],['transform','rotate(1)']]){clip.setAttribute(key,value);assert.equal(inset.renderContent(a,{root:f.root,geometry}).getAttribute('data-inset-unavailable'),'clip');assert.throws(()=>inset.sourceInfo(a,f.root,{checkVisibility:false}),'pre-selection inspection does not waive clip-definition correctness');clip.removeAttribute(key);}
    rect.setAttribute('rx','10');assert.equal(inset.renderContent(a,{root:f.root,geometry}).getAttribute('data-inset-unavailable'),'clip');rect.removeAttribute('rx');
    defs.append(clip.cloneNode(true));assert.equal(inset.renderContent(a,{root:f.root,geometry}).getAttribute('data-inset-unavailable'),'clip','ambiguous referenced ids must never guess clipping geometry');
  });
  test('unavailable calibration produces no fabricated bar and manual overflow is explicit',()=>{
    const f=fixture();assert.equal(inset.renderContent(a,{root:f.root,geometry}).querySelector('[data-inset-scale]'),null);
    const overflow=inset.renderContent({...a,scaleLengthUm:90},{root:f.root,geometry,calibration:100});assert.equal(overflow.hasAttribute('data-inset-unavailable'),false);assert.equal(overflow.getAttribute('data-inset-scale-unavailable'),'scale');assert.ok(overflow.querySelector('image'));assert.ok(overflow.querySelector('[data-inset-roi]'));assert.equal(overflow.querySelector('[data-inset-scale]'),null,'invalid scale never hides a valid image or fabricates a misleading line');
  });
  test('tiny windows and thick strokes omit an overflowing scale but retain the original ROI',()=>{
    const f=fixture();
    for(const value of [{...a,w:1/600,h:.5/400},{...a,w:.1,h:.01},{...a,stroke:100}]){const g=inset.renderContent(value,{root:f.root,geometry,calibration:100});assert.equal(g.getAttribute('data-inset-scale-unavailable'),'scale');assert.ok(g.querySelector('image'));assert.equal(g.querySelector('[data-inset-scale]'),null);assert.equal(g.querySelector('[data-inset-scale-background]'),null);assert.ok(g.getAttribute('data-inset-error'));}
    const filled=inset.renderContent({...a,y:.3,h:.6,fill:true},{root:f.root,geometry});const background=filled.querySelector('[data-inset-window] > rect');assert.equal(background.getAttribute('y'),'180');assert.equal(background.getAttribute('height'),'120','optional fill stays inside the exact image frame');
  });
}
if(process.argv.includes('--dom'))domChecks();
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(`${tests.length} image inset core tests passed`);})().catch(error=>{console.error(error);process.exitCode=1;});
