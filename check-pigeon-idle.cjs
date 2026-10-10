const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('portfolio.js', 'utf8');
let random = .5, played = 0, timerId = 0;
const timers = new Map(), events = {};
const pigeon = {loaded: true, duration: 2, currentTime: 0, paused: true,
  availableAnimations: ['Blink','Peck','HeadTilt','LookAround','Breathing'],
  pause() { this.paused = true; },
  play(options) { assert.equal(options.repetitions, this.animationName === 'Breathing' ? Infinity : 1); this.paused = false; played++; },
  addEventListener(name, fn) { events[name] = fn; }, updateComplete: Promise.resolve()};
let clipName = 'Blink', clipTime = 0, seekCount = 0;
Object.defineProperties(pigeon, {
  animationName: {get: () => clipName, set(name) {
    if (name !== clipName && pigeon.paused) clipTime = 0;
    clipName = name;
  }},
  currentTime: {get: () => clipTime, set(time) { seekCount++; clipTime = time; }}
});
const document = {body: {dataset: {page: 'menu'}}, hidden: false, addEventListener() {}};
const reducedMotion = {matches: false, addEventListener() {}};
const context = {pigeon, document, reducedMotion, Math: {random: () => random},
  clearTimeout(id) { timers.delete(id); },
  setTimeout(fn, delay) { const id = ++timerId; timers.set(id, {fn, delay}); return id; }};
vm.runInNewContext(source.slice(source.indexOf('  let idleTimer;'), source.indexOf('  const modelReady')), context);
async function runSelection() {
  assert.equal(timers.size, 1);
  const [id, timer] = [...timers][0]; timers.delete(id);
  assert.ok(timer.delay >= 3000 && timer.delay <= 7000);
  await timer.fn();
}
(async () => {
  const counts = {default: 0, Blink: 0, Peck: 0, HeadTilt: 0, LookAround: 0};
  for (let i = 0; i < 10000; i++) counts[context.chooseMenuMotion((i+.5)/10000) || 'default']++;
  assert.deepEqual(counts, {default: 3200, Blink: 1700, Peck: 1700, HeadTilt: 1700, LookAround: 1700});
  await context.scheduleIdle();
  for (const [value,name] of [[.4,'Blink'],[.6,'Peck'],[.75,'HeadTilt'],[.9,'LookAround']]) {
    random = value;
    const seeksBeforeTransition = seekCount;
    await runSelection(); assert.equal(pigeon.animationName,name);
    assert.equal(seekCount, seeksBeforeTransition, 'Crossfades must not reset the mixer clock');
    // No timer may interrupt even a slow action; only its finished event advances.
    assert.equal(timers.size,0);
    pigeon.currentTime = pigeon.duration-.01;
    await Promise.resolve(); assert.equal(pigeon.animationName,name); assert.equal(timers.size,0);
    pigeon.currentTime = pigeon.duration; pigeon.paused = true;
    await events.finished();
    assert.equal(pigeon.animationName,'Breathing'); assert.equal(pigeon.currentTime,0);
    assert.equal(timers.size,1);
    const before = played; await events.finished(); assert.equal(played,before);
  }
  const beforeRest = played; pigeon.currentTime = 1.5; random = .1;
  await runSelection(); assert.equal(played,beforeRest); assert.equal(pigeon.currentTime,1.5);
  document.body.dataset.page='home'; await context.scheduleIdle(); await runSelection();
  assert.equal(pigeon.animationName,'Blink'); assert.equal(timers.size,0);
  await events.finished(); assert.equal(timers.size,1);
  document.body.dataset.page='menu'; await context.scheduleIdle(); random=.9; await runSelection();
  document.body.dataset.page='about'; await context.scheduleIdle();
  const cancelled = played; await events.finished(); assert.equal(played,cancelled); assert.equal(timers.size,0);
  assert.equal(pigeon.currentTime,0);
  document.body.dataset.page='menu'; document.hidden=true; await context.scheduleIdle(); assert.equal(timers.size,0);
  document.hidden=false; reducedMotion.matches=true; await context.scheduleIdle(); assert.equal(timers.size,0);
  reducedMotion.matches=false; await context.scheduleIdle();
  const running=runSelection(); document.body.dataset.page='about'; await context.scheduleIdle();
  const before=played; await running; assert.equal(played,before);
  const b = fs.readFileSync('assets/pigeon-idle.glb');
  assert.equal(b.readUInt32LE(8), b.length);
  const g = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)));
  assert.deepEqual(g.animations.map(a => a.name), ['Blink','Peck','HeadTilt','LookAround','Breathing']);
  const peck = g.animations.find(a => a.name === 'Peck');
  const targets = peck.channels.map(c => g.nodes[c.target.node].name);
  assert.ok(!targets.includes('SmartRigArmature') && !targets.includes('Bone_001'));
  assert.equal(targets.filter(name => name.includes('eyelid_')).length, 4);
  assert.equal(g.nodes[g.animations.find(a => a.name === 'HeadTilt').channels[0].target.node].name, 'Bone_008');
  const attrs = g.meshes[0].primitives[0].attributes;
  function read(index, row, component) {
    const a = g.accessors[index], v = g.bufferViews[a.bufferView];
    const size = a.type === 'VEC3' ? 3 : 4, bytes = a.componentType === 5121 ? 1 : 4;
    return b[bytes === 1 ? 'readUInt8' : 'readFloatLE'](28+b.readUInt32LE(12)+v.byteOffset+row*size*bytes+component*bytes);
  }
  for (let i=0;i<g.accessors[attrs.POSITION].count;i++) {
    const y = read(attrs.POSITION,i,1), z = read(attrs.POSITION,i,2);
    if (y <= .18 || (y >= 1.3 && z > .25)) {
      assert.equal(read(attrs.WEIGHTS_0,i,0), 1);
      const joint = g.skins[0].joints[read(attrs.JOINTS_0,i,0)];
      assert.equal(g.nodes[joint].name, y <= .18 ? 'Bone_001' : 'Bone_008');
    }
  }
  for (const clip of g.animations.slice(1)) for (const sampler of clip.samplers) {
    const accessor = g.accessors[sampler.output]; const view = g.bufferViews[accessor.bufferView];
    const offset = 28 + b.readUInt32LE(12) + view.byteOffset;
    const size = accessor.type === 'VEC3' ? 3 : 4;
    for (let c = 0; c < size; c++) assert.equal(b.readFloatLE(offset + c * 4), b.readFloatLE(offset + (accessor.count - 1) * size * 4 + c * 4));
  }
  console.log('Idle probabilities, lifecycle, cancellation and GLB rest poses: passed');
})();
