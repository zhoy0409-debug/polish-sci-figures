/* Compact typography controls. The host owns selection/history/export; preview
 * touches only the selected text nodes and is discarded before one commit. */
'use strict';
const StudioTextToolsUI = (() => {
  function api(){return typeof StudioTextFormatting!=='undefined'?StudioTextFormatting:typeof module!=='undefined'&&module.exports?require('./text-formatting.js'):null;}
  const shapes=new Set(['path','rect','circle','ellipse','line','polyline','polygon','use']);
  function isText(item){return item?.el?.matches?.('text,tspan');}
  function isShape(item){return shapes.has(item?.el?.localName);}
  function identity(item){return item?.identity||[item?.kind,item?.id,item?.vi,item?.key].join('/');}
  function inherited(el,property,fallback=''){for(let n=el;n?.nodeType===1;n=n.parentElement){const value=n.style?.getPropertyValue?.(property)||n.getAttribute?.(property);if(value)return value;}return fallback;}
  function create(adapter){
    const formatting=api();if(!formatting)throw Error('Text formatting is unavailable');
    const toolbar=adapter.toolbar,doc=toolbar.ownerDocument,t=adapter.t||String,container=doc.createElement('div');container.className='text-tools';toolbar.append(container);
    const button=(label,cls)=>{const b=doc.createElement('button');b.type='button';b.className=cls;b.textContent=t(label);b.setAttribute('aria-label',t(label));b.title=t(label);container.append(b);return b;};
    const spacingButton=button('文字间距','text-spacing-toggle'),painterButton=button('格式刷','text-format-painter'),eyeButton=button('吸色笔','shape-eyedropper');
    spacingButton.setAttribute('aria-expanded','false');painterButton.setAttribute('aria-pressed','false');eyeButton.setAttribute('aria-pressed','false');
    const popover=doc.createElement('section');popover.className='text-spacing-popover';popover.hidden=true;popover.setAttribute('aria-label',t('文字间距'));container.append(popover);
    const field=(label,name,min,max,step)=>{const wrapper=doc.createElement('label'),caption=doc.createElement('span'),input=doc.createElement('input');caption.textContent=t(label);input.type='number';input.name=name;input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',t(label));wrapper.append(caption,input);popover.append(wrapper);return input;};
    const letter=field('字间距（pt）','letterSpacing',-1000,1000,.1),line=field('行距（倍）','lineHeight',.5,5,.05),hint=doc.createElement('p');hint.className='muted';hint.textContent=t('输入即预览，移开焦点即应用；格式刷只复制文字样式，吸色笔只修改图形颜色。');popover.append(hint);
    let preview=null,spacingSession=null,eyeTargets=null,destroyed=false;
    const options=item=>adapter.captureOptions?.(item)||{pointFactor:item.pointFactor||1};
    const valid=(item,role='target')=>!!item&&!(role==='target'&&item.locked)&&!item.disabled&&!item.original&&adapter.valid?.(item,role)!==false;
    const selected=()=>adapter.selected?.()||[];
    const writableTexts=()=>selected().filter(item=>isText(item)&&valid(item));
    const writableShapes=()=>selected().filter(item=>isShape(item)&&valid(item));
    const announce=message=>adapter.say?.(t(message));
    const notify=()=>{const active=painter.status().active;painterButton.setAttribute('aria-pressed',String(active));eyeButton.setAttribute('aria-pressed',String(!!eyeTargets));container.classList.toggle('text-tool-active',active||!!eyeTargets);adapter.changed?.({painter:active,eyedropper:!!eyeTargets});};
    const painter=formatting.createPainter({valid,read:item=>formatting.capture(item.el,options(item)),write:(items,record)=>adapter.apply(items,items.map(item=>formatting.plan(item.el,record,options(item))),t('已应用文字格式')),changed:notify,error:error=>announce(error.message)});
    function cancelPreview(){preview?.finish(false);preview=null;spacingSession=null;}
    function sameSelection(items){const now=writableTexts();return now.length===items.length&&now.every((item,i)=>identity(item)===identity(items[i])&&item.el===items[i].el);}
    function beginSpacing(){
      const items=writableTexts();if(!items.length)return false;
      if(spacingSession&&!sameSelection(spacingSession.items))cancelPreview();
      if(!spacingSession){spacingSession={items:items.slice(),values:{}};preview=formatting.createPreview(items.map(item=>({...item,...options(item)})),{requestFrame:adapter.requestFrame,cancelFrame:adapter.cancelFrame,valid:()=>!!spacingSession&&sameSelection(spacingSession.items)&&spacingSession.items.every(item=>valid(item)&&item.el.isConnected!==false),drawn:()=>adapter.previewed?.()});}
      return true;
    }
    function valueFor(input){const value=input.value.trim();if(!value)return null;const n=Number(value);return Number.isFinite(n)&&n>=Number(input.min)&&n<=Number(input.max)?n:null;}
    function updateSpacing(input){
      const value=valueFor(input);input.setAttribute('aria-invalid',String(value===null));if(value===null){cancelPreview();return false;}if(!beginSpacing())return false;
      spacingSession.values[input.name]=value;return preview.update(spacingSession.values);
    }
    function commitSpacing(){
      if(!spacingSession)return false;const session=spacingSession;if(!sameSelection(session.items)||!session.items.every(item=>valid(item))){cancelPreview();return false;}
      preview.flush();const plans=session.items.map(item=>{const values={},opts=options(item),f=Number(opts.letterPointFactor??opts.pointFactor??1);if(session.values.letterSpacing!==undefined)values['letter-spacing']=String(session.values.letterSpacing/f);if(session.values.lineHeight!==undefined)values['line-height']=String(session.values.lineHeight);return {props:values,children:[]};});
      cancelPreview();if(!Object.keys(plans[0]?.props||{}).length)return false;const result=adapter.apply(session.items,plans,t('已更新文字间距'));sync();return result!==false;
    }
    for(const input of [letter,line]){
      input.addEventListener('input',()=>updateSpacing(input));input.addEventListener('change',commitSpacing);input.addEventListener('blur',commitSpacing);
      input.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Enter'){event.preventDefault();commitSpacing();input.blur();}else if(event.key==='Escape'){event.preventDefault();cancelPreview();sync();input.blur();}});
    }
    spacingButton.addEventListener('click',()=>{const show=popover.hidden;if(!show)commitSpacing();popover.hidden=!show;spacingButton.setAttribute('aria-expanded',String(show));if(show){sync();letter.focus();}});
    painterButton.addEventListener('click',()=>{commitSpacing();eyeTargets=null;if(painter.status().active)painter.cancel();else {const items=selected().filter(item=>isText(item)&&valid(item,'source'));if(items.length===1&&painter.arm(items[0]))announce('已复制文字格式，请点击目标文字；Esc 取消。');}notify();});
    eyeButton.addEventListener('click',()=>{commitSpacing();painter.cancel();eyeTargets=eyeTargets?null:writableShapes().slice();if(!eyeTargets?.length)eyeTargets=null;else announce('请点击图形吸取颜色，应用到已选图形；Esc 取消。');notify();});
    function colorOf(item){
      if(!isShape(item))return null;const supplied=adapter.readColor?.(item);if(supplied)return formatting.hex(supplied);
      return formatting.hex(inherited(item.el,'fill',item.el.localName==='line'?'none':'black'))||formatting.hex(inherited(item.el,'stroke','none'));
    }
    function shapePlan(item,color){
      const props={},channel=adapter.paintChannel?.()||'both';for(const key of channel==='both'?['fill','stroke']:[channel]){if(!['fill','stroke'].includes(key))continue;const value=inherited(item.el,key,key==='fill'&&item.el.localName!=='line'?'black':'none');if(value!=='none'&&!/url\s*\(/i.test(value))props[key]=color;}
      return {props,children:[]};
    }
    function handlePointer(event){
      if(destroyed||event.button!==undefined&&event.button!==0||!painter.status().active&&!eyeTargets)return false;
      const target=adapter.target?.(event)||null;event.preventDefault?.();event.stopPropagation?.();
      if(painter.status().active){if(!target||!isText(target)||!valid(target)){announce(target?.locked?'文字已锁定，请先解锁。':'请点击可编辑文字应用格式。');return true;}painter.apply(target);sync();return true;}
      const color=target&&valid(target,'source')?colorOf(target):null;if(!color){announce('请点击有纯色填充或描边的图形。');return true;}
      const items=eyeTargets.filter(item=>valid(item)),plans=items.map(item=>shapePlan(item,color));if(!items.length||!plans.some(plan=>Object.keys(plan.props).length)){announce('所选图形暂不能应用颜色。');return true;}
      if(adapter.apply(items,plans,t('已应用吸取的图形颜色'))!==false){eyeTargets=null;notify();sync();}return true;
    }
    function cancel(){cancelPreview();const active=painter.cancel()||!!eyeTargets;eyeTargets=null;notify();sync();return active;}
    function handleKey(event){if(event.key!=='Escape')return false;const active=!!preview||painter.status().active||!!eyeTargets||!popover.hidden;if(!active)return false;event.preventDefault?.();cancel();popover.hidden=true;spacingButton.setAttribute('aria-expanded','false');return true;}
    function sync(){
      if(destroyed)return;if(spacingSession&&!sameSelection(spacingSession.items))cancelPreview();
      const items=writableTexts(),sources=selected().filter(item=>isText(item)&&valid(item,'source'));spacingButton.disabled=!items.length;painterButton.disabled=sources.length!==1&&!painter.status().active;eyeButton.disabled=!writableShapes().length&&!eyeTargets;
      if(!items.length){popover.hidden=true;spacingButton.setAttribute('aria-expanded','false');return;}
      const values=items.map(item=>{const spacing=formatting.readSpacing(item.el),opts=options(item);return {letterSpacing:spacing.letterSpacing*Number(opts.letterPointFactor??opts.pointFactor??1),lineHeight:spacing.lineHeight};});
      for(const input of [letter,line]){if(doc.activeElement===input&&spacingSession)continue;const value=values[0][input.name],same=values.every(other=>Math.abs(other[input.name]-value)<1e-7);input.value=same?String(Number(value.toFixed(3))):'';input.placeholder=same?'':t('混合');input.setAttribute('aria-invalid','false');}
    }
    sync();
    return {sync,handlePointer,handleKey,cancel,destroy(){cancel();destroyed=true;container.remove();},get element(){return container;},get active(){return painter.status().active||!!eyeTargets;}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioTextToolsUI;
