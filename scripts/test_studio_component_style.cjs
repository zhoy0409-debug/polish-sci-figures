'use strict';
const assert=require('node:assert/strict'),api=require('../skills/polish-sci-figures/assets/figure-studio/component-style.js');
const {JSDOM}=require('jsdom'),NS='http://www.w3.org/2000/svg';let passed=0;
const test=(name,run)=>{run();passed++;console.log('PASS '+name);};
function fixture(prefix='p4-'){
  const dom=new JSDOM(`<svg xmlns="${NS}" viewBox="0 0 240 180"><defs><path id="tickY" d="M 0 0 L -3 0"/><path id="tickX" d="M 0 0 L 0 3"/><text data-role="ticks">Definition</text></defs><g id="${prefix}axes_1">
    <g id="${prefix}patch_1"><path d="M 40 20 L 200 20 L 200 140 L 40 140 Z" fill="white"/></g>
    <g id="${prefix}matplotlib.axis_1">${['Control','Treated','Rescue'].map((text,i)=>`<g id="${prefix}xtick_${i+1}"><g id="line2d_${i}"><use href="#tickX" x="${60+i*60}" y="140"/><path data-test="grid" d="M ${60+i*60} 140 L ${60+i*60} 20" stroke="#ddd"/></g><text data-test="xtick" x="${60+i*60}" y="155">${text}</text></g>`).join('')}<text data-test="x-title" x="120" y="175">Group</text></g>
    <g id="${prefix}matplotlib.axis_2">${[0,5,10].map((value,i)=>`<g id="${prefix}ytick_${i+1}"><use href="#tickY" x="40" y="${140-i*60}"/><text data-test="ytick" x="30" y="${140-i*60}">${value}<tspan baseline-shift="super">2</tspan></text></g>`).join('')}<text data-test="y-title" transform="rotate(-90)">Response</text></g>
    <g id="${prefix}patch_2"><path data-test="y-spine" d="M 40 140 L 40 20" fill="none"/></g><g id="${prefix}patch_3"><path data-test="x-spine" d="M 40 140 L 200 140" fill="none"/></g>
    <g id="${prefix}patch_4"><path data-test="data" d="M 70 130 L 130 70" fill="none"/></g>
    <g id="${prefix}line2d_20"><path data-test="data" d="M 40 140 L 200 140" fill="none"/></g>
    <g id="${prefix}legend_1"><rect width="80" height="20"/><text data-test="legend">Treatment<tspan> A</tspan></text></g>
    <text data-test="unclassified">P = 0.032</text>
  </g></svg>`,{contentType:'image/svg+xml'}),svg=dom.window.document.documentElement;
  [svg,...svg.querySelectorAll('*')].forEach((node,i)=>node.setAttribute('data-key','e'+i));return {dom,svg};
}
test('categorical and numeric axes are recognized without selecting data, grid lines or text runs',()=>{
  const f=fixture();try{const before=f.svg.outerHTML,counts=api.inspect(f.svg);assert.deepEqual(counts,{axes:8,ticks:6,axis:2,legend:1});
    assert.ok(api.targets(f.svg,'axes').every(el=>el.localName==='use'||el.dataset.test?.endsWith('spine')));assert.equal(api.targets(f.svg,'ticks').filter(el=>el.localName==='tspan').length,0);assert.equal(api.targets(f.svg,'ticks').filter(el=>el.dataset.test==='xtick').length,3);assert.equal(f.svg.outerHTML,before);
  }finally{f.dom.window.close();}
});
test('hidden components, locked ancestors and a locked child run cannot be changed indirectly',()=>{
  const f=fixture();try{const tick=f.svg.querySelector('[data-test="ytick"]'),legend=f.svg.querySelector('[data-test="legend"]');tick.parentElement.style.display='none';const locked=[legend.querySelector('tspan').dataset.key,f.svg.querySelector('[data-test="x-spine"]').parentElement.dataset.key];
    assert.deepEqual(api.inspect(f.svg,{lockedKeys:locked}),{axes:6,ticks:5,axis:2,legend:0});
    f.svg.querySelector('[data-test="y-title"]').setAttribute('opacity','0');assert.equal(api.targets(f.svg,'axis',{lockedKeys:locked}).length,1);
  }finally{f.dom.window.close();}
});
test('explicit roles work for editable SVGs while unlabelled PDF geometry remains unclassified',()=>{
  const dom=new JSDOM(`<svg xmlns="${NS}"><path data-key="e1" d="M 0 100 L 0 0"/><text data-key="e2">10</text><text data-key="e3">Y</text><g><line data-key="e4" data-role="axis-tick" x1="0" x2="3"/><text data-key="e5" data-role="axis">X<tspan data-key="e6">2</tspan></text><text data-key="e7" data-role="legend">Sample</text></g></svg>`,{contentType:'image/svg+xml'});
  try{const svg=dom.window.document.documentElement;assert.deepEqual(api.inspect(svg),{axes:1,ticks:0,axis:1,legend:1});assert.equal(api.targets(svg,'axes')[0].dataset.key,'e4');assert.deepEqual(api.targets(svg,'unknown'),[]);assert.equal(api.targets(svg,'axis',{lockedKeys:new Set(['e6'])}).length,0);}finally{dom.window.close();}
});
test('nested transforms and namespaced Matplotlib IDs preserve component association',()=>{
  const f=fixture('saved-panel-');try{const axes=f.svg.querySelector('[id$="axes_1"]');axes.setAttribute('transform','translate(5 12) rotate(18) scale(2 .6)');assert.deepEqual(api.inspect(f.svg),{axes:8,ticks:6,axis:2,legend:1});
    f.svg.querySelector('[data-test="x-spine"]').setAttribute('clip-path','url(#dataClip)');assert.equal(api.targets(f.svg,'axes').length,7,'clipped data-like line cannot be inferred as a spine');
  }finally{f.dom.window.close();}
});
test('duplicate or non-stroke marker definitions cannot identify axis ticks',()=>{
  const f=fixture();try{const definition=f.svg.querySelector('#tickY');definition.parentElement.append(definition.cloneNode(true));assert.equal(api.targets(f.svg,'axes').length,4);f.svg.querySelector('#tickX').setAttribute('d','M 0 0 L 5 0 L 5 5 Z');assert.equal(api.targets(f.svg,'axes').length,0);}finally{f.dom.window.close();}
});
if(process.argv.includes('--real')){
  const cp=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),repo=path.resolve(__dirname,'..'),python=process.env.PYTHON||[path.join(repo,'.venv/Scripts/python.exe'),path.join(repo,'.venv/bin/python')].find(fs.existsSync)||'python';
  const code=`import io,json,matplotlib\nmatplotlib.use('Agg')\nimport matplotlib.pyplot as plt\nplt.rcParams['svg.fonttype']='none'\nfig,ax=plt.subplots()\nax.bar(['Control','Treated','Rescue'],[3,6,4],label='Observations')\nax.set(xlabel='Group',ylabel='Value')\nax.grid(axis='y')\nax.legend()\nax.spines[['right','top']].set_visible(False)\ns=io.StringIO();fig.savefig(s,format='svg');print(json.dumps(s.getvalue()))`;
  test('actual Matplotlib categorical plot retains both spines, ticks and legend but excludes grid/bar marks',()=>{
    const raw=JSON.parse(cp.execFileSync(python,['-X','utf8','-c',code],{cwd:repo,encoding:'utf8',maxBuffer:4000000})),dom=new JSDOM(raw,{contentType:'image/svg+xml'}),svg=dom.window.document.documentElement;
    try{[svg,...svg.querySelectorAll('*')].forEach((node,i)=>node.setAttribute('data-key','e'+i));const axes=api.targets(svg,'axes'),tickCount=svg.querySelectorAll('g[id^="xtick_"],g[id^="ytick_"]').length;assert.equal(axes.filter(el=>el.localName==='path').length,2);assert.equal(axes.filter(el=>el.localName==='use').length,tickCount);assert.equal(api.targets(svg,'axis').length,2);assert.equal(api.targets(svg,'legend').length,1);assert.equal(api.targets(svg,'ticks').length,tickCount);}finally{dom.window.close();}
  });
}
console.log(`${passed} component style target regressions passed`);
