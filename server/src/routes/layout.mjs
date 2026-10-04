import { Router } from 'express';
import { layoutRequest } from '../schemas.mjs';
import { err, productFromRow } from '../lib/http.mjs';

const SIDES = ['front', 'left', 'right', 'back'];

// AI layout suggestions. The model only ever sees catalogue ids we send it, and its answer is validated: unknown ids,
// bad sides and pieces too big for the room are dropped. Signed-in users only, so the API key can't be used anonymously.
export function layoutRouter({ db, auth, filesBase, anthropicKey, layoutModel, layoutLimits, fetchImpl }) {
  const r = Router();
  const hits = new Map(); // userId -> request timestamps (in memory; fine for one server process)
  const limit = (req, _res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.user.id) ?? []).filter((t) => now - t < 86_400_000);
    if (recent.length >= layoutLimits.perDay) throw err(429, 'You have used the daily AI layout suggestions. Try again tomorrow, or use a starter layout.');
    if (recent.filter((t) => now - t < 60_000).length >= layoutLimits.perMinute) throw err(429, 'Too many suggestions in a row. Wait a minute and try again.');
    hits.set(req.user.id, [...recent, now]);
    next();
  };

  r.post('/suggest', auth, limit, async (req, res) => {
    if (!anthropicKey) throw err(503, 'AI layout suggestions are not configured on this server');
    const { roomType, anchorId, room } = layoutRequest.parse(req.body);
    const all = (await db.prepare(`SELECT data FROM products ORDER BY ${db.sql.order}`).all()).map((row) => productFromRow(row, filesBase));
    const placeable = all.filter((p) => (p.model3D || p.proxy) && !p.sizeReview);
    const anchor = placeable.find((p) => p.id === anchorId);
    if (!anchor) throw err(404, 'Anchor product not found or not placeable');
    const fits = (p) => !room || (p.dimensionsCm.w * p.dimensionsCm.d) / 1e4 <= room.area * 0.4;
    const pool = placeable.filter((p) => p.id !== anchor.id && !p.demo && fits(p));
    // Keep the prompt small: at most 12 pieces per category, nearest in colour family to the anchor first.
    const by = {};
    for (const p of pool.sort((a, b) => Number(b.colorFamily === anchor.colorFamily) - Number(a.colorFamily === anchor.colorFamily))) (by[p.category] ??= []).length < 12 && by[p.category].push(p);
    const cand = Object.values(by).flat();
    const line = (p) => `${p.id} | ${p.category}${p.subcategory ? '/' + p.subcategory : ''} | ${p.dimensionsCm.w}x${p.dimensionsCm.d}x${p.dimensionsCm.h}cm | ${p.colorFamily ?? '?'} | ${p.material ?? '?'}`;
    const prompt = `Room type: ${roomType}\n${room ? `Room: ${room.area.toFixed(1)} m2, longest side ${room.maxSpan.toFixed(1)} m\n` : ''}Anchor piece (already placed, its front faces +z): ${line(anchor)}\n\nCandidates (id | category | WxDxH | colour | material):\n${cand.map(line).join('\n')}\n\nChoose 2 to 5 candidates that complete a coherent ${roomType.toLowerCase()} around the anchor: similar style/colour, sensible sizes, walkways kept clear. For each give the side of the anchor it goes on (front, left, right, back) and the gap in metres (0.05-1.2). Reply with ONLY JSON: {"slots":[{"productId":"...","side":"front","gap":0.4,"why":"short reason"}]}`;
    let text;
    try {
      const up = await fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: layoutModel, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!up.ok) throw new Error(`upstream ${up.status}`);
      text = (await up.json()).content?.find((b) => b.type === 'text')?.text ?? '';
    } catch { throw err(502, 'The layout service is unavailable. Try again, or use a starter layout.'); }
    let raw;
    try { raw = JSON.parse(text.replace(/```json|```/g, '').trim()).slots; } catch { raw = null; }
    if (!Array.isArray(raw)) throw err(502, 'The layout service returned something unusable. Try again.');
    const seen = new Set();
    const slots = raw.flatMap((s) => {
      const p = cand.find((c) => c.id === s?.productId);
      if (!p || seen.has(p.id) || !SIDES.includes(s.side)) return [];
      seen.add(p.id);
      return [{ productId: p.id, side: s.side, gap: Math.min(1.2, Math.max(0.05, Number(s.gap) || 0.3)), why: String(s.why ?? '').slice(0, 140) }];
    }).slice(0, 5);
    if (!slots.length) throw err(502, 'No usable suggestions this time. Try again.');
    res.json({ slots });
  });
  return r;
}
