/* User-declared submission requirements. No journal claims, network or figure data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioSubmissionProfiles=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='figure-studio-submission-profile/1',LIBRARY='figure-studio-submission-library/1',MAX_PROFILES=24,MAX_BYTES=100000;
  const keys=['schema','name','source','checkedOn','notes','widthMm','dpi','maxHeightMm','minTextPt','minLinePt'];
  function validate(value){
    const fail=()=>{throw Error('Invalid submission profile / 投稿配置无效');};
    if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key))||value.schema!==SCHEMA)fail();
    for(const [key,max]of [['name',80],['source',500],['checkedOn',10],['notes',800]])if(typeof value[key]!=='string'||value[key].length>max||/[\u0000-\u001f\u007f]/.test(value[key]))fail();
    if(!value.name.trim()||value.name!==value.name.trim())fail();
    // A source is a researcher-supplied reference, never fetched or rendered as HTML.
    if(value.checkedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(value.checkedOn)||!Number.isFinite(Date.parse(value.checkedOn))||new Date(value.checkedOn).toISOString().slice(0,10)!==value.checkedOn))fail();
    for(const [key,min,max]of [['widthMm',20,2000],['minTextPt',4,36],['minLinePt',.1,3]])if(!Number.isFinite(value[key])||value[key]<min||value[key]>max)fail();
    if(![600,900,1200].includes(value.dpi)||value.maxHeightMm!==null&&(!Number.isFinite(value.maxHeightMm)||value.maxHeightMm<20||value.maxHeightMm>2000))fail();
    return Object.fromEntries(keys.map(key=>[key,value[key]]));
  }
  function library(profiles){
    if(!Array.isArray(profiles)||profiles.length>MAX_PROFILES)throw Error('最多保存 24 个配置 / Up to 24 profiles');
    const result=profiles.map(validate);if(new Set(result.map(p=>p.name)).size!==result.length)throw Error('配置名称重复 / Duplicate profile name');
    return {schema:LIBRARY,profiles:result};
  }
  function parse(text){
    if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_BYTES)throw Error('配置文件超过 100 KB / Profile file exceeds 100 KB');
    const value=JSON.parse(text);
    if(value?.schema===SCHEMA)return library([value]);
    if(!value||value.schema!==LIBRARY||Object.keys(value).some(k=>!['schema','profiles'].includes(k)))throw Error('不支持的配置文件 / Unsupported profile file');
    return library(value.profiles);
  }
  function assess(value,output,thresholds){
    const p=validate(value);
    if(!output||!['widthMm','heightMm','dpi'].every(key=>Number.isFinite(output[key]))||output.widthMm<=0||output.heightMm<=0)throw Error('缺少实际导出尺寸 / Actual export dimensions required');
    const checks=[{id:'width',ok:Math.abs(output.widthMm-p.widthMm)<.01,actual:output.widthMm,required:p.widthMm,unit:'mm'},{id:'dpi',ok:output.dpi===p.dpi,actual:output.dpi,required:p.dpi,unit:'dpi'}];
    if(p.maxHeightMm!==null)checks.push({id:'height',ok:output.heightMm<=p.maxHeightMm+.01,actual:output.heightMm,maximum:p.maxHeightMm,unit:'mm'});
    if(thresholds)checks.push({id:'review-thresholds',ok:thresholds.minTextPt===p.minTextPt&&thresholds.minLinePt===p.minLinePt,actual:{minTextPt:thresholds.minTextPt,minLinePt:thresholds.minLinePt},required:{minTextPt:p.minTextPt,minLinePt:p.minLinePt}});
    return {schema:'figure-studio-submission-assessment/1',profile:p,checks,settingsMatch:checks.every(c=>c.ok),certified:false};
  }
  return {SCHEMA,LIBRARY,MAX_PROFILES,MAX_BYTES,validate,library,parse,assess};
});
