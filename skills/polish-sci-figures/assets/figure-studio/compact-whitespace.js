/* Safe canvas trimming. Coordinates are physical SVG units; artists never scale. */
(function(root){
  'use strict';
  const finiteBox=b=>b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>=0&&b.height>=0;
  const union=(a,b)=>!a?{...b}:{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.max(a.x+a.width,b.x+b.width)-Math.min(a.x,b.x),height:Math.max(a.y+a.height,b.y+b.height)-Math.min(a.y,b.y)};
  const contains=(a,b,epsilon=.01)=>b.x>=a.x-epsilon&&b.y>=a.y-epsilon&&b.x+b.width<=a.x+a.width+epsilon&&b.y+b.height<=a.y+a.height+epsilon;
  function plan({layout,places,ink,overlays=[],padding=4}){
    const blocked=reason=>({available:false,reason,layout});
    if(!layout?.positions?.length||!layout.cells?.length||!Number.isFinite(padding)||padding<0)return blocked('unmeasurable');
    if(layout.positions.some(pos=>!places[pos.id]||places[pos.id].cs!==1||places[pos.id].rs!==1))return blocked('spanning-panels');
    const positions=layout.positions,byId=new Map(positions.map(p=>[p.id,p])),bounds=new Map();
    for(const pos of positions){const box=ink[pos.id];if(!finiteBox(box)||(!box.width&&!box.height))return blocked('unmeasurable');bounds.set(pos.id,{...box});}
    const overlayOwners={};
    for(const overlay of overlays){
      if(!finiteBox(overlay.box))return blocked('unmeasurable');
      const owners=positions.filter(pos=>contains(pos,overlay.box));
      if(owners.length!==1)return blocked('cross-panel-overlay');
      overlayOwners[overlay.id]=owners[0].id;bounds.set(owners[0].id,union(bounds.get(owners[0].id),overlay.box));
    }
    const columns=Math.max(...layout.cells.map(c=>c.col))+1,rows=Math.max(...layout.cells.map(c=>c.row))+1;
    const cutsX=Array.from({length:columns},()=>({before:Infinity,after:Infinity})),cutsY=Array.from({length:rows},()=>({before:Infinity,after:Infinity}));
    for(const cell of layout.cells){
      const pos=positions.find(p=>places[p.id].col===cell.col&&places[p.id].row===cell.row),box=pos&&bounds.get(pos.id);
      // Empty slots keep their dimensions: templates remain usable for later images.
      const left=box?Math.max(0,box.x-cell.x-padding):0,right=box?Math.max(0,cell.x+cell.width-box.x-box.width-padding):0;
      const top=box?Math.max(0,box.y-cell.y-padding):0,bottom=box?Math.max(0,cell.y+cell.height-box.y-box.height-padding):0;
      cutsX[cell.col].before=Math.min(cutsX[cell.col].before,left);cutsX[cell.col].after=Math.min(cutsX[cell.col].after,right);
      cutsY[cell.row].before=Math.min(cutsY[cell.row].before,top);cutsY[cell.row].after=Math.min(cutsY[cell.row].after,bottom);
    }
    const before=(cuts,index)=>cuts.slice(0,index).reduce((sum,c)=>sum+c.before+c.after,0),apply=(box,col,row)=>{
      const x=cutsX[col],y=cutsY[row];return {...box,x:box.x-before(cutsX,col),y:box.y-before(cutsY,row),width:box.width-x.before-x.after,height:box.height-y.before-y.after};
    };
    const cells=layout.cells.map(c=>apply(c,c.col,c.row));
    const compactPositions=positions.map(pos=>{const p=places[pos.id],next=apply(pos,p.col,p.row);return {...next,renderBox:{...pos,x:next.x-cutsX[p.col].before,y:next.y-cutsY[p.row].before},trim:{left:cutsX[p.col].before,right:cutsX[p.col].after,top:cutsY[p.row].before,bottom:cutsY[p.row].after}};});
    if(cells.some(c=>c.width<24||c.height<24))return blocked('unmeasurable');
    const reducedX=cutsX.reduce((sum,c)=>sum+c.before+c.after,0),reducedY=cutsY.reduce((sum,c)=>sum+c.before+c.after,0);
    const result={...layout,width:layout.width-reducedX,height:layout.height-reducedY,cells,positions:compactPositions,compact:{sourceWidth:layout.width,sourceHeight:layout.height,originalPositions:positions,overlayOwners,reducedX,reducedY,padding}};
    // Out-of-canvas edits must never be silently cropped by a tighter viewport.
    for(const pos of compactPositions){const old=byId.get(pos.id),box=bounds.get(pos.id),moved={...box,x:box.x+pos.renderBox.x-old.x,y:box.y+pos.renderBox.y-old.y};if(!contains(pos,moved))return blocked('outside-panel-content');}
    return {available:true,reason:reducedX>.01||reducedY>.01?'compacted':'no-blank-space',layout:result};
  }
  function overlayGeometry(layout,id){
    if(!layout.compact)return {width:layout.width,height:layout.height,dx:0,dy:0};
    const owner=layout.positions.find(p=>p.id===layout.compact.overlayOwners[id]);
    if(!owner?.renderBox)return {width:layout.compact.sourceWidth,height:layout.compact.sourceHeight,dx:0,dy:0};
    const original=layout.compact.originalPositions?.find(p=>p.id===owner.id);
    return {width:layout.compact.sourceWidth,height:layout.compact.sourceHeight,dx:owner.renderBox.x-(original?.x||0),dy:owner.renderBox.y-(original?.y||0)};
  }
  let clipSerial=0;
  function appendPanel(rootSvg,svg,position){
    if(!position.renderBox){rootSvg.append(svg);return svg;}
    // Retain the source page background, but keep its unused canvas from
    // painting over a neighbouring cell after the cells become smaller.
    const ns='http://www.w3.org/2000/svg',defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),rect=document.createElementNS(ns,'rect'),group=document.createElementNS(ns,'g'),id='studio-compact-clip-'+(++clipSerial);
    clip.setAttribute('id',id);clip.setAttribute('clipPathUnits','userSpaceOnUse');
    for(const key of ['x','y','width','height'])rect.setAttribute(key,position[key]);
    clip.append(rect);defs.append(clip);group.setAttribute('clip-path',`url(#${id})`);group.append(svg);rootSvg.append(defs,group);return group;
  }
  function measure(svg){
    for(const node of svg.querySelectorAll('.chosen'))node.classList.remove('chosen');
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-50000px;top:0;pointer-events:none';host.append(svg);document.body.append(host);
    try{
      const inverse=svg.getScreenCTM()?.inverse();if(!inverse)throw Error('unmeasurable');
      const transformed=(box,matrix)=>{const points=[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f})),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));return {x,y,width:Math.max(...points.map(p=>p.x))-x,height:Math.max(...points.map(p=>p.y))-y};};
      const clipCache=new Map(),clipBounds=node=>{
        if(clipCache.has(node))return clipCache.get(node);
        const rects=[];for(let at=node;at&&at!==svg;at=at.parentElement){
          const ref=at.getAttribute('clip-path')?.match(/url\(\s*['"]?#([^\s)'" ]+)['"]?\s*\)/)?.[1];if(!ref)continue;
          const clip=[...svg.querySelectorAll('clipPath[id]')].find(el=>el.id===ref);if(!clip||clip.getAttribute('clipPathUnits')==='objectBoundingBox'||clip.children.length!==1||clip.firstElementChild.localName!=='rect')continue;
          const rect=clip.firstElementChild,own=rect.transform?.baseVal.consolidate()?.matrix,outer=clip.transform?.baseVal.consolidate()?.matrix;
          let matrix=inverse.multiply(at.getScreenCTM());if(outer)matrix=matrix.multiply(outer);if(own)matrix=matrix.multiply(own);
          const box={x:+rect.getAttribute('x')||0,y:+rect.getAttribute('y')||0,width:+rect.getAttribute('width'),height:+rect.getAttribute('height')};if(finiteBox(box))rects.push(transformed(box,matrix));
        }clipCache.set(node,rects);return rects;
      };
      const visible=node=>{for(let at=node;at&&at!==svg;at=at.parentElement){const style=getComputedStyle(at);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0)return false;}return true;};
      const background=node=>{for(let at=node;at&&at!==svg;at=at.parentElement)if(/(?:^|-)patch_1$/.test(at.id||'')&&/(?:^|-)figure_1$/.test(at.parentElement?.id||''))return true;return false;};
      const inkBox=parent=>{
        let result=null;const nodes=parent.matches?.('text,use,path,line,polyline,polygon,rect,circle,ellipse,image')?[parent]:[...parent.querySelectorAll('text,use,path,line,polyline,polygon,rect,circle,ellipse,image')];
        for(const node of nodes){
          if(node.closest('defs,clipPath,mask,pattern')||!visible(node)||background(node))continue;
          const style=getComputedStyle(node),fill=style.fill,stroke=style.stroke,hasStroke=stroke!=='none'&&Number(style.strokeOpacity)!==0;
          if(node.localName!=='image'&&(fill==='none'||Number(style.fillOpacity)===0)&&!hasStroke)continue;
          let box,matrix;try{box=node.getBBox();matrix=inverse.multiply(node.getScreenCTM());}catch{throw Error('unmeasurable');}
          if(!finiteBox(box)||!matrix)throw Error('unmeasurable');
          const extra=hasStroke?(parseFloat(style.strokeWidth)||0)/2*Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)):0;
          const mapped=transformed(box,matrix);let x=mapped.x-extra,y=mapped.y-extra,right=mapped.x+mapped.width+extra,bottom=mapped.y+mapped.height+extra;
          for(const clip of clipBounds(node)){x=Math.max(x,clip.x);y=Math.max(y,clip.y);right=Math.min(right,clip.x+clip.width);bottom=Math.min(bottom,clip.y+clip.height);}
          if(right>=x&&bottom>=y)result=union(result,{x,y,width:right-x,height:bottom-y});
        }return result;
      };
      const ink={};for(const panel of svg.querySelectorAll('svg[data-panel]'))ink[panel.getAttribute('data-panel')]=inkBox(panel);
      for(const label of svg.querySelectorAll('[data-panel-label]')){const id=label.getAttribute('data-panel-label'),box=inkBox(label);if(box)ink[id]=union(ink[id],box);}
      const overlays=[...svg.querySelectorAll('[data-annotation]')].map(group=>({id:group.getAttribute('data-annotation'),box:inkBox(group.firstElementChild)}));
      return {ink,overlays};
    }finally{svg.remove();host.remove();}
  }
  const api={plan,measure,union,contains,finiteBox,overlayGeometry,appendPanel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.StudioCompactWhitespace=api;
})(typeof globalThis!=='undefined'?globalThis:this);
