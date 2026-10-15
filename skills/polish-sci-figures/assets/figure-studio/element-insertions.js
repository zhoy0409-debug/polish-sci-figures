/* Small, immutable clipboard additions to an existing editable SVG variant.
 * Original variant sources, panel geometry and ordinary per-element edits stay
 * separate. The renderer must still use canvas-clipboard.mountAll to validate
 * SVG semantics and local references before mounting these records.
 */
'use strict';
const StudioElementInsertions=(()=>{
  const MIN_KEY=1000000000,KEY_STRIDE=100001,MAX_INSERTIONS=300;
  const MAX_BYTES=20000000,MAX_TOTAL_BYTES=40000000,MAX_NODES=100000;
  const SVG_NS='http://www.w3.org/2000/svg',XLINK_NS='http://www.w3.org/1999/xlink';
  const TAGS=new Set(['svg','g','a','symbol','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','use','clipPath','linearGradient','radialGradient','stop','image','title','desc','filter','feComponentTransfer','feFuncR','feFuncG','feFuncB','feFuncA']);
  const cache=new Map(),MAX_CACHE_ENTRIES=300,MAX_CACHE_CHARS=16000000;let cachedChars=0;
  const fail=message=>{const error=new Error(message);error.code='element-insertions';throw error;};
  const plain=value=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;const proto=Object.getPrototypeOf(value);return proto===null||Object.getPrototypeOf(proto)===null&&Object.getOwnPropertyDescriptor(proto,'constructor')?.value?.name==='Object';};
  const ownKeys=value=>{if(!plain(value)||Reflect.ownKeys(value).some(key=>typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||!Object.getOwnPropertyDescriptor(value,key)?.enumerable||!Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value')))fail('Inserted element records are invalid.');return Object.keys(value);};
  const denseArray=(value,max)=>Array.isArray(value)&&Object.getOwnPropertyDescriptor(Object.getPrototypeOf(value),'constructor')?.value?.name==='Array'&&value.length<=max&&Reflect.ownKeys(value).length===value.length+1&&Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).every(descriptor=>descriptor?.enumerable&&Object.hasOwn(descriptor,'value'));
  function variantLimit(options={}){const count=typeof options==='number'?options:options?.variantCount;if(count===undefined)return 10001;if(!Number.isInteger(count)||count<1||count>10001)fail('The destination variant is invalid.');return count;}
  function variantIndex(value,count){const key=String(value);if(!/^(0|[1-9]\d*)$/.test(key)||!Number.isSafeInteger(+key)||+key>=count)fail('The destination variant is invalid.');return key;}
  function matrix(value){
    if(!denseArray(value,6)||value.length!==6||value.some(n=>typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>1e12)||Math.abs(value[0]*value[3]-value[1]*value[2])<1e-12)fail('The inserted element transform is invalid.');
    return value.map(n=>Object.is(n,-0)?0:n);
  }
  function decoded(value){return value.replace(/&([^;\s]+);/g,(_,entity)=>{if(Object.hasOwn({amp:1,lt:1,gt:1,quot:1,apos:1},entity))return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity];if(!/^#(?:\d+|x[\da-f]+)$/i.test(entity))fail('The inserted SVG contains an unsupported entity.');const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):+entity.slice(1);if(!Number.isInteger(n)||n<32||n>0x10ffff||n>=0xd800&&n<=0xdfff)fail('The inserted SVG contains an unsupported entity.');return String.fromCodePoint(n);});}
  function attribute(name,value,tag){
    const local=name.split(':').at(-1),text=decoded(value);
    if(/^on/i.test(local)||/[<>\\]|(?:javascript|vbscript)\s*:|expression\s*\(|@import/i.test(text))fail('The inserted SVG contains active content.');
    if(name==='xmlns'||name.startsWith('xmlns:')){if(![SVG_NS,XLINK_NS].includes(text))fail('The inserted SVG namespace is unsupported.');return;}
    if(local==='href'){
      if(!/^#[\w.:-]+$/.test(text)&&!(tag==='image'&&/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(text)))fail('Inserted SVG references must be local or embedded.');return;
    }
    const remainder=text.replace(/url\(\s*(['"]?)#[\w.:-]+\1\s*\)/gi,'');if(/url\s*\(/i.test(remainder))fail('Inserted SVG references must be local.');
  }
  // This bounded lexical envelope check needs no DOM and rejects active or
  // external content when reopening a project. It is not a substitute for the
  // renderer's XML, namespace, clip/filter and reference graph validation.
  function sourceInfo(text){
    if(typeof text!=='string'||!text.length||text.length>MAX_BYTES||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))fail('The inserted SVG is invalid or too large.');
    const found=cache.get(text);if(found){cache.delete(text);cache.set(text,found);return found;}
    const bytes=new TextEncoder().encode(text).length;if(bytes>MAX_BYTES)fail('The inserted SVG is too large.');
    const stack=[];let cursor=0,nodes=0,roots=0,rootBox=null;
    while(cursor<text.length){
      const start=text.indexOf('<',cursor),between=text.slice(cursor,start<0?text.length:start);
      if(!stack.length&&between.trim())fail('The inserted SVG has content outside its root.');
      if(start<0){cursor=text.length;break;}
      if(text.startsWith('<!--',start)){const end=text.indexOf('-->',start+4);if(end<0||text.slice(start+4,end).includes('--'))fail('The inserted SVG comment is invalid.');cursor=end+3;continue;}
      if(text.startsWith('<![CDATA[',start)){const end=text.indexOf(']]>',start+9);if(!stack.length||end<0)fail('The inserted SVG text is invalid.');cursor=end+3;continue;}
      if(text[start+1]==='!'||text[start+1]==='?')fail('The inserted SVG contains an unsupported declaration.');
      let end=start+1,quote=null;for(;end<text.length;end++){const char=text[end];if(quote){if(char===quote)quote=null;}else if(char==='"'||char==="'")quote=char;else if(char==='>')break;else if(char==='<')fail('The inserted SVG is invalid.');}
      if(end>=text.length||quote)fail('The inserted SVG is incomplete.');
      const raw=text.slice(start+1,end),closing=raw[0]==='/',selfClosing=/\/\s*$/.test(raw),match=raw.match(closing?/^\/([A-Za-z_][\w:.-]*)\s*$/:/^([A-Za-z_][\w:.-]*)/);if(!match)fail('The inserted SVG tag is invalid.');
      const qualified=match[1],tag=qualified.split(':').at(-1);if(!TAGS.has(tag)||qualified.split(':').length>2)fail('The inserted SVG contains an unsupported element.');
      if(closing){if(stack.pop()!==qualified)fail('The inserted SVG nesting is invalid.');cursor=end+1;continue;}
      if(!stack.length){if(++roots!==1||tag!=='svg')fail('The inserted selection requires one SVG root.');}
      if(++nodes>=MAX_NODES)fail('The inserted SVG has too many elements.');
      let position=match[0].length;const attrs=new Set();
      while(position<raw.length){const rest=raw.slice(position);if(/^\s*\/?\s*$/.test(rest))break;const attr=rest.match(/^\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/);if(!attr||attrs.has(attr[1]))fail('The inserted SVG attributes are invalid.');attrs.add(attr[1]);const value=attr[2]??attr[3];attribute(attr[1],value,tag);if(nodes===1&&attr[1]==='viewBox')rootBox=decoded(value);position+=attr[0].length;}
      if(!selfClosing){stack.push(qualified);if(stack.length>256)fail('The inserted SVG nesting is too deep.');}cursor=end+1;
    }
    const box=String(rootBox||'').trim().split(/[\s,]+/).map(Number);if(stack.length||roots!==1||box.length!==4||box.some(n=>!Number.isFinite(n))||box[0]!==0||box[1]!==0||box[2]<=0||box[3]<=0||box[2]>14400||box[3]>14400)fail('The inserted SVG dimensions are invalid.');
    const info=Object.freeze({bytes,nodes,width:box[2],height:box[3]});
    if(text.length<=MAX_CACHE_CHARS){while(cache.size>=MAX_CACHE_ENTRIES||cachedChars+text.length>MAX_CACHE_CHARS){const first=cache.keys().next().value;cachedChars-=first.length;cache.delete(first);}cache.set(text,info);cachedChars+=text.length;}return info;
  }
  function inspect(map,options){
    const count=variantLimit(options),slots=new Set();let totalBytes=0,totalRecords=0;
    if(map===undefined)return {slots,totalRecords,totalBytes,count};
    for(const vi of ownKeys(map)){
      variantIndex(vi,count);const records=map[vi];if(!denseArray(records,MAX_INSERTIONS))fail('Inserted element records are invalid.');let variantBytes=0,variantNodes=0;
      for(const record of records){
        const keys=ownKeys(record);if(keys.length!==3||!['svg','matrix','keyStart'].every(key=>Object.hasOwn(record,key)))fail('Inserted element record fields are invalid.');
        matrix(record.matrix);const slot=(record.keyStart-MIN_KEY)/KEY_STRIDE;if(!Number.isSafeInteger(record.keyStart)||!Number.isInteger(slot)||slot<0||slot>=MAX_INSERTIONS||slots.has(slot))fail('Inserted element editing keys overlap or are invalid.');slots.add(slot);
        const info=sourceInfo(record.svg);variantBytes+=info.bytes;variantNodes+=info.nodes+1;totalBytes+=info.bytes;if(++totalRecords>MAX_INSERTIONS||totalBytes>MAX_TOTAL_BYTES||variantBytes>MAX_BYTES||variantNodes>=MAX_NODES)fail('The inserted selections exceed the supported size.');
      }
    }
    return {slots,totalRecords,totalBytes,count};
  }
  function validate(map,options){inspect(map,options);return true;}
  function append(panel,variant,svg,transform,options){
    ownKeys(panel);const info=inspect(panel.insertedElements,options),vi=variantIndex(variant,info.count),m=matrix(transform);sourceInfo(svg);
    if(info.totalRecords>=MAX_INSERTIONS)fail('The panel has too many inserted selections.');
    // Monotonic keys avoid accidentally reviving stale per-element edits.
    const slot=info.slots.size?Math.max(...info.slots)+1:0;if(slot>=MAX_INSERTIONS)fail('The panel has exhausted its insertion keys.');
    const keyStart=MIN_KEY+slot*KEY_STRIDE,record=Object.freeze({svg,matrix:Object.freeze(m),keyStart}),records=Object.freeze([...(panel.insertedElements?.[vi]||[]),record]);
    const insertedElements={...(panel.insertedElements||{}),[vi]:records};validate(insertedElements,options);
    return {panel:{...panel,insertedElements},record,keyStart,key:'e'+keyStart};
  }
  return {validate,append,sourceInfo,limits:Object.freeze({minInsertionKey:MIN_KEY,insertionKeyStride:KEY_STRIDE,maxInsertions:MAX_INSERTIONS,maxBytes:MAX_BYTES,maxTotalBytes:MAX_TOTAL_BYTES,maxNodes:MAX_NODES})};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioElementInsertions;
