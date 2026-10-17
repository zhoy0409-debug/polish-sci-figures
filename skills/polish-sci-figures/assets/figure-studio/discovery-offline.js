/* Minimal descriptive fallback when neither Python nor WASM is available.
 * Exact observations only; no density, confidence intervals, tests or imputation. */
'use strict';
const DiscoveryOffline=(()=>{
 const supported=new Set(['compare_strip_median','compare_ecdf','compare_paired_lines','compare_paired_change','paired_dumbbell','time_individual_paths','time_baseline_change','relation_scatter','summary_mean_sd']);
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 async function render(candidate){
  const view=candidate.chart_id;if(!supported.has(view))throw Error('Requires the existing local renderer');
  const rows=candidate.rendering.rows,h=rows[0],body=rows.slice(1),get=(r,k)=>r[h.indexOf(k)],color=['#426b9d','#c35e70','#69758b','#a8864f'];
  let marks='',ticks='',xLabel='',yLabel='Value';const text=(x,y,s,anchor='middle')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial" font-size="10">${esc(s)}</text>`;
  const point=(x,y,c)=>`<circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`,line=(x,y,xx,yy,c)=>`<path d="M${x} ${y}L${xx} ${yy}" stroke="${c}" fill="none"/>`;
  const scale=(values,lo,hi)=>{const min=Math.min(...values),max=Math.max(...values),pad=(max-min||Math.abs(min)||1)*.08,fn=v=>lo+(v-min+pad)/(max-min+2*pad)*(hi-lo);for(const value of [...new Set([min,(min+max)/2,max])])ticks+=lo===50?text(fn(value),250,+value.toPrecision(4)):text(38,fn(value)+3,+value.toPrecision(4),'end');return fn;};
  if(view==='compare_strip_median'){
   const groups=[...new Set(body.map(r=>get(r,'group')))],y=scale(body.map(r=>+get(r,'value')),230,25),x=i=>65+i*300/Math.max(1,groups.length-1);
   for(const [i,g]of groups.entries()){const sub=body.filter(r=>get(r,'group')===g),values=sub.map(r=>+get(r,'value')).sort((a,b)=>a-b),mid=values.length%2?values[Math.floor(values.length/2)]:(values[values.length/2-1]+values[values.length/2])/2;sub.forEach((r,j)=>marks+=point(x(i)+Math.sin(j*2.4)*9,y(+get(r,'value')),color[i%4]));marks+=line(x(i)-12,y(mid),x(i)+12,y(mid),color[i%4])+text(x(i),250,g);}
  }else if(view==='compare_ecdf'){
   const groups=[...new Set(body.map(r=>get(r,'group')))],x=scale(body.map(r=>+get(r,'value')),50,390);yLabel='Cumulative proportion';xLabel='Value';for(const v of [0,.5,1])ticks+=text(38,233-v*200,v,'end');
   for(const [i,g]of groups.entries()){const values=body.filter(r=>get(r,'group')===g).map(r=>+get(r,'value')).sort((a,b)=>a-b);let prev=50,py=230;values.forEach((v,j)=>{const xx=x(v),yy=230-(j+1)/values.length*200;marks+=line(prev,py,xx,py,color[i%4])+line(xx,py,xx,yy,color[i%4]);prev=xx;py=yy;});marks+=text(300,15+i*12,g);}
  }else if(['compare_paired_lines','compare_paired_change','paired_dumbbell'].includes(view)){
   const change=view==='compare_paired_change',values=body.flatMap(r=>change?[+get(r,'after')- +get(r,'before')]:[+get(r,'before'),+get(r,'after')]),y=scale(values,230,25);
   if(change){yLabel='After − before';body.forEach((r,i)=>marks+=point(60+i*320/Math.max(1,body.length-1),y(+get(r,'after')- +get(r,'before')),color[0]));}
   else{body.forEach(r=>{const a=y(+get(r,'before')),b=y(+get(r,'after'));marks+=line(100,a,330,b,'#9ba9b8')+point(100,a,color[0])+point(330,b,color[1]);});marks+=text(100,250,'Before')+text(330,250,'After');}
  }else if(view==='relation_scatter'){
   const x=scale(body.map(r=>+get(r,'x')),50,390),y=scale(body.map(r=>+get(r,'y')),230,25);xLabel='X';yLabel='Y';body.forEach(r=>marks+=point(x(+get(r,'x')),y(+get(r,'y')),color[0]));
  }else if(view==='summary_mean_sd'){
   const x=scale(body.flatMap(r=>[+get(r,'mean')- +get(r,'sd'),+get(r,'mean')+ +get(r,'sd')]),50,390);xLabel='Supplied mean ± SD';yLabel='';body.forEach((r,i)=>{const y=30+i*190/Math.max(1,body.length-1),mean=+get(r,'mean'),sd=+get(r,'sd');marks+=line(x(mean-sd),y,x(mean+sd),y,color[0])+point(x(mean),y,color[0])+text(220,y-7,get(r,'group')).replace('</text>',` (<tspan font-style="italic">n</tspan> = ${esc(get(r,'n'))})</text>`);});
  }else{
   const units=[...new Set(body.map(r=>get(r,'unit')))],groups=[...new Set(body.map(r=>get(r,'group')))],x=scale(body.map(r=>+get(r,'time')),50,390),all=[];const paths=[];
   for(const u of units){const sub=body.filter(r=>get(r,'unit')===u).sort((a,b)=>+get(a,'time')- +get(b,'time')),base=view==='time_baseline_change'?+get(sub[0],'value'):0;paths.push(sub.map(r=>[+get(r,'time'),+get(r,'value')-base,groups.indexOf(get(r,'group'))]));all.push(...sub.map(r=>+get(r,'value')-base));}
   const y=scale(all,230,25);for(const path of paths)path.forEach(([time,value,g],i)=>{marks+=point(x(time),y(value),color[g%4]);if(i)marks+=line(x(path[i-1][0]),y(path[i-1][1]),x(time),y(value),color[g%4]);});xLabel='Time';if(view==='time_baseline_change')yLabel='Change from baseline';
   groups.forEach((g,i)=>marks+=text(300,13+i*12,g));
  }
  // Numeric tick values make the local fallback quantitatively interpretable.
  // The exact values are also retained in the saved table; never invent distributions.
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="432pt" height="288pt" viewBox="0 0 432 288"><rect width="432" height="288" fill="white"/><path d="M42 20V235H400" stroke="#617083" fill="none"/>${marks}${ticks}${text(220,278,xLabel)}<text transform="translate(12 140) rotate(-90)" text-anchor="middle" font-family="Arial" font-size="10">${esc(yLabel)}</text></svg>`;
  const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
  return {id:'panel-0',name:view,provenance:'user-data',initialVariant:0,recipe:candidate.rendering.recipe,analysis:{family:'descriptive-browser-fallback',inference_performed:false},table:{name:'local-data.csv',rows,sha256:await hash(JSON.stringify(rows))},variants:[{name:view,svg,width:432,height:288,viewBox:[0,0,432,288],sha256:await hash(svg),size:'original',preserveAspect:true}]};
 }
 return {render,supported};
})();
if(typeof module!=='undefined')module.exports=DiscoveryOffline;
