import { Router } from 'express';
import { err } from '../lib/http.mjs';

/** Saved furniture, per user. PUT and DELETE are idempotent. */
export function wishlistRouter({ db, auth }) {
  const r = Router();
  r.get('/', auth, (req, res) =>
    res.json(db.prepare('SELECT product_id, added_at FROM wishlist WHERE user_id=? ORDER BY added_at DESC').all(req.user.id)
      .map((x) => ({ id: x.product_id, addedAt: Number(x.added_at) }))));
  r.put('/:productId', auth, (req, res) => {
    if (!db.prepare('SELECT 1 FROM products WHERE id=?').get(req.params.productId)) throw err(404, 'Product not found');
    db.prepare('INSERT OR IGNORE INTO wishlist(user_id,product_id,added_at) VALUES(?,?,?)').run(req.user.id, req.params.productId, Date.now());
    res.status(204).end();
  });
  r.delete('/:productId', auth, (req, res) => {
    db.prepare('DELETE FROM wishlist WHERE user_id=? AND product_id=?').run(req.user.id, req.params.productId);
    res.status(204).end();
  });
  return r;
}
