/* Whole-panel commands. Logical slots survive visual alignment; asset bytes stay append-only. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.StudioPanelCommands=api;})(typeof window!=='undefined'?window:globalThis,()=>{
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value)),EPS=.000001,MAX_OFFSET=1e7;
  const modes=new Set(['left','center','right','top','middle','bottom']);
  function gridFor(state){return state.grid||{rows:Math.ceil(state.order.length/state.columns),places:Object.fromEntries(state.order.map((id,i)=>[id,{row:Math.floor(i/state.columns),col:i%state.columns,rs:1,cs:1}]))};}
  function idsFor(state,ids){return [...new Set(ids||[])].filter(id=>state.order.includes(id)&&state.panels[id]);}
  function lockedReason(state,id){
    const panel=state.panels[id];if(panel?.locked)return 'panel-locked';if(panel?.label?.locked)return 'label-locked';
    if(Object.values(panel?.lockedElements||{}).some(keys=>keys?.length))return 'content-locked';
    if((state.overlays||[]).some(overlay=>overlay.type==='inset'&&overlay.source?.panelId===id&&overlay.locked))return 'inset-locked';
    return null;
  }
  function deletionInfo(state,ids){
    const chosen=idsFor(state,ids),removed=[],skipped=[];
    for(const id of chosen){const reason=lockedReason(state,id);if(reason)skipped.push({id,reason});else removed.push(id);}
    return {removed,skipped,needsReplacement:removed.length>0&&removed.length===state.order.length};
  }
  function removePanels(state,ids,{replacementId=null,metrics=null}={}){
    const info=deletionInfo(state,ids);if(!info.removed.length)return {state,removed:[],skipped:info.skipped,replacementId:null,selection:idsFor(state,ids)};
    if(info.needsReplacement&&(!replacementId||state.panels[replacementId]||info.removed.includes(replacementId)))throw Error('删除最后一张小图需要空白画布');
    const next=clone(state),removed=new Set(info.removed),grid=next.grid=clone(gridFor(state)),first=state.order.indexOf(info.removed[0]),place=clone(grid.places[info.removed[0]]);
    if(metrics){
      if(!Array.isArray(metrics.widths)||metrics.widths.length!==state.columns||!Array.isArray(metrics.heights)||metrics.heights.length!==grid.rows||[...metrics.widths,...metrics.heights].some(n=>!Number.isFinite(n)||n<=0||n>14400))throw Error('工程布局无效');
      grid.widths=metrics.widths.slice();grid.heights=metrics.heights.slice();
    }
    next.order=state.order.filter(id=>!removed.has(id));for(const id of removed){delete next.panels[id];delete grid.places[id];}
    let replacement=null;if(!next.order.length){replacement=replacementId;next.order=[replacement];next.panels[replacement]={variant:0,edits:{}};grid.places[replacement]=place;}
    if(next.panelGroups)next.panelGroups=next.panelGroups.map(group=>group.filter(id=>!removed.has(id))).filter(group=>group.length>1);
    if(next.overlays)next.overlays=next.overlays.filter(overlay=>overlay.type!=='inset'||!removed.has(overlay.source?.panelId));
    if(next.imageLinks){const present=ref=>ref?.insetId?next.overlays?.some(overlay=>overlay.id===ref.insetId):next.order.includes(ref?.panelId);next.imageLinks=next.imageLinks.filter(link=>present(link.parent)&&present(link.child));}
    const remaining=idsFor(next,ids),selection=remaining.length?remaining:[next.order[Math.min(first,next.order.length-1)]];
    return {state:next,removed:info.removed,skipped:info.skipped,replacementId:replacement,selection};
  }
  function validFrame(frame){return !!frame&&['x','y','width','height'].every(key=>Number.isFinite(frame[key]))&&frame.width>0&&frame.height>0;}
  function frameMap(frames){return frames instanceof Map?frames:new Map(Array.isArray(frames)?frames.map(frame=>[frame.id,frame]):Object.entries(frames||{}));}
  function offset(panel){const value=panel?.frameOffset;if(value===undefined)return {x:0,y:0};if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||Math.abs(value.x)>MAX_OFFSET||Math.abs(value.y)>MAX_OFFSET)throw Error('小图位置参数无效');return value;}
  function frameWithOffset(frame,panel){const delta=offset(panel);return {...frame,x:frame.x+delta.x,y:frame.y+delta.y};}
  function alignPanels(state,ids,mode,{frames,bounds=null}={}){
    if(!modes.has(mode))throw Error('对齐方向无效');
    const chosen=idsFor(state,ids);if(chosen.length<2)return {state,changed:[],skipped:[],target:null,clamped:false};
    const indexed=frameMap(frames),items=chosen.map(id=>({id,frame:indexed.get(id),reason:lockedReason(state,id)}));if(items.some(item=>!validFrame(item.frame)))throw Error('无法测量所选小图，请重新选择');
    const horizontal=['left','center','right'].includes(mode),axis=horizontal?'x':'y',size=horizontal?'width':'height',anchor=frame=>frame[axis]+(['right','bottom'].includes(mode)?frame[size]:['center','middle'].includes(mode)?frame[size]/2:0),editable=items.filter(item=>!item.reason),skipped=items.filter(item=>item.reason).map(({id,reason})=>({id,reason}));
    if(!editable.length)return {state,changed:[],skipped,target:null,clamped:false};
    const reference=items.find(item=>item.reason),low=Math.min(...items.map(item=>item.frame[axis])),high=Math.max(...items.map(item=>item.frame[axis]+item.frame[size]));
    let target=reference?anchor(reference.frame):['left','top'].includes(mode)?low:['right','bottom'].includes(mode)?high:(low+high)/2,clamped=false;
    if(bounds){
      const start=Number(bounds[axis]??0),extent=Number(bounds[size]);if(!Number.isFinite(start)||!Number.isFinite(extent)||extent<=0)throw Error('母版尺寸无效');
      const lead=frame=>['right','bottom'].includes(mode)?frame[size]:['center','middle'].includes(mode)?frame[size]/2:0,min=Math.max(...editable.map(item=>start+lead(item.frame))),max=Math.min(...editable.map(item=>start+extent-item.frame[size]+lead(item.frame)));
      if(min>max+EPS)throw Error('所选小图超出母版，请先调整母版尺寸');const actual=Math.max(min,Math.min(max,target));clamped=Math.abs(actual-target)>EPS;target=actual;
    }
    const changes=[];for(const item of editable){const delta=target-anchor(item.frame);if(Math.abs(delta)<=EPS)continue;const previous=offset(state.panels[item.id]),value={...previous,[axis]:previous[axis]+delta};if(Math.abs(value[axis])>MAX_OFFSET)throw Error('小图位置参数无效');changes.push({id:item.id,dx:horizontal?delta:0,dy:horizontal?0:delta,frameOffset:value});}
    if(!changes.length)return {state,changed:[],skipped,target,clamped};
    const next={...state,panels:{...state.panels}};for(const change of changes)next.panels[change.id]={...state.panels[change.id],frameOffset:change.frameOffset};
    return {state:next,changed:changes,skipped,target,clamped};
  }
  function removeEmptyTrack(state,cell,{axis='auto',metrics=null}={}){
    const grid=gridFor(state);if(!cell||!Number.isInteger(cell.row)||!Number.isInteger(cell.col)||cell.row<0||cell.col<0||cell.row>=grid.rows||cell.col>=state.columns||!['auto','row','column'].includes(axis))throw Error('请选择有效的空格');
    const occupies=(place,row,col)=>row>=place.row&&row<place.row+place.rs&&col>=place.col&&col<place.col+place.cs;
    if(state.order.some(id=>occupies(grid.places[id],cell.row,cell.col)))return {state,removed:false,reason:'occupied-cell'};
    const emptyRow=grid.rows>1&&!state.order.some(id=>cell.row>=grid.places[id].row&&cell.row<grid.places[id].row+grid.places[id].rs),emptyColumn=state.columns>1&&!state.order.some(id=>cell.col>=grid.places[id].col&&cell.col<grid.places[id].col+grid.places[id].cs),direction=axis==='row'?(emptyRow?'row':null):axis==='column'?(emptyColumn?'column':null):emptyRow?'row':emptyColumn?'column':null;
    if(!direction)return {state,removed:false,reason:'occupied-track'};
    const index=direction==='row'?cell.row:cell.col,start=direction==='row'?'row':'col',track=direction==='row'?'heights':'widths';
    for(const id of state.order)if(grid.places[id][start]>index&&lockedReason(state,id))return {state,removed:false,reason:'locked-panel',id};
    const next={...state,grid:clone(grid)},sizes=metrics?.[track]||grid[track];
    if(sizes){if(!Array.isArray(sizes)||sizes.length!==(direction==='row'?grid.rows:state.columns)||sizes.some(n=>!Number.isFinite(n)||n<=0||n>14400))throw Error('工程布局无效');next.grid[track]=sizes.filter((_,i)=>i!==index);}
    if(direction==='row')next.grid.rows--;else next.columns--;
    for(const id of state.order)if(next.grid.places[id][start]>index)next.grid.places[id][start]--;
    return {state:next,removed:true,axis:direction,index,selection:{row:Math.min(cell.row,next.grid.rows-1),col:Math.min(cell.col,next.columns-1)}};
  }
  function isDeleteEvent(event){return !!event&&!event.defaultPrevented&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['Delete','Backspace'].includes(event.key)&&!event.target?.isContentEditable&&!event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');}
  return {deletionInfo,removePanels,alignPanels,removeEmptyTrack,frameWithOffset,validFrame,isDeleteEvent,lockedReason};
});
