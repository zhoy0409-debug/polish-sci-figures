/* JSON stdin adapter. The browser and CLI share the production rule module. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const assets=path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio');
try {
 const input=JSON.parse(fs.readFileSync(0,'utf8').replace(/^\uFEFF/,''));
 const result=require(path.join(assets,'research-discovery.js')).discover(input,JSON.parse(fs.readFileSync(path.join(assets,'chart-knowledge.json'),'utf8')));
 process.stdout.write(JSON.stringify(result));
}catch{process.stderr.write('Invalid discovery input; inspect the local table and declarations.\n');process.exitCode=2;}
