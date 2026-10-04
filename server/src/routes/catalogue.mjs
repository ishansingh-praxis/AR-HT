import { Router } from 'express';
import { currentVersion } from '../db.mjs';
import { err, productFromRow } from '../lib/http.mjs';

export function catalogueRouter({ db, filesBase }) {
  const r = Router();
  const parse = (row) => productFromRow(row, filesBase);

  r.get('/categories', async (_req, res) =>
    res.json((await db.prepare('SELECT category AS name, COUNT(*) AS count FROM products GROUP BY category').all()).map((x) => ({ name: x.name, count: Number(x.count) }))));

  r.get('/products', async (req, res) => {
    const { category, role, roomType, q } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const where = [], args = [];
    if (category) { where.push('category=?'); args.push(String(category)); }
    if (role) { where.push('role=?'); args.push(String(role)); }
    let list = (await db.prepare(`SELECT data FROM products ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${db.sql.order}`).all(...args)).map(parse);
    if (roomType) list = list.filter((p) => (p.roomTypes ?? []).includes(String(roomType)));
    if (q) list = list.filter((p) => `${p.name} ${p.material ?? ''} ${p.subcategory ?? ''}`.toLowerCase().includes(String(q).toLowerCase()));
    res.json({ total: list.length, items: list.slice(offset, offset + limit) });
  });

  r.get('/products/:id', async (req, res) => {
    const row = await db.prepare('SELECT data FROM products WHERE id=?').get(req.params.id);
    if (!row) throw err(404, 'Product not found');
    res.json(parse(row));
  });

  // Delta sync: what changed since the version the app already has. since=0 (or missing) returns everything.
  r.get('/catalogue', async (req, res) => {
    const since = Math.max(0, Number(req.query.since) || 0);
    const version = await currentVersion(db);
    const etag = `W/"cat-${filesBase}-${since}-${version}"`;
    res.set('ETag', etag).set('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    const products = (await db.prepare(`SELECT data FROM products WHERE version>? ORDER BY version, ${db.sql.order}`).all(since)).map(parse);
    const removed = since ? (await db.prepare('SELECT id FROM product_tombstones WHERE version>?').all(since)).map((x) => x.id) : [];
    res.json({ version, products, removed });
  });
  return r;
}
