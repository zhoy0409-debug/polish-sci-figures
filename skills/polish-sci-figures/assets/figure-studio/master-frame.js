/* The paper is a viewport over document coordinates, independent of grid
 * tracks. Cropping never changes a panel, glyph, image, inset or lock record. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.StudioMasterFrame=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
  'use strict';
  const MIN=1,MAX=1e7,NS='http://www.w3.org/2000/svg';let serial=0;
  const valid=frame=>!!frame&&Object.keys(frame).every(key=>['x','y','width','height'].includes(key))&&['x','y','width','height'].every(key=>Number.isFinite(frame[key])&&Math.abs(frame[key])<=MAX)&&frame.width>=MIN&&frame.height>=MIN;
  const contains=(frame,box)=>!box||box.x>=frame.x-.001&&box.y>=frame.y-.001&&box.x+box.width<=frame.x+frame.width+.001&&box.y+box.height<=frame.y+frame.height+.001;
  const current=(state,layout)=>state.masterFrame?{...state.masterFrame}:{x:0,y:0,width:layout.documentWidth||layout.width,height:layout.documentHeight||layout.height};
  function apply(layout,state){if(!state.masterFrame)return layout;if(!valid(state.masterFrame))throw Error('母版边界无效');return {...layout,documentWidth:layout.documentWidth||layout.width,documentHeight:layout.documentHeight||layout.height,masterFrame:{...state.masterFrame},width:state.masterFrame.width,height:state.masterFrame.height};}
  function plan(state,layout,frame,{pinned=null}={}){
    if(!valid(frame))throw Error('母版边界无效');if(!contains(frame,pinned))throw Error('母版不能裁掉已锁定的内容，请先解锁');
    const before=current(state,layout),next={...state,masterFrame:{...frame}};
    // Preserve the physical export scale when an explicit publication width is
    // set. Cropping is allowed below the old 20 mm input-field minimum.
    if(state.exportSettings){const widthMm=state.exportSettings.widthMm*frame.width/before.width;if(widthMm>2000)throw Error('导出尺寸或分辨率无效');next.exportSettings={...state.exportSettings,widthMm};}
    return {state:next,layout:apply(layout,next),actual:{...frame},clamped:false};
  }
  function edge(state,layout,side,dx,dy,{pinned=null,proportional=false}={}){
    if(!['top','left','right','bottom','corner'].includes(side)||![dx,dy].every(Number.isFinite))throw Error('母版边界无效');
    const old=current(state,layout),frame={...old},right=old.x+old.width,bottom=old.y+old.height;
    if(side==='left'){frame.x=Math.min(right-MIN,old.x+dx);if(pinned)frame.x=Math.min(frame.x,pinned.x);frame.width=right-frame.x;}
    if(side==='top'){frame.y=Math.min(bottom-MIN,old.y+dy);if(pinned)frame.y=Math.min(frame.y,pinned.y);frame.height=bottom-frame.y;}
    if(side==='right'||side==='corner')frame.width=Math.max(MIN,old.width+dx,pinned?pinned.x+pinned.width-old.x:0);
    if(side==='bottom'||side==='corner')frame.height=Math.max(MIN,old.height+dy,pinned?pinned.y+pinned.height-old.y:0);
    if(side==='corner'&&proportional){let ratio=(frame.width*old.width+frame.height*old.height)/(old.width**2+old.height**2);ratio=Math.max(MIN/old.width,MIN/old.height,ratio,pinned?(pinned.x+pinned.width-old.x)/old.width:0,pinned?(pinned.y+pinned.height-old.y)/old.height:0);frame.width=old.width*ratio;frame.height=old.height*ratio;}
    const result=plan(state,layout,frame,{pinned});result.clamped=(side==='left'&&Math.abs(frame.x-old.x-dx)>.001)||(side==='top'&&Math.abs(frame.y-old.y-dy)>.001)||(['right','corner'].includes(side)&&!proportional&&Math.abs(frame.width-old.width-dx)>.001)||(['bottom','corner'].includes(side)&&!proportional&&Math.abs(frame.height-old.height-dy)>.001);return result;
  }
  function bounds(measured,padding=4){
    const boxes=[...Object.values(measured.ink||{}),...(measured.overlays||[]).map(item=>item.box)].filter(box=>box&&['x','y','width','height'].every(key=>Number.isFinite(box[key]))&&box.width>=0&&box.height>=0&&(box.width||box.height));
    if(!boxes.length)throw Error('没有可贴合的可见内容');if(!Number.isFinite(padding)||padding<0)throw Error('母版边界无效');
    const x=Math.min(...boxes.map(box=>box.x))-padding,y=Math.min(...boxes.map(box=>box.y))-padding,right=Math.max(...boxes.map(box=>box.x+box.width))+padding,bottom=Math.max(...boxes.map(box=>box.y+box.height))+padding;return {x,y,width:Math.max(MIN,right-x),height:Math.max(MIN,bottom-y)};
  }
  const point=(layout,u,v)=>({x:(layout.masterFrame?.x||0)+u*layout.width,y:(layout.masterFrame?.y||0)+v*layout.height});
  function clip(svg,frame){
    const doc=svg.ownerDocument,defs=doc.createElementNS(NS,'defs'),path=doc.createElementNS(NS,'clipPath'),rect=doc.createElementNS(NS,'rect'),group=doc.createElementNS(NS,'g'),id='studio-master-clip-'+(++serial);
    path.id=id;path.setAttribute('clipPathUnits','userSpaceOnUse');rect.setAttribute('data-master-frame-clip','true');for(const key of ['x','y','width','height'])rect.setAttribute(key,frame[key]);path.append(rect);defs.append(path);group.setAttribute('data-master-frame-content','true');group.setAttribute('clip-path',`url(#${id})`);
    for(const child of [...svg.children])if(!['defs','metadata'].includes(child.localName)&&!['data-editor-guides','data-editor-selection','data-editor-selection-resize','data-editor-snap','data-editor-alignment','data-panel-move','data-resize'].some(key=>child.hasAttribute(key)))group.append(child);svg.append(defs,group);return group;
  }
  return {MIN,MAX,valid,contains,current,apply,plan,edge,bounds,point,clip};
});
