import { Router } from 'express';
import multer from 'multer';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { err, productFromRow } from '../lib/http.mjs';
import { audit } from '../lib/audit.mjs';
import { deleteProduct, tx, upsertProduct } from '../db.mjs';
import { buildCatalogue, diffCatalogue } from '../../../shared/importer.mjs';
import { checkRoom } from '../../../shared/room-checks.mjs';
import { ROOM_TYPES } from '../schemas.mjs';

const DAY = 24 * 3600 * 1000;

const roomInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/, 'lowercase letters, digits and dashes only'),
  title: z.string().min(2).max(80),
  roomType: z.enum(ROOM_TYPES),
  style: z.array(z.string().max(30)).max(8).default([]),
  blurb: z.string().max(600).default(''),
  notes: z.string().max(600).optional(),
  roomCm: z.object({ w: z.number().min(150).max(2000), d: z.number().min(150).max(2000) }),
  door: z.object({ wall: z.enum(['top', 'bottom', 'left', 'right']), at: z.number().min(0).max(2000) }).optional(),
  pieces: z.array(z.object({ productId: z.string().min(1).max(120), x: z.number(), z: z.number(), rot: z.number(), anchor: z.boolean() })).min(1).max(60),
});

/** Editor tools: catalogue import (diff then publish), 3D model review queue, sample-room editor, size checks, usage stats. */
export function adminToolsRouter({ db, auth, editor, storage, filesBase }) {
  const r = Router();
  const csv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024, files: 1 } });
  const allProducts = async () => (await db.prepare(`SELECT data FROM products ORDER BY ${db.sql.order}`).all()).map((row) => productFromRow(row, filesBase));
  const getProduct = async (id) => { const row = await db.prepare('SELECT data FROM products WHERE id=?').get(id); if (!row) throw err(404, 'Product not found'); return JSON.parse(row.data); };

  // ---- size check ----
  r.post('/products/:id/size-checked', auth, editor, async (req, res) => {
    const p = await getProduct(req.params.id);
    const { sizeReview: was, ...rest } = p;
    const next = { ...rest, dimsConfidence: 'high' };
    await upsertProduct(db, next);
    await audit(db, req.user.id, 'product.size-checked', p.id, { was: was ?? null });
    res.json({ product: productFromRow({ data: JSON.stringify(next) }, filesBase) });
  });

  // ---- catalogue import: upload the Shopify CSV, review the diff, then publish ----
  r.post('/import', auth, editor, csv.single('file'), async (req, res) => {
    if (!req.file) throw err(400, 'Send the Shopify CSV as the "file" field');
    let built;
    try { built = buildCatalogue(req.file.buffer.toString('utf8')); } catch (e) { throw err(422, `Could not read that file as a Shopify export: ${e.message}`); }
    if (!built.products.length) throw err(422, 'No importable products were found in that file');
    const diff = diffCatalogue(await allProducts(), built.products);
    const id = randomBytes(8).toString('hex');
    storage.putObject(`imports/${id}.json`, Buffer.from(JSON.stringify({ products: built.products, issues: built.issues, diff, by: req.user.id, at: Date.now() })));
    await audit(db, req.user.id, 'catalogue.import.preview', id, { products: built.products.length });
    const cap = (a) => a.slice(0, 200);
    res.status(201).json({
      id, products: built.products.length, skipped: built.issues.length, issues: built.issues.slice(0, 100),
      diff: { added: cap(diff.added), changed: cap(diff.changed), removed: cap(diff.removed), flagged: cap(diff.flagged), counts: { added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length, flagged: diff.flagged.length } },
    });
  });
  r.post('/import/:id/publish', auth, editor, async (req, res) => {
    if (!/^[0-9a-f]{16}$/.test(req.params.id)) throw err(400, 'Invalid import id');
    const buf = storage.getObject(`imports/${req.params.id}.json`);
    if (!buf) throw err(404, 'Import not found or already published');
    const { removeMissing } = z.object({ removeMissing: z.boolean().default(false) }).parse(req.body ?? {});
    const job = JSON.parse(buf.toString());
    const live = new Map((await allProducts()).map((p) => [p.id, p]));
    const touched = new Set([...job.diff.added, ...job.diff.changed]);
    let version = 0;
    await db.tx(async (t) => {
      for (const p of job.products) {
        if (!touched.has(p.id)) continue;
        const old = live.get(p.id);
        const { url: _u, ...model } = old?.model3D ?? {};
        // The importer owns catalogue facts; the 3D pipeline owns model, proxy and status.
        version = await upsertProduct(t, { ...p, ...(old?.model3D ? { model3D: model } : {}), ...(old?.modelStatus ? { modelStatus: old.modelStatus } : {}), ...(old?.proxy ? { proxy: old.proxy } : {}) });
      }
      // Products missing from the file are only removed when the editor asked for it (a partial export must not wipe the catalogue).
      if (removeMissing) for (const id of job.diff.removed) version = await deleteProduct(t, id) ?? version;
    });
    storage.deleteObject(`imports/${req.params.id}.json`);
    await audit(db, req.user.id, 'catalogue.import.publish', req.params.id, { added: job.diff.added.length, changed: job.diff.changed.length, removed: removeMissing ? job.diff.removed.length : 0 });
    res.json({ published: touched.size, removed: removeMissing ? job.diff.removed.length : 0, version });
  });

  // ---- 3D model review ----
  r.get('/models-queue', auth, editor, async (_req, res) => {
    const products = await allProducts();
    const byId = new Map(products.map((p) => [p.id, p]));
    const brief = (p) => ({ id: p.id, name: p.name, category: p.category, role: p.role, collection: p.collection, family: p.family, dimensionsCm: p.dimensionsCm, images: p.images?.slice(0, 3) ?? [], sizeReview: p.sizeReview });
    const rows = await db.prepare("SELECT product_id,version,glb_key,size_mb,status,report,created_at FROM models WHERE status IN ('pending','rejected') ORDER BY created_at DESC").all();
    const entry = (m) => ({ productId: m.product_id, version: m.version, url: storage.publicUrl(m.glb_key), sizeMb: m.size_mb, status: m.status, report: m.report ? JSON.parse(m.report) : null, createdAt: m.created_at, product: byId.get(m.product_id) ? brief(byId.get(m.product_id)) : null });
    res.json({
      needsModel: products.filter((p) => !p.model3D && !p.sizeReview && !p.demo && rows.every((m) => m.product_id !== p.id)).map(brief),
      pending: rows.filter((m) => m.status === 'pending').map(entry),
      rejected: rows.filter((m) => m.status === 'rejected').map(entry),
    });
  });
  const findModel = async (productId, version) => {
    const m = await db.prepare('SELECT * FROM models WHERE product_id=? AND version=?').get(productId, Number(version));
    if (!m) throw err(404, 'Model not found');
    return m;
  };
  r.post('/models/:productId/:version/approve', auth, editor, async (req, res) => {
    const m = await findModel(req.params.productId, req.params.version);
    if (m.status !== 'pending') throw err(409, `This model is already ${m.status}`);
    const p = await getProduct(m.product_id);
    const next = { ...p, modelStatus: 'ready', model3D: { key: m.glb_key, version: m.version, unit: 'm' } };
    await upsertProduct(db, next); // bumps the catalogue version: apps download it
    await db.prepare("UPDATE models SET status='ready', reviewed_by=? WHERE id=?").run(req.user.id, m.id);
    await audit(db, req.user.id, 'model.approve', m.product_id, { version: m.version });
    res.json({ product: productFromRow({ data: JSON.stringify(next) }, filesBase) });
  });
  r.post('/models/:productId/:version/reject', auth, editor, async (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const m = await findModel(req.params.productId, req.params.version);
    if (m.status !== 'pending') throw err(409, `This model is already ${m.status}`);
    const report = { ...(m.report ? JSON.parse(m.report) : {}), rejectedReason: reason };
    await db.prepare("UPDATE models SET status='rejected', reviewed_by=?, report=? WHERE id=?").run(req.user.id, JSON.stringify(report), m.id);
    await audit(db, req.user.id, 'model.reject', m.product_id, { version: m.version, reason });
    res.json({ ok: true });
  });

  // ---- sample rooms ----
  const roomsList = async () => (await db.prepare('SELECT data FROM sample_rooms ORDER BY sort').all()).map((x) => JSON.parse(x.data));
  /** Same rules as the build-time test. Returns the problems (empty = publishable). */
  const roomProblems = async (room) => {
    const prods = new Map((await allProducts()).map((p) => [p.id, p]));
    return checkRoom(room, (id) => prods.get(id));
  };
  r.post('/rooms/check', auth, editor, async (req, res) => res.json(await roomProblems(roomInput.parse(req.body))));
  r.put('/rooms/:id', auth, editor, async (req, res) => {
    const room = roomInput.parse(req.body);
    if (room.id !== req.params.id) throw err(400, 'The room id cannot be changed');
    const { problems } = await roomProblems(room);
    if (problems.length) throw err(422, 'This room does not pass the integrity checks', { problems });
    const exists = await db.prepare('SELECT sort FROM sample_rooms WHERE id=?').get(room.id);
    if (exists) await db.prepare('UPDATE sample_rooms SET data=? WHERE id=?').run(JSON.stringify(room), room.id);
    else await db.prepare('INSERT INTO sample_rooms(id,sort,data) VALUES(?,?,?)').run(room.id, Number((await db.prepare('SELECT COALESCE(MAX(sort),-1)+1 AS n FROM sample_rooms').get()).n), JSON.stringify(room));
    await audit(db, req.user.id, exists ? 'room.update' : 'room.create', room.id);
    res.status(exists ? 200 : 201).json(room);
  });
  r.delete('/rooms/:id', auth, editor, async (req, res) => {
    if (!(await db.prepare('DELETE FROM sample_rooms WHERE id=?').run(req.params.id)).changes) throw err(404, 'Room not found');
    await audit(db, req.user.id, 'room.delete', req.params.id);
    res.status(204).end();
  });
  r.get('/rooms', auth, editor, async (_req, res) => res.json(await roomsList()));

  // ---- usage stats (anonymous events) ----
  r.get('/stats', auth, editor, async (req, res) => {
    const num = (v, d) => (v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
    const to = num(req.query.to, Date.now());
    const from = num(req.query.from, to - 30 * DAY);
    if (from >= to || to - from > 400 * DAY) throw err(400, 'Pick a range of up to 400 days');
    const q = async (sql, ...a) => await db.prepare(sql).all(...a);
    const sum = (name) => `SUM(CASE WHEN name='${name}' THEN 1 ELSE 0 END)`;
    const dayOf = db.sql.day('ts');
    const daily = (await q(`SELECT ${dayOf} AS day, COUNT(DISTINCT device_id) AS devices,
        ${sum('ar_opened')} AS "arSessions", ${sum('piece_placed')} AS placements, ${sum('room_scanned')} AS scans
      FROM events WHERE ts>=? AND ts<? GROUP BY ${dayOf} ORDER BY day`, from, to)).map((d) => ({ ...d, devices: Number(d.devices), arSessions: Number(d.arSessions), placements: Number(d.placements), scans: Number(d.scans) }));
    const n = async (name) => Number((await q('SELECT COUNT(*) AS n FROM events WHERE name=? AND ts>=? AND ts<?', name, from, to))[0].n);
    const arSessions = await n('ar_opened'), scans = await n('room_scanned'), recShown = await n('rec_shown'), recPlaced = await n('rec_placed');
    const names = new Map((await allProducts()).map((p) => [p.id, p.name]));
    const pidOf = db.sql.json('props', 'id');
    const top = (await q(`SELECT ${pidOf} AS pid, COUNT(*) AS n FROM events WHERE name='piece_placed' AND ts>=? AND ts<? AND ${pidOf} IS NOT NULL GROUP BY ${pidOf} ORDER BY n DESC LIMIT 10`, from, to))
      .map((t) => ({ id: t.pid, name: names.get(t.pid) ?? t.pid, count: Number(t.n) }));
    res.json({
      from, to, daily, topProducts: top,
      totals: {
        devices: Number((await q('SELECT COUNT(DISTINCT device_id) AS n FROM events WHERE ts>=? AND ts<?', from, to))[0].n),
        arSessions, scans, placements: await n('piece_placed'), recShown, recPlaced,
        // sessions that ended with a scanned room / AR sessions; recommendation placed rate = rec_placed / rec_shown
        scanSuccessRate: arSessions ? Math.min(1, scans / arSessions) : null,
        recPlacedRate: recShown ? Math.min(1, recPlaced / recShown) : null,
      },
    });
  });
  return r;
}
