/* Shared QA-only boundary: an installed count is exact to the approved package
 * and the actual hashed Install manifest, never a historical numeric constant. */
'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function relativeFile(value){assert.equal(typeof value,'string');const file=value.replaceAll('\\','/');assert.ok(file&&!file.startsWith('/')&&!file.includes(':')&&!file.includes('\0')&&file.split('/').every(v=>v&&v!=='.'&&v!=='..'),'Packaged manifest entries must be relative owned file names');return file;}
function installedManifestBoundary(bytes,stateVerification,packageProof,setupHash){
 assert.equal(stateVerification.everyPackagedFileMatches,true);assert.equal(packageProof.portableTree.status,'PASS');for(const key of ['fileSetExact','allSizesExact','allStreamSha256Exact'])assert.equal(packageProof.portableTree[key],true,'Complete package file proof is required: '+key);const expected=packageProof.portableTree.applicationFiles;assert.ok(Number.isSafeInteger(expected)&&expected>0,'Approved package must explicitly identify its exact application file count');assert.equal(stateVerification.fileCount,expected,'Installed count differs from the approved exact package count');assert.ok(packageProof.artifacts.some(v=>v.name.endsWith('-Setup-x64.exe')&&v.sha256===setupHash),'Approved package proof must identify the same original Setup');const manifestSha256=sha(bytes);assert.equal(manifestSha256,stateVerification.manifestSha256,'Actual Install manifest bytes differ from the installed state');const entries=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));assert.ok(Array.isArray(entries));assert.equal(entries.length,expected,'Actual Install manifest count differs from the approved exact package count');const byFile=new Map();
 for(const entry of entries){const file=relativeFile(entry.file);assert.match(entry.sha256,/^[a-f0-9]{64}$/);assert.ok(!byFile.has(file.toLowerCase()),'Installed manifest must not contain duplicate paths');byFile.set(file.toLowerCase(),{...entry,file});}
 return{entries,byFile,manifestSha256,applicationFiles:expected};
}
module.exports={relativeFile,installedManifestBoundary};
