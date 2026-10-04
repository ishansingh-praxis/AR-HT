import assert from 'node:assert/strict';
import fs from 'node:fs';
import { designPlan, planSvg } from '../src/plan/planSvg.mjs';
import { shareMessage, slugFromLink, withUtm } from '../src/utils/links.ts';

const catalogue = JSON.parse(fs.readFileSync('src/data/catalogue.json', 'utf8'));
const rooms = JSON.parse(fs.readFileSync('src/data/rooms.json', 'utf8'));
const byId = new Map<string, any>(catalogue.map((p: any) => [p.id, p]));

// ---- planSvg: one curated room, checked against a stored snapshot (delete the file to re-record after an intentional change) ----
const room = rooms[0];
const svg = planSvg({
  roomCm: room.roomCm, width: 360, title: `Plan of ${room.title}`,
  pieces: room.pieces.map((pc: any) => { const p = byId.get(pc.productId); return { x: pc.x, z: pc.z, rot: pc.rot, w: p.dimensionsCm.w, d: p.dimensionsCm.d, fill: p.colors?.[0]?.hex, label: String(p.role).replace('-', ' ') }; }),
});
const snap = new URL('./snapshots/plan-room0.svg', import.meta.url);
if (!fs.existsSync(snap)) { fs.mkdirSync(new URL('./snapshots/', import.meta.url), { recursive: true }); fs.writeFileSync(snap, svg); console.log('recorded plan snapshot'); }
assert.equal(svg, fs.readFileSync(snap, 'utf8'), 'plan drawing changed: if intentional, delete scripts/snapshots/plan-room0.svg and re-run');
assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
assert.equal((svg.match(/<g transform/g) ?? []).length, room.pieces.length, 'one group per piece');
assert.match(svg, /aria-label="Plan of /);

// ---- same input -> same output; escaping ----
assert.equal(planSvg({ roomCm: { w: 300, d: 200 }, pieces: [] }), planSvg({ roomCm: { w: 300, d: 200 }, pieces: [] }));
assert.ok(!planSvg({ roomCm: { w: 300, d: 200 }, pieces: [{ x: 50, z: 50, rot: 0, w: 100, d: 60, label: '<img onerror=1>' }], title: '"><script>' }).includes('<script>'));

// ---- designPlan: offsets in metres from the first piece -> a room that contains every piece ----
const sofa = catalogue.find((p: any) => p.role === 'sofa' && !p.sizeReview);
const items = [
  { productId: sofa.id, offset: [0, 0, 0] as [number, number, number], rotationY: 0, scale: 1 },
  { productId: sofa.id, offset: [3, 0, 1] as [number, number, number], rotationY: 90, scale: 1 },
];
const plan = designPlan(items, (id) => byId.get(id));
assert.equal(plan.pieces.length, 2);
for (const pc of plan.pieces) {
  const a = (pc.rot * Math.PI) / 180;
  const ex = Math.abs(Math.cos(a)) * pc.w / 2 + Math.abs(Math.sin(a)) * pc.d / 2, ez = Math.abs(Math.sin(a)) * pc.w / 2 + Math.abs(Math.cos(a)) * pc.d / 2;
  assert.ok(pc.x - ex >= -0.5 && pc.x + ex <= plan.roomCm.w + 0.5 && pc.z - ez >= -0.5 && pc.z + ez <= plan.roomCm.d + 0.5, 'piece inside the plan room');
}
assert.ok(Math.abs((plan.pieces[1].x - plan.pieces[0].x) - 300) < 0.01 && Math.abs((plan.pieces[1].z - plan.pieces[0].z) - 100) < 0.01, 'spacing preserved in cm');
assert.deepEqual(designPlan([], () => undefined).pieces, []);
assert.equal(designPlan(items, (id) => byId.get(id), { w: 2000, d: 2000 }).roomCm.w, 2000, 'a bigger scanned room is used');

// ---- links ----
assert.equal(withUtm('https://www.hometown.in/p/x?color=red', 'item'), 'https://www.hometown.in/p/x?color=red&utm_source=hometown-ar&utm_medium=app&utm_campaign=item');
assert.equal(withUtm('not a url', 'item'), 'not a url');
assert.equal(slugFromLink('https://share.hometown.in/d/abcdefghjk'), 'abcdefghjk');
assert.equal(slugFromLink('hometownar://d/abcdefghjk'), 'abcdefghjk');
assert.equal(slugFromLink('https://share.hometown.in/x/abcdefghjk'), null);
assert.equal(shareMessage({ name: 'Den', pieceNames: ['A'], url: 'https://x/d/abc' }), 'See my room plan: https://x/d/abc');
assert.equal(shareMessage({ name: 'Den', roomType: 'Living room', pieceNames: ['Sofa', 'Sofa', 'Rug'] }), 'Den (Living room)\n• Sofa × 2\n• Rug\nDesigned with HomeTown AR');

console.log('plan + link tests passed');
