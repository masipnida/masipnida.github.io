// Run: node check-portfolio.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('portfolio-content.js', 'utf8'), context);
const content = context.window.PORTFOLIO_CONTENT;
assert.deepEqual(Object.keys(content), ['about', 'stack', 'work', 'history']);
assert.match(content.about, /소규모 프로젝트부터 공모전 출품작까지/);
assert.match(content.stack, /CS Foundations/);
for (const title of ['Mocozi', 'WBOND', 'Horang Print Studio', 'REALThon 2025']) {
  assert.ok(content.work.includes(title), `Missing project: ${title}`);
}
for (const id of ['experience', 'education', 'activities', 'awards']) {
  assert.ok(content.history.includes(`id="${id}"`), `Missing history: ${id}`);
}
const model = fs.readFileSync('assets/pigeon-idle.glb');
assert.equal(model.toString('ascii', 0, 4), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.equal(model.readUInt32LE(8), model.length);
assert.ok(fs.existsSync('vendor/model-viewer.min.js'));
assert.match(fs.readFileSync('index.html', 'utf8'), /<model-viewer[^>]+src="assets\/pigeon-idle\.glb(?:\?v=[a-z0-9-]+)?"/);
assert.ok(!fs.readFileSync('index.html', 'utf8').includes('<header'));
console.log('Content preservation, GLB asset, and header removal: passed.');
