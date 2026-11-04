/* Run with NODE_PATH=.cache/studio-dom/node_modules node scripts/test_studio_statistics_report_i18n.cjs. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {JSDOM} = require('jsdom');
const i18n = require('../skills/polish-sci-figures/assets/figure-studio/i18n.js');
const source = fs.readFileSync(path.join(__dirname, '../skills/polish-sci-figures/assets/figure-studio/studio.js'), 'utf8');
const start = source.indexOf('  function statisticsReport(');
const end = source.indexOf('  function statisticsInvalidate(', start);
assert.ok(start >= 0 && end > start);
const record = {binding:'current', data_sha256:'synthetic', config:{}, analysis:{correction:'holm', primary_test:{name:'Synthetic test', pairwise:[{
  group_a:'中文前组', group_b:'中文后组', n_a:12, n_b:13, statistic:1.23456789,
  degrees_of_freedom:23, estimand:'mean_difference', estimate:2.34567891,
  descriptive_median_difference:2, ci95:[1.123456789,3.987654321], p_method:'synthetic', p_raw:0, p:0
}]}}};
const original = JSON.stringify(record);
const document = new JSDOM('').window.document;
const report = vm.runInNewContext(source.slice(start,end)+'\nstatisticsReport', {document, StudioI18n:i18n, T:i18n.t});
for (const language of ['en','zh-CN']) {
  i18n.setLanguage(language);
  const output = new JSDOM(report(record,'用户图名')).window.document;
  assert.equal(output.documentElement.lang, language);
  const text = output.body.textContent;
  for (const value of ['用户图名','中文后组 − 中文前组','12 / 13','1.23457','2.34568','23','mean_difference']) assert.ok(text.includes(value), value);
  assert.deepEqual(JSON.parse(output.querySelector('pre').textContent), record);
  if (language === 'en') {
    for (const value of ['Comparisons','Sample size (first / second)','Statistic','Degrees of freedom','Estimand','Estimate','Descriptive median difference','Calculation method','Raw P value','Adjusted P value','1.12346 to 3.98765','Full analysis and provenance','For a reported P of zero']) assert.ok(text.includes(value), value);
    assert.ok(!text.includes('本机计算或导入'));
  } else {
    for (const value of ['比较结果','统计量','自由度','估计值','原始 P 值','校正后 P 值','1.12346 至 3.98765','完整分析与来源记录','遇到 P = 0']) assert.ok(text.includes(value), value);
  }
}
assert.equal(JSON.stringify(record), original, 'report localization must not alter analysis data');
console.log('Statistical report bilingual rendering, columns, precision and provenance passed');
