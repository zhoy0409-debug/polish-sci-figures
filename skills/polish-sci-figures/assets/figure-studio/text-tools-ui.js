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
    const toolbar=adapter.toolbar,doc=toolbar.ownerDocument,t=adapter.t||String,container=doc.createElement('div'),buttonLabels=[],fieldLabels=[];container.className='text-tools';toolbar.append(container);
    const button=(label,cls)=>{const b=doc.createElement('button');b.type='button';b.className=cls;b.textContent=t(label);b.setAttribute('aria-label',t(label));b.title=t(label);buttonLabels.push({button:b,label});container.append(b);return b;};
    const spacingButton=button('文字间距','text-spacing-toggle'),painterButton=button('格式刷','text-format-painter'),eyeButton=button('吸色笔','shape-eyedropper');
    spacingButton.setAttribute('aria-expanded','false');painterButton.setAttribute('aria-pressed','false');eyeButton.setAttribute('aria-pressed','false');
    const painterOptions=doc.createElement('span'),painterOptionsButton=doc.createElement('button'),painterPopover=doc.createElement('section'),brushLabels=[];
    painterOptions.className='text-painter-options';painterOptionsButton.type='button';painterOptionsButton.className='text-painter-settings-toggle';painterOptionsButton.textContent='▾';painterOptionsButton.setAttribute('aria-label',t('格式刷设置'));painterOptionsButton.title=t('格式刷设置');painterOptionsButton.setAttribute('aria-expanded','false');painterOptions.append(painterOptionsButton);painterButton.after(painterOptions);
    painterPopover.className='text-spacing-popover text-painter-popover';painterPopover.hidden=true;painterPopover.setAttribute('aria-label',t('格式刷设置'));
    const brushChecks=[];
    for(const [label,fields]of [['字体',['fontFamily']],['字号',['fontSize']],['加粗与斜体',['fontWeight','fontStyle']],['文字颜色',['fill']],['文字间距',['letterSpacing','lineHeight']]]){
      const wrapper=doc.createElement('label'),caption=doc.createElement('span'),input=doc.createElement('input');wrapper.className='text-painter-choice';input.type='checkbox';input.checked=true;input.name='brush-'+fields[0];caption.textContent=t(label);input.setAttribute('aria-label',t(label));wrapper.append(caption,input);painterPopover.append(wrapper);brushLabels.push({caption,input,label});brushChecks.push({input,fields});
    }
    const fontLabel=doc.createElement('label'),fontCaption=doc.createElement('span'),brushFont=doc.createElement('select');fontLabel.className='text-painter-font';brushFont.name='brushFont';fontCaption.textContent=t('字体来源');brushFont.setAttribute('aria-label',t('字体来源'));fontLabel.append(fontCaption,brushFont);painterPopover.append(fontLabel);brushLabels.push({caption:fontCaption,input:brushFont,label:'字体来源'});
    const brushFontLabels=[];for(const [value,label]of [['source','保留原字体'],['Arial','Arial'],['Times New Roman','Times New Roman']]){const option=doc.createElement('option');option.value=value;option.textContent=t(label);brushFont.append(option);brushFontLabels.push({option,label});}
    const brushHint=doc.createElement('p');brushHint.className='muted';brushHint.textContent=t('可复制导入文件的原字体；本机缺少该字体时，可选择 Arial 或 Times New Roman。');painterPopover.append(brushHint);
    const popover=doc.createElement('section');popover.className='text-spacing-popover';popover.hidden=true;popover.setAttribute('aria-label',t('文字间距'));container.append(popover);
    const field=(label,name,min,max,step)=>{const wrapper=doc.createElement('label'),caption=doc.createElement('span'),input=doc.createElement('input');caption.textContent=t(label);input.type='number';input.name=name;input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',t(label));fieldLabels.push({caption,input,label});wrapper.append(caption,input);popover.append(wrapper);return input;};
    const letter=field('字间距（pt）','letterSpacing',-1000,1000,.1),line=field('行距（倍）','lineHeight',.5,5,.05),hint=doc.createElement('p'),spacingStatus=doc.createElement('p');hint.className='muted';hint.textContent=t('输入即预览，移开焦点即应用；格式刷只复制文字样式，吸色笔只修改图形颜色。');spacingStatus.className='muted text-spacing-status';spacingStatus.setAttribute('role','status');spacingStatus.setAttribute('aria-live','polite');spacingStatus.hidden=true;popover.append(hint,spacingStatus);container.append(painterPopover);
    function localize(){
      // Keep the existing controls and focus when the host changes language.
      // Only changed strings touch the DOM; ordinary preview frames stay cheap.
      for(const {button,label}of buttonLabels){const value=t(label);if(button.textContent!==value)button.textContent=value;if(button.getAttribute('aria-label')!==value)button.setAttribute('aria-label',value);if(button.title!==value)button.title=value;}
      for(const {caption,input,label}of fieldLabels){const value=t(label);if(caption.textContent!==value)caption.textContent=value;if(input.getAttribute('aria-label')!==value)input.setAttribute('aria-label',value);}
      const title=t('文字间距'),help=t('输入即预览，移开焦点即应用；格式刷只复制文字样式，吸色笔只修改图形颜色。');if(popover.getAttribute('aria-label')!==title)popover.setAttribute('aria-label',title);if(hint.textContent!==help)hint.textContent=help;
      const settings=t('格式刷设置');painterOptionsButton.setAttribute('aria-label',settings);painterOptionsButton.title=settings;painterPopover.setAttribute('aria-label',settings);
      for(const {caption,input,label}of brushLabels){const value=t(label);if(caption.textContent!==value)caption.textContent=value;if(input.getAttribute('aria-label')!==value)input.setAttribute('aria-label',value);}
      for(const {option,label}of brushFontLabels){const value=t(label);if(option.textContent!==value)option.textContent=value;}
      const brushHelp=t('可复制导入文件的原字体；本机缺少该字体时，可选择 Arial 或 Times New Roman。');if(brushHint.textContent!==brushHelp)brushHint.textContent=brushHelp;
      renderSpacingStatus();
    }
    let preview=null,spacingSession=null,eyeTargets=null,destroyed=false;
    const composing=new Map(),compositionEnded=new WeakSet();
    const inComposition=event=>!!event?.isComposing||event?.keyCode===229||composing.has(event?.target);
    const options=item=>adapter.captureOptions?.(item)||{pointFactor:item.pointFactor||1};
    const valid=(item,role='target')=>!!item&&!(role==='target'&&item.locked)&&!item.disabled&&!item.original&&adapter.valid?.(item,role)!==false;
    const selected=()=>adapter.selected?.()||[];
    const writableTexts=()=>selected().filter(item=>isText(item)&&valid(item));
    const writableShapes=()=>selected().filter(item=>isShape(item)&&valid(item));
    const announce=message=>adapter.say?.(t(message));
    const notify=()=>{localize();const active=painter.status().active;painterButton.setAttribute('aria-pressed',String(active));eyeButton.setAttribute('aria-pressed',String(!!eyeTargets));container.classList.toggle('text-tool-active',active||!!eyeTargets);adapter.changed?.({painter:active,eyedropper:!!eyeTargets});};
    const brushFields=()=>brushChecks.filter(choice=>choice.input.checked).flatMap(choice=>choice.fields);
    const painter=formatting.createPainter({valid,read:item=>formatting.capture(item.el,{...options(item),fields:brushFields(),skipUnsupported:true,...(brushFont.value==='source'?{}:{fontFamily:brushFont.value})}),write:(items,record)=>adapter.apply(items,items.map(item=>formatting.plan(item.el,record,options(item))),t('已应用文字格式')),changed:notify,error:error=>announce(error.message)});
    function spacingCopy(zh,en){const value=t(zh);return value!==zh?value:String(adapter.language?.()||doc.documentElement.lang||'').startsWith('en')?en:zh;}
    function renderSpacingStatus(){
      const session=spacingSession,state=!session?'idle':session.invalid.size?'invalid':session.committing?'committing':session.error?'error':'previewing';container.dataset.previewState=state;spacingStatus.hidden=!session;
      const message=state==='invalid'?spacingCopy('输入尚未完成或超出范围；保留上次有效预览，修正后可应用。','The value is incomplete or outside the allowed range. The last valid preview is kept; correct the value to apply.'):state==='committing'?spacingCopy('正在应用文字间距。','Applying text spacing.'):state==='error'?session.error:spacingCopy('预览中，尚未应用。Enter 或移开焦点保留，Esc 取消。','Preview only, not applied. Press Enter or leave the field to keep it; Esc cancels.');if(spacingStatus.textContent!==message)spacingStatus.textContent=message;
    }
    function dropSpacingPreview(session){session.preview?.finish(false);session.preview=null;if(spacingSession===session)preview=null;}
    function clearSpacingSession(session){dropSpacingPreview(session);if(spacingSession!==session)return;spacingSession=null;composing.clear();for(const input of [letter,line]){compositionEnded.delete(input);input.setAttribute('aria-invalid','false');}renderSpacingStatus();}
    function cancelPreview(reason='cancelled'){
      const session=spacingSession;if(!session)return false;
      if(!session.managed?.cancel(reason))clearSpacingSession(session);return true;
    }
    function sameSelection(items){const now=writableTexts();return now.length===items.length&&now.every((item,i)=>identity(item)===identity(items[i])&&item.el===items[i].el);}
    function validSpacingSession(session){return spacingSession===session&&sameSelection(session.items)&&session.items.every(item=>valid(item)&&item.el.isConnected!==false);}
    function spacingPreview(session){
      if(!session.preview)session.preview=formatting.createPreview(session.items.map(item=>({...item,...options(item)})),{requestFrame:adapter.requestFrame,cancelFrame:adapter.cancelFrame,valid:()=>validSpacingSession(session),drawn:()=>{localize();adapter.previewed?.();}});
      preview=session.preview;return preview;
    }
    function spacingPlans(session,values){return session.items.map(item=>{const props={},opts=options(item),factor=Number(opts.letterPointFactor??opts.pointFactor??1);if(values.letterSpacing!==undefined)props['letter-spacing']=String(values.letterSpacing/factor);if(values.lineHeight!==undefined)props['line-height']=String(values.lineHeight);return {props,children:[]};});}
    function beginSpacing(){
      if(spacingSession&&!sameSelection(spacingSession.items))cancelPreview();
      // A preceding module may replace the board while restoring its draft.
      // Restore it before capturing the actual text nodes for this session.
      if(!spacingSession)adapter.previewSessions?.cancel('text-spacing-started');
      const items=writableTexts();if(!items.length)return false;
      if(!spacingSession){
        const session=spacingSession={items:items.slice(),values:{},invalid:new Set(),preview:null,managed:null,committing:false,error:''};
        if(adapter.previewSessions)session.managed=adapter.previewSessions.begin({kind:'text-spacing',originalValue:{},valid:()=>validSpacingSession(session),
          render:values=>{const draw=spacingPreview(session);if(!draw.update(values)||!draw.flush())throw Error('Text spacing preview is unavailable');},
          restore:()=>dropSpacingPreview(session),
          commit:values=>{if(session.invalid.size||!validSpacingSession(session))return false;const plans=spacingPlans(session,values);return Object.keys(plans[0]?.props||{}).length?adapter.apply(session.items,plans,t('已更新文字间距')):false;},
          onError:message=>{if(spacingSession===session){session.error=message;renderSpacingStatus();}},
          onFinish:()=>{clearSpacingSession(session);if(!destroyed)sync();}});
        // The manager's beforeBegin hook can restore an image/inset preview
        // by replacing board nodes. Capture those final committed nodes.
        session.items=writableTexts().slice();if(!session.items.length){cancelPreview('context-changed');return false;}
        renderSpacingStatus();
      }
      return true;
    }
    function valueFor(input){const value=input.value.trim();if(!value||input.validity?.badInput)return null;const n=Number(value);return Number.isFinite(n)&&n>=Number(input.min)&&n<=Number(input.max)?n:null;}
    function updateSpacing(input){
      if(spacingSession?.committing)return false;if(!beginSpacing())return false;const session=spacingSession,value=valueFor(input);input.setAttribute('aria-invalid',String(value===null));
      if(value===null){session.invalid.add(input.name);if(session.managed){session.managed.flush();session.managed.reject(spacingCopy('输入尚未完成或超出范围。','The value is incomplete or outside the allowed range.'));}renderSpacingStatus();return false;}
      session.invalid.delete(input.name);session.error='';session.values[input.name]=value;const values={...session.values},ok=session.managed?session.managed.update(values):spacingPreview(session).update(values);
      if(session.invalid.size&&session.managed){session.managed.flush();session.managed.reject(spacingCopy('输入尚未完成或超出范围。','The value is incomplete or outside the allowed range.'));}renderSpacingStatus();return ok;
    }
    function commitSpacing(){
      if(!spacingSession||composing.size)return false;const session=spacingSession;if(session.committing)return false;if(!validSpacingSession(session)){cancelPreview('context-changed');return false;}
      // An unfinished field is a draft, not permission to commit its previous
      // valid value. Keep both the input and the last successful board preview.
      if(session.invalid.size){renderSpacingStatus();return false;}
      if(session.managed){session.committing=true;renderSpacingStatus();session.managed.commit().then(ok=>{if(spacingSession===session){session.committing=false;renderSpacingStatus();if(ok)sync();}}).catch(error=>{if(spacingSession===session){session.committing=false;renderSpacingStatus();announce(error.message);}});return true;}
      preview?.flush();const plans=spacingPlans(session,session.values);clearSpacingSession(session);if(!Object.keys(plans[0]?.props||{}).length)return false;const result=adapter.apply(session.items,plans,t('已更新文字间距'));sync();return result!==false;
    }
    function leaveSpacing(){if(!commitSpacing()&&spacingSession&&!spacingSession.committing)cancelPreview('tool-changed');}
    for(const input of [letter,line]){
      input.addEventListener('compositionstart',()=>{if(beginSpacing())composing.set(input,{session:spacingSession,blurred:false});});
      input.addEventListener('compositionend',()=>{const pending=composing.get(input);composing.delete(input);if(!pending||destroyed||spacingSession!==pending.session||!validSpacingSession(pending.session))return;updateSpacing(input);compositionEnded.add(input);if(pending.blurred){compositionEnded.delete(input);commitSpacing();}});
      input.addEventListener('input',event=>{if(!inComposition(event))updateSpacing(input);});
      input.addEventListener('change',event=>{if(!inComposition(event)&&!(compositionEnded.has(input)&&doc.activeElement===input))commitSpacing();});
      input.addEventListener('blur',()=>{const pending=composing.get(input);if(pending){pending.blurred=true;return;}compositionEnded.delete(input);commitSpacing();});
      input.addEventListener('pointerdown',()=>compositionEnded.delete(input));
      input.addEventListener('keydown',event=>{event.stopPropagation();if(inComposition(event))return;compositionEnded.delete(input);if(event.key==='Enter'){event.preventDefault();commitSpacing();input.blur();}else if(event.key==='Escape'){event.preventDefault();cancelPreview();sync();input.blur();}});
    }
    spacingButton.addEventListener('click',()=>{const show=popover.hidden;if(!show)leaveSpacing();painterPopover.hidden=true;painterOptionsButton.setAttribute('aria-expanded','false');popover.hidden=!show;spacingButton.setAttribute('aria-expanded',String(show));if(show){sync();letter.focus();}});
    function armPainter(){const items=selected().filter(item=>isText(item)&&valid(item,'source'));if(items.length!==1||!painter.arm(items[0]))return false;announce(brushFields().length===Object.keys(painter.status().record).length?'已复制文字格式，请点击目标文字；Esc 取消。':'已复制可用的文字格式；不支持的样式将保留目标原样。');return true;}
    painterButton.addEventListener('click',()=>{leaveSpacing();eyeTargets=null;painterPopover.hidden=true;painterOptionsButton.setAttribute('aria-expanded','false');if(painter.status().active)painter.cancel();else armPainter();notify();});
    painterOptionsButton.addEventListener('click',()=>{leaveSpacing();const show=painterPopover.hidden;popover.hidden=true;spacingButton.setAttribute('aria-expanded','false');painterPopover.hidden=!show;painterOptionsButton.setAttribute('aria-expanded',String(show));if(show)brushChecks[0].input.focus();});
    function changeBrushOptions(){brushFont.disabled=!brushChecks[0].input.checked;if(painter.status().active){painter.cancel();armPainter();}notify();}
    for(const choice of brushChecks)choice.input.addEventListener('change',changeBrushOptions);brushFont.addEventListener('change',changeBrushOptions);
    eyeButton.addEventListener('click',()=>{leaveSpacing();painter.cancel();eyeTargets=eyeTargets?null:writableShapes().slice();if(!eyeTargets?.length)eyeTargets=null;else announce('请点击图形吸取颜色，应用到已选图形；Esc 取消。');notify();});
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
    function cancel(){const spacing=cancelPreview();const active=painter.cancel()||!!eyeTargets||spacing;eyeTargets=null;notify();sync();return active;}
    function handleKey(event){if(event.key!=='Escape'||inComposition(event))return false;const active=!!preview||painter.status().active||!!eyeTargets||!popover.hidden||!painterPopover.hidden;if(!active)return false;event.preventDefault?.();cancel();popover.hidden=true;painterPopover.hidden=true;spacingButton.setAttribute('aria-expanded','false');painterOptionsButton.setAttribute('aria-expanded','false');return true;}
    function sync(){
      if(destroyed)return;localize();if(spacingSession&&!spacingSession.committing&&!sameSelection(spacingSession.items))cancelPreview('context-changed');
      const items=writableTexts(),sources=selected().filter(item=>isText(item)&&valid(item,'source'));spacingButton.disabled=!items.length;painterButton.disabled=sources.length!==1&&!painter.status().active;eyeButton.disabled=!writableShapes().length&&!eyeTargets;
      if(!items.length){popover.hidden=true;spacingButton.setAttribute('aria-expanded','false');return;}
      if(spacingSession)return;
      const values=items.map(item=>{const spacing=formatting.readSpacing(item.el),opts=options(item);return {letterSpacing:spacing.letterSpacing*Number(opts.letterPointFactor??opts.pointFactor??1),lineHeight:spacing.lineHeight};});
      for(const input of [letter,line]){const value=values[0][input.name],same=values.every(other=>Math.abs(other[input.name]-value)<1e-7);input.value=same?String(Number(value.toFixed(3))):'';input.placeholder=same?'':t('混合');input.setAttribute('aria-invalid','false');}
    }
    sync();
    return {sync,refresh:sync,handlePointer,handleKey,cancel,destroy(){cancel();destroyed=true;container.remove();},get element(){return container;},get active(){return painter.status().active||!!eyeTargets;}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioTextToolsUI;
