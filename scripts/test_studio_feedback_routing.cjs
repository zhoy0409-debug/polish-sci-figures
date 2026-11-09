/* Run with node scripts/test_studio_feedback_routing.cjs. No packages required. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/studio-feedback-routing.yml'), 'utf8');
// Exercise the literal prefix used by the production GitHub Actions condition.
const condition = workflow.match(/^    if: startsWith\(github\.event\.issue\.title, '([^']+)'\)$/m);
assert.ok(condition, 'feedback routing must use the issue title prefix');
const routes = title => title.toLowerCase().startsWith(condition[1].toLowerCase());
for (const title of ['[Figure Studio 反馈]', '[Figure Studio 反馈] ', '[Figure Studio 反馈] 导出问题', '[Figure Studio 反馈]导出问题']) {
  assert.equal(routes(title), true, `feedback must route: ${title}`);
}
for (const title of ['', '[Bug]: export', '[Figure Studio 反馈', 'Other [Figure Studio 反馈]', '[Figure Studio 反馈其他]']) {
  assert.equal(routes(title), false, `unrelated issue must not route: ${title}`);
}
assert.match(workflow, /types: \[opened\]/, 'keep routing on issue creation');
assert.match(workflow, /labels\[\]=user-feedback/, 'retain the feedback label');
console.log('Figure Studio feedback title routing passed');
