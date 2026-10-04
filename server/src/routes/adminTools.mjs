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
  const allProducts = () => db.prepare('SELECT data FROM products ORDER BY rowid').all().map((row) => productFromRow(row, filesBase));
  const getProduct = (id) => { const row = db.prepare('SELECT data FROM products WHERE id=?').get(id); if (!row) throw err(404, 'Product not found'); return JSON.parse(row.data); };

  // ---- size check ----
  r.post('/products/:id/size-checked', auth, editor, (req, res) => {
    const p = getProduct(req.params.id);
    const { sizeReview: was, ...rest } = p;
    const next = { ...rest, dimsConfidence: 'high' };
    upsertProduct(db, next);
    audit(db, req.user.id, 'product.size-checked', p.id, { was: was ?? null });
    res.json({ product: productFromRow({ data: JSON.stringify(next) }, filesBase) });
  });

  // ---- catalogue import: upload the Shopify CSV, review the diff, then publish ----
  r.post('/import', auth, editor, csv.single('file'), (req, res) => {
    if (!req.file) throw err(400, 'Send the Shopify CSV as the "file" field');
    let built;
    try { built = buildCatalogue(req.file.buffer.toString('utf8')); } catch (e) { throw err(422, `Could not read that file as a Shopify export: ${e.message}`); }
    if (!built.products.length) throw err(422, 'No importable products were found in that file');
    const diff = diffCatalogue(allProducts(), built.products);
    const id = randomBytes(8).toString('hex');
    storage.putObject(`imports/${id}.json`, Buffer.from(JSON.stringify({ products: built.products, issues: built.issues, diff, by: req.user.id, at: Date.now() })));
    audit(db, req.user.id, 'catalogue.import.preview', id, { products: built.products.length });
    const cap = (a) => a.slice(0, 200);
    res.status(201).json({
      id, products: built.products.length, skipped: built.issues.length, issues: built.issues.slice(0, 100),
      diff: { added: cap(diff.added), changed: cap(diff.changed), removed: cap(diff.removed), flagged: cap(diff.flagged), counts: { added: diff.added.length, changed: diff.changed.length, removed: diff.removed.length, flagged: diff.flagged.length } },
    });
  });
  r.post('/import/:id/publish', auth, editor, (req, res) => {
    if (!/^[0-9a-f]{16}$/.test(req.params.id)) throw err(400, 'Invalid import id');
    const buf = storage.getObject(`imports/${req.params.id}.json`);
    if (!buf) throw err(404, 'Import not found or already published');
    const { removeMissing } = z.object({ removeMissing: z.boolean().default(false) }).parse(req.body ?? {});
    const job = JSON.parse(buf.toString());
    const live = new Map(allProducts().map((p) => [p.id, p]));
    const touched = new Set([...job.diff.added, ...job.diff.changed]);
    let version = 0;
    tx(db, () => {
      for (const p of job.products) {
        if (!touched.has(p.id)) continue;
        const old = live.get(p.id);
        const { url: _u, ...model } = old?.model3D ?? {};
        // The importer owns catalogue facts; the 3D pipeline owns model, proxy and status.
        version = upsertProduct(db, { ...p, ...(old?.model3D ? { model3D: model } : {}), ...(old?.modelStatus ? { modelStatus: old.modelStatus } : {}), ...(old?.proxy ? { proxy: old.proxy } : {}) });
      }
      // Products missing from the file are only removed when the editor asked for it (a partial export must not wipe the catalogue).
      if (removeMissing) for (const id of job.diff.removed) version = deleteProduct(db, id) ?? version;
    });
    storage.deleteObject(`imports/${req.params.id}.json`);
    audit(db, req.user.id, 'catalogue.import.publish', req.params.id, { added: job.diff.added.length, changed: job.diff.changed.length, removed: removeMissing ? job.diff.removed.length : 0 });
    res.json({ published: touched.size, removed: removeMissing ? job.diff.removed.length : 0, version });
  });

  // ---- 3D model review ----
  r.get('/models-queue', auth, editor, (_req, res) => {
    const products = allProducts();
    const byId = new Map(products.map((p) => [p.id, p]));
    const brief = (p) => ({ id: p.id, name: p.name, category: p.category, role: p.role, collection: p.collection, family: p.family, dimensionsCm: p.dimensionsCm, images: p.images?.slice(0, 3) ?? [], sizeReview: p.sizeReview });
    const rows = db.prepare("SELECT product_id,version,glb_key,size_mb,status,report,created_at FROM models WHERE status IN ('pending','rejected') ORDER BY created_at DESC").all();
    const entry = (m) => ({ productId: m.product_id, version: m.version, url: storage.publicUrl(m.glb_key), sizeMb: m.size_mb, status: m.status, report: m.report ? JSON.parse(m.report) : null, createdAt: m.created_at, product: byId.get(m.product_id) ? brief(byId.get(m.product_id)) : null });
    res.json({
      needsModel: products.filter((p) => !p.model3D && !p.sizeReview && !p.demo && rows.every((m) => m.product_id !== p.id)).map(brief),
      pending: rows.filter((m) => m.status === 'pending').map(entry),
      rejected: rows.filter((m) => m.status === 'rejected').map(entry),
    });
  });
  const findModel = (productId, version) => {
    const m = db.prepare('SELECT * FROM models WHERE product_id=? AND version=?').get(productId, Number(version));
    if (!m) throw err(404, 'Model not found');
    return m;
  };
  r.post('/models/:productId/:version/approve', auth, editor, (req, res) => {
    const m = findModel(req.params.productId, req.params.version);
    if (m.status !== 'pending') throw err(409, `This model is already ${m.status}`);
    const p = getProduct(m.product_id);
    const next = { ...p, modelStatus: 'ready', model3D: { key: m.glb_key, version: m.version, unit: 'm' } };
    upsertProduct(db, next); // bumps the catalogue version: apps download it
    db.prepare("UPDATE models SET status='ready', reviewed_by=? WHERE id=?").run(req.user.id, m.id);
    audit(db, req.user.id, 'model.approve', m.product_id, { version: m.version });
    res.json({ product: productFromRow({ data: JSON.stringify(next) }, filesBase) });
  });
  r.post('/models/:productId/:version/reject', auth, editor, (req, res) => {
    const { reason } = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const m = findModel(req.params.productId, req.params.version);
    if (m.status !== 'pending') throw err(409, `This model is already ${m.status}`);
    const report = { ...(m.report ? JSON.parse(m.report) : {}), rejectedReason: reason };
    db.prepare("UPDATE models SET status='rejected', reviewed_by=?, report=? WHERE id=?").run(req.user.id, JSON.stringify(report), m.id);
    audit(db, req.user.id, 'model.reject', m.product_id, { version: m.version, reason });
    res.json({ ok: true });
  });

  // ---- sample rooms ----
  const roomsList = () => db.prepare('SELECT data FROM sample_rooms ORDER BY sort').all().map((x) => JSON.parse(x.data));
  /** Same rules as the build-time test. Returns the problems (empty = publishable). */
  const roomProblems = (room) => {
    const prods = new Map(allProducts().map((p) => [p.id, p]));
    return checkRoom(room, (id) => prods.get(id));
  };
  r.post('/rooms/check', auth, editor, (req, res) => res.json(roomProblems(roomInput.parse(req.body))));
  r.put('/rooms/:id', auth, editor, (req, res) => {
    const room = roomInput.parse(req.body);
    if (room.id !== req.params.id) throw err(400, 'The room id cannot be changed');
    const { problems } = roomProblems(room);
    if (problems.length) throw err(422, 'This room does not pass the integrity checks', { problems });
    const exists = db.prepare('SELECT sort FROM sample_rooms WHERE id=?').get(room.id);
    if (exists) db.prepare('UPDATE sample_rooms SET data=? WHERE id=?').run(JSON.stringify(room), room.id);
    else db.prepare('INSERT INTO sample_rooms(id,sort,data) VALUES(?,?,?)').run(room.id, Number(db.prepare('SELECT COALESCE(MAX(sort),-1)+1 AS n FROM sample_rooms').get().n), JSON.stringify(room));
    audit(db, req.user.id, exists ? 'room.update' : 'room.create', room.id);
    res.status(exists ? 200 : 201).json(room);
  });
  r.delete('/rooms/:id', auth, editor, (req, res) => {
    if (!db.prepare('DELETE FROM sample_rooms WHERE id=?').run(req.params.id).changes) throw err(404, 'Room not found');
    audit(db, req.user.id, 'room.delete', req.params.id);
    res.status(204).end();
  });
  r.get('/rooms', auth, editor, (_req, res) => res.json(roomsList()));

  // ---- usage stats (anonymous events) ----
  r.get('/stats', auth, editor, (req, res) => {
    const num = (v, d) => (v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
    const to = num(req.query.to, Date.now());
    const from = num(req.query.from, to - 30 * DAY);
    if (from >= to || to - from > 400 * DAY) throw err(400, 'Pick a range of up to 400 days');
    const q = (sql, ...a) => db.prepare(sql).all(...a);
    const daily = q(`SELECT strftime('%Y-%m-%d', ts/1000, 'unixepoch') AS day, COUNT(DISTINCT device_id) AS devices,
        SUM(name='ar_opened') AS arSessions, SUM(name='piece_placed') AS placements, SUM(name='room_scanned') AS scans
      FROM events WHERE ts>=? AND ts<? GROUP BY day ORDER BY day`, from, to).map((d) => ({ ...d, devices: Number(d.devices), arSessions: Number(d.arSessions), placements: Number(d.placements), scans: Number(d.scans) }));
    const n = (name) => Number(q('SELECT COUNT(*) AS n FROM events WHERE name=? AND ts>=? AND ts<?', name, from, to)[0].n);
    const arSessions = n('ar_opened'), scans = n('room_scanned'), recShown = n('rec_shown'), recPlaced = n('rec_placed');
    const names = new Map(allProducts().map((p) => [p.id, p.name]));
    const top = q(`SELECT json_extract(props,'$.id') AS pid, COUNT(*) AS n FROM events WHERE name='piece_placed' AND ts>=? AND ts<? AND pid IS NOT NULL GROUP BY pid ORDER BY n DESC LIMIT 10`, from, to)
      .map((t) => ({ id: t.pid, name: names.get(t.pid) ?? t.pid, count: Number(t.n) }));
    res.json({
      from, to, daily, topProducts: top,
      totals: {
        devices: Number(q('SELECT COUNT(DISTINCT device_id) AS n FROM events WHERE ts>=? AND ts<?', from, to)[0].n),
        arSessions, scans, placements: n('piece_placed'), recShown, recPlaced,
        // sessions that ended with a scanned room / AR sessions; recommendation placed rate = rec_placed / rec_shown
        scanSuccessRate: arSessions ? Math.min(1, scans / arSessions) : null,
        recPlacedRate: recShown ? Math.min(1, recPlaced / recShown) : null,
      },
    });
  });
  return r;
}
