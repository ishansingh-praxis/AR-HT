import { Router } from 'express';
import express from 'express';
import { err } from '../lib/http.mjs';

/** PUT /v1/uploads/:token — raw bytes go straight to storage. The signed token (from an admin endpoint) says which key and how large. */
export function uploadsRouter({ storage }) {
  const r = Router();
  r.put('/:token', express.raw({ type: () => true, limit: '26mb' }), (req, res) => {
    const t = storage.verifyUpload(req.params.token);
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw err(400, 'Send the file as the request body');
    if (req.body.length > t.max) throw err(413, 'File is too large');
    storage.putObject(t.key, req.body);
    res.status(201).json({ key: t.key });
  });
  return r;
}
