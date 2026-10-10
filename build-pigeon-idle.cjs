// Preserve the supplied model and append head/neck motions to a derived GLB.
const fs = require('node:fs');
const source = fs.readFileSync('assets/pigeon-eyelids.glb');
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength));
const chunks = [source.subarray(28 + jsonLength)];
let length = chunks[0].length;
const identity = [0, 0, 0, 1];
const multiply = ([x,y,z,w], [a,b,c,d]) => [w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];
const parents = new Map();
gltf.nodes.forEach((node, i) => node.children?.forEach(child => parents.set(child, i)));
function worldRotation(i) {
  if (i === undefined) return identity;
  return multiply(worldRotation(parents.get(i)), gltf.nodes[i].rotation || identity);
}
function readAccessor(index) {
  const a = gltf.accessors[index], v = gltf.bufferViews[a.bufferView];
  const size = {SCALAR: 1, VEC3: 3, VEC4: 4}[a.type];
  const bytes = a.componentType === 5121 ? 1 : 4;
  return Array.from({length: a.count}, (_,i) => Array.from({length: size}, (_,c) =>
    chunks[0][bytes === 1 ? 'readUInt8' : 'readFloatLE']((v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || size * bytes) + c * bytes)));
}
// The auto-rig spreads the eyes across several bones. Bind the whole head rigidly
// to its shared parent, and blend only at the neck; keep foot vertices on the pelvis.
const attributes = gltf.meshes[0].primitives[0].attributes;
const positions = readAccessor(attributes.POSITION);
const joints = readAccessor(attributes.JOINTS_0);
const weights = readAccessor(attributes.WEIGHTS_0);
const headJoint = gltf.skins[0].joints.indexOf(gltf.nodes.findIndex(n => n.name === 'Bone_008'));
const pelvisJoint = gltf.skins[0].joints.indexOf(gltf.nodes.findIndex(n => n.name === 'Bone_001'));
positions.forEach(([x,y,z], i) => {
  const head = z > .25 ? Math.max(0, Math.min(1, (y - 1.16) / .14)) : 0;
  const foot = Math.max(0, Math.min(1, (.28 - y) / .1));
  const blend = Math.max(head, foot);
  if (!blend) return;
  const target = head > foot ? headJoint : pelvisJoint;
  const combined = new Map([[target, blend]]);
  joints[i].forEach((joint,c) => combined.set(joint, (combined.get(joint) || 0) + weights[i][c] * (1-blend)));
  const entries = [...combined].sort((a,b) => b[1]-a[1]).slice(0,4);
  const total = entries.reduce((sum,entry) => sum+entry[1],0);
  const ja = gltf.accessors[attributes.JOINTS_0], wa = gltf.accessors[attributes.WEIGHTS_0];
  const jv = gltf.bufferViews[ja.bufferView], wv = gltf.bufferViews[wa.bufferView];
  for (let c=0;c<4;c++) {
    chunks[0].writeUInt8(entries[c]?.[0] || 0, jv.byteOffset + i*4+c);
    chunks[0].writeFloatLE((entries[c]?.[1] || 0)/total, wv.byteOffset+i*16+c*4);
  }
});
function accessor(values, type) {
  const data = Buffer.alloc(values.length * 4);
  values.forEach((value, i) => data.writeFloatLE(value, i * 4));
  const view = gltf.bufferViews.push({buffer: 0, byteOffset: length, byteLength: data.length}) - 1;
  chunks.push(data); length += data.length;
  return gltf.accessors.push({bufferView: view, componentType: 5126, count: values.length / ({VEC4: 4, VEC3: 3}[type] || 1), type,
    ...(type === 'SCALAR' ? {min: [Math.min(...values)], max: [Math.max(...values)]} : {})}) - 1;
}
function clip(name, times, tracks) {
  const input = accessor(times, 'SCALAR');
  const animation = {name, samplers: [], channels: []};
  for (const [bone, axis, degrees] of tracks) {
    const node = gltf.nodes.findIndex(n => n.name === bone);
    if (node < 0) throw Error(`Missing ${bone}`);
    const parent = worldRotation(parents.get(node));
    const inverse = [-parent[0], -parent[1], -parent[2], parent[3]];
    const rest = gltf.nodes[node].rotation || identity;
    const rotations = degrees.flatMap(degree => {
      const half = degree * Math.PI / 360;
      const delta = [...axis.map(v => v * Math.sin(half)), Math.cos(half)];
      const q = multiply(multiply(multiply(inverse, delta), parent), rest);
      const norm = Math.hypot(...q);
      return q.map(v => v / norm);
    });
    animation.channels.push({sampler: animation.samplers.length, target: {node, path: 'rotation'}});
    animation.samplers.push({input, output: accessor(rotations, 'VEC4'), interpolation: 'LINEAR'});
  }
  gltf.animations.push(animation);
}
function translate(animation, bone, offsets) {
  const node = gltf.nodes.findIndex(n => n.name === bone);
  const parent = worldRotation(parents.get(node));
  const inverse = [-parent[0], -parent[1], -parent[2], parent[3]];
  const values = offsets.flatMap(offset => {
    const delta = multiply(multiply(inverse, [...offset,0]), parent);
    return gltf.nodes[node].translation.map((v,c) => v + delta[c]);
  });
  animation.channels.push({sampler: animation.samplers.length, target: {node, path: 'translation'}});
  animation.samplers.push({input: animation.samplers[0].input, output: accessor(values, 'VEC3'), interpolation: 'LINEAR'});
}
clip('Peck', [0, .25, .55, .68, .8, .96, 1.15, 1.7], [
  ['Bone_011', [1,0,0], [0,5,26,35,27,34,18,0]],
  ['Bone_010', [1,0,0], [0,2,8,12,8,11,4,0]],
  ['Bone_008', [1,0,0], [0,3,8,12,6,11,4,0]]
]);
const peck = gltf.animations.at(-1);
const reach = [0,.35,.85,1,.8,.95,.5,0];
translate(peck, 'Bone_008', reach.map(amount => [0,-.06*amount,.32*amount]));
// Raise the rear body slightly without moving the pelvis-bound feet.
translate(peck, 'Bone_016', reach.map(amount => [0,.045*amount,0]));
// Reuse the supplied Blink's closed-eye pose while the bird reaches and pecks.
for (const channel of gltf.animations.find(a => a.name === 'Blink').channels) {
  const blink = gltf.animations[0].samplers[channel.sampler];
  const frames = readAccessor(blink.output);
  const open = frames[0], closed = frames[Math.floor(frames.length / 2)];
  peck.channels.push({sampler: peck.samplers.length, target: channel.target});
  peck.samplers.push({input: peck.samplers[0].input, interpolation: 'LINEAR',
    output: accessor([open,closed,closed,closed,closed,closed,closed,open].flat(), 'VEC4')});
}
clip('HeadTilt', [0,.3,.6,1,1.35,1.65,2], [
  ['Bone_008', [0,0,1], [0,-10,-18,-18,8,8,0]]
]);
clip('LookAround', [0,.35,.7,1.1,1.55,1.9,2.3,2.7], [
  ['Bone_008', [0,1,0], [0,-12,-24,-24,12,26,26,0]]
]);
const breathTimes = Array.from({length: 25}, (_,i) => i / 6);
const breath = breathTimes.map(t => (1-Math.cos(t*Math.PI/2))/2);
clip('Breathing', breathTimes, [
  ['Bone_011', [1,0,0], breath.map(amount => -.8*amount)]
]);
translate(gltf.animations.at(-1), 'Bone_011', breath.map(amount => [0,.012*amount,0]));
gltf.buffers[0].byteLength = length;
const json = Buffer.from(JSON.stringify(gltf));
const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 32); json.copy(padded);
const header = Buffer.alloc(20); header.write('glTF'); header.writeUInt32LE(2,4);
header.writeUInt32LE(28 + padded.length + length,8); header.writeUInt32LE(padded.length,12); header.writeUInt32LE(0x4e4f534a,16);
const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(length); binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync('assets/pigeon-idle.glb', Buffer.concat([header,padded,binHeader,...chunks]));
console.log('Built pigeon-idle.glb: Blink, Peck, HeadTilt, LookAround, Breathing');
