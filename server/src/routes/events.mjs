import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { eventsInput } from '../schemas.mjs';

/** Anonymous usage events: allow-listed names, flat scalar props, at most 50 per batch. */
export function eventsRouter({ db, eventLimit }) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60 * 1000, limit: eventLimit, standardHeaders: true, legacyHeaders: false });
  r.post('/', limiter, async (req, res) => {
    const { deviceId, events } = eventsInput.parse(req.body);
    await db.tx(async (t) => { for (const e of events) await t.run('INSERT INTO events(device_id,name,ts,props) VALUES(?,?,?,?)', deviceId, e.name, e.ts, JSON.stringify(e.props)); });
    res.status(204).end();
  });
  return r;
}
