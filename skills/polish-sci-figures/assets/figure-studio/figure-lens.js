/* Colour-vision lens and figure-wide find/replace.
 * The lens filters the editor viewport only: project state, history, saved
 * files and exports never see it. Text edits use the review transaction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioFigureLens=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const NAMES={none:['正常','Normal'],protan:['红色盲','Red-blind (protan)'],deutan:['绿色盲','Green-blind (deutan)'],tritan:['蓝色盲','Blue-blind (tritan)'],grayscale:['灰度打印','Grayscale']};
  function filterValues(matrix){return matrix.map(row=>[...row,0,0].join(' ')).join(' ')+' 0 0 0 1 0';}
  // Literal matching only; replacement text is never interpreted as a pattern.
  function occurrences(text,query,{caseSensitive=false,wholeWord=false}={}){
    if(!query)return [];
    const pattern=new RegExp(query.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&'),caseSensitive?'gu':'giu'),found=[];
    const word=c=>!!c&&/[\p{L}\p{N}_]/u.test(c);
    for(const m of text.matchAll(pattern)){if(wholeWord&&(word(text[m.index-1])||word(text[m.index+m[0].length])))continue;found.push({start:m.index,end:m.index+m[0].length});}
    return found;
  }
  function replaceAll(text,query,replacement,options){
    let result='',last=0;for(const m of occurrences(text,query,options)){result+=text.slice(last,m.start)+replacement;last=m.end;}
    return result+text.slice(last);
  }
  function mount({document:doc,quality,artboard,language,host,review,blocked=()=>false}){
    const en=()=>language()==='en',labels=[],make=tag=>doc.createElement(tag);
    const label=(el,zh,english)=>{const update=()=>{el.textContent=en()?english:zh;};labels.push(update);update();return el;};
    const t=(zh,english)=>en()?english:zh;
    const defs=doc.createElementNS(NS,'svg');defs.setAttribute('aria-hidden','true');defs.setAttribute('width','0');defs.setAttribute('height','0');defs.style.cssText='position:absolute;width:0;height:0;overflow:hidden';defs.id='figureLensFilters';
    for(const [id,matrix]of Object.entries(quality.VISION)){
      const filter=doc.createElementNS(NS,'filter'),color=doc.createElementNS(NS,'feColorMatrix');
      filter.id='figureLens-'+id;for(const [k,v]of Object.entries({x:'0',y:'0',width:'1',height:'1','color-interpolation-filters':'linearRGB'}))filter.setAttribute(k,v);
      color.setAttribute('type','matrix');color.setAttribute('values',filterValues(matrix));filter.append(color);defs.append(filter);
    }
    doc.body.append(defs);
    const lens=make('details'),lensTitle=label(make('summary'),'色觉预览','Colour-vision preview'),note=label(make('p'),'只改变屏幕显示；保存与导出仍为原色。','Changes the screen only. Saved files and exports keep the original colours.'),choices=make('div');
    lens.id='figureLens';choices.className='quality-actions';choices.setAttribute('role','group');lens.append(lensTitle,note,choices);
    const badge=make('button');badge.type='button';badge.id='figureLensBadge';badge.hidden=true;badge.onclick=()=>setVision('none');doc.body.append(badge);
    let vision='none';const buttons=new Map();
    function paintBadge(){badge.hidden=vision==='none';badge.textContent=t('色觉预览：','Viewing as: ')+NAMES[vision][en()?1:0]+' ×';badge.title=t('恢复正常颜色显示','Return to normal colours');}
    function setVision(next){
      if(!NAMES[next])return;vision=next;
      if(next==='none')artboard.style.removeProperty('filter');else artboard.style.filter='url(#figureLens-'+next+')';
      for(const [id,button]of buttons)button.setAttribute('aria-pressed',String(id===next));paintBadge();
    }
    for(const [id,pair]of Object.entries(NAMES)){const button=label(make('button'),...pair);button.type='button';button.dataset.vision=id;button.setAttribute('aria-pressed',String(id==='none'));button.onclick=()=>setVision(id);buttons.set(id,button);choices.append(button);}

    const finder=make('details'),finderTitle=label(make('summary'),'查找与替换文字','Find and replace text'),form=make('div'),findLabel=make('label'),findText=label(make('span'),'查找','Find'),find=make('input'),replaceLabel=make('label'),replaceText=label(make('span'),'替换为','Replace with'),replacement=make('input');
    finder.id='figureFindReplace';form.className='quality-thresholds';find.type=replacement.type='text';find.maxLength=replacement.maxLength=200;find.id='figureFind';replacement.id='figureReplace';findLabel.append(findText,find);replaceLabel.append(replaceText,replacement);form.append(findLabel,replaceLabel);
    const options=make('div');options.className='quality-actions figure-find-options';
    const toggle=(id,zh,english)=>{const wrap=make('label'),input=make('input');input.type='checkbox';input.id=id;wrap.append(input,label(make('span'),zh,english));options.append(wrap);return input;};
    const caseSensitive=toggle('figureFindCase','区分大小写','Match case'),wholeWord=toggle('figureFindWord','全词匹配','Whole word');
    const apply=label(make('button'),'预览全部替换','Preview replace all');apply.type='button';apply.id='figureReplaceAll';
    const status=make('p'),list=make('ol');status.id='figureFindStatus';status.className='quality-status';status.setAttribute('role','status');list.className='figure-find-results';
    finder.append(finderTitle,form,options,apply,status,list);
    const before=review.element.querySelector(':scope > details');if(before)before.before(lens,finder);else review.element.append(lens,finder);
    const settings=()=>({caseSensitive:caseSensitive.checked,wholeWord:wholeWord.checked});
    const editable=item=>!item.locked&&!item.statistical&&!item.rich;
    const reason=item=>item.locked?t('已锁定','locked'):item.statistical?t('统计结果','statistical result'):item.rich?t('含字符格式','rich text'):'';
    function matches(){return find.value?host.texts().filter(item=>occurrences(item.text,find.value,settings()).length):[];}
    function refresh(){
      list.replaceChildren();if(!find.value){status.textContent='';apply.disabled=true;return;}
      const found=matches(),can=found.filter(editable).length;apply.disabled=!can;
      status.textContent=found.length?t(`${found.length} 段文字匹配，${can} 段可替换`,`${found.length} text objects match, ${can} can be replaced`):t('没有匹配的文字','No matching text');
      for(const item of found.slice(0,100)){const row=make('li'),button=make('button'),why=reason(item);button.type='button';button.textContent=item.text.slice(0,80)+(why?' · '+why:'');button.onclick=()=>host.locate(item.target);row.append(button);list.append(row);}
    }
    find.addEventListener('input',refresh);for(const input of [caseSensitive,wholeWord])input.addEventListener('change',refresh);
    apply.onclick=()=>review.showTextPlan(()=>host.textPlan(matches().map(item=>({target:item.target,from:item.text,to:replaceAll(item.text,find.value,replacement.value,settings())}))));
    finder.addEventListener('toggle',()=>{if(finder.open)refresh();});apply.disabled=true;
    function openFinder(){review.open();finder.open=true;refresh();find.focus();find.select();finder.scrollIntoView?.({block:'nearest'});}
    const keys=event=>{
      if(event.isComposing||event.altKey||event.shiftKey||!(event.ctrlKey||event.metaKey)||event.key?.toLowerCase()!=='h'||blocked())return;
      if(event.target?.closest?.('input,textarea,select,[contenteditable="true"]')&&!review.element.contains(event.target))return;
      event.preventDefault();openFinder();
    };
    doc.addEventListener('keydown',keys);
    const languageField=doc.getElementById('language'),retitle=()=>queueMicrotask(()=>{for(const update of labels)update();paintBadge();if(finder.open)refresh();});languageField?.addEventListener('change',retitle);
    return {setVision,openFinder,refresh,get vision(){return vision;},dispose(){setVision('none');doc.removeEventListener('keydown',keys);languageField?.removeEventListener('change',retitle);for(const el of [lens,finder,badge,defs])el.remove();}};
  }
  return {NAMES,filterValues,occurrences,replaceAll,mount};
});
