#!/usr/bin/env node
'use strict';
// This CLI deliberately cannot invent DOM identities. Element operations are
// preflighted in Studio using the editor's actual sanitizer and source snapshot.
const fs=require('node:fs'),path=require('node:path'),ops=require('../assets/figure-studio/project-operations.js'),planning=require('../assets/figure-studio/figure-planning.js'),core=require('../assets/figure-studio/studio.js');
function read(file){if(fs.statSync(file).size>200000000)throw Error('Input exceeds 200 MB');return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
async function main(){const [command,input,patchFile,output,confirmation]=process.argv.slice(2);if(!['inspect','apply','plan'].includes(command)||!input||command==='apply'&&(!patchFile||!output)||command==='plan'&&!patchFile)throw Error('Usage: node studio_operations.cjs inspect PROJECT | plan PROJECT ASSIGNMENTS | apply PROJECT PATCH NEW_OUTPUT [--confirm-scientific-change]');const payload=read(input);core.validateState(payload.state,payload.project);
 if(command==='plan'){process.stdout.write(JSON.stringify(planning.plan(await ops.inspect(payload),read(patchFile)),null,2)+'\n');return;}
 if(command==='inspect'){const result=await ops.inspect(payload);result.capabilities.operations=['panel.label.style','panel.candidate'];result.capabilities.elementStyles='Export element references and preflight in the editor';process.stdout.write(JSON.stringify(result,null,2)+'\n');return;}
 if(path.resolve(input)===path.resolve(output)||path.resolve(patchFile)===path.resolve(output))throw Error('Output must be a new file');
 const planned=await ops.preflight(payload,read(patchFile),{validValue:core.validValue,validateState:core.validateState});if(planned.requiresScientificReview&&confirmation!=='--confirm-scientific-change')throw Error('Candidate change requires explicit scientific review. Prefer editor preview or pass --confirm-scientific-change after review.');const history=payload.history?core.History.restore(payload.history,payload.project,payload.state):new core.History(payload.state);history.commit(planned.next);
 fs.writeFileSync(output,JSON.stringify({...payload,state:planned.next,history:history.toJSON()},null,2),{flag:'wx'});process.stdout.write(JSON.stringify({status:'applied',output,changes:planned.changes,originalUnchanged:true})+'\n');
}
main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=2;});
