/* Local profile library; uses the editor's canonical canvas and preview transaction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioSubmissionProfileUI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function mount(host){
    const doc=host.document,core=host.core,t=(zh,en)=>host.language()==='en'?en:zh,key='figure-studio-submission-library-v1';let session=null,profiles=[];
    const panel=doc.createElement('aside');panel.id='submissionProfiles';panel.className='quality-workspace submission-profiles';panel.hidden=true;
    const labels=[];
    function el(tag,zh,en,parent=panel){const node=doc.createElement(tag);if(zh){const text=doc.createTextNode(t(zh,en));labels.push({text,zh,en});node.append(text);}parent?.append(node);return node;}
    const heading=el('div');heading.className='quality-heading';el('h2','投稿配置','Submission profiles',heading);const close=el('button','×','×',heading);close.type='button';
    el('p','本机保存尺寸与预检阈值。请依据目标期刊要求填写；通用默认值不是期刊认证。','Save dimensions and review thresholds locally. Use the target journal’s requirements; general defaults are not journal certification.').className='quality-note';
    const listLabel=el('label','本机配置','Local profiles'),list=el('select',null,null,listLabel);list.id='submissionProfileList';
    const fields=el('div');fields.className='submission-fields';const inputs={};
    function field(id,zh,en,type='text',min,max,step){const label=el('label',zh,en,fields),input=el('input',null,null,label);input.id='submission-'+id;input.type=type;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(step!==undefined)input.step=step;inputs[id]=input;return input;}
    field('name','配置名称','Profile name').maxLength=80;
    field('source','要求来源（网址或说明，不会自动联网）','Requirement source (URL or note; never fetched)').maxLength=500;
    field('checkedOn','人工核对日期（可选）','Date checked by researcher (optional)','date');
    field('widthMm','成图宽度（mm）','Final width (mm)','number',20,2000,.1);
    const dpiLabel=el('label','栅格分辨率','Raster resolution',fields),dpi=el('select',null,null,dpiLabel);dpi.id='submission-dpi';inputs.dpi=dpi;for(const value of [600,900,1200]){const option=el('option',String(value)+' dpi',String(value)+' dpi',dpi);option.value=value;}
    field('maxHeightMm','最大高度（mm，可选；不裁切图形）','Maximum height (mm, optional; no cropping)','number',20,2000,.1);
    field('minTextPt','最小字号（pt，默认 8）','Minimum text (pt, default 8)','number',4,36,.5);
    field('minLinePt','最小线宽（pt，默认 0.25）','Minimum line (pt, default 0.25)','number',.1,3,.05);
    field('notes','备注（仅配置说明）','Notes (profile description only)').maxLength=800;
    const status=el('p');status.className='quality-status';status.setAttribute('role','status');
    const actions=el('div');actions.className='quality-actions submission-preview-actions';const preview=el('button','预览此配置','Preview profile',actions),keep=el('button','保留配置','Keep profile',actions),cancel=el('button','取消预览','Cancel preview',actions);preview.className='primary';keep.disabled=true;cancel.disabled=true;
    // Preview/Keep/Cancel remain visible while scrolling a long profile form.
    actions.prepend(status);panel.insertBefore(actions,fields);
    const storage=el('div');storage.className='quality-actions';const save=el('button','保存到本机配置','Save local profile',storage),remove=el('button','删除本机配置','Delete local profile',storage),download=el('button','导出配置文件','Export profile file',storage),upload=el('button','导入配置文件…','Import profiles…',storage),review=el('button','检查已保留图形','Review kept figure',storage);
    el('p','先预览，参数变化会同步到真实画布；保留后可一次撤销。仅保存配置不会修改工程。检查会报告超高、尺寸不匹配和实际字号／线宽，不自动压缩或篡改图形。','Preview first; changes update the actual canvas. Keep creates one undo step. Saving a local profile does not edit the project. Review reports excess height, mismatched settings and actual text/line sizes without cropping or altering the figure.').className='quality-note';
    const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    doc.body.append(panel);
    function say(message){status.textContent=message;}
    async function attempt(work){try{return await work();}catch(error){say(error.message);return false;}}
    function read(){return core.validate({schema:core.SCHEMA,...Object.fromEntries(Object.entries(inputs).map(([id,input])=>[id,['widthMm','dpi','minTextPt','minLinePt'].includes(id)?input.value.trim()===''?NaN:Number(input.value):id==='maxHeightMm'?input.value.trim()===''?null:Number(input.value):input.value.trim()]))});}
    function fill(profile){for(const [id,input]of Object.entries(inputs))input.value=profile?.[id]??'';}
    function refreshList(selected=''){list.replaceChildren();const blank=doc.createElement('option');blank.textContent=t('新配置／当前工程','New / current project');blank.value='';list.append(blank);for(const profile of profiles){const option=doc.createElement('option');option.textContent=profile.name;option.value=profile.name;list.append(option);}list.value=selected;}
    function load(){const selected=list.value,raw=host.storage.getItem(key);profiles=raw?core.parse(raw).profiles:[];refreshList(selected);}
    function store(next){const value=core.library(next);host.storage.setItem(key,JSON.stringify(value));profiles=value.profiles;refreshList(inputs.name.value.trim());}
    function cancelDraft(){session?.cancel('submission-cancel');session=null;keep.disabled=true;cancel.disabled=true;}
    function update(){const profile=read(),next=host.plan(profile);if(!session?.isCurrent()){session=host.preview(next,()=>{session=null;keep.disabled=true;cancel.disabled=true;},t('已应用投稿配置','Submission profile applied'));}else session.update(next);keep.disabled=!!session.error;cancel.disabled=false;say(t('真实画布预览中；保留或取消。','Previewing on the actual canvas. Keep or cancel.'));}
    preview.onclick=()=>attempt(update);
    fields.addEventListener('input',event=>{if(event.isComposing||event.target.dataset.composing||!session?.isCurrent())return;attempt(()=>{try{update();}catch(error){session.reject(error.message);keep.disabled=true;throw error;}});});
    fields.addEventListener('compositionstart',event=>{event.target.dataset.composing='true';});fields.addEventListener('compositionend',event=>{delete event.target.dataset.composing;if(session?.isCurrent())event.target.dispatchEvent(new Event('input',{bubbles:true}));});
    keep.onclick=()=>attempt(async()=>{if(await session?.commit())say(t('配置与尺寸已保留；可一次撤销。','Profile and dimensions kept; undo is available.'));});cancel.onclick=()=>{cancelDraft();say(t('预览已取消，工程未改变。','Preview cancelled; project unchanged.'));};
    list.onchange=()=>{cancelDraft();const profile=profiles.find(p=>p.name===list.value)||host.current();fill(profile||defaults());say('');};
    function defaults(){return {name:'',source:'',checkedOn:'',notes:'',widthMm:host.output().widthMm,dpi:host.output().dpi,maxHeightMm:null,minTextPt:8,minLinePt:.25};}
    save.onclick=()=>attempt(()=>{load();const profile=read();store([...profiles.filter(p=>p.name!==profile.name),profile]);say(t('已保存到本机；工程不变。','Saved locally; project unchanged.'));});
    remove.onclick=()=>attempt(()=>{load();if(!list.value)throw Error(t('请先选择本机配置','Select a local profile first'));store(profiles.filter(p=>p.name!==list.value));say(t('已从本机配置移除；已保留的工程配置不变。','Removed locally; the profile kept in the project is unchanged.'));});
    download.onclick=()=>attempt(()=>host.download(read(),'figure-studio-submission-profile.json'));
    upload.onclick=()=>file.click();file.onchange=()=>attempt(async()=>{const selected=file.files?.[0];file.value='';if(!selected)return;if(selected.size>core.MAX_BYTES)throw Error(t('配置文件超过 100 KB','Profile file exceeds 100 KB'));const imported=core.parse(await selected.text());load();const merged=new Map(profiles.map(p=>[p.name,p]));for(const profile of imported.profiles){if(merged.has(profile.name)&&JSON.stringify(merged.get(profile.name))!==JSON.stringify(profile))throw Error(t('同名配置不同，请改名后再导入','A different profile has the same name. Rename it before importing.'));merged.set(profile.name,profile);}store([...merged.values()]);say(t('配置已导入本机；工程未修改。','Profiles imported locally; project unchanged.'));});
    review.onclick=()=>attempt(()=>{if(session?.isCurrent())throw Error(t('请先保留或取消预览','Keep or cancel the preview first'));const profile=host.current();if(!profile)throw Error(t('请先在工程中保留一个配置','Keep a profile in the project first'));closePanel();host.review(profile);});
    function refreshLanguage(){for(const label of labels)if(label.text.isConnected)label.text.nodeValue=t(label.zh,label.en);if(list.options[0])list.options[0].textContent=t('新配置／当前工程','New / current project');host.trigger.textContent=t('投稿配置…','Submission profiles…');close.setAttribute('aria-label',t('关闭投稿配置','Close submission profiles'));panel.setAttribute('aria-label',t('投稿配置','Submission profiles'));}
    function closePanel(){if(panel.hidden)return;cancelDraft();panel.hidden=true;host.trigger.focus();}
    close.onclick=closePanel;
    host.trigger.onclick=()=>attempt(()=>{if(!panel.hidden){closePanel();return;}host.onOpen();refreshLanguage();panel.hidden=false;fill(host.current()||defaults());refreshList();say('');inputs.name.focus();load();});
    const language=doc.getElementById('language'),languageChange=()=>queueMicrotask(refreshLanguage);language?.addEventListener('change',languageChange);refreshLanguage();
    return {element:panel,close:closePanel,dispose(){closePanel();language?.removeEventListener('change',languageChange);panel.remove();}};
  }
  return {mount};
});
