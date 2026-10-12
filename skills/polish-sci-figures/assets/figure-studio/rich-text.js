/* Character formatting is stored as bounded data, never as user-supplied HTML. */
'use strict';
const StudioRichText = (() => {
  const NS='http://www.w3.org/2000/svg',FIELDS=new Set(['bold','italic','script']);
  function parse(value){
    const record=typeof value==='string'?JSON.parse(value):value;
    if(!record||Object.keys(record).some(k=>!['baseText','runs'].includes(k))||typeof record.baseText!=='string'||record.baseText.length>4000||!Array.isArray(record.runs)||record.runs.length>512)throw Error('字符格式无效');
    let previous=0;
    for(const run of record.runs){
      if(!run||Object.keys(run).some(k=>!['start','end','style'].includes(k))||!Number.isInteger(run.start)||!Number.isInteger(run.end)||run.start<previous||run.end<=run.start||run.end>record.baseText.length||!run.style||Array.isArray(run.style)||!Object.keys(run.style).length||Object.keys(run.style).some(k=>!FIELDS.has(k)))throw Error('字符格式无效');
      if(['bold','italic'].some(k=>run.style[k]!==undefined&&typeof run.style[k]!=='boolean')||run.style.script!==undefined&&!['super','sub','normal'].includes(run.style.script))throw Error('字符格式无效');
      previous=run.end;
    }
    return record;
  }
  function valid(value){try{return typeof value==='string'&&value.length<=160000&&!!parse(value);}catch{return false;}}
  function remap(value,text){
    if(!value)return {baseText:text,runs:[]};
    const old=parse(value);if(old.baseText===text)return JSON.parse(JSON.stringify(old));
    const before=old.baseText;let prefix=0,suffix=0;
    while(prefix<Math.min(before.length,text.length)&&before[prefix]===text[prefix])prefix++;
    while(suffix<Math.min(before.length-prefix,text.length-prefix)&&before[before.length-1-suffix]===text[text.length-1-suffix])suffix++;
    // Retain only unchanged character spans or an explicit whole-text style.
    // In particular, a changed P-value never inherits a former digit's format.
    const runs=[];
    for(const run of old.runs){
      let start=run.start,end=run.end;
      if(start===0&&end===before.length){end=text.length;}
      else if(end<=prefix){}
      else if(start>=before.length-suffix){const shift=text.length-before.length;start+=shift;end+=shift;}
      else continue;
      if(end>start)runs.push({start,end,style:{...run.style}});
    }
    return {baseText:text,runs};
  }
  function characters(record,text){const styles=Array.from({length:text.length},()=>({}));for(const r of remap(record,text).runs)for(let i=r.start;i<r.end;i++)Object.assign(styles[i],r.style);return styles;}
  function compact(text,styles){
    const runs=[];let previous='';
    for(let i=0;i<styles.length;i++){const style=styles[i],key=JSON.stringify(style);if(key==='{}'){previous='';continue;}if(previous===key&&runs.at(-1).end===i)runs.at(-1).end=i+1;else runs.push({start:i,end:i+1,style:{...style}});previous=key;}
    return parse({baseText:text,runs});
  }
  function format(value,text,start,end,property,next){
    if(!FIELDS.has(property)&&property!=='clear')throw Error('字符格式无效');
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>text.length||end<=start)throw Error('请先选中需要设置的字符');
    // A browser selection uses UTF-16 offsets. Keep surrogate pairs intact.
    if(start>0&&/[\uDC00-\uDFFF]/.test(text[start]))start--;
    if(end<text.length&&/[\uDC00-\uDFFF]/.test(text[end]))end++;
    const styles=characters(value,text);
    if(next===undefined&&property!=='clear')next=property==='script'?'normal':!styles.slice(start,end).every(s=>s[property]===true);
    for(let i=start;i<end;i++){if(property==='clear')styles[i]={bold:false,italic:false,script:'normal'};else styles[i][property]=next;}
    return compact(text,styles);
  }
  function textNodes(el){const nodes=[];const walk=node=>{for(const child of [...node.childNodes]){if(child.nodeType===3)nodes.push(child);else if(child.nodeType===1)walk(child);}};walk(el);return nodes;}
  function apply(el,value,normalized=false){
    if(!el||!value)return el;
    const record=remap(value,el.textContent);
    // Absolute y positions in source math tspans cannot be reset by nesting a
    // baseline-shift="baseline" span. Convert them to semantic runs only when
    // a character-level baseline edit actually needs to override them.
    if(!normalized&&record.runs.some(r=>r.style.script)){
      const native=nativeStyles(el);
      if(native.runs.some(r=>['super','sub'].includes(r.style.script))){
        const text=el.textContent,styles=characters(native,text);
        for(const r of record.runs)for(let i=r.start;i<r.end;i++)Object.assign(styles[i],r.style);
        rebuildText(el,text);el.style.fontWeight='400';el.style.fontStyle='normal';
        return apply(el,compact(text,styles),true);
      }
    }
    const nodes=textNodes(el);let offset=0;
    for(const node of nodes){
      const text=node.nodeValue,start=offset;offset+=text.length;
      const runs=record.runs.filter(r=>r.end>start&&r.start<offset);if(!runs.length)continue;
      const cuts=[...new Set([0,text.length,...runs.flatMap(r=>[Math.max(0,r.start-start),Math.min(text.length,r.end-start)])])].sort((a,b)=>a-b);
      const fragment=el.ownerDocument.createDocumentFragment();
      for(let i=0;i<cuts.length-1;i++){
        const a=cuts[i],b=cuts[i+1],run=runs.find(r=>r.start<=start+a&&r.end>=start+b),content=text.slice(a,b);
        if(!run){fragment.appendChild(el.ownerDocument.createTextNode(content));continue;}
        const span=el.ownerDocument.createElementNS(NS,'tspan');span.setAttribute('data-rich-run','true');span.textContent=content;
        if(run.style.bold!==undefined)span.style.fontWeight=run.style.bold?'700':'400';
        if(run.style.italic!==undefined)span.style.fontStyle=run.style.italic?'italic':'normal';
        if(run.style.script){span.style.baselineShift=run.style.script==='normal'?'baseline':run.style.script;span.style.fontSize=run.style.script==='normal'?'100%':'70%';}
        fragment.appendChild(span);
      }
      node.parentNode.replaceChild(fragment,node);
    }
    return el;
  }
  function inherited(node,property,attribute,root){for(let p=node.parentElement;p;p=p.parentElement){const value=p.style?.[property]||p.getAttribute?.(attribute);if(value)return value;if(p===root)break;}return '';}
  function absoluteSize(value){const raw=String(value||'').trim();return /^\d*\.?\d+(?:px|pt)?$/.test(raw)?parseFloat(raw):NaN;}
  function pointSize(el){const own=absoluteSize(el.style.fontSize||el.getAttribute('font-size'));if(Number.isFinite(own))return own;const sizes=[...el.querySelectorAll('tspan')].map(n=>absoluteSize(n.style.fontSize||n.getAttribute('font-size'))).filter(Number.isFinite);return sizes.length?Math.max(...sizes):12;}
  function nativeStyles(el){
    const nodes=textNodes(el),max=pointSize(el),base=nodes.find(n=>absoluteSize(inherited(n,'fontSize','font-size',el))>=max*.85),baseY=parseFloat(base?.parentElement?.getAttribute('y'))||0;let at=0;const styles=[];
    for(const n of nodes){const style={},weight=inherited(n,'fontWeight','font-weight',el),italic=inherited(n,'fontStyle','font-style',el),shift=inherited(n,'baselineShift','baseline-shift',el),size=absoluteSize(inherited(n,'fontSize','font-size',el));
      if(weight)style.bold=weight==='bold'||+weight>=600;if(italic)style.italic=italic==='italic'||italic==='oblique';
      if(['super','sub'].includes(shift))style.script=shift;
      else if(Number.isFinite(size)&&size<max*.85){const y=n.parentElement.hasAttribute('y')?parseFloat(n.parentElement.getAttribute('y'))-baseY:parseFloat(n.parentElement.getAttribute('dy'));if(Number.isFinite(y)&&y!==0)style.script=y<0?'super':'sub';}
      for(let i=0;i<n.nodeValue.length;i++)styles[at++]={...style};
    }
    return compact(el.textContent,styles);
  }
  function rebuildText(el,text){
    const nodes=textNodes(el),size=pointSize(el),base=nodes.find(n=>absoluteSize(inherited(n,'fontSize','font-size',el))>=size*.85);
    if(size>0&&!el.style.fontSize&&!el.hasAttribute('font-size'))el.setAttribute('font-size',size);
    const family=nodes.length?inherited(nodes[0],'fontFamily','font-family',el):'';if(family&&!el.style.fontFamily&&!el.hasAttribute('font-family'))el.setAttribute('font-family',family);
    // Matplotlib math text may put its only origin on the first tspan.
    const first=el.querySelector('tspan');for(const key of ['x','y']){const origin=key==='y'&&base?.parentElement?.hasAttribute('y')?base.parentElement:first;if(!el.hasAttribute(key)&&origin?.hasAttribute(key))el.setAttribute(key,origin.getAttribute(key).trim().split(/[ ,]+/)[0]);}
    el.replaceChildren();const x=el.getAttribute('x')||'0';
    text.split('\n').forEach((line,i)=>{const span=el.ownerDocument.createElementNS(NS,'tspan');if(i){span.setAttribute('x',x);span.setAttribute('dy','1.25em');}span.textContent=line;if(i)el.appendChild(el.ownerDocument.createTextNode('\n'));el.appendChild(span);});
    return el;
  }
  function replaceText(el,text){
    if(el.textContent===text)return el;
    const styles=remap(nativeStyles(el),text);rebuildText(el,text);apply(el,styles,true);return el;
  }
  function mount(host,adapter){
    const title=document.createElement('h3'),hint=document.createElement('p'),field=document.createElement('textarea'),toolbar=document.createElement('div'),status=document.createElement('p');
    host.classList.add('rich-text-controls');field.id='richTextContent';field.rows=3;field.maxLength=2000;field.spellcheck=false;toolbar.className='rich-text-toolbar';hint.className=status.className='muted';status.setAttribute('role','status');host.append(title,hint,field,toolbar,status);
    let current=null,selection=[0,0],composing=false;
    const buttons=[];for(const [action,label,glyph]of [['bold','加粗所选字符','B'],['italic','斜体所选字符','I'],['super','上标','x²'],['sub','下标','x₂'],['normal','正常基线','x'],['clear','清除所选格式','Tx']]){
      const button=document.createElement('button');button.type='button';button.textContent=glyph;button.className='rich-text-action rich-text-'+action;button.dataset.action=action;toolbar.append(button);buttons.push({button,label});
      button.onpointerdown=e=>{e.preventDefault();selection=[field.selectionStart,field.selectionEnd];};
      button.onclick=()=>{if(!current)return;const [start,end]=selection;if(start===end){status.textContent=adapter.t('请先选中需要设置的字符');field.focus();return;}adapter.format(action,start,end);field.focus();field.setSelectionRange(start,end);selection=[start,end];};
    }
    const capture=()=>{selection=[field.selectionStart,field.selectionEnd];};field.addEventListener('select',capture);field.addEventListener('keyup',capture);field.addEventListener('pointerup',capture);
    field.oncompositionstart=()=>{composing=true;};field.oncompositionend=()=>{composing=false;adapter.text(field.value);};field.oninput=()=>{capture();if(!composing)adapter.text(field.value);};
    field.onkeydown=e=>{if(composing||e.isComposing){e.stopPropagation();return;}if((e.ctrlKey||e.metaKey)&&['b','i'].includes(e.key.toLowerCase())){e.preventDefault();capture();buttons.find(v=>v.button.dataset.action===(e.key.toLowerCase()==='b'?'bold':'italic')).button.click();}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();adapter.text(field.value);}e.stopPropagation();};
    return {
      sync(target){
        const t=adapter.t;same: {const same=current?.identity===target?.identity;current=target||null;host.hidden=!target;if(!target)break same;const active=document.activeElement===field,start=field.selectionStart,end=field.selectionEnd;
          if(field.value!==target.text)field.value=target.text;if(same&&active)field.setSelectionRange(Math.min(start,field.value.length),Math.min(end,field.value.length));else if(!same)selection=[0,0];field.disabled=!!target.locked;
          title.textContent=t('字符格式');hint.textContent=t('选中文字中的任意字符，再设置格式。Enter 确认文字，Shift + Enter 换行。');field.setAttribute('aria-label',t('文字与字符格式'));
          status.textContent=target.manual?t('此处为手动显示文字；分析记录中的数值未更改。'):target.statistical?t('统计数值随数据更新。字符格式保留在未变化的文字上。'):'';
          for(const {button,label}of buttons){button.disabled=!!target.locked;button.title=t(label);button.setAttribute('aria-label',t(label));}
        }
      },
      focus(){field.focus();field.select();selection=[0,field.value.length];host.scrollIntoView({block:'nearest'});},
      selection(){return [...selection];}
    };
  }
  return {parse,valid,remap,format,apply,replaceText,nativeStyles,pointSize,mount};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioRichText;
