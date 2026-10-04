import { Router } from 'express';
import { designInput, designPatch } from '../schemas.mjs';
import { err } from '../lib/http.mjs';

const EXTRA = ['roomType', 'frame', 'cloudAnchorId', 'scan'];

export function designsRouter({ db, auth, storage }) {
  const r = Router();
  const view = (d) => ({
    id: Number(d.id), ...(d.client_id ? { clientId: d.client_id } : {}), name: d.name, createdAt: Number(d.created_at), updatedAt: Number(d.updated_at),
    ...(d.thumbnail_key ? { thumbnailKey: d.thumbnail_key, thumbnailUrl: storage.publicUrl(d.thumbnail_key) } : {}), ...(d.share_slug ? { shareSlug: d.share_slug } : {}), ...JSON.parse(d.data),
  });
  const own = async (id, userId) => {
    const d = await db.prepare('SELECT * FROM designs WHERE id=? AND user_id=? AND deleted_at IS NULL').get(id, userId);
    if (!d) throw err(404, 'Design not found');
    return d;
  };
  const checkProducts = async (items) => {
    const ids = [...new Set(items.map((i) => i.productId))];
    const found = (await db.prepare(`SELECT COUNT(*) AS n FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).get(...ids)).n;
    if (Number(found) !== ids.length) throw err(400, 'Design references an unknown product');
  };
  /** A thumbnail key must be inside the user's own folder (it came from /thumbnails/upload-url). */
  const checkThumb = (key, userId) => { if (key !== undefined && !key.startsWith(`thumbnails/${userId}/`)) throw err(400, 'Invalid thumbnail key'); };
  const pickExtra = (src) => Object.fromEntries(EXTRA.filter((k) => src[k] !== undefined).map((k) => [k, src[k]]));

  // GET /designs            -> everything the user has
  // GET /designs?since=<ms> -> only what changed (and the ids deleted) since then; serverTime is the next `since`
  r.get('/', auth, async (req, res) => {
    const since = Number(req.query.since) || 0;
    const rows = await db.prepare('SELECT * FROM designs WHERE user_id=? AND updated_at>? ORDER BY id DESC').all(req.user.id, since);
    res.json({
      designs: rows.filter((d) => d.deleted_at == null).map(view),
      deleted: since ? rows.filter((d) => d.deleted_at != null).map((d) => Number(d.id)) : [],
      serverTime: Date.now(),
    });
  });

  r.post('/', auth, async (req, res) => {
    const d = designInput.parse(req.body);
    if (d.clientId) {
      const dup = await db.prepare('SELECT * FROM designs WHERE user_id=? AND client_id=?').get(req.user.id, d.clientId);
      if (dup && dup.deleted_at == null) return res.status(200).json(view(dup)); // a retry of an earlier create
      if (dup) await db.prepare('UPDATE designs SET client_id=NULL WHERE id=?').run(dup.id); // deleted earlier: the id may be reused
    }
    await checkProducts(d.items);
    checkThumb(d.thumbnailKey, req.user.id);
    const count = Number((await db.prepare('SELECT COUNT(*) AS n FROM designs WHERE user_id=? AND deleted_at IS NULL').get(req.user.id)).n);
    const name = d.name ?? `Design ${count + 1}`;
    const now = Date.now();
    const row = await db.prepare('INSERT INTO designs(user_id,name,data,created_at,updated_at,thumbnail_key,client_id) VALUES(?,?,?,?,?,?,?)')
      .run(req.user.id, name, JSON.stringify({ items: d.items, ...pickExtra(d) }), now, now, d.thumbnailKey ?? null, d.clientId ?? null);
    res.status(201).json(view(await db.prepare('SELECT * FROM designs WHERE id=?').get(row.lastInsertRowid)));
  });

  r.get('/:id', auth, async (req, res) => res.json(view(await own(req.params.id, req.user.id))));

  // Name and/or full item replacement. A stale `updatedAt` (someone else changed it) is a 409 with the current version.
  r.patch('/:id', auth, async (req, res) => {
    const body = designPatch.parse(req.body);
    const cur = await own(req.params.id, req.user.id);
    checkThumb(body.thumbnailKey, req.user.id);
    if (body.updatedAt !== undefined && body.updatedAt !== Number(cur.updated_at)) throw err(409, 'This design changed somewhere else. Reload it first.', { current: view(cur) });
    const data = JSON.parse(cur.data);
    if (body.items) { await checkProducts(body.items); data.items = body.items; }
    Object.assign(data, pickExtra(body));
    const updatedAt = Math.max(Date.now(), Number(cur.updated_at) + 1);
    await db.prepare('UPDATE designs SET name=?, data=?, thumbnail_key=?, updated_at=? WHERE id=?')
      .run(body.name ?? cur.name, JSON.stringify(data), body.thumbnailKey ?? cur.thumbnail_key, updatedAt, cur.id);
    res.json(view(await db.prepare('SELECT * FROM designs WHERE id=?').get(cur.id)));
  });

  // Soft delete, so other devices learn about it through ?since=.
  r.delete('/:id', auth, async (req, res) => {
    await db.prepare('UPDATE designs SET deleted_at=?, updated_at=? WHERE id=? AND user_id=? AND deleted_at IS NULL')
      .run(Date.now(), Date.now(), req.params.id, req.user.id);
    res.status(204).end();
  });
  return r;
}
