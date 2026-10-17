'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=b=>createHash('sha256').update(b).digest('hex');
function main(argv){
  const a=Object.fromEntries(argv.map(v=>{const i=v.indexOf('=');assert.ok(i>2&&v.startsWith('--'));return[v.slice(2,i),v.slice(i+1)];}));
  assert.ok(a.input&&a.out);assert.ok(!fs.existsSync(a.out),'Do not overwrite earlier evidence');
  const bytes=fs.readFileSync(a.input),raw=JSON.parse(bytes),base=path.dirname(path.resolve(a.input));
  assert.equal(raw.status,'PASS');assert.equal(raw.cases.length,4);
  assert.deepEqual(raw.conditions.viewport,{width:1280,height:720});assert.equal(raw.conditions.deviceScaleFactor,1);
  const expected=new Set(['en/carbon','en/pearl','zh-CN/carbon','zh-CN/pearl']);
  assert.equal(sha(fs.readFileSync(path.join(base,'harness-captured.cjs'))),raw.harnessSha256);
  const images=[];
  const cases=raw.cases.map(c=>{
    const key=c.language+'/'+c.theme;assert.ok(expected.delete(key),'Unexpected or repeated condition');assert.equal(c.status,'PASS');
    assert.equal(c.sourceProof.byteExactOutsideDocumentedInjection,true);assert.equal(c.sourceProof.credentialsExcluded,true);
    assert.deepEqual(c.remoteRequests,[]);assert.deepEqual(c.pageErrors,[]);
    for(const k of ['discoveryMetadataAndLanguagePreserved','discoverySingleUndoRedoAndSources','literatureLockedOwnerProtected','sourceReplacementInvalidates','lockedOwnerProtected','blankWelcomePreviewCancelLifecycle','blankReplacementSingleUndoRedo'])assert.equal(c[k],true,k);
    assert.equal(c.languageBackendRenderCountDelta,0);
    for(const k of ['previousRowsCleared','oldCardsRemoved','actualFindBlocked','sameFilenameRereadRecovered'])assert.equal(c.rejectedNewSource[k],true);
    assert.equal(c.rejectedNewSource.rendererRequestsWhileRejected,0);
    for(const k of ['arrowKeydownAndKeyupPassThrough','controlZActualUndo','controlShiftZActualRedo','undoExact'])assert.equal(c.discoveryDockKeyboard[k],true);
    for(const k of ['discoveryDockEditing','literatureDockEditing']){assert.equal(c[k].inlineF2Started,true);assert.equal(c[k].escapeExact,true);assert.equal(c[k].nudgeCommits,1);assert.equal(c[k].undoStateExact,true);}
    for(const k of ['transportFailureRetainedA','applyDisabledDuringFailure','sourceDataUnchanged','singleUndoRedo','noPaperEvidenceClaim'])assert.equal(c.literature[k],true,k);
    for(const k of ['literatureAStatusContrast','literatureFailedBStatusContrast'])assert.ok(c[k].ratio>=4.5);
    const idb={};for(const k of ['baselineIdb','discoveryDraftIdb','literatureBaselineIdb','literatureDraftIdb']){assert.equal(c[k].readonly,true);assert.equal(c[k].allOtherValuesStrictDeepEqual,true);assert.ok(c[k].representationOmissions.every(v=>['project.layoutRenders','project.heatmapRenders','project.statisticalRenders'].includes(v)));idb[k]=c[k];}
    const exports={};for(const k of ['discoveryDraftExports','literatureDraftExports']){const v=c[k];assert.equal(v.pixels[0].rgbaSha256,v.pixels[1].rgbaSha256);assert.equal(v.requestedDpi,600);exports[k]={canonicalSvgSha256:v.canonicalSvgSha256,rawSvgSha256:v.rawSvgSha256,pngSha256:v.pngSha256,tiffSha256:v.tiffSha256,decoded:v.pixels.map(p=>({format:p.format,mode:p.mode,width:p.width,height:p.height,rgbaSha256:p.rgbaSha256,dpi:p.dpi})),requestedDpi:v.requestedDpi};}
    for(const name of ['discovery-draft.png','literature-A-valid.png','literature-B-failed.png','literature-draft.png']){const relative=c.language+'-'+c.theme+'/'+name,file=path.join(base,relative);assert.ok(fs.existsSync(file));images.push({condition:key,file:relative,sha256:sha(fs.readFileSync(file))});}
    return{language:c.language,theme:c.theme,status:c.status,sourceProof:c.sourceProof,version:c.version,rejectedNewSource:c.rejectedNewSource,discoveryDockKeyboard:c.discoveryDockKeyboard,discoveryDockEditing:c.discoveryDockEditing,discoveryMetadataAndLanguagePreserved:true,languageBackendRenderCountDelta:0,discoverySingleUndoRedoAndSources:true,literatureViews:c.literature.previewedViews,literatureFailureKeptScientificSvg:true,literatureFailedBDisplay:c.literatureFailedBDisplay,literatureDockEditing:c.literatureDockEditing,literatureSingleUndoRedoAndRawSources:true,literatureLockedOwnerProtected:true,sourceReplacementInvalidates:true,lockedOwnerProtected:true,blankWelcomePreviewCancelLifecycle:true,blankReplacementSingleUndoRedo:true,statusContrast:{valid:c.literatureAStatusContrast,failed:c.literatureFailedBStatusContrast},idb,exports,pageErrors:0,externalRequests:0};
  });assert.equal(expected.size,0);
  const result={schema:'figure-studio-resource-preview-public-summary/1',status:'PASS',label:raw.label,kind:raw.kind,browser:raw.browser,conditions:raw.conditions,rawReportSha256:sha(bytes),harnessSha256:raw.harnessSha256,scope:'Four actual Chrome conditions. Public Iris (150 observations) and six-row repository CSV engineering fixture. Discovery and local literature comparisons render on the editable main canvas; literature comparisons are explicitly not paper evidence. Actual Save/readonly IndexedDB/SVG/PNG/TIFF use committed state. Real local renderer transport is aborted once to test last-valid handling; no values, responses, citations or figure numbers are fabricated.',representationPolicy:'Only the three documented own undefined derived-cache keys absent from JSON Save are omitted in IDB comparison. All other scientific values, source SVG, state, history, checkpoints and data drafts remain strict deep equal. Only root CSS fit width/height are excluded from last-valid scientific SVG comparison and reported separately; all content and other root attributes/styles remain exact.',cases,images,limitations:['Functional checks use a local source runtime unless kind explicitly identifies an installed runtime.','Fixed DPR 1 and headless actual Windows Chrome; this is not physical touch or a performance benchmark.','Computed contrast is sampled only for the actual literature status box, not a whole-page accessibility certification.']};
  const text=JSON.stringify(result,null,2);assert.ok(!/\b[A-Z]:[\\/]|127\.0\.0\.1|localhost|(?:token|nonce)\s*[:=]\s*["']?[A-Za-z0-9_-]{12,}/i.test(text),'Public summary must not contain local absolute paths or credentials');
  fs.mkdirSync(path.dirname(path.resolve(a.out)),{recursive:true});fs.writeFileSync(a.out,text+'\n');
  console.log(JSON.stringify({status:'PASS',out:a.out,sha256:sha(text+'\n'),conditions:cases.length}));return result;
}
if(require.main===module)main(process.argv.slice(2));module.exports={main};
