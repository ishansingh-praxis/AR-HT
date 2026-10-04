import { Router } from 'express';

/** Curated sample rooms (seeded from src/data/rooms.json). */
export function roomsRouter({ db }) {
  const r = Router();
  r.get('/', (_req, res) => res.json(db.prepare('SELECT data FROM sample_rooms ORDER BY sort').all().map((x) => JSON.parse(x.data))));
  return r;
}
