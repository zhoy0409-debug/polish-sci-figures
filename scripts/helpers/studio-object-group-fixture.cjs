// Load the actual mixed-group dependencies for tests that extract legacy handlers.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
module.exports=function install(ctx){
 if(!vm.isContext(ctx))vm.createContext(ctx);
 if(vm.runInContext('typeof objectGroupToken',ctx)==='undefined')vm.runInContext(slice('function objectGroupToken(','function validateState('),ctx);
 if(vm.runInContext('typeof selectionGroups',ctx)==='undefined')ctx.selectionGroups=()=>[];
 if(vm.runInContext('typeof appendArrowheads',ctx)==='undefined')vm.runInContext(slice('  function appendArrowheads(','  function overlayNode('),ctx);
 if(vm.runInContext('typeof objectSelectionRefs',ctx)==='undefined')vm.runInContext(slice('  function objectSelectionRefs(','  const sizeNames='),ctx);
 else if(vm.runInContext('typeof objectGroupAtTarget',ctx)==='undefined')vm.runInContext(slice('  function objectGroupAtTarget(','  function selectObjectGroup('),ctx);
};
