'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path='../skills/polish-sci-figures/assets/figure-studio/i18n.js',i18n=require(path),copy=x=>JSON.parse(JSON.stringify(x));
const panel={id:'panel-1',name:'示例柱形',name_i18n:{'zh-CN':'示例柱形',en:'Example bars'},provenance:'local-recomputed'};
i18n.validateDisplayNames(panel);assert.equal(panel.name_i18n_base,panel.name);
i18n.setLanguage('en');assert.equal(i18n.panelName(panel),'Example bars');
i18n.setLanguage('zh-CN');assert.equal(i18n.panelName(panel),'示例柱形');
const renamed={...copy(panel),name:'My own experiment'};i18n.setLanguage('en');assert.equal(i18n.panelName(renamed),'My own experiment');i18n.setLanguage('zh-CN');assert.equal(i18n.panelName(renamed),'My own experiment');
for(const p of [{name:'用户图'},{name:'independent',provenance:'user-import',recipe:{design:'independent'}},{name:'独立样本比较',provenance:'local-recomputed',recipe:{design:'independent'}}]){const before=p.name;i18n.setLanguage('en');assert.equal(i18n.panelName(p),before);}
for(const names of [null,[],{}, {fr:'Test'}, {en:''}, {en:'x'.repeat(501)}, {en:4}])assert.throws(()=>i18n.validateDisplayNames({name:'a',name_i18n:names}),/显示名称/);
const partial={name:'Example',name_i18n:{en:'Example'}};i18n.validateDisplayNames(partial);i18n.setLanguage('zh-CN');assert.equal(i18n.panelName(partial),'Example');
const title={title:'编辑示例',title_i18n:{'zh-CN':'编辑示例',en:'Editing example'}};i18n.validateDisplayNames(title,'title');i18n.setLanguage('en');assert.equal(i18n.projectTitle(title),'Editing example');title.title='My project';assert.equal(i18n.projectTitle(title),'My project');
const target={name:panel.name,variants:[{name:'new'}]},original=JSON.stringify(panel);i18n.preserveDisplayNames(target,panel);assert.deepEqual(target.name_i18n,panel.name_i18n);target.name_i18n.en='Changed';assert.equal(JSON.stringify(panel),original,'asset metadata is copied, not aliased');
const imported={name:'new-image.png'};i18n.preserveDisplayNames(imported,panel);assert.equal(imported.name_i18n,undefined);
const factory={id:'project',title:'编辑示例',title_i18n:{'zh-CN':'编辑示例',en:'Editing example'},panels:[copy(panel)]};i18n.validateDisplayNames(factory,'title');
const saved={id:'project',title:factory.title,panels:[{id:panel.id,name:panel.name,table:{rows:[['real'],[13]]}}]},rows=JSON.stringify(saved.panels[0].table);
i18n.restoreDisplayNames(saved,factory);assert.equal(i18n.panelName(saved.panels[0]),'Example bars');assert.equal(i18n.projectTitle(saved),'Editing example');assert.equal(JSON.stringify(saved.panels[0].table),rows);
const custom={id:'project',title:'User project',panels:[{id:panel.id,name:'User panel'}]};i18n.restoreDisplayNames(custom,factory);assert.equal(custom.title_i18n,undefined);assert.equal(custom.panels[0].name_i18n,undefined);
const foreign={...copy(saved),id:'foreign'};delete foreign.panels[0].name_i18n;i18n.restoreDisplayNames(foreign,factory);assert.equal(foreign.panels[0].name_i18n,undefined);
const generated=copy(factory);generated.panels[0].recipe={family:'gallery',parameters:{view:'compare_bar_points'}};
const revised={id:'project',title:'User project',panels:[{id:'panel-9',name:panel.name,recipe:{family:'gallery',parameters:{view:'compare_bar_points'},axis_settings:{y_min:-40}}}]};
i18n.restoreDisplayNames(revised,generated);assert.equal(revised.panels[0].name_i18n.en,'Example bars');
const mismatched=copy(revised);delete mismatched.panels[0].name_i18n;mismatched.panels[0].recipe.parameters.view='compare_box_points';i18n.restoreDisplayNames(mismatched,generated);assert.equal(mismatched.panels[0].name_i18n,undefined);
const ambiguous=copy(generated);ambiguous.panels.push({...copy(generated.panels[0]),id:'panel-20'});const unmatched=copy(revised);delete unmatched.panels[0].name_i18n;i18n.restoreDisplayNames(unmatched,ambiguous);assert.equal(unmatched.panels[0].name_i18n,undefined);
// Existing generated identifiers and gallery contract names remain bilingual.
const ctx={module:{exports:{}},StudioGalleryContracts:{compare_raincloud:{'zh-CN':['雨云图'],en:['Raincloud plot']}},StudioDiscovery:{roc_band:{'zh-CN':['ROC 置信带'],en:['ROC confidence band']}}};vm.runInNewContext(fs.readFileSync(require.resolve(path),'utf8'),ctx);const I=ctx.module.exports;
I.setLanguage('zh-CN');assert.equal(I.panelName({name:'independent',provenance:'upstream-bundle',recipe:{design:'independent'}}),'独立样本比较');assert.equal(I.panelName({name:'compare_raincloud',provenance:'synthetic-template'}),'雨云图');
I.setLanguage('en');assert.equal(I.panelName({name:'compare_raincloud',provenance:'synthetic-template'}),'Raincloud plot');assert.equal(I.panelName({name:'roc_band',provenance:'synthetic-template'}),'ROC confidence band');
// Structure prevents long English labels from increasing the column minimum.
const css=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.css','utf8');assert.match(css,/#masters\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/\.master span\{[^}]*white-space:normal;[^}]*overflow-wrap:anywhere/);assert.match(css,/\.master svg\{flex:none;/);
console.log('PASS explicit bilingual panel/project names, bounded metadata, custom-name preservation, asset copies, exact autosave migration and wrapping master CSS. Actual 150% browser geometry is checked separately.');
