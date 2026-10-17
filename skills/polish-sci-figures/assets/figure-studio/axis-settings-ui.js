/* Declarative professional-axis editor. Rendering and history remain owned by
 * Studio: this module never mutates artwork or source observations directly. */
'use strict';
const StudioAxisSettingsUI=(()=>{
  const clone=value=>JSON.parse(JSON.stringify(value||{}));
  const EN={'坐标轴设置':'Axis settings','范围':'Range','刻度':'Ticks','尺寸':'Size','外观':'Appearance','当前坐标轴':'Current axis','当前子图':'Current panel','应用范围':'Apply to','横轴':'X axis','纵轴':'Y axis','下限':'Minimum','上限':'Maximum','自动':'Automatic','尺度':'Scale','线性':'Linear','主刻度间隔':'Major interval','主刻度数量':'Major count','次刻度数':'Minor subdivisions','标签格式':'Label format','小数':'Decimal','科学记数':'Scientific','百分比':'Percent','小数位':'Decimal places','刻度位置':'Tick position','下':'Bottom','上':'Top','左':'Left','右':'Right','两侧':'Both sides','隐藏':'Hidden','显示标签':'Show labels','绘图区宽':'Plot width','绘图区高':'Plot height','左侧留白':'Left margin','下侧留白':'Bottom margin','锁定纵横比':'Lock aspect ratio','刻度方向':'Tick direction','向外':'Out','向内':'In','双向':'In and out','刻度长度':'Tick length','刻度字号':'Tick label size','刻度与标题颜色':'Tick and title colour','轴线宽':'Axis line width','轴线颜色':'Axis line colour','轴框':'Axis frame','仅左/下':'Left and bottom','完整方框':'Full box','无':'None','显示轴线':'Show spines','轴标题字号':'Axis title size','轴标题距离':'Title spacing','标签距离':'Label spacing','应用':'Apply','复位':'Reset','关闭':'Close','实时预览':'Live preview','绘图区尺寸使用最终印刷 pt（1 mm = 2.83465 pt）；文字字号与线宽保持物理尺寸。':'Plot dimensions use publication points (1 mm = 2.83465 pt); text and strokes retain their physical sizes.','范围会重新绘制真实观测、区间与曲线；不会改写原始数据。':'Ranges rerender observations, intervals and curves without changing source data.','log10 仅用于经过审查的正值数值数据；非正值与不支持图型将被拒绝。':'Log10 requires reviewed positive numeric data. Nonpositive values and unsupported charts are rejected.','对数轴间隔以 log₁₀ 单位表示（1 表示每十倍）。百分比仅改变显示（0.25 → 25%）。':'Log intervals are in log10 units (1 means each decade). Percent changes display only (0.25 → 25%).','导入 SVG：只能延长已识别轴及更改线条外观。范围缩小、尺度转换与绘图区重绘需要原始数据和配方。':'Imported SVG: only recognized axis extension and spine appearance are supported. Cropping ranges, scale changes and plot reflow require source data and a recipe.','当前对象没有可验证的数据坐标关系；只能使用图形编辑，不能重新标定数值。':'This object has no verified data-coordinate mapping. Use graphic editing; numeric recalibration is unavailable.','请先启动本机数据引擎。':'Start the local data engine first.','此子图已锁定。':'This panel is locked.','请输入有效的有限数值。':'Enter valid finite values.','下限必须小于上限。':'Minimum must be less than maximum.','主刻度间隔与数量只能选择一种。':'Choose either a major interval or a major count.','坐标轴设置已应用。':'Axis settings applied.','设置未应用。':'Settings were not applied.','原图轴线只允许延长；不能缩短原有数值范围。':'Imported axes can only extend; the original numeric range cannot shrink.','当前轴':'Selected axis'};
  function mount(host,options={}){
    if(!host||!options.getContext||!options.onApply)throw Error('Axis editor requires a host, getContext and onApply');
    let context={},draft={},active='y',timer=null,busy=false,dirty=false,opened=false,revision=0,epoch=0,queued=false,destroyed=false;
    const contextIdentity=value=>value?.contextKey??JSON.stringify([value?.projectId,value?.panelId,value?.variant,value?.key]);
    const language=()=>typeof options.language==='function'?options.language():options.language||'zh';
    const t=text=>language()==='en'?(EN[text]||text):text;
    const element=(name,cls,text)=>{const node=document.createElement(name);if(cls)node.className=cls;if(text!==undefined)node.textContent=t(text);return node;};
    const root=element('div','axis-settings');root.hidden=true;root.setAttribute('data-axis-settings','');
    const header=element('div','axis-settings-header');header.append(element('strong',null,'坐标轴设置'));
    const close=element('button',null,'关闭');close.type='button';close.onclick=()=>api.close();header.append(close);root.append(header);
    const notice=element('p','axis-settings-notice'),status=element('p','axis-settings-status');status.setAttribute('role','status');
    root.append(notice);const scope=element('div','axis-settings-row');
    const target=element('select');target.setAttribute('aria-label',t('应用范围'));for(const [value,label]of [['axis','当前坐标轴'],['panel','当前子图']]){const option=element('option',null,label);option.value=value;target.append(option);}scope.append(target);
    const axis=element('select');axis.setAttribute('aria-label',t('当前轴'));for(const [value,label]of [['x','横轴'],['y','纵轴']]){const option=element('option',null,label);option.value=value;axis.append(option);}scope.append(axis);root.append(scope);
    const content=element('div','axis-settings-sections');root.append(content,status);
    const actions=element('div','axis-settings-actions'),apply=element('button','primary','应用'),reset=element('button',null,'复位');apply.type=reset.type='button';
    const live=element('input');live.type='checkbox';live.checked=true;const liveLabel=element('label','axis-settings-live','实时预览');liveLabel.prepend(live);actions.append(liveLabel,reset,apply);root.append(actions);host.append(root);
    const section=(title,open=false)=>{const d=element('details');d.open=open;d.append(element('summary',null,title));const body=element('div','axis-settings-grid');d.append(body);content.append(d);return body;};
    const fields=new Map();
    function add(body,key,label,{type='number',values,min,max,step='any',hint}={}){
      const wrapper=element('label',null,label),input=element(values?'select':'input');input.dataset.axisField=key;
      if(values)for(const [value,text]of values){const option=element('option',null,text);option.value=value;input.append(option);}
      else {input.type=type;if(type==='number'){input.step=step;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;input.placeholder=t('自动');}}
      input.setAttribute('aria-label',t(label));wrapper.append(input);if(hint)wrapper.append(element('small',null,hint));body.append(wrapper);fields.set(key,input);
      input.onchange=()=>{dirty=true;revision++;syncDraft();if(live.checked)schedule();};input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();perform();}};return input;
    }
    function build(){
      content.replaceChildren();fields.clear();const ranges=section('范围',true);
      add(ranges,'min','下限');add(ranges,'max','上限');add(ranges,'scale','尺度',{values:[['','自动'],['linear','线性'],['log','log10']]});
      const ticks=section('刻度');add(ticks,'major_step','主刻度间隔',{min:1e-12});add(ticks,'major_count','主刻度数量',{min:2,max:40,step:1});add(ticks,'minor_count','次刻度数',{min:0,max:9,step:1});
      add(ticks,'tick_format','标签格式',{values:[['','自动'],['auto','自动'],['decimal','小数'],['scientific','科学记数'],['percent','百分比']]});add(ticks,'decimals','小数位',{min:0,max:8,step:1});
      add(ticks,'tick_side','刻度位置',{values:active==='x'?[['','自动'],['bottom','下'],['top','上'],['both','两侧'],['none','隐藏']]:[['','自动'],['left','左'],['right','右'],['both','两侧'],['none','隐藏']]});
      add(ticks,'labels_visible','显示标签',{values:[['','自动'],['true','显示标签'],['false','隐藏']]});const tickHint=element('p','axis-settings-hint','对数轴间隔以 log₁₀ 单位表示（1 表示每十倍）。百分比仅改变显示（0.25 → 25%）。');if(context.controls?.percentage_base?.[active]===100)tickHint.textContent=language()==='en'?'Log intervals use log10 units. This axis already uses percent values; 25 displays as 25%.':'对数间隔使用 log₁₀ 单位。当前轴已使用百分数，25 显示为 25%，不会再次乘以 100。';ticks.append(tickHint);
      const size=section('尺寸');for(const [key,label]of [['plot_width_pt','绘图区宽'],['plot_height_pt','绘图区高'],['plot_left_pt','左侧留白'],['plot_bottom_pt','下侧留白']])add(size,key,label,{min:key.includes('width')||key.includes('height')?36:24,max:key.includes('width')||key.includes('height')?1200:240});
      const lock=add(size,'aspect_lock','锁定纵横比',{type:'checkbox'});lock.checked=false;size.append(element('p','axis-settings-hint','绘图区尺寸使用最终印刷 pt（1 mm = 2.83465 pt）；文字字号与线宽保持物理尺寸。'));
      const appearance=section('外观');add(appearance,'tick_direction','刻度方向',{values:[['','自动'],['out','向外'],['in','向内'],['inout','双向']]});
      for(const [key,label,min,max]of [['tick_length_pt','刻度长度',0,24],['tick_label_size_pt','刻度字号',4,48],['axis_width_pt','轴线宽',.1,8],['title_size_pt','轴标题字号',4,64],['title_pad_pt','轴标题距离',0,48],['label_pad_pt','标签距离',0,36]])add(appearance,key,label,{min,max,step:.1});
      for(const [key,label]of [['axis_color','轴线颜色'],['tick_color','刻度与标题颜色']])add(appearance,key,label,{type:'color'});
      add(appearance,'axis_box','轴框',{values:[['','自动'],['left_bottom','仅左/下'],['full','完整方框'],['none','无']]});add(appearance,'axis_visible','显示轴线',{values:[['','自动'],['true','显示轴线'],['false','隐藏']]});
      for(const key of ['plot_width_pt','plot_height_pt'])fields.get(key).oninput=()=>{
        if(!lock.checked)return;const geometry=context.controls?.geometry||{},width=draft.plot_width_pt??geometry.plot_width_pt,height=draft.plot_height_pt??geometry.plot_height_pt,ratio=width/height;if(!Number.isFinite(ratio)||ratio<=0)return;
        const value=+fields.get(key).value;if(!Number.isFinite(value)||value<=0)return;fields.get(key==='plot_width_pt'?'plot_height_pt':'plot_width_pt').value=+(key==='plot_width_pt'?value/ratio:value*ratio).toFixed(3);
      };
    }
    const scopedStyles=['tick_direction','tick_length_pt','tick_label_size_pt','tick_color','axis_width_pt','axis_color','axis_visible','title_size_pt','title_pad_pt','label_pad_pt'];
    function keyFor(key){return ['min','max','scale','major_step','major_count','minor_count','tick_format','decimals','tick_side','labels_visible'].includes(key)||target.value==='axis'&&scopedStyles.includes(key)?active+'_'+key:key;}
    function syncDraft(){
      for(const [key,input]of fields){if(key==='aspect_lock'||input.disabled)continue;const name=keyFor(key);if(input.type==='color'){if(input.dataset.changed==='true')draft[name]=input.value;continue;}if(input.value===''){delete draft[name];continue;}draft[name]=['labels_visible','axis_visible'].includes(key)?input.value==='true':input.type==='number'?Number(input.value):input.value;}
    }
    function validate(){
      for(const [key,input]of fields)if(!input.disabled&&input.type==='number'&&input.value!==''&&(!Number.isFinite(+input.value)||!input.validity.valid))throw Error(t('请输入有效的有限数值。'));
      for(const a of ['x','y']){if(Number.isFinite(draft[a+'_min'])&&Number.isFinite(draft[a+'_max'])&&draft[a+'_min']>=draft[a+'_max'])throw Error(t('下限必须小于上限。'));if(draft[a+'_major_step']!==undefined&&draft[a+'_major_count']!==undefined)throw Error(t('主刻度间隔与数量只能选择一种。'));}
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(()=>perform(),650);}
    async function perform(){
      clearTimeout(timer);if(busy){queued=true;return;}const startedRevision=revision,startedEpoch=epoch,startedContext=contextIdentity(context);let acceptedContext=startedContext,valid=false,retry=false,dispatched=false;
      try{syncDraft();validate();busy=true;queued=false;dispatched=true;apply.disabled=reset.disabled=true;axis.disabled=target.disabled=true;status.textContent='';let result;
        if(context.native){result=await options.onApply(clone(draft),{axis:active,scope:target.value,contextKey:startedContext});}
        else if(context.imported?.supported){const info=context.imported,min=draft[active+'_min']??info.min,max=draft[active+'_max']??info.max;if(min>info.min+1e-9||max<info.max-1e-9)throw Error(t('原图轴线只允许延长；不能缩短原有数值范围。'));if(!options.onImportedApply)throw Error(t('设置未应用。'));result=await options.onImportedApply({extension:{version:1,axis:active,scale:info.scale,min,max},style:Object.fromEntries(['axis_width_pt','axis_color','axis_visible'].filter(k=>draft[keyFor(k)]!==undefined).map(k=>[k,draft[keyFor(k)]]))},context);}
        else throw Error(t('当前对象没有可验证的数据坐标关系；只能使用图形编辑，不能重新标定数值。'));
        acceptedContext=result?.contextKey??startedContext;valid=startedEpoch===epoch&&contextIdentity(options.getContext()||{})===acceptedContext&&!destroyed;
        if(!valid)return;context=options.getContext()||context;
        if(revision===startedRevision){dirty=false;status.textContent=t('坐标轴设置已应用。');}
        else {dirty=true;status.textContent=language()==='en'?'Earlier settings applied; newer edits are pending.':'前次设置已应用；新的修改尚待应用。';retry=queued||live.checked;}
      }catch(error){valid=startedEpoch===epoch&&contextIdentity(options.getContext()||{})===acceptedContext&&!destroyed;if(valid){status.textContent=error.message||t('设置未应用。');retry=dispatched&&revision!==startedRevision&&(queued||live.checked);}}
      finally{busy=false;if(!destroyed){apply.disabled=reset.disabled=blocked();axis.disabled=!context.native;target.disabled=!context.native;if(!valid&&startedEpoch===epoch&&dispatched){dirty=false;queued=false;clearTimeout(timer);refresh(true);status.textContent='';}if(valid&&retry){queued=false;clearTimeout(timer);Promise.resolve().then(()=>{if(startedEpoch===epoch&&!destroyed)perform();});}}}
    }
    function blocked(){return !!(context.locked||context.native&&(!context.engine||!context.controls?.supported)||!context.native&&!context.imported?.supported);}
    function refresh(force=false){
      if(root.hidden&&!force)return context;
      const incoming=options.getContext()||{};if(busy&&!force)return context;if(!force&&contextIdentity(incoming)!==contextIdentity(context)){epoch++;revision=0;dirty=false;queued=false;clearTimeout(timer);}context=incoming;if(dirty&&!force)return;if(!context.native&&context.imported?.supported)active=context.imported.axis;draft=clone(context.settings);build();axis.value=active;axis.disabled=busy||!context.native;const native=!!context.native&&context.controls?.supported;
      notice.textContent=t(context.locked?'此子图已锁定。':native&&!context.engine?'请先启动本机数据引擎。':native?'范围会重新绘制真实观测、区间与曲线；不会改写原始数据。':context.imported?.supported?'导入 SVG：只能延长已识别轴及更改线条外观。范围缩小、尺度转换与绘图区重绘需要原始数据和配方。':'当前对象没有可验证的数据坐标关系；只能使用图形编辑，不能重新标定数值。');
      if(native)notice.textContent+=' '+t('log10 仅用于经过审查的正值数值数据；非正值与不支持图型将被拒绝。');if(context.advisory)notice.textContent+=' '+context.advisory;
      target.disabled=!native;for(const [key,input]of fields){const value=draft[keyFor(key)]??draft[key];input.disabled=blocked()||(!native&&!['min','max','axis_width_pt','axis_color','axis_visible'].includes(key))||native&&key==='scale'&&!context.controls?.log_scale||native&&['min','max','scale','major_step','major_count','minor_count','tick_format','decimals'].includes(key)&&!context.controls?.[active+'_range'];
        if(input.type==='color'){input.value=value||'#26364b';input.oninput=()=>{input.dataset.changed='true';dirty=true;revision++;syncDraft();if(live.checked)schedule();};}
        else if(input.type!=='checkbox')input.value=value===undefined?'':String(value);
        const placeholder=context.controls?.geometry?.[key]??context.controls?.effective?.[0]?.[keyFor(key)]??context.controls?.defaults?.[keyFor(key)]??context.imported?.[key];if(input.type==='number'&&Number.isFinite(placeholder))input.placeholder=String(+placeholder.toPrecision(6));}
      apply.disabled=reset.disabled=busy||blocked();return context;
    }
    axis.onchange=()=>{syncDraft();active=axis.value;dirty=false;context={...context,settings:clone(draft)};const saved=options.getContext;const next=clone(draft);refresh(true);draft={...draft,...next};for(const [key,input]of fields)if(input.type!=='checkbox'&&input.type!=='color')input.value=draft[keyFor(key)]===undefined?'':String(draft[keyFor(key)]);};
    target.onchange=()=>{dirty=false;refresh(true);};
    apply.onclick=perform;reset.onclick=async()=>{if(busy)return;clearTimeout(timer);const token=++epoch;queued=false;dirty=false;try{await options.onReset?.({axis:active,scope:target.value,native:context.native,context});if(token===epoch&&!destroyed)refresh(true);}catch(error){if(token===epoch&&!destroyed)status.textContent=error.message;}};
    const api={refresh,open(selection={}){clearTimeout(timer);epoch++;queued=false;if(['x','y'].includes(selection.axis))active=selection.axis;opened=true;root.hidden=false;dirty=false;refresh(true);root.scrollIntoView?.({block:'nearest'});},close(){clearTimeout(timer);epoch++;queued=false;root.hidden=true;opened=false;},destroy(){clearTimeout(timer);epoch++;queued=false;destroyed=true;root.remove();},get isOpen(){return opened;},get element(){return root;}};
    refresh(true);return api;
  }
  return {mount};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioAxisSettingsUI;
