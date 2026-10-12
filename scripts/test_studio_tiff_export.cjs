/* Validate the encoder independently through TIFF tags and Pillow's TIFF decoder. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),modulePath=path.join(root,'skills/polish-sci-figures/assets/figure-studio/tiff-export.js');
const tiff=require(modulePath);
let checks=0;
function equal(actual,expected,message){assert.deepEqual(actual,expected,message);checks++;}
function ok(value,message){assert.ok(value,message);checks++;}
function tags(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  equal(String.fromCharCode(...bytes.subarray(0,2)),'II');equal(view.getUint16(2,true),42);
  const offset=view.getUint32(4,true),count=view.getUint16(offset,true),result=new Map();let previous=0;
  for(let i=0;i<count;i++){
    const start=offset+2+i*12,id=view.getUint16(start,true),type=view.getUint16(start+2,true),n=view.getUint32(start+4,true),sizes={3:2,4:4,5:8};
    ok(id>previous,'IFD tags are sorted and unique');previous=id;ok(sizes[type],'Expected baseline TIFF type');
    const p=n*sizes[type]<=4?start+8:view.getUint32(start+8,true),values=[];
    ok(p+n*sizes[type]<=bytes.length,'Tag payload stays inside file');
    for(let j=0;j<n;j++)values.push(type===3?view.getUint16(p+j*2,true):type===4?view.getUint32(p+j*4,true):view.getUint32(p+j*8,true)/view.getUint32(p+j*8+4,true));
    result.set(id,{type,count:n,values});
  }
  equal(view.getUint32(offset+2+count*12,true),0,'Single-image TIFF');return result;
}
function verify(options,bytes,expected){
  const fields=tags(bytes),value=id=>fields.get(id).values;
  equal(value(256),[options.width]);equal(value(257),[options.height]);equal(value(258),[8,8,8]);
  equal(value(259),[1]);equal(value(262),[2]);equal(value(274),[1]);equal(value(277),[3]);equal(value(284),[1]);equal(value(296),[2]);
  equal(value(282),[options.dpi??600]);equal(value(283),[options.dpi??600]);
  const pixels=[],offsets=value(273),counts=value(279),rowsPerStrip=value(278)[0];
  equal(offsets.length,Math.ceil(options.height/rowsPerStrip));equal(counts.length,offsets.length);
  for(let strip=0;strip<offsets.length;strip++){
    equal(counts[strip],Math.min(rowsPerStrip,options.height-strip*rowsPerStrip)*options.width*3);
    if(strip)equal(offsets[strip],offsets[strip-1]+counts[strip-1],'Strips preserve top-to-bottom row ordering');
    pixels.push(...bytes.subarray(offsets[strip],offsets[strip]+counts[strip]));
  }
  equal(pixels,expected,'Decoded RGB pixels match the original canvas, including white compositing');
  equal(offsets.at(-1)+counts.at(-1),bytes.length,'No lost or unexpected trailing pixel data');
  equal(tiff.estimateBytes(options),bytes.length,'Preflight file estimate is exact');
  return {width:options.width,height:options.height,dpi:options.dpi??600,rgb:expected,base64:Buffer.from(bytes).toString('base64')};
}
async function main(){
  const fixtures=[];
  const options={width:3,height:2,data:new Uint8ClampedArray([255,0,0,255,0,255,0,255,0,0,255,255,0,0,0,255,10,20,30,128,42,89,200,0])};
  const snapshot=options.data.slice(),expected=[255,0,0,0,255,0,0,0,255,0,0,0,132,137,142,255,255,255];
  const first=tiff.encode(options);fixtures.push(verify(options,first,expected));equal(options.data,snapshot,'Source pixels are immutable');
  for(const height of [1,64,65,130]){
    const width=5,data=new Uint8Array(width*height*4),rgb=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const p=(y*width+x)*4,color=[(x*39+y)%256,(y*7+x)%256,(y+x*17)%256];data.set([...color,255],p);rgb.push(...color);
    }
    const settings={width,height,data,dpi:height===130?600.25:1200};
    fixtures.push(verify(settings,tiff.encode(settings),rgb));
  }
  // An ImageData slice must not expose prefix/suffix bytes from its backing buffer.
  const backing=new Uint8Array([99,98,...options.data,97,96]),slice={...options,data:backing.subarray(2,-2),dpi:2400};
  fixtures.push(verify(slice,tiff.encode(slice),expected));equal(backing[0],99);equal(backing.at(-1),96);
  // The standalone browser script has no module-loader or network dependency.
  const browser={setTimeout,performance};vm.runInNewContext(fs.readFileSync(modulePath,'utf8'),browser);
  ok(browser.StudioTiff);equal(Array.from(browser.StudioTiff.encode(options)),Array.from(first));

  for(const invalid of [null,{}, {width:0,height:1},{width:-1,height:1},{width:1.5,height:1},{width:'1',height:1},{width:NaN,height:1},{width:1,height:Infinity}])
    assert.throws(()=>tiff.estimateBytes(invalid),error=>error.code==='TIFF_DIMENSIONS');
  for(const invalid of [{width:32768,height:1},{width:1,height:32768},{width:8001,height:8000},{width:Number.MAX_SAFE_INTEGER,height:1}])
    assert.throws(()=>tiff.estimateBytes(invalid),error=>error.code==='TIFF_CAPACITY');
  ok(tiff.estimateBytes({width:8000,height:8000})>192000000,'64 MP boundary is accepted without allocating its pixels');
  equal(tiff.MAX_PIXELS,64000000);equal(tiff.MAX_DIMENSION,32767);
  for(const data of [null,[],new Uint8Array(23),new Uint8Array(25),new Int8Array(24),new Uint16Array(24),new DataView(new ArrayBuffer(24))])
    assert.throws(()=>tiff.encode({...options,data}),error=>error.code==='TIFF_PIXELS');
  for(const dpi of [0,-600,NaN,Infinity,'600',null,0.0001,65536])
    assert.throws(()=>tiff.encode({...options,dpi}),error=>error.code==='TIFF_DPI');
  checks+=27;

  // Cooperative encoding is byte-identical and yields even when a canvas is narrow.
  const asyncOptions={width:2,height:600,data:new Uint8ClampedArray(2*600*4).fill(255),dpi:600},progress=[];
  let timerRan=false;setTimeout(()=>{timerRan=true;},0);
  const asyncBytes=await tiff.encodeAsync({...asyncOptions,onProgress:value=>progress.push(value)});
  ok(timerRan,'Encoding lets the event loop repaint');equal(asyncBytes,tiff.encode(asyncOptions));
  equal(progress[0],0);equal(progress.at(-1),1);ok(progress.length>=4,'Encoding yields between row batches');
  for(let i=1;i<progress.length;i++)ok(progress[i]>progress[i-1]&&progress[i]<=1,'Progress is monotonic');
  await assert.rejects(tiff.encodeAsync({...options,dpi:0}),error=>error.code==='TIFF_DPI');checks++;

  // Independent decoder confirms compatibility, pixel orientation, and physical resolution.
  const python=process.env.PYTHON||[path.join(root,'.venv/bin/python'),path.join(root,'.venv/Scripts/python.exe')].find(file=>fs.existsSync(file))||'python';
  const code=String.raw`import base64,io,json,sys
from PIL import Image
fixtures=json.load(sys.stdin)
for f in fixtures:
    image=Image.open(io.BytesIO(base64.b64decode(f['base64'])))
    assert image.tag_v2[274]==1  # Pillow removes this tag after applying orientation on load.
    image.load()
    assert image.format=='TIFF' and image.mode=='RGB'
    assert image.size==(f['width'],f['height'])
    assert list(image.tobytes())==f['rgb']
    assert image.n_frames==1
    assert image.tag_v2[259]==1 and image.tag_v2[296]==2
    assert tuple(image.tag_v2[258])==(8,8,8)
    assert all(abs(v-f['dpi'])<1e-8 for v in image.info['dpi'])
    assert abs(float(image.tag_v2[282])-f['dpi'])<1e-8
    assert abs(float(image.tag_v2[283])-f['dpi'])<1e-8
print(f'Pillow independently decoded {len(fixtures)} TIFFs: exact RGB pixels and DPI.')`;
  const decoded=cp.spawnSync(python,['-c',code],{encoding:'utf8',input:JSON.stringify(fixtures),maxBuffer:2e6});
  equal(decoded.status,0,decoded.stderr||decoded.stdout);console.log(decoded.stdout.trim());
  console.log(`PASS: TIFF export (${checks} checks; baseline tags, strip ordering, alpha, DPI, capacity, async and standalone).`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
