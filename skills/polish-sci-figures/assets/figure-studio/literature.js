/* Optional public-literature lookup. Measurements and project contents never enter this module. */
'use strict';
const StudioLiterature = (() => {
  const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/';
  const CHARTS = [
    {id:'raincloud',terms:['raincloud'],pattern:/\braincloud\b/i,views:['compare_raincloud','raincloud','raincloud_horizontal'],en:'Raincloud plot',zh:'雨云图'},
    {id:'box',terms:['box plot','boxplot'],pattern:/\bbox[ -]?plots?\b/i,views:['compare_box','compare_box_points','compare_notched_box','box_raw_points','compare_facet_boxes'],en:'Box plot',zh:'箱线图'},
    {id:'violin',terms:['violin plot'],pattern:/\bviolin[ -]?plots?\b/i,views:['compare_violin','compare_violin_box','violin_raw_points'],en:'Violin plot',zh:'小提琴图'},
    {id:'estimation',terms:['estimation plot','Gardner Altman','Cumming plot'],pattern:/\bestimation\s+(?:plots?|graphics?)\b|\bgardner[\s–—-]+altman\b|\bcumming\s+plots?\b/i,views:['compare_gardner_altman','compare_cumming','estimation_graphic','paired_estimation'],en:'Estimation plot',zh:'效应估计图'},
    {id:'ecdf',terms:['empirical cumulative distribution','ECDF'],pattern:/\bempirical\s+cumulative\s+distribution\b|\becdf\b/i,views:['compare_ecdf','group_ecdf','ecdf','complementary_ecdf'],en:'Empirical cumulative distribution',zh:'经验累积分布图'},
    {id:'bar',terms:['bar plot','bar chart'],pattern:/\bbar[ -]?(?:plots?|charts?)\b/i,views:['compare_bar_sd','compare_bar_points','bar_raw_points','grouped_observations'],en:'Bar plot',zh:'柱状图'},
    {id:'paired',terms:['paired plot','dumbbell plot'],pattern:/\bpaired\s+(?:plots?|trajector(?:y|ies))\b|\bdumbbell\s+(?:plots?|charts?)\b/i,views:['paired_dumbbell','compare_paired_lines','paired_trajectories'],en:'Paired observations',zh:'配对观测图'},
    {id:'scatter',terms:['scatter plot','scatterplot'],pattern:/\bscatter[ -]?plots?\b/i,views:['relationship_regression','relationship_joint_distribution','prediction_intervals','relation_loess'],en:'Scatter plot',zh:'散点图'},
    {id:'forest',terms:['forest plot'],pattern:/\bforest\s+plots?\b/i,views:['forest_intervals','group_estimate_forest','forest_reference_linked','coefficient_forest','meta_forest','meta_cumulative'],en:'Forest plot',zh:'森林图'},
    {id:'roc',terms:['ROC curve','receiver operating characteristic'],pattern:/\broc\s+curves?\b|\breceiver[ -]operating[ -]characteristic\b/i,views:['roc','roc_facets','roc_pointwise_band','roc_bootstrap_curves','roc_low_fpr','roc_threshold_color','roc_threshold_labels'],en:'ROC curve',zh:'ROC 曲线'},
    {id:'pr',terms:['precision recall curve'],pattern:/\bprecision[\s–—-]+recall\s+(?:curves?|plots?)\b/i,views:['precision_recall'],en:'Precision–recall curve',zh:'精确率–召回率曲线'},
    {id:'survival',terms:['Kaplan Meier'],pattern:/\bkaplan[\s–—-]+meier\b/i,views:['kaplan_meier','kaplan_meier_risk_table','survival_risk_counts'],en:'Kaplan–Meier curve',zh:'Kaplan–Meier 曲线'},
    {id:'heatmap',terms:['heatmap','heat map'],pattern:/\bheat[ -]?maps?\b/i,views:['matrix_heatmap','clustered_matrix','composition_heatmap','confusion_counts','confusion_row_normalized','correlation_values','checkerboard_assay','antibiogram_matrix'],en:'Heatmap',zh:'热图'},
    {id:'volcano',terms:['volcano plot'],pattern:/\bvolcano\s+plots?\b/i,views:['volcano','volcano_ranked_hits','volcano_labels'],en:'Volcano plot',zh:'火山图'},
    {id:'ma',terms:['MA plot'],pattern:/\bMA[ -]plots?\b/,views:['ma_expression'],en:'MA plot',zh:'MA 图'},
    {id:'bland',terms:['Bland Altman'],pattern:/\bbland[\s–—-]+altman\b/i,views:['bland_altman'],en:'Bland–Altman plot',zh:'Bland–Altman 一致性图'},
    {id:'upset',terms:['UpSet plot'],pattern:/\bupset\s+plots?\b/i,views:['upset_intersections'],en:'UpSet plot',zh:'UpSet 交集图'},
    {id:'sina',terms:['sina plot'],pattern:/\bsina\s+plots?\b/i,views:['distribution_sina','sina_points'],en:'Sina plot',zh:'Sina 散点图'},
    {id:'ridgeline',terms:['ridgeline plot'],pattern:/\bridge[ -]?line\s+plots?\b/i,views:['compare_ridgeline','ridgeline'],en:'Ridgeline plot',zh:'山脊图'},
    {id:'superplot',terms:['superplot'],pattern:/\bsuperplots?\b/i,views:['superplot'],en:'SuperPlot',zh:'独立实验分层散点图'},
    {id:'dose',terms:['dose response curve'],pattern:/\bdose[\s–—-]+response\s+(?:curves?|plots?)\b/i,views:['dose_response','dose_response_result'],en:'Dose–response curve',zh:'剂量–反应曲线'},
    {id:'bubble',terms:['enrichment dot plot','enrichment bubble plot'],pattern:/\benrichment\s+(?:dot|bubble)\s+plots?\b/i,views:['enrichment_bubble','enrichment_dots'],en:'Enrichment dot plot',zh:'富集点图'},
    {id:'swimmer',terms:['swimmer plot'],pattern:/\bswimmer\s+plots?\b/i,views:['swimmer','swimmer_duration','time_swimmer'],en:'Swimmer plot',zh:'泳道图'},
    {id:'manhattan',terms:['Manhattan plot'],pattern:/\bmanhattan\s+plots?\b/i,views:['genome_manhattan'],en:'Manhattan plot',zh:'曼哈顿图'}
  ];
  const TEXT = {
    title:['文献作图实例','Examples in papers'], topic:['研究主题（可选）','Research topic (optional)'],
    placeholder:['例如：细胞活性','e.g. cell viability'], search:['查找文献实例','Find examples'],
    privacy:['仅发送图型检索词及您填写的主题；数据留在本机。','Only chart search terms and your topic are sent. Your data stay on this device.'],
    idle:['看看类似图型在论文中如何使用，再用自己的数据预览。','See how papers use these chart types, then preview with your own data.'],
    busy:['正在查找，并核对开放全文的图注…','Finding papers and checking open-access figure captions…'],
    cancel:['取消','Cancel'], cancelled:['已取消，当前图形保持不变。','Search cancelled. Your figure is unchanged.'],
    none:['没有找到结果。可缩短研究主题，或清空主题再试。','No results. Try a shorter topic, or search without a topic.'],
    unavailable:['当前图型还没有可核对的文献检索词。仍可使用上方本地图型推荐。','Literature search is not available for these chart types yet. Local chart recommendations remain available.'],
    verified:['图注提及此图型','Chart type found in caption'], unverified:['图型尚未核实','Chart type not verified'],
    caution:['图注匹配只说明论文使用了此类图，不代表其实验设计或统计方法适用于您的数据。','A caption match identifies a chart type; it does not establish that the study design or analysis fits your data.'],
    preview:['用我的数据预览','Preview with my data'], article:['查看论文','Open paper'], figure:['查看对应图','Open figure'],
    partial:['已找到论文；部分图注暂未核实，可打开原文查看。','Papers found; some captions could not be checked. Open the source to review.'],
    source:['来源：Europe PMC · 仅在点击查找时联网','Source: Europe PMC · Connects only when you search'],
    offline:['暂时无法连接文献服务。可以重试，本地作图不受影响。','Cannot reach the literature service. Retry when connected; local editing still works.'],
    timeout:['文献服务响应较慢，请重试。','The literature service is taking too long. Please retry.'],
    rate_limit:['文献服务繁忙，请稍后重试。','The literature service is busy. Please retry shortly.'],
    invalid_topic:['主题请填写简短关键词，不要填写网址、邮箱或特殊检索语法。','Enter short topic keywords, without URLs, email addresses or query syntax.'],
    invalid_response:['文献服务未返回可核实的记录，请重试。','The service returned no verifiable records. Please retry.'],
    changed:['已切换图形，重新查找即可获得对应实例。','The figure has changed. Search again for matching examples.'],
    cached:['已显示本机缓存的检索结果。','Showing search results cached on this device.']
  };
  function words(key, language='en') { return (TEXT[key] || TEXT.offline)[language==='en'?1:0]; }
  class LiteratureError extends Error {
    constructor(code) { super(code); this.name=code==='aborted'?'AbortError':'LiteratureError';this.code=code; }
  }
  function plain(value, max=500) { return typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):''; }
  function cleanTopic(value='') {
    if(typeof value!=='string'||value.length>120||/[\u0000-\u001f\u007f<>:"@/\\?={}\[\]]|\b(?:www\.|https?\b|doi\b)|\b\d{1,3}(?:\.\d{1,3}){3}\b/i.test(value))throw new LiteratureError('invalid_topic');
    const topic=value.trim();
    if(topic&&!/^[\p{L}\p{M}\p{N}\s()'’.,–—-]+$/u.test(topic))throw new LiteratureError('invalid_topic');
    // The topic is one quoted literal. No field names or user query operators execute.
    return topic.replace(/[()'’.,–—-]+/g,' ').replace(/\s+/g,' ').trim();
  }
  function chartSelection(views=[]) {
    const requested=[...new Set(Array.isArray(views)?views.filter(v=>typeof v==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(v)).slice(0,256):[])];
    // The caller passes scientifically eligible views in recommendation order.
    // Keep that order both between chart families and for each Preview action.
    return CHARTS.map(chart=>({...chart,views:requested.filter(v=>chart.views.includes(v))}))
      .filter(chart=>chart.views.length).sort((a,b)=>requested.indexOf(a.views[0])-requested.indexOf(b.views[0]));
  }
  function buildSearch({views=[],topic=''}={}) {
    const charts=chartSelection(views),clean=cleanTopic(topic);
    if(!charts.length)throw new LiteratureError('no_views');
    const supported=new Set(charts.flatMap(c=>c.views)),leading=[...new Set(views.filter(v=>supported.has(v)))].slice(0,3);
    const terms=[...new Set(chartSelection(leading).flatMap(c=>c.terms))];
    return {charts,topic:clean,query:`(${terms.map(t=>'"'+t+'"').join(' OR ')}) AND OPEN_ACCESS:Y${clean?' AND TITLE_ABS:"'+clean+'"':''}`};
  }
  function verifiedId(value, type) { const s=typeof value==='number'?String(value):typeof value==='string'?value:'';return (type==='pmcid'?/^PMC[1-9]\d{0,11}$/:/^[1-9]\d{0,11}$/).test(s)?s:''; }
  function doiValue(value) {
    const s=typeof value==='string'?value.trim():'';
    return s.length<=240&&/^10\.\d{4,9}\/[A-Za-z0-9._;()/:+-]+$/.test(s)&&!s.includes('..')?s:'';
  }
  function safeArticle(record) {
    if(!record||typeof record!=='object')return null;
    const pmcid=verifiedId(record.pmcid,'pmcid'),pmid=verifiedId(record.pmid||(record.source==='MED'?record.id:''),'pmid');
    // IDs and URLs are built from validated fields; links supplied by a response are never used.
    if(!pmcid&&!pmid)return null;
    const title=plain(record.title,600);if(!title)return null;
    return {source:'Europe PMC',id:pmid||pmcid,pmid,pmcid,doi:doiValue(record.doi),title,
      year:/^(19|20)\d{2}$/.test(String(record.pubYear||''))?String(record.pubYear):'',
      journal:plain(record.journalTitle||record.journalInfo?.journal?.title,180),
      articleUrl:pmcid?'https://europepmc.org/articles/'+pmcid:'https://europepmc.org/article/MED/'+pmid,
      openAccess:record.isOpenAccess==='Y',verified:false,figures:[],compatibleViews:[]};
  }
  function prepareXML(xml) {
    if(typeof xml!=='string'||xml.length>3000000||/<!ENTITY\b/i.test(xml))throw new LiteratureError('invalid_response');
    // JATS routinely has an external public DTD. Strip it; never fetch/resolve a DTD or entity.
    // Internal subsets and malformed declarations are rejected instead of partially parsed.
    const declarations=xml.match(/<!DOCTYPE\b[\s\S]*?>/gi)||[];
    if(declarations.length>1||declarations.some(s=>s.includes('[')))throw new LiteratureError('invalid_response');
    const cleaned=xml.replace(/<!DOCTYPE\b[^>]*>/gi,'');
    if(/<!DOCTYPE\b/i.test(cleaned))throw new LiteratureError('invalid_response');
    return cleaned;
  }
  function parseFigures(xml, charts, pmcid, Parser=globalThis.DOMParser) {
    const source=prepareXML(xml);
    if(!Parser)return [];
    const doc=new Parser().parseFromString(source,'application/xml');
    if(doc.getElementsByTagName('parsererror').length||doc.documentElement?.localName!=='article')throw new LiteratureError('invalid_response');
    const child=(node,name)=>Array.from(node.children||[]).find(n=>n.localName===name);
    const figures=[];
    for(const fig of Array.from(doc.getElementsByTagName('fig')).slice(0,100)) {
      const id=fig.getAttribute('id')||'',label=plain(child(fig,'label')?.textContent,80),caption=plain(child(fig,'caption')?.textContent,20000);
      if(!/^[A-Za-z][A-Za-z0-9_.:-]{0,119}$/.test(id)||!caption||!label)continue;
      const matches=charts.filter(c=>c.pattern.test(caption));
      if(!matches.length)continue;
      figures.push({id,label,chartTypes:matches.map(c=>({id:c.id,en:c.en,zh:c.zh})),compatibleViews:[...new Set(matches.flatMap(c=>c.views))],
        url:'https://europepmc.org/articles/'+pmcid+'#'+encodeURIComponent(id),evidence:'caption',verified:true});
      if(figures.length===3)break;
    }
    return figures;
  }
  function createClient(deps={}) {
    const fetcher=deps.fetch||((...args)=>globalThis.fetch(...args)),Parser=deps.DOMParser||globalThis.DOMParser;
    const setTimer=deps.setTimeout||globalThis.setTimeout,clearTimer=deps.clearTimeout||globalThis.clearTimeout,now=deps.now||Date.now;
    const cache=new Map();
    function check(signal) {if(signal.aborted)throw signal.reason instanceof LiteratureError?signal.reason:new LiteratureError('aborted');}
    function abortable(promise,signal) {
      check(signal);
      return new Promise((resolve,reject)=>{
        const onAbort=()=>{try{check(signal);}catch(error){reject(error);}};
        signal.addEventListener('abort',onAbort,{once:true});
        Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',onAbort);try{check(signal);resolve(value);}catch(error){reject(error);}},error=>{signal.removeEventListener('abort',onAbort);reject(error);});
      });
    }
    async function read(response,signal,max) {
      const length=Number(response.headers?.get?.('content-length'));if(length>max)throw new LiteratureError('invalid_response');
      if(response.body?.getReader) {
        const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
        try{for(;;){const part=await abortable(reader.read(),signal);if(part.done)break;size+=part.value.byteLength;if(size>max)throw new LiteratureError('invalid_response');text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}
        finally{try{await reader.cancel();}catch{}}
      }
      const text=await abortable(response.text(),signal);if(text.length>max)throw new LiteratureError('invalid_response');return text;
    }
    async function request(url,signal,max) {
      check(signal);let response;
      try{response=await abortable(fetcher(url,{method:'GET',mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal}),signal);}
      catch(error){check(signal);throw error instanceof LiteratureError?error:new LiteratureError('offline');}
      check(signal);
      if(!response.ok)throw new LiteratureError(response.status===429?'rate_limit':'offline');
      return read(response,signal,max);
    }
    async function searchExamples({views=[],goal='',topic='',signal,language='en'}={}) {
      // Do not add panel, table or project parameters here. The allowlisted query is the entire request.
      const search=buildSearch({views,topic}),key=JSON.stringify([search.query,search.charts.map(c=>c.views)]),hit=cache.get(key);
      if(signal?.aborted)throw new LiteratureError('aborted');
      if(hit&&now()-hit.time<600000)return {...JSON.parse(JSON.stringify(hit.result)),fromCache:true};
      const controller=new AbortController(),abort=()=>controller.abort(new LiteratureError('aborted'));
      signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimer(()=>controller.abort(new LiteratureError('timeout')),10000);
      try{
        const url=new URL(BASE+'search');url.searchParams.set('query',search.query);url.searchParams.set('format','json');url.searchParams.set('pageSize','5');url.searchParams.set('resultType','core');
        const raw=await request(url.href,controller.signal,600000);let data;try{data=JSON.parse(raw);}catch{throw new LiteratureError('invalid_response');}
        if(!Array.isArray(data?.resultList?.result))throw new LiteratureError('invalid_response');
        const seen=new Set(),papers=data.resultList.result.map(safeArticle).filter(p=>p&&!seen.has(p.pmcid||p.pmid)&&seen.add(p.pmcid||p.pmid)).slice(0,5);
        if(data.resultList.result.length&&!papers.length)throw new LiteratureError('invalid_response');
        let partial=false;
        await Promise.all(papers.filter(p=>p.pmcid&&p.openAccess).slice(0,3).map(async paper=>{
          try{const xml=await request(BASE+paper.pmcid+'/fullTextXML',controller.signal,3000000);paper.figures=parseFigures(xml,search.charts,paper.pmcid,Parser);paper.verified=paper.figures.length>0;paper.compatibleViews=[...new Set(paper.figures.flatMap(f=>f.compatibleViews))];paper.verification=paper.verified?'caption':'no_caption_match';}
          catch(error){if(signal?.aborted)throw new LiteratureError('aborted');partial=true;paper.verification=error.code||'unavailable';}
        }));
        if(signal?.aborted)throw new LiteratureError('aborted');
        const result={source:'Europe PMC',query:search.query,papers:papers.sort((a,b)=>Number(b.verified)-Number(a.verified)),partial,fetchedAt:new Date(now()).toISOString(),fromCache:false};
        // Partial/error results are not cached: retry should actually recheck the service.
        if(!partial){cache.set(key,{time:now(),result:JSON.parse(JSON.stringify(result))});while(cache.size>12)cache.delete(cache.keys().next().value);}
        return result;
      }finally{clearTimer(timer);signal?.removeEventListener('abort',abort);}
    }
    return {searchExamples,clearCache:()=>cache.clear()};
  }
  const client=createClient();
  function mount(container,{getContext=()=>({}),onPreview=()=>{},searchExamples=client.searchExamples}={}) {
    const document=container.ownerDocument;let controller=null,serial=0,destroyed=false,currentKey='',context={},lastResult=null;
    const element=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;};
    const section=element('details','literature-panel'),heading=element('summary'),intro=element('p','literature-intro'),label=element('label','literature-topic-label'),input=element('input','literature-topic');input.type='text';input.maxLength=120;input.autocomplete='off';
    const labelText=element('span');label.append(labelText,input);
    const actions=element('div','literature-actions'),searchButton=element('button'),cancelButton=element('button'),privacy=element('small','literature-privacy'),status=element('p','literature-status'),results=element('div','literature-results'),source=element('small','literature-source');
    searchButton.type=cancelButton.type='button';cancelButton.hidden=true;actions.append(searchButton,cancelButton);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    section.append(heading,intro,label,actions,privacy,status,results,source);container.replaceChildren(section);
    const language=()=>context.language==='en'?'en':'zh-CN',t=key=>words(key,language());
    const snapshot=()=>{const c=getContext()||{};return {views:Array.isArray(c.views)?c.views.filter(v=>typeof v==='string'):[],goal:typeof c.goal==='string'?c.goal:'',language:c.language==='en'?'en':'zh-CN',contextKey:typeof c.contextKey==='string'?c.contextKey:''};};
    const identity=c=>JSON.stringify([c.contextKey,c.views,c.goal,c.language]);
    const link=(text,url)=>{const a=element('a','',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';return a;};
    function showResult(result,key) {
      const resultSerial=serial,eligibleCharts=chartSelection(context.views);
      results.replaceChildren();
      if(!result.papers.length){status.textContent=t('none');return;}
      status.textContent=result.partial?t('partial'):result.fromCache?t('cached'):'';
      for(const paper of result.papers) {
        const card=element('article','literature-card'),title=element('h4'),meta=element('p','literature-meta',[paper.journal,paper.year].filter(Boolean).join(' · '));title.append(link(paper.title,paper.articleUrl));card.append(title,meta);
        const badge=element('span','literature-badge'+(paper.verified?' is-verified':''),t(paper.verified?'verified':'unverified'));card.append(badge);
        const previews=new Map();
        for(const fig of paper.figures) {
          const row=element('div','literature-figure'),names=fig.chartTypes.map(c=>language()==='en'?c.en:c.zh).join(' / ');row.append(link(fig.label+' · '+names,fig.url));
          for(const chart of eligibleCharts){
            if(!fig.chartTypes.some(type=>type.id===chart.id)||previews.has(chart.id))continue;
            const view=chart.views.find(v=>fig.compatibleViews.includes(v));
            if(view)previews.set(chart.id,{view,name:language()==='en'?chart.en:chart.zh});
          }
          card.append(row);
        }
        for(const {view,name}of previews.values()){const preview=element('button','literature-preview',t('preview')+(previews.size>1?' · '+name:''));preview.type='button';preview.onclick=()=>{if(destroyed||serial!==resultSerial||identity(snapshot())!==key){refresh();return;}onPreview(view);};card.append(preview);}
        if(!paper.verified)card.append(link(t('article'),paper.articleUrl));
        if(paper.doi){const doi=element('small','literature-doi');doi.append(link('DOI: '+paper.doi,'https://doi.org/'+encodeURIComponent(paper.doi).replace(/%2F/gi,'/')));card.append(doi);}
        else if(paper.pmid)card.append(element('small','literature-doi','PMID: '+paper.pmid));
        results.append(card);
      }
      if(result.papers.some(p=>p.verified))results.append(element('p','literature-caution',t('caution')));
    }
    function stop(message) {serial++;controller?.abort();controller=null;searchButton.disabled=false;cancelButton.hidden=true;section.removeAttribute('aria-busy');if(message)status.textContent=t(message);}
    async function run() {
      refresh();stop();const ticket=++serial,key=currentKey;controller=new AbortController();const own=controller;
      lastResult=null;results.replaceChildren();status.textContent=t('busy');searchButton.disabled=true;cancelButton.hidden=false;section.setAttribute('aria-busy','true');
      try{const result=await searchExamples({views:context.views,goal:context.goal,topic:input.value,signal:own.signal,language:context.language});if(destroyed||ticket!==serial||own.signal.aborted)return;if(identity(snapshot())!==key){refresh();return;}lastResult=result;showResult(result,key);}
      catch(error){if(!destroyed&&ticket===serial)status.textContent=t(error.code==='no_views'?'unavailable':error.code==='aborted'?'cancelled':error.code||'offline');}
      finally{if(ticket===serial&&!destroyed){controller=null;searchButton.disabled=false;cancelButton.hidden=true;section.removeAttribute('aria-busy');}}
    }
    function refresh() {
      if(destroyed)return;const next=snapshot(),key=identity(next),changed=currentKey&&key!==currentKey;
      context=next;if(changed){stop();lastResult=null;results.replaceChildren();status.textContent=t('changed');}currentKey=key;
      heading.textContent=t('title');intro.textContent=t('idle');labelText.textContent=t('topic');input.placeholder=t('placeholder');searchButton.textContent=t('search');cancelButton.textContent=t('cancel');privacy.textContent=t('privacy');source.textContent=t('source');
      if(!chartSelection(context.views).length){searchButton.disabled=true;status.textContent=t('unavailable');}else if(!controller)searchButton.disabled=false;
    }
    searchButton.onclick=run;cancelButton.onclick=()=>stop('cancelled');input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();if(!searchButton.disabled)run();}};input.oninput=()=>{stop();lastResult=null;results.replaceChildren();status.textContent=t('idle');refresh();};refresh();
    return {refresh,destroy(){if(destroyed)return;stop();destroyed=true;container.replaceChildren();}};
  }
  return {searchExamples:client.searchExamples,clearCache:client.clearCache,mount,createClient,buildSearch,parseFigures,prepareXML,safeArticle,words};
})();
if(typeof module!=='undefined')module.exports=StudioLiterature;
