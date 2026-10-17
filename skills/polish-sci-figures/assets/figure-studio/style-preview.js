/* Reversible paint-only patches. Geometry and semantic chart operations keep
 * their canonical renderer; this helper never receives project or history. */
'use strict';
const StudioStylePreview=(()=>{
  const allowed=new Set(['fill','stroke','opacity']);
  function create(){
    const saved=new Map();
    const restore=()=>{for(const [node,style]of saved){
      // Flush Chrome's lazy CSSOM attribute before removing it. Otherwise a
      // previously absent SVG style may materialize as style="" afterwards.
      if(style===null){node.getAttribute('style');node.removeAttribute('style');}else node.setAttribute('style',style);
    }saved.clear();};
    function paint(changes){
      // Validate the complete patch before touching any visible node. An image,
      // gradient, geometry edit or unsupported value must use another renderer.
      for(const {node,props}of changes){
        if(!node?.style||node.localName==='image'||!props||typeof props!=='object')throw Error('Unsupported paint preview');
        for(const [property,value]of Object.entries(props)){
          if(!allowed.has(property)||typeof value!=='string')throw Error('Unsupported paint property');
          if(property==='opacity'?!/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(value):!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid paint value');
        }
      }
      restore();
      try{for(const {node,props}of changes){if(!saved.has(node))saved.set(node,node.getAttribute('style'));for(const [property,value]of Object.entries(props))node.style.setProperty(property,value);}}catch(error){restore();throw error;}
    }
    return {paint,restore,keep(){saved.clear();},get size(){return saved.size;}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioStylePreview;
