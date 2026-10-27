/* Native scientific bytes remain distinct from their reversible display PNG. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioScientificTiff=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='figure-studio-scientific-image/1',ORIGIN_SCHEMA='figure-studio-scientific-origin/1',MAX_BYTES=64000000,MAX_TOTAL=80000000;
  const checked=new WeakMap(),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
  const integer=value=>Number.isSafeInteger(value)&&value>=0;
  function localEndpoint(endpoint,href){
    try{
      if(typeof endpoint!=='string')return null;
      const origin=new URL(href),url=new URL(endpoint,origin);
      if(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.username||origin.password||url.origin!==origin.origin||url.pathname!=='/api/import-tiff'||url.search||url.hash||url.username||url.password)return null;
      return url.pathname;
    }catch{return null;}
  }
  function base64Shape(value){
    if(typeof value!=='string'||!value.length||value.length>26666668||value.length%4)return false;
    for(let i=0;i<value.length;i+=262144)if(!/^[A-Za-z0-9+/]*={0,2}$/.test(value.slice(i,i+262144))||i+262144<value.length&&value.slice(i,i+262144).includes('='))return false;
    return true;
  }
  function validateSources(owner){
    const sources=owner.scientificSources||{};
    if(!sources||typeof sources!=='object'||Array.isArray(sources)||Object.keys(sources).length>128)throw Error('Invalid native TIFF source store');
    let total=0;
    for(const [key,source]of Object.entries(sources)){
      if(!hex(key)||!source||source.schema!==SCHEMA||source.sha256!==key||!integer(source.bytes)||!source.bytes||source.bytes>MAX_BYTES||typeof source.data!=='string'||source.data.length!==Math.ceil(source.bytes/3)*4||typeof source.name!=='string'||source.name.length>255||!source.metadata||source.metadata.schema!==SCHEMA||source.metadata.fileSha256!==key||source.metadata.fileBytes!==source.bytes||!Array.isArray(source.metadata.pages)||!source.metadata.pages.length||source.metadata.pages.length>128||JSON.stringify(source.metadata).length>262144)throw Error('Invalid native TIFF source record');
      if(source.metadata.pages.some((page,index)=>page.index!==index||!integer(page.width)||!integer(page.height)||!page.width||!page.height||Math.max(page.width,page.height)>32768||page.width*page.height>32000000||typeof page.supported!=='boolean'))throw Error('Invalid native TIFF page geometry');
      total+=source.bytes;
    }
    if(total>MAX_TOTAL)throw Error('Native TIFF source limit: 80 MB per project; originals are never silently discarded');
    for(const panel of owner.panels||[]){
      const origin=panel.analysis?.scientificOrigin;
      if(origin){
        const sourcePanel=(owner.panels||[]).find(p=>p.id===origin.sourcePanelId),source=sourcePanel?.analysis?.scientificImage;
        if(origin.schema!==ORIGIN_SCHEMA||Object.keys(origin).sort().join(',')!=='displaySha256,schema,sourcePanelId,sourceSha256'||panel.analysis.scientificImage||typeof origin.sourcePanelId!=='string'||!source||!sources[source.sourceSha256]||origin.sourceSha256!==source.sourceSha256||origin.displaySha256!==source.display?.sha256||panel.analysis.imageRectification?.sourceSha256!==origin.displaySha256)throw Error('Scientific TIFF derivative does not match its retained original display');
      }
      const record=panel.analysis?.scientificImage;if(!record)continue;
      const source=sources[record.sourceSha256],page=source?.metadata.pages[record.page],display=record.display;
      if(record.schema!==SCHEMA||!source||!integer(record.page)||!page||!page.supported||!hex(record.nativeSamplesSha256)||!display||!hex(display.sha256)||!Array.isArray(display.window)||display.window.length!==2||!display.window.every(Number.isFinite)||display.window[0]<0||display.window[1]<=display.window[0]||display.window[1]>(page.bitsPerSample?.[0]===16?65535:255)||!Number.isFinite(display.gamma)||display.gamma<.1||display.gamma>10||!['gray','green','magenta','cyan'].includes(display.lut)||!Array.isArray(display.size)||display.size.length!==2||!display.size.every(v=>integer(v)&&v>0)||typeof display.resampled!=='boolean'||display.quantitative!==false)throw Error('Invalid scientific TIFF display record');
      if(display.size[0]>page.width||display.size[1]>page.height||display.resampled!==(display.size[0]!==page.width||display.size[1]!==page.height)||display.iccProfileSha256!=null&&!hex(display.iccProfileSha256)||page.samplesPerPixel===3&&(display.iccProfileSha256||null)!==(page.iccProfileSha256||null))throw Error('Scientific TIFF display geometry/profile does not match its source');
    }
    return true;
  }
  async function digest(bytes){
    const engine=globalThis.crypto||((typeof require==='function')?require('node:crypto').webcrypto:null);
    if(!engine?.subtle)throw Error('Native TIFF verification requires local SHA-256 support');
    return [...new Uint8Array(await engine.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  }
  async function decodeBase64(data,bytes){
    const output=new Uint8Array(bytes);let offset=0;
    for(let start=0;start<data.length;start+=262144){
      const value=atob(data.slice(start,start+262144));
      if(offset+value.length>bytes)throw Error('Invalid native TIFF byte count');
      for(let i=0;i<value.length;i++)output[offset++]=value.charCodeAt(i);
      if(start&&start%2097152===0)await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(offset!==bytes)throw Error('Invalid native TIFF byte count');
    return output;
  }
  async function verifySources(owner){
    validateSources(owner);
    for(const source of Object.values(owner.scientificSources||{})){
      let entry=checked.get(source);
      if(!entry||entry.data!==source.data||entry.sha!==source.sha256||entry.bytes!==source.bytes){
        entry={data:source.data,sha:source.sha256,bytes:source.bytes};
        entry.promise=(async()=>{const bytes=await decodeBase64(entry.data,entry.bytes);if(await digest(bytes)!==entry.sha)throw Error('Native TIFF bytes failed SHA-256 verification');return true;})();checked.set(source,entry);
      }
      await entry.promise;
    }
    for(const panel of owner.panels||[]){
      const record=panel.analysis?.scientificImage;if(!record)continue;
      for(const variant of panel.variants||[]){
        if(variant.name!=='imported_scientific_tiff')continue;
        if(typeof DOMParser==='undefined')throw Error('Native TIFF display verification requires an SVG parser');
        const svg=new DOMParser().parseFromString(variant.svg,'image/svg+xml'),images=[...svg.querySelectorAll('image')];
        if(svg.querySelector('parsererror')||images.length!==1)throw Error('Invalid scientific TIFF display SVG');
        const href=images[0].getAttribute('href')||images[0].getAttributeNS('http://www.w3.org/1999/xlink','href'),data=href?.startsWith('data:image/png;base64,')?href.slice(22):null;
        if(!base64Shape(data)||!data.startsWith('iVBORw0KGgo'))throw Error('Invalid scientific TIFF display PNG');
        const padding=data.endsWith('==')?2:data.endsWith('=')?1:0,bytes=await decodeBase64(data,data.length/4*3-padding);
        if(await digest(bytes)!==record.display.sha256)throw Error('Scientific TIFF display failed SHA-256 verification');
      }
    }
    return true;
  }
  function sourceRecord({name,data,bytes,sha256,metadata}){
    const source={schema:SCHEMA,name:String(name).slice(0,255),data,bytes,sha256,metadata};
    validateSources({scientificSources:{[sha256]:source}});return source;
  }
  function asset({name,source,result}){
    if(result.metadata.fileSha256!==source.sha256||!result.metadata.decodingVerified||result.metadata.fileBytes!==source.bytes)throw Error('TIFF result does not match the imported original');
    const {native,display}=result,page=source.metadata.pages[native?.page];
    if(!page||!display||!hex(display.sha256)||!base64Shape(display.data)||!display.data.startsWith('iVBORw0KGgo')||display.mime!=='image/png'||!Array.isArray(native.size)||native.size[0]!==page.width||native.size[1]!==page.height)throw Error('TIFF display result is incomplete');
    const width=360,height=360*page.height/page.width;
    if(height>14400||height<=0)throw Error('TIFF aspect ratio exceeds the canvas limit');
    const href='data:image/png;base64,'+display.data;
    const record={schema:SCHEMA,sourceSha256:source.sha256,page:native.page,nativeSamplesSha256:native.samplesSha256,
      display:{sha256:display.sha256,window:[...display.window],gamma:display.gamma,lut:display.lut,size:[...display.size],resampled:display.resampled,iccProfileSha256:display.iccProfileSha256||null,quantitative:false}};
    const resultAsset={name,variants:[{name:'imported_scientific_tiff',svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="${href}"/></svg>`,width,height,viewBox:[0,0,width,height],size:'original',preserveAspect:true}],initialVariant:0,recipe:{source:name},analysis:{scientificImage:record,import:{format:'tiff',displayOnly:true,page:native.page+1,nativeBits:page.bitsPerSample}},table:null,provenance:'user-scientific-image'};
    validateSources({scientificSources:{[source.sha256]:source},panels:[resultAsset]});return resultAsset;
  }
  function nativeRecord(owner,panel){const record=panel?.analysis?.scientificImage;if(record)return record;const id=panel?.analysis?.scientificOrigin?.sourcePanelId;return typeof id==='string'?(owner.panels||[]).find(p=>p.id===id)?.analysis?.scientificImage||null:null;}
  function originFor(owner,panel){const record=panel?.analysis?.scientificImage;if(record)return {schema:ORIGIN_SCHEMA,sourcePanelId:panel.id,sourceSha256:record.sourceSha256,displaySha256:record.display.sha256};return panel?.analysis?.scientificOrigin?{...panel.analysis.scientificOrigin}:null;}
  function original(owner,panel){const record=nativeRecord(owner,panel);return record?owner.scientificSources?.[record.sourceSha256]||null:null;}
  return Object.freeze({SCHEMA,ORIGIN_SCHEMA,MAX_BYTES,MAX_TOTAL,localEndpoint,validateSources,verifySources,digest,decodeBase64,sourceRecord,asset,nativeRecord,originFor,original});
});
