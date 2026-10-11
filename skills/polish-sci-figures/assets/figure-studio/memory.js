/* Local preference counts: no source tables, figure text, paths or SVG assets. */
'use strict';
class StudioPreferences {
  constructor(saved){
    this.enabled=saved?.enabled!==false;
    this.seen=Array.isArray(saved?.seen)?saved.seen.filter(x=>typeof x==='string'&&/^[a-f0-9:]{1,80}$/.test(x)).slice(-500):[];
    this.counts={palette:{},typography:{},chart:{},canvas:{},layout:{}};
    if(saved?.schema===1)for(const kind of Object.keys(this.counts))for(const [key,count]of Object.entries(saved.counts?.[kind]||{})){
      if(StudioPreferences.valid(kind,key)&&Number.isInteger(count)&&count>0&&count<=100000)this.counts[kind][key]=count;
    }
  }
  static valid(kind,key){
    if(typeof key!=='string'||key.length>1000)return false;
    if(kind==='chart')return /^[a-zA-Z0-9_-]{1,80}$/.test(key);
    if(kind==='canvas')return ['original','portrait','wide','spanWide','spanTall','large'].includes(key);
    try{const value=JSON.parse(key);
      if(kind==='palette')return Array.isArray(value)&&value.length>0&&value.length<=8&&value.every(x=>/^#[a-f0-9]{6}$/i.test(x));
      if(kind==='typography')return Array.isArray(value)&&value.length===2&&['Arial','Times New Roman','DejaVu Sans','Calibri','SimSun'].includes(value[0])&&Number.isFinite(value[1])&&value[1]>=4&&value[1]<=72;
      if(kind==='layout')return Array.isArray(value)&&value.length===3&&Number.isInteger(value[0])&&value[0]>=1&&value[0]<=24&&Number.isInteger(value[1])&&value[1]>=1&&value[1]<=6&&Array.isArray(value[2])&&value[2].length<=24&&value[2].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isInteger)&&p[0]>=1&&p[0]<=value[0]&&p[1]>=1&&p[1]<=value[1]);
    }catch{}return false;
  }
  static fingerprint(text){let a=2166136261,b=5381;for(const ch of text){a=Math.imul(a^ch.charCodeAt(0),16777619);b=Math.imul(b,33)^ch.charCodeAt(0);}return (a>>>0).toString(16)+':'+(b>>>0).toString(16);}
  record(key,features){
    if(!this.enabled||this.seen.includes(key)||!/^[a-f0-9:]{1,80}$/.test(key))return false;
    for(const kind of Object.keys(this.counts))for(const value of new Set(features[kind]||[]))if(StudioPreferences.valid(kind,value))this.counts[kind][value]=Math.min(100000,(this.counts[kind][value]||0)+1);
    this.seen.push(key);if(this.seen.length>500)this.seen.shift();
    return true;
  }
  top(kind,minimum=2){return Object.entries(this.counts[kind]||{}).filter(([,n])=>n>=minimum).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,3);}
  clear(){this.seen=[];for(const kind of Object.keys(this.counts))this.counts[kind]={};}
  toJSON(){return {schema:1,enabled:this.enabled,seen:this.seen,counts:this.counts};}
}
if(typeof module!=='undefined')module.exports=StudioPreferences;
