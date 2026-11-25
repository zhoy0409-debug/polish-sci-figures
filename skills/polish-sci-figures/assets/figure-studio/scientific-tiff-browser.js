/* Offline TIFF display. Native samples stay separate from reversible display PNGs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioScientificTiffBrowser=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function workerMain(){
    'use strict';
    const SCHEMA='figure-studio-scientific-image/1',LIMIT=32000000,MAX_BYTES=64000000;
    let raw=null,ifds=null,metadata=null,decoded=null,active=null;
    self.fetch=()=>Promise.reject(Error('TIFF decoding is offline'));self.XMLHttpRequest=undefined;
    const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
    const fail=message=>{throw Error(message);},first=(d,tag,fallback)=>d['t'+tag]?.[0]??fallback;
    const checked=(n,max=LIMIT)=>{if(!Number.isSafeInteger(n)||n<1||n>max)fail('TIFF dimensions/count exceed the supported limit');return n;};
    function directories(buffer){
      const bytes=new Uint8Array(buffer),view=new DataView(buffer),le=bytes[0]===73&&bytes[1]===73;
      if(bytes.length<8||bytes.length>MAX_BYTES||!le&&!(bytes[0]===77&&bytes[1]===77))fail('Invalid TIFF header');
      if(view.getUint16(2,le)!==42)fail('Browser import supports classic TIFF. Open BigTIFF in the desktop editor.');
      const sizes={1:1,2:1,3:2,4:4,5:8,7:1},wanted=new Set([256,257,258,259,262,266,270,273,274,277,278,279,284,317,322,323,324,325,330,339,34675]);
      const result=[],seen=new Set();let offset=view.getUint32(4,le),tagValues=0;
      while(offset){
        if(result.length>=128||seen.has(offset)||offset<8||offset+2>bytes.length)fail('TIFF has too many pages or invalid page links');seen.add(offset);
        const count=view.getUint16(offset,le);if(count>4096||offset+2+count*12+4>bytes.length)fail('Invalid TIFF directory');const d={};
        for(let i=0;i<count;i++){
          const at=offset+2+i*12,tag=view.getUint16(at,le),type=view.getUint16(at+2,le),n=view.getUint32(at+4,le);if(!wanted.has(tag))continue;
          const size=sizes[type];if(!size||n>1000000||(tagValues+=n)>1000000)fail('Browser TIFF metadata limit exceeded; use the desktop editor');
          const length=size*n,start=length<=4?at+8:view.getUint32(at+8,le);if(start+length>bytes.length)fail('TIFF tag points outside the file');
          if(type===2){if(length>262144)fail('TIFF description exceeds 256 KiB');d['t'+tag]=[new TextDecoder().decode(bytes.subarray(start,start+length)).replace(/\0+$/,'')];}
          else if(type===7||type===1)d['t'+tag]=bytes.slice(start,start+length);
          else{const values=[];for(let k=0;k<n;k++)values.push(type===3?view.getUint16(start+k*2,le):type===4?view.getUint32(start+k*4,le):view.getUint32(start+k*8,le)/view.getUint32(start+k*8+4,le));d['t'+tag]=values;}
        }
        const width=checked(first(d,256)),height=checked(first(d,257));if(width>32768||height>32768||width*height>LIMIT)fail('TIFF page limit: 32 megapixels and 32768 pixels per edge');
        result.push(d);offset=view.getUint32(offset+2+count*12,le);
      }
      if(!result.length)fail('TIFF contains no image pages');return {records:result,le};
    }
    async function inspect(buffer){
      raw=buffer;const parsed=directories(buffer);ifds=parsed.records;const pages=[];
      for(const [index,d]of ifds.entries()){
        const width=first(d,256),height=first(d,257),bits=Array.from(d.t258||[1]),samples=first(d,277,1),format=Array.from(d.t339||[1]),photo=first(d,262,-1),orientation=first(d,274,1),compression=first(d,259,1),icc=d.t34675;
        let reason=null;
        if(d.t330)reason='Pyramidal TIFF/SubIFDs require the desktop editor; no resolution is chosen automatically.';
        else if(orientation!==1)reason='Oriented TIFF requires explicit support; original pixels have not been changed.';
        else if(format.some(v=>v!==1))reason='Signed/float TIFF samples are not silently reduced to 8-bit.';
        else if(!(samples===1&&bits.length===1&&[8,16].includes(bits[0])&&photo===1||samples===3&&bits.every(b=>b===8)&&[1,3].includes(bits.length)&&photo===2))reason='Unsupported TIFF channels/photometry. RGB16, palette, alpha and CMYK are not silently converted.';
        else if(![1,5,8,32946,32773].includes(compression))reason='This browser supports lossless uncompressed, LZW, Deflate and PackBits TIFF. Use the desktop editor for other compression.';
        else if(first(d,284,1)!==1||first(d,266,1)!==1||![1,2].includes(first(d,317,1)))reason='This TIFF storage layout requires the desktop editor.';
        else if(icc&&samples===3)reason='This RGB TIFF has an ICC profile. Use the desktop editor to retain its colour profile.';
        pages.push({index,width,height,bitsPerSample:bits,samplesPerPixel:samples,sampleFormat:format,mode:samples===3?'RGB':bits[0]===16?(parsed.le?'I;16':'I;16B'):'L',orientation,photometry:photo,compression:String(compression),supported:!reason,unsupportedReason:reason,iccProfileSha256:icc?await sha(icc):null});
      }
      metadata={schema:SCHEMA,fileSha256:await sha(buffer),fileBytes:buffer.byteLength,byteOrder:parsed.le?'little':'big',pages,ome:null,displayOnly:true,originalRetainedRequired:true,decodingVerified:false,decodingEngine:'UTIF.js d5f4afefa9bde9f5ac1ee9782983088f6ffbf5e9; bounded offline worker',limitations:['Display PNG is 8-bit; the original TIFF and native sample digest are retained.','Pages are not assumed to be channels, paired observations or replicates.','TIFF print DPI is not microscopy calibration.']};
      return {metadata,description:first(ifds[0],270,'')};
    }
    function packbitsLength(data,off,len,expected){
      let count=0,end=off+len;while(off<end){const n=(data[off++]<<24)>>24;if(n===-128)continue;const bytes=n>=0?n+1:1,run=n>=0?n+1:1-n;if(off+bytes>end||(count+=run)>expected)fail('Damaged PackBits TIFF strip');off+=bytes;}
      if(count!==expected)fail('Truncated PackBits TIFF strip');
    }
    function lzwLength(data,off,len,expected){
      const lengths=new Uint32Array(4096);for(let i=0;i<256;i++)lengths[i]=1;let at=0,bits=9,next=258,previous=-1,count=0,ended=false;
      while(at+bits<=len*8){let code=0;for(let j=0;j<bits;j++,at++)code=(code<<1)|((data[off+(at>>>3)]>>(7-(at&7)))&1);
        if(code===256){bits=9;next=258;previous=-1;continue;}if(code===257){ended=true;break;}
        const length=code<next?lengths[code]:code===next&&previous>=0?lengths[previous]+1:0;
        if(!length||(count+=length)>expected)fail('Damaged LZW TIFF strip');
        if(previous>=0&&next<4096){lengths[next++]=lengths[previous]+1;if(next===(1<<bits)-1&&bits<12)bits++;}previous=code;
      }
      if(!ended||count!==expected)fail('Truncated LZW TIFF strip');
    }
    function adler(bytes){let a=1,b=0;for(let i=0;i<bytes.length;i++){a=(a+bytes[i])%65521;b=(b+a)%65521;}return ((b<<16)|a)>>>0;}
    const decompress=UTIF.decode._decompress,inflate=UTIF._inflateRaw;
    UTIF.decode._decompress=function(img,all,data,off,len,compression,target,toff,order,width,height){
      const page=active,expected=Math.min(target.length-toff,width*height*page.samplesPerPixel*(page.bitsPerSample[0]/8));
      if(!Number.isSafeInteger(off)||!Number.isSafeInteger(len)||off<8||len<1||off+len>data.length||expected<1||expected>LIMIT*3)fail('Invalid TIFF strip/tile bounds');
      if(compression===1&&len!==expected)fail('TIFF uncompressed byte count differs from its declared geometry');
      if(compression===5)lzwLength(data,off,len,expected);
      if(compression===32773)packbitsLength(data,off,len,expected);
      UTIF._inflateRaw=source=>{
        const bytes=inflate(source,new Uint8Array(expected+1));if(bytes.length!==expected)fail('TIFF Deflate size differs from its geometry');
        const view=new DataView(data.buffer,data.byteOffset+off+len-4,4);if(adler(bytes)!==view.getUint32(0,false))fail('TIFF Deflate checksum failed');return bytes;
      };
      try{return decompress(img,all,data,off,len,compression,target,toff,order,width,height);}finally{UTIF._inflateRaw=inflate;}
    };
    async function plane(index){
      if(!Number.isInteger(index)||!metadata.pages[index])fail('Invalid TIFF page');const page=metadata.pages[index];if(!page.supported)fail(page.unsupportedReason);
      if(decoded?.index===index)return decoded;for(const d of ifds)delete d.data;
      const d=ifds[index],w=page.width,h=page.height,spp=page.samplesPerPixel,bpv=page.bitsPerSample[0]/8;
      const tiled=!!d.t322,tw=checked(first(d,322,w)),th=checked(first(d,323,h));if(tw*th>LIMIT)fail('TIFF tile exceeds the pixel limit');
      const rows=Math.min(h,checked(first(d,278,h),4294967295)),offsets=tiled?d.t324:d.t273,counts=tiled?d.t325:d.t279,expected=tiled?Math.ceil(w/tw)*Math.ceil(h/th):Math.ceil(h/rows);
      if(!offsets||!counts||offsets.length!==expected||counts.length!==expected)fail('TIFF strip/tile table differs from its geometry');
      for(let i=0;i<expected;i++)if(!Number.isSafeInteger(offsets[i])||!Number.isSafeInteger(counts[i])||offsets[i]<8||counts[i]<1||offsets[i]+counts[i]>raw.byteLength)fail('TIFF image data points outside the file');
      if(first(d,259,1)===1)for(let i=0;i<expected;i++){const bytes=(tiled?tw*th:w*Math.min(rows,h-i*rows))*spp*bpv;if(counts[i]!==bytes)fail('TIFF uncompressed byte count differs from its declared geometry');}
      active=page;UTIF.decodeImage(raw,d,ifds);if(!d.data||d.data.byteLength!==w*h*spp*bpv)fail('Decoded TIFF dimensions differ from metadata');
      // UTIF normalises every decoded 16-bit strip to little endian, including BE sources.
      let samples=d.data;if(bpv===2){samples=new Uint8Array(d.data.byteLength);const input=new DataView(d.data.buffer,d.data.byteOffset,d.data.byteLength),output=new DataView(samples.buffer);for(let i=0;i<w*h;i++)output.setUint16(i*2,input.getUint16(i*2,true),true);}
      const values=bpv===2?new Uint16Array(samples.buffer,samples.byteOffset,samples.byteLength/2):samples;
      metadata.decodingVerified=true;decoded={index,samples,values,native:{page:index,size:[w,h],bits:[...page.bitsPerSample],samplesSha256:await sha(samples),omePosition:page.omePosition||null}};return decoded;
    }
    function evenRound(n){const lower=Math.floor(n);return n-lower===.5?(lower%2?lower+1:lower):Math.round(n);}
    function base64(bytes){let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
    async function display(payload){
      const index=payload.page??0,decoded=await plane(index),page=metadata.pages[index],maximum=page.bitsPerSample[0]===16?65535:255,window=payload.window,gamma=payload.gamma??1,lut=payload.lut??'gray',edge=payload.previewEdge??0;
      if(!Array.isArray(window)||window.length!==2||!window.every(Number.isFinite)||window[0]<0||window[1]<=window[0]||window[1]>maximum||!Number.isFinite(gamma)||gamma<.1||gamma>10||!['gray','green','magenta','cyan'].includes(lut)||page.samplesPerPixel===3&&lut!=='gray'||!Number.isInteger(edge)||edge!==0&&(edge<256||edge>2048))fail('Invalid native display range, gamma, LUT or resolution');
      const w=page.width,h=page.height,rgba=new Uint8ClampedArray(w*h*4),range=window[1]-window[0],map=n=>evenRound(Math.pow(Math.max(0,Math.min(1,(n-window[0])/range)),1/gamma)*255);
      for(let i=0;i<w*h;i++){const at=i*4;if(page.samplesPerPixel===3){rgba[at]=map(decoded.values[i*3]);rgba[at+1]=map(decoded.values[i*3+1]);rgba[at+2]=map(decoded.values[i*3+2]);}else{const value=map(decoded.values[i]);rgba[at]=lut==='green'||lut==='cyan'?0:value;rgba[at+1]=lut==='magenta'?0:value;rgba[at+2]=lut==='green'?0:value;}rgba[at+3]=255;}
      const canvas=new OffscreenCanvas(w,h);canvas.getContext('2d').putImageData(new ImageData(rgba,w,h),0,0);let output=canvas;
      if(edge&&Math.max(w,h)>edge){const scale=edge/Math.max(w,h);output=new OffscreenCanvas(Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale)));const ctx=output.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,0,0,output.width,output.height);}
      const blob=await output.convertToBlob({type:'image/png'});if(blob.size>20000000)fail('Display PNG exceeds 20 MB; choose an explicitly resampled display resolution');const png=new Uint8Array(await blob.arrayBuffer());
      return {metadata,native:decoded.native,display:{mime:'image/png',data:base64(png),sha256:await sha(png),size:[output.width,output.height],window:[...window],gamma,lut,resampled:output.width!==w||output.height!==h,previewEdge:edge,iccProfileSha256:null,quantitative:false}};
    }
    self.onmessage=async event=>{const {id,action,...payload}=event.data;try{
      let value;if(action==='upload')value=await inspect(payload.buffer);
      else if(action==='ome'){metadata.ome=payload.ome;for(const page of metadata.pages)if(payload.ome){page.omePosition=payload.ome.planePositions[String(page.index)]||null;if(!page.omePosition){page.supported=false;page.unsupportedReason='This TIFF page is not declared in the OME plane mapping';}}value={metadata};}
      else if(!raw)fail('TIFF session expired');
      else if(action==='display')value=await display(payload);
      else if(action==='suggest'){const d=await plane(payload.page??0);let lo=Infinity,hi=-Infinity;for(const v of d.values){lo=Math.min(lo,v);hi=Math.max(hi,v);}const high=metadata.pages[d.index].bitsPerSample[0]===16?65535:255;value={metadata,native:d.native,suggestedWindow:lo<hi?[lo,hi]:[0,high],method:'global-native-min-max',forDisplayOnly:true};}
      else if(action==='inspect')value={metadata};else fail('Unsupported offline TIFF operation');
      self.postMessage({id,value});
    }catch(error){self.postMessage({id,error:error?.message||'TIFF could not be decoded'});}};
  }
  async function omeMetadata(description,pages){
    if(!description||!/<(?:[A-Za-z_][\w.-]*:)?OME(?:\s|\/?>)/.test(description))return null;
    const bytes=new TextEncoder().encode(description);if(bytes.length>262144||/<!DOCTYPE|<!ENTITY/i.test(description))throw Error('Unsupported OME XML size or DTD/entity declaration');
    const xml=new DOMParser().parseFromString(description,'application/xml'),root=xml.documentElement;if(xml.querySelector('parsererror')||root.localName!=='OME')throw Error('Invalid OME XML');
    const children=(n,name)=>[...n.children].filter(c=>c.localName===name),images=children(root,'Image');if(images.length!==1)throw Error('Multiple OME series require explicit series support');const pixels=children(images[0],'Pixels');if(pixels.length!==1)throw Error('OME must contain one Pixels description');const p=pixels[0],order=p.getAttribute('DimensionOrder')||'';
    if(!/^XY[ZCT]{3}$/.test(order)||new Set(order.slice(2)).size!==3)throw Error('Unsupported OME dimension order');
    const number=(text,min=0,max=32000000)=>{if(!/^\+?\d+$/.test(text??''))throw Error('Invalid OME integer');const n=Number(text);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error('Invalid OME size or plane coordinate');return n;};
    const sizes=Object.fromEntries([...'XYZCT'].map(axis=>[axis,number(p.getAttribute('Size'+axis),1)])),pixelType=p.getAttribute('Type'),bits=pixelType==='uint16'?16:8;
    if(!['uint8','uint16'].includes(pixelType)||sizes.C>1&&['true','1'].includes((p.getAttribute('Interleaved')||'false').toLowerCase()))throw Error('OME signed/float or interleaved channels are not silently converted');
    const significantBits=p.hasAttribute('SignificantBits')?number(p.getAttribute('SignificantBits'),1,bits):null,channels=children(p,'Channel');if(channels.length&&(channels.length!==sizes.C||channels.some(c=>(c.getAttribute('SamplesPerPixel')||'1')!=='1')))throw Error('OME channel descriptions disagree');
    const blocks=children(p,'TiffData');if(!blocks.length)throw Error('OME has no local TiffData mapping');const total=sizes.Z*sizes.C*sizes.T;if(!Number.isSafeInteger(total))throw Error('OME dimensions exceed supported mapping limits');const mapped={},positions=new Set();
    for(const block of blocks){
      if([...block.attributes].some(a=>!['IFD','FirstZ','FirstC','FirstT','PlaneCount'].includes(a.name)))throw Error('Unsupported OME TiffData mapping attributes');
      if([...block.children].some(c=>c.localName!=='UUID'||!root.getAttribute('UUID')||c.textContent.trim()!==root.getAttribute('UUID')))throw Error('OME references another or unverified file; no external file is opened');
      const first=number(block.getAttribute('IFD')??'0',0,127);let count=number(block.getAttribute('PlaneCount')??String(block.hasAttribute('IFD')?1:pages.length),0,128),stride=1,start=0;
      for(const axis of order.slice(2)){start+=number(block.getAttribute('First'+axis)??'0',0,sizes[axis]-1)*stride;stride*=sizes[axis];}if(!block.attributes.length)count=Math.min(count,total);if(first+count>pages.length||start+count>total)throw Error('OME plane mapping exceeds available or declared planes');
      for(let step=0;step<count;step++){const index=first+step,position={};let linear=start+step;for(const axis of order.slice(2)){position[axis]=linear%sizes[axis];linear=Math.floor(linear/sizes[axis]);}const key=JSON.stringify([position.Z,position.C,position.T]),page=pages[index];
        if(mapped[index]||positions.has(key)||page.width!==sizes.X||page.height!==sizes.Y||page.samplesPerPixel!==1||page.bitsPerSample.length!==1||page.bitsPerSample[0]!==bits)throw Error('OME mapping overlaps or disagrees with native TIFF samples');mapped[index]=position;positions.add(key);
      }
    }
    if(!Object.keys(mapped).length)throw Error('OME maps no local TIFF plane');
    return {dimensionOrder:order,sizes,pixelType,significantBits,channels:channels.map((c,index)=>({index,name:(c.getAttribute('Name')||'').slice(0,200)})),physicalSize:Object.fromEntries(['PhysicalSizeX','PhysicalSizeY','PhysicalSizeZ','PhysicalSizeXUnit','PhysicalSizeYUnit','PhysicalSizeZUnit'].filter(k=>p.hasAttribute(k)).map(k=>[k,p.getAttribute(k)])),planePositions:mapped,mappedPlanes:Object.keys(mapped).length,declaredPlanes:total,complete:Object.keys(mapped).length===total,xmlSha256:await StudioScientificTiff.digest(bytes),mappingReference:'https://docs.openmicroscopy.org/ome-model/6.2.2/ome-tiff/specification.html',validation:'Supported structural mapping; not full OME schema or acquisition validation'};
  }
  function available(){return typeof Worker==='function'&&typeof OffscreenCanvas==='function'&&typeof OffscreenCanvas.prototype.convertToBlob==='function'&&!!globalThis.crypto?.subtle&&!!document.getElementById('scientific-tiff-decoder');}
  function create(){
    const sessions=new Map();let sequence=0;
    function close(sourceId,error=new DOMException('TIFF operation cancelled','AbortError')){const session=sessions.get(sourceId);if(!session)return;sessions.delete(sourceId);session.worker.terminate();URL.revokeObjectURL(session.url);for(const pending of session.pending.values()){clearTimeout(pending.timer);pending.reject(error);}session.pending.clear();}
    function call(session,payload,signal,transfer=[]){return new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(new DOMException('Cancelled','AbortError'));return;}const id=++sequence;
      const abort=()=>close(session.id),finish=(fn,value)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);},timer=setTimeout(()=>close(session.id,Error('TIFF decoding timed out; the project is unchanged')),30000);
      session.pending.set(id,{timer,resolve:value=>finish(resolve,value),reject:error=>finish(reject,error)});signal?.addEventListener('abort',abort,{once:true});session.worker.postMessage({id,...payload},transfer);
    });}
    return {
      async upload(file,signal){
        if(!available())throw Error('Offline TIFF decoding requires a browser with local Worker and canvas support. Open the file in the desktop editor.');
        if(!file||file.size>64000000)throw Error('TIFF limit: 64 MB');
        const decoder=JSON.parse(document.getElementById('scientific-tiff-decoder').textContent),url=URL.createObjectURL(new Blob([decoder,'\n;(',workerMain.toString(),')();'],{type:'text/javascript'})),id='browser-tiff-'+crypto.randomUUID(),worker=new Worker(url),session={id,url,worker,pending:new Map()};sessions.set(id,session);
        worker.onmessage=event=>{const pending=session.pending.get(event.data.id);if(!pending)return;session.pending.delete(event.data.id);event.data.error?pending.reject(Error(event.data.error)):pending.resolve(event.data.value);};
        worker.onerror=()=>close(id,Error('The offline TIFF worker could not start. Open the file in the desktop editor.'));
        try{const buffer=await file.arrayBuffer(),result=await call(session,{action:'upload',buffer},signal,[buffer]),ome=await omeMetadata(result.description,result.metadata.pages),configured=await call(session,{action:'ome',ome},signal);return {sourceId:id,metadata:configured.metadata};}catch(error){close(id);throw error;}
      },
      request(payload,signal){const session=sessions.get(payload.sourceId);if(!session)return Promise.reject(Error('TIFF session expired'));const {sourceId,...body}=payload;return call(session,body,signal);},
      release:close,destroy(){for(const id of [...sessions.keys()])close(id);}
    };
  }
  return Object.freeze({available,create});
});
