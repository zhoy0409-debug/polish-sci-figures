/* Explicit local feedback drafts and public release-download accounting.
   No telemetry, installation identifiers or project/image inspection. */
'use strict';
const StudioSupport=(()=>{
  const REPO='zhoy0409-debug/polish-sci-figures',API='https://api.github.com/repos/'+REPO,
    ISSUE='https://github.com/'+REPO+'/issues/new',PREFIX='[Figure Studio 反馈] ',
    LEDGER_PATH='skills/polish-sci-figures/assets/figure-studio/download-metrics-ledger.json',
    WINDOWS=/^polish-sci-figures-Studio-\d+\.\d+\.\d+-(Setup-x64\.exe|Portable-x64\.zip)$/;
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),integer=n=>Number.isSafeInteger(n)&&n>=0;
  function validateLedger(value){
    if(!object(value)||value.schema!=='figure-studio-download-ledger/1'||!Number.isFinite(Date.parse(value.recordedAt))||!Array.isArray(value.baseline)||value.baseline.length>5000||!Array.isArray(value.qaEvents)||value.qaEvents.length>10000)throw Error('Invalid download accounting ledger');
    const ids=new Set();for(const a of value.baseline){if(!object(a)||!integer(a.id)||!integer(a.count)||typeof a.name!=='string'||!WINDOWS.test(a.name)||typeof a.tag!=='string'||a.tag.length>100||typeof a.prerelease!=='boolean'||ids.has(a.id))throw Error('Invalid or duplicate baseline asset');ids.add(a.id);}
    const events=new Set();for(const event of value.qaEvents){if(!object(event)||typeof event.id!=='string'||!event.id||event.id.length>200||events.has(event.id)||!integer(event.assetId)||!Number.isSafeInteger(event.count)||event.count<1||event.count>1000||!Number.isFinite(Date.parse(event.occurredAt))||typeof event.evidence!=='string'||!/^docs\/qa\/[A-Za-z0-9_./-]+$/.test(event.evidence)||event.evidence.includes('..'))throw Error('Invalid or duplicate QA exclusion');events.add(event.id);}
    return value;
  }
  function calculateDownloads(releases,rawLedger){
    const ledger=validateLedger(rawLedger);if(!Array.isArray(releases)||releases.length>1000)throw Error('Invalid release metadata');
    const start=Date.parse(ledger.recordedAt),baseline=new Map(ledger.baseline.map(x=>[x.id,x])),assets=new Map(),issues=[],qaSums=new Map();
    for(const event of ledger.qaEvents)if(Date.parse(event.occurredAt)>start)qaSums.set(event.assetId,(qaSums.get(event.assetId)||0)+event.count);
    for(const r of releases){if(!object(r)||r.draft||r.prerelease||!r.published_at)continue;if(!Array.isArray(r.assets)||r.assets.length>1000)throw Error('Invalid release asset list');for(const a of r.assets){if(!object(a)||!WINDOWS.test(a.name||''))continue;if(!integer(a.id)||!integer(a.download_count)||assets.has(a.id))throw Error('Invalid or duplicate current asset');assets.set(a.id,{...a,tag:r.tag_name});}}
    for(const b of baseline.values())if(!b.prerelease&&!assets.has(b.id))issues.push('Baseline asset is missing: '+b.id);
    const rows=[];let net=0,excluded=0;
    for(const [id,a]of assets){const b=baseline.get(id),old=b?.count;
      if(b&&(b.name!==a.name||b.tag!==a.tag))throw Error('Release asset identity changed');
      let delta=old===undefined?(Date.parse(a.created_at)>start?a.download_count:null):a.download_count-old;
      const qa=qaSums.get(id)||0;
      if(b?.prerelease||delta===null||delta<0||qa>delta){issues.push('Counter requires reconciliation: '+id);delta=null;}
      const value=delta===null?null:delta-qa;if(value!==null)net+=value;excluded+=qa;
      rows.push({assetId:id,tag:a.tag,name:a.name,netNewDownloads:value,registeredQaExcluded:qa});
    }
    return {schema:'figure-studio-download-metrics/1',since:ledger.recordedAt,netNewDownloads:issues.length?null:net,registeredQaExcluded:excluded,historicalNetDownloads:null,countsUsers:false,rows,issues};
  }
  function redact(text){return String(text||'').replace(/(?:[A-Za-z]:[\\/]|\\\\)[^\r\n]*/g,'[本机路径已隐藏]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱已隐藏]').replace(/(?:gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})/g,'[凭据已隐藏]');}
  function feedbackDraft(fields,info={}){
    if(!object(fields)||!['problem','usability','suggestion'].includes(fields.kind)||typeof fields.summary!=='string'||!fields.summary.trim()||fields.summary.length>200||typeof fields.detail!=='string'||!fields.detail.trim()||fields.detail.length>6000)throw Error('Please provide a short summary and the details');
    const title=PREFIX+redact(fields.summary.trim()),sections=[['反馈类型',fields.kind],['使用反馈',redact(fields.detail.trim())]];
    if(fields.includeEnvironment){const safe={};for(const key of ['currentVersion','suiteVersion','platform','channel'])if(typeof info[key]==='string'&&/^[A-Za-z0-9 ._-]{1,60}$/.test(info[key]))safe[key]=info[key];sections.push(['基础版本信息',Object.entries(safe).map(([k,v])=>k+': '+v).join('\n')||'未提供']);}
    const body=sections.map(([name,text])=>'### '+name+'\n\n'+text).join('\n\n')+'\n\n---\n已由提交者预览并核对。编辑器未自动附加工程、科研原图、测量数据或诊断日志。';
    const url=new URL(ISSUE);url.searchParams.set('title',title);url.searchParams.set('body',body);
    return {title,body,url:url.href.length<=7500?url.href:null,requiresPaste:url.href.length>7500};
  }
  async function publicJSON(url,signal){
    const parsed=new URL(url);if(parsed.origin!=='https://api.github.com'||!parsed.pathname.startsWith('/repos/'+REPO+'/'))throw Error('Unexpected metadata endpoint');
    const response=await fetch(url,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',signal,headers:{Accept:'application/vnd.github+json'}});
    if(!response.ok)throw Error(response.status===403?'GitHub metadata request limit; try again later.':'GitHub metadata is unavailable ('+response.status+')');
    const text=await response.text();if(text.length>4000000)throw Error('Metadata limit exceeded');return JSON.parse(text);
  }
  async function fetchDownloads(bundled,signal){
    const releases=[];let complete=false;
    for(let page=1;page<=10;page++){const chunk=await publicJSON(API+'/releases?per_page=100&page='+page,signal);if(!Array.isArray(chunk))throw Error('Invalid release page');releases.push(...chunk);if(chunk.length<100){complete=true;break;}}
    if(!complete)throw Error('Release pagination limit; no partial total is shown');
    let ledger=validateLedger(bundled),ledgerSynced=false;
    try{const file=await publicJSON(API+'/contents/'+LEDGER_PATH+'?ref=main',signal);if(file.encoding!=='base64'||typeof file.content!=='string'||file.content.length>500000)throw Error('Invalid ledger response');const raw=Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0)),fresh=validateLedger(JSON.parse(new TextDecoder().decode(raw)));if(Date.parse(fresh.recordedAt)<Date.parse(ledger.recordedAt))throw Error('Older accounting baseline');ledger=fresh;ledgerSynced=true;}catch(error){if(signal?.aborted)throw error;}
    const result=calculateDownloads(releases,ledger);return {...result,ledgerSynced,queriedAt:new Date().toISOString(),netNewDownloads:ledgerSynced?result.netNewDownloads:null,unpublishedOrUnavailableLedger:!ledgerSynced};
  }
  function create(host){
    const doc=host.document||document,en=()=>host.language()==='en',t=(zh,eng)=>en()?eng:zh,el=(tag,text)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    let feedback=null,metrics=null,abort=null;
    function dialog(id,title){const box=el('dialog');box.id=id;box.className='experience-dialog studio-support-dialog';const header=el('div');header.className='command-heading';header.append(el('h2',title));const close=el('button',t('关闭','Close'));close.type='button';close.onclick=()=>box.close();header.append(close);box.append(header);doc.body.append(box);return box;}
    function field(box,caption,type,id){const label=el('label',caption),input=el(type);input.id=id;label.append(input);box.append(label);return input;}
    function openFeedback(){
      if(feedback?.open){feedback.querySelector('input')?.focus();return;}
      feedback?.remove();const box=feedback=dialog('studioFeedback',t('使用反馈','Send feedback'));box.append(el('p',t('先预览内容，再去 GitHub 确认提交。反馈公开可见，需要 GitHub 账号；编辑器不会自动上传图片或工程。','Preview first, then confirm on GitHub. Feedback is public and requires a GitHub account. Images and projects are not uploaded.')));
      const kind=field(box,t('反馈类型','Feedback type'),'select','feedbackKind');for(const [value,zh,eng]of [['problem','功能问题','Problem'],['usability','不好用的地方','Usability'],['suggestion','改进建议','Suggestion']]){const o=el('option',t(zh,eng));o.value=value;kind.append(o);}
      const summary=field(box,t('一句话概括','Short summary'),'input','feedbackSummary');summary.maxLength=200;
      const detail=field(box,t('你想做什么、哪里不顺手、希望怎样改进','What were you doing, what felt wrong, and what would help?'),'textarea','feedbackDetail');detail.maxLength=6000;detail.rows=6;
      const include=field(box,t('附带基础版本信息（可选）','Include basic version information (optional)'),'input','feedbackEnvironment');include.type='checkbox';include.checked=false;
      const preview=el('pre');preview.id='feedbackPreview';preview.hidden=true;box.append(preview);
      const consent=field(box,t('已预览内容，确认没有私人数据，并同意公开提交到 GitHub','I reviewed this draft, removed private data and agree to submit it publicly on GitHub'),'input','feedbackConsent');consent.type='checkbox';consent.checked=false;
      const status=el('p');status.setAttribute('role','status');box.append(status);const actions=el('div');actions.className='row';const inspect=el('button',t('预览反馈','Preview feedback')),send=el('a',t('到 GitHub 确认提交','Confirm on GitHub')),save=el('button',t('保存反馈文本','Save feedback text'));send.target='_blank';send.rel='noopener noreferrer';send.id='feedbackSubmit';send.setAttribute('aria-disabled','true');save.type=inspect.type='button';actions.append(inspect,send,save);box.append(actions);let draft=null;
      function invalidate(){draft=null;consent.checked=false;preview.hidden=true;send.removeAttribute('href');send.setAttribute('aria-disabled','true');}
      for(const input of [kind,summary,detail,include])input.addEventListener('input',invalidate);
      inspect.onclick=()=>{try{draft=feedbackDraft({kind:kind.value,summary:summary.value,detail:detail.value,includeEnvironment:include.checked},host.supportInfo?.()||{});preview.textContent=draft.title+'\n\n'+draft.body;preview.hidden=false;consent.checked=false;status.textContent=draft.requiresPaste?t('内容较长：保存文本后，在 GitHub 新反馈中粘贴。','This is a longer report: save the text and paste it into a new GitHub issue.'):t('请核对预览，再勾选公开提交确认。','Review the preview, then confirm public submission.');}catch(error){status.textContent=error.message;}};
      consent.onchange=()=>{const ready=!!draft&&consent.checked;send.setAttribute('aria-disabled',String(!ready));if(ready)send.href=draft.url||ISSUE;else send.removeAttribute('href');};
      send.addEventListener('click',event=>{if(!draft||!consent.checked){event.preventDefault();return;}status.textContent=t('已打开确认页面；只有在 GitHub 点击提交后才会创建反馈。','The confirmation page is open. Feedback is created only after you submit on GitHub.');});
      save.onclick=()=>{if(!draft){inspect.click();if(!draft)return;}const a=el('a');a.href=URL.createObjectURL(new Blob([draft.title+'\n\n'+draft.body],{type:'text/plain;charset=utf-8'}));a.download='Figure-Studio-feedback.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};box.showModal();summary.focus();
    }
    function openMetrics(){
      if(metrics?.open)return;metrics?.remove();const box=metrics=dialog('studioDownloadMetrics',t('下载统计（扣除登记验收）','Downloads excluding registered QA'));box.append(el('p',t('仅统计正式 Windows 安装包与便携包。历史验收无法完整追溯，因此不显示历史净下载总数；不收集使用行为，也不统计用户人数。','Only stable Windows installers and portable packages are counted. Historical QA is not fully reconciled, so no lifetime net total is shown. Usage and user identities are not collected.')));
      const result=el('div');result.id='downloadMetricsResult';result.append(el('p',t('尚未联网获取。','Not fetched.')));box.append(result);const status=el('p');status.setAttribute('role','status');box.append(status);const run=el('button',t('联网获取公开统计','Fetch public download statistics')),cancel=el('button',t('停止获取','Cancel fetch'));run.type=cancel.type='button';cancel.hidden=true;box.append(run,cancel);const bundle=doc.getElementById('downloadMetricsLedger');
      run.onclick=async()=>{abort?.abort();const current=abort=new AbortController();run.disabled=true;cancel.hidden=false;status.textContent=t('正在读取 GitHub 公开元数据；不发送工程或图像。','Reading public GitHub metadata; no project or image is sent.');try{if(!bundle)throw Error('Download accounting is not configured');const value=await fetchDownloads(JSON.parse(bundle.textContent),current.signal);if(current.signal.aborted)return;result.replaceChildren();const summary=el('strong',value.netNewDownloads===null?t('净新增下载：待核实','Net new downloads: awaiting reconciliation'):t('净新增下载：','Net new downloads: ')+value.netNewDownloads);result.append(summary,el('p',t('统计起点：','Accounting starts: ')+value.since),el('p',(value.netNewDownloads===null?t('登记验收（待核对）：','Registered QA (unreconciled): '):t('已扣除登记验收：','Registered QA excluded: '))+value.registeredQaExcluded));const table=el('table');table.append(el('caption',t('启用统计后的各版本下载，不包含起点前的历史计数','Per-version downloads after the baseline; earlier counters are excluded')));for(const row of value.rows.filter(row=>value.ledgerSynced&&(row.netNewDownloads===null||row.netNewDownloads>0||row.registeredQaExcluded>0))){const tr=el('tr');for(const text of [row.tag,row.name.includes('Setup')?t('安装包','Setup'):t('便携包','Portable'),value.ledgerSynced&&row.netNewDownloads!==null?String(row.netNewDownloads):t('待核实','Unreconciled')])tr.append(el('td',text));table.append(tr);}if(table.rows.length)result.append(table);status.textContent=!value.ledgerSynced?t('最新验收台账尚未发布或同步失败，暂不展示未经核实的净下载。','The current QA ledger is unpublished or unavailable; unverified net downloads are withheld.'):value.netNewDownloads===null?t('发行计数或验收记录需要核对，暂不展示净下载。','Release counters or QA records need reconciliation; net downloads are withheld.'):t('已按公开验收台账扣除；下载次数不等于用户数。','Registered QA exclusions applied; downloads are not users.');}catch(error){if(current.signal.aborted)status.textContent=t('已停止。','Cancelled.');else status.textContent=t('获取失败，编辑功能可继续使用：','Fetch failed; editing remains available: ')+error.message;}finally{if(abort===current){run.disabled=false;cancel.hidden=true;abort=null;}}};
      cancel.onclick=()=>abort?.abort();box.addEventListener('close',()=>abort?.abort());box.showModal();
    }
    return {openFeedback,openMetrics};
  }
  return {create,validateLedger,calculateDownloads,redact,feedbackDraft,fetchDownloads};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioSupport;
