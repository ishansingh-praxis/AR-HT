import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { eventsInput } from '../schemas.mjs';
import { tx } from '../db.mjs';

/** Anonymous usage events: allow-listed names, flat scalar props, at most 50 per batch. */
export function eventsRouter({ db, eventLimit }) {
  const r = Router();
  const limiter = rateLimit({ windowMs: 60 * 1000, limit: eventLimit, standardHeaders: true, legacyHeaders: false });
  r.post('/', limiter, (req, res) => {
    const { deviceId, events } = eventsInput.parse(req.body);
    const ins = db.prepare('INSERT INTO events(device_id,name,ts,props) VALUES(?,?,?,?)');
    tx(db, () => { for (const e of events) ins.run(deviceId, e.name, e.ts, JSON.stringify(e.props)); });
    res.status(204).end();
  });
  return r;
}
