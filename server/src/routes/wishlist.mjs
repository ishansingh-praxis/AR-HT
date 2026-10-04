import { Router } from 'express';
import { err } from '../lib/http.mjs';

/** Saved furniture, per user. PUT and DELETE are idempotent. */
export function wishlistRouter({ db, auth }) {
  const r = Router();
  r.get('/', auth, async (req, res) =>
    res.json((await db.prepare('SELECT product_id, added_at FROM wishlist WHERE user_id=? ORDER BY added_at DESC').all(req.user.id))
      .map((x) => ({ id: x.product_id, addedAt: Number(x.added_at) }))));
  r.put('/:productId', auth, async (req, res) => {
    if (!await db.prepare('SELECT 1 FROM products WHERE id=?').get(req.params.productId)) throw err(404, 'Product not found');
    await db.prepare('INSERT INTO wishlist(user_id,product_id,added_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(req.user.id, req.params.productId, Date.now());
    res.status(204).end();
  });
  r.delete('/:productId', auth, async (req, res) => {
    await db.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').run(req.user.id, req.params.productId);
    res.status(204).end();
  });
  return r;
}
