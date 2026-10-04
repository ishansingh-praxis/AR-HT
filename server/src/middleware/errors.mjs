import multer from 'multer';
import { ZodError } from 'zod';

/**
 * Last middleware: turns thrown errors into JSON. Unexpected errors are logged (without bodies or tokens), passed to `report`
 * (Sentry, scrubbed in its beforeSend) and hidden from the client behind a request id.
 */
export const errorHandler = (report = () => {}) => (e, req, res, _next) => {
  if (e instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: e.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
  if (e instanceof multer.MulterError) return res.status(400).json({ error: e.message });
  if (e.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  if (e.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  if (e.code === '22P02') return res.status(404).json({ error: 'Not found' }); // PostgreSQL: a non-numeric id in the URL
  if (e.status) return res.status(e.status).json({ error: e.message, ...(e.extra ?? {}) });
  (req.log ?? console).error({ err: e, id: req.id }, 'unhandled error');
  try { report(e, { requestId: req.id, method: req.method, path: req.path }); } catch { /* reporting must never break the response */ }
  res.status(500).json({ error: 'Something went wrong', requestId: req.id });
};

export const notFound = (_req, res) => res.status(404).json({ error: 'Not found' });
