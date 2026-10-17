/* Deterministic engineering geometry, not biological accuracy evidence.
 * Minimal PNG headers below declare dimensions only; they are not real photos. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),Insets=require(path.join(root,'skills/polish-sci-figures/assets/figure-studio/image-insets.js')),Scale=require(path.join(root,'skills/polish-sci-figures/assets/figure-studio/scale-geometry.js'));
let passed=0;const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} versus ${expected}`);
function png(w,h){const bytes=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(w,16);bytes.writeUInt32BE(h,20);return 'data:image/png;base64,'+bytes.toString('base64');}
function node(name,attrs={},parent=null){const attributes={...attrs},styles={};return{localName:name,parentElement:parent,style:{getPropertyValue:key=>styles[key]||'',setProperty:(key,value)=>styles[key]=value},getAttribute:key=>attributes[key]??null,getAttributeNS:(_,key)=>attributes['xlink:'+key]??null,setAttribute:(key,value)=>attributes[key]=String(value),removeAttribute:key=>delete attributes[key]};}
function image(w=1280,h=960,attrs={},parentAttrs={}){const parent=node('svg',{viewBox:'0 0 900 600',...parentAttrs}),img=node('image',{x:'0',y:'0',width:'600',height:'340',href:png(w,h),...attrs},parent);return img;}
const config={calibration:100,length:20,size:9,thickness:1,position:'br'};
function check(name,work){work();passed++;console.log('PASS '+name);}
function rejects(reason,work){assert.throws(work,error=>error.code==='scale-geometry'&&error.reason===reason);}
check('public H&E known 1280x960 dimensions: meet content width, not 600-unit letterbox',()=>{
 const img=image(),before=img.getAttribute('href'),g=Scale.geometry(img,config);near(g.fullWidth,453.3333333333333);near(g.x,73.33333333333334);near(g.w,g.fullWidth);near(g.h,340);near(g.len,90.66666666666666);near(g.left+g.boxW+g.pad,g.x+g.w);assert.equal(img.getAttribute('href'),before);assert.deepEqual(config,{calibration:100,length:20,size:9,thickness:1,position:'br'});
});
check('slice retains full source calibration but places inside the actual crop',()=>{
 const g=Scale.geometry(image(1000,500,{width:'300',height:'300',preserveAspectRatio:'xMidYMid slice'}),{...config,length:10});near(g.fullWidth,600);near(g.x,0);near(g.y,0);near(g.w,300);near(g.h,300);near(g.len,60);assert.ok(g.left>=g.x&&g.left+g.boxW<=g.x+g.w);rejects('overflow',()=>Scale.geometry(image(1000,500,{width:'300',height:'300',preserveAspectRatio:'xMidYMid slice'}),{...config,length:60}));
});
check('none uses actual horizontal pixel mapping without imposing square pixels',()=>{
 const g=Scale.geometry(image(1280,960,{preserveAspectRatio:'none'}),config);near(g.fullWidth,600);near(g.w,600);near(g.h,340);near(g.len,120);
});
check('all preserveAspectRatio alignments use visible source content',()=>{
 for(const align of ['xMinYMin','xMidYMid','xMaxYMax']){
  const factor=align.startsWith('xMin')?0:align.startsWith('xMid')?.5:1;
  const g=Scale.geometry(image(1280,960,{preserveAspectRatio:align+' meet'}),config);near(g.x,(600-g.w)*factor);near(g.len,90.66666666666666);
  const vertical=Scale.geometry(image(1280,960,{width:'400',height:'600',preserveAspectRatio:align+' meet'}),config);near(vertical.y,(600-300)*factor);near(vertical.len,80);
 }
});
check('flips, nonuniform scale and translation preserve full-source length and same-parent placement',()=>{
 const matrix={a:-2,b:0,c:0,d:-1.5,e:1500,f:800},g=Scale.geometry(image(),config,{unit:2,matrix,api:Insets});near(g.fullWidth,906.6666666666666);near(g.len,181.33333333333331);near(g.x,446.66666666666674);near(g.y,290);near(g.w,906.6666666666666);near(g.h,510);near(g.size,18);near(g.thick,2);near(g.left+g.boxW+g.pad,g.x+g.w);
});
check('percentage positions and physical SVG image lengths reuse the existing parser',()=>{
 const img=image(1000,500,{x:'10%',y:'10%',width:'50%',height:'50%',preserveAspectRatio:'none'}),g=Scale.geometry(img,config);near(g.x,90);near(g.y,60);near(g.w,450);near(g.h,300);near(g.len,90);
 const physical=Scale.geometry(image(1000,500,{width:'300pt',height:'150pt',preserveAspectRatio:'none'}),config);near(physical.fullWidth,400);near(physical.len,80);
});
check('unknown/invalid source pixels are refused without falling back to viewport width',()=>{
 for(const href of ['', 'https://example.invalid/private.png','data:image/svg+xml;base64,PHN2Zy8+','data:image/png;base64,AAAA'])rejects('source',()=>Scale.geometry(image(1280,960,{href}),config));
 const noSource=image();noSource.removeAttribute('href');rejects('source',()=>Scale.geometry(noSource,config));
});
check('extra masks and clips are refused on the image and ancestors',()=>{
 for(const field of ['clip-path','mask']){rejects('clip',()=>Scale.geometry(image(1280,960,{[field]:'url(#unknown)'}),config));rejects('clip',()=>Scale.geometry(image(1280,960,{}, {[field]:'url(#unknown)'}),config));const img=image();img.style.setProperty(field,'url(#css-clip)');rejects('clip',()=>Scale.geometry(img,config));}
 assert.ok(Scale.geometry(image(1280,960,{'clip-path':'none',mask:'none'}),config));
});
check('rotation, skew, degenerate transforms and CSS image geometry are refused',()=>{
 for(const matrix of [{a:1,b:.1,c:0,d:1,e:0,f:0},{a:1,b:0,c:.1,d:1,e:0,f:0},{a:0,b:0,c:0,d:1,e:0,f:0},{a:1,b:0,c:0,d:1,e:NaN,f:0}])rejects('transform',()=>Scale.geometry(image(),config,{matrix}));
 const img=image();img.style.setProperty('width','400px');rejects('transform',()=>Scale.geometry(img,config));
 rejects('transform',()=>Scale.geometry(image(1280,960,{transform:'scale(2)'}),config));
});
check('overflow does not shorten requested bar or alter its label/calibration',()=>{
 const cfg={...config,length:80};rejects('overflow',()=>Scale.geometry(image(1000,500,{width:'100',height:'100',preserveAspectRatio:'xMidYMid slice'}),cfg));assert.equal(cfg.length,80);assert.equal(cfg.calibration,100);
 rejects('overflow',()=>Scale.geometry(image(1000,500,{width:'200',height:'30'}),config));
 for(const value of [{...config,calibration:0},{...config,length:-1},{...config,length:81},{...config,size:NaN},{...config,position:'center'}])rejects('parameters',()=>Scale.geometry(image(),value));
});
console.log(`PASS ${passed} scale geometry groups; synthetic dimension headers only, no photo decoding or scientific image accuracy claim.`);
