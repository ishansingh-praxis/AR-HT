import express from 'express';
import fs from 'node:fs';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { migrateModelKeys } from './db.mjs';
import { authMiddleware } from './middleware/auth.mjs';
import { createTokens, createCodes } from './lib/tokens.mjs';
import { createMailer } from './lib/mailer.mjs';
import { googleVerifier, appleVerifier } from './lib/social.mjs';
import { errorHandler, notFound } from './middleware/errors.mjs';
import { authRouter } from './routes/auth.mjs';
import { meRouter, accountPageRouter } from './routes/me.mjs';
import { catalogueRouter } from './routes/catalogue.mjs';
import { designsRouter } from './routes/designs.mjs';
import { wishlistRouter } from './routes/wishlist.mjs';
import { eventsRouter } from './routes/events.mjs';
import { layoutRouter } from './routes/layout.mjs';
import { uploadsRouter } from './routes/uploads.mjs';
import { shareRouter } from './routes/share.mjs';
import { createStorage } from './lib/storage.mjs';
import { adminToolsRouter } from './routes/adminTools.mjs';
import { roomsRouter } from './routes/rooms.mjs';
import { adminRouter } from './routes/admin.mjs';

export function createApp({
  db, jwtSecret, uploadDir, publicUrl = '', cdnBaseUrl = '', corsOrigins = [], logLevel = 'silent',
  authLimit = 30, eventLimit = 60, globalLimit = 600, layoutLimits = { perMinute: 5, perDay: 20 },
  anthropicKey = '', layoutModel = 'claude-sonnet-5-5', fetchImpl = fetch,
  share: shareCfg = {}, mail = {}, onError = () => {}, googleClientIds = [], appleAudiences = [], verifyGoogle = googleVerifier(googleClientIds), verifyApple = appleVerifier(appleAudiences),
}) {
  const app = express();
  const mounts = []; // [prefix, router] for every router, so the full route table can be listed
  const mount = (parent, prefix, prefixOf, router) => { parent.use(prefix, router); mounts.push([`${prefixOf}${prefix === '/' ? '' : prefix}`, router]); };
  migrateModelKeys(db);
  // Files live on local disk, served from this server's /files unless CDN_BASE_URL points at a static host in front of the folder.
  const filesBase = cdnBaseUrl || `${publicUrl}/files`;
  const storage = createStorage({ dir: uploadDir, publicBase: filesBase, secret: jwtSecret });
  const share = {
    apiUrl: publicUrl, baseUrl: shareCfg.domain ? `https://${shareCfg.domain}` : publicUrl,
    appleTeamId: shareCfg.appleTeamId ?? '', iosBundleId: shareCfg.iosBundleId ?? 'in.hometown.roomdesigner',
    androidPackage: shareCfg.androidPackage ?? 'in.hometown.roomdesigner', androidCerts: shareCfg.androidCerts ?? [],
    storeLinks: [shareCfg.appStoreUrl && `<a href="${shareCfg.appStoreUrl}">App Store</a>`, shareCfg.playStoreUrl && `<a href="${shareCfg.playStoreUrl}">Google Play</a>`].filter(Boolean).join(' · ').replace(/^(.+)$/, '<p>Get the app: $1</p>'),
  };
  const tokens = createTokens({ db, jwtSecret });
  const codes = createCodes({ db });
  const mailer = mail.send ? mail : createMailer({ ...mail, log: { info: (m) => logLevel !== 'silent' && console.log(m) } });
  const { auth, admin, editor } = authMiddleware({ db, tokens });

  // Request hygiene: id + structured logs (method, url, status; never bodies or tokens), security headers, CORS allow-list, rate limit, gzip.
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({
    logger: pino({ level: logLevel }),
    genReqId: (req, res) => { const id = req.headers['x-request-id']?.toString().slice(0, 64) || randomUUID(); res.setHeader('x-request-id', id); return id; },
    serializers: { req: (r) => ({ id: r.id, method: r.method, url: r.url?.split('?')[0] }), res: (r) => ({ statusCode: r.statusCode }) },
  }));
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || corsOrigins.includes(origin)) }));
  app.use(compression());
  app.use(rateLimit({ windowMs: 60 * 1000, limit: globalLimit, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '1mb' }));
  // Versioned files never change, so browsers and CDNs may keep them for a year.
  app.use('/files', express.static(uploadDir, { maxAge: '365d', immutable: true, dotfiles: 'deny', index: false }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/ready', (_req, res) => {
    try { db.prepare('SELECT 1').get(); res.json({ ok: true }); } catch { res.status(503).json({ ok: false }); }
  });

  const ctx = { db, auth, admin, editor, tokens, codes, mailer, verifyGoogle, verifyApple, publicUrl, filesBase, storage, uploadDir, authLimit, eventLimit, anthropicKey, layoutModel, layoutLimits, fetchImpl };
  const v1 = express.Router();
  mount(v1, '/auth', '/v1', authRouter(ctx));
  mount(v1, '/me', '/v1', meRouter(ctx));
  mount(v1, '/wishlist', '/v1', wishlistRouter(ctx));
  mount(v1, '/designs', '/v1', designsRouter(ctx));
  mount(v1, '/events', '/v1', eventsRouter(ctx));
  mount(v1, '/layout', '/v1', layoutRouter(ctx));
  mount(v1, '/rooms', '/v1', roomsRouter(ctx));
  mount(v1, '/admin', '/v1', adminRouter(ctx));
  mount(v1, '/admin', '/v1', adminToolsRouter(ctx));
  mount(v1, '/uploads', '/v1', uploadsRouter(ctx));
  const sharing = shareRouter({ ...ctx, share });
  mount(v1, '/', '/v1', sharing.api);
  mount(v1, '/', '/v1', catalogueRouter(ctx)); // /categories /products /products/:id /catalogue
  app.use('/v1', v1);
  mount(app, '/account', '', accountPageRouter());
  mount(app, '/', '', sharing.web);

  // The admin dashboard (built from /admin with `npm run build`). It is static files; every action it takes is checked by the admin API.
  const adminDist = path.resolve(import.meta.dirname, '../../admin/dist');
  const adminCsp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' blob: data:; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'none'";
  app.use('/admin', (_req, res, next) => { res.setHeader('Content-Security-Policy', adminCsp); next(); });
  if (fs.existsSync(path.join(adminDist, 'index.html'))) {
    app.use('/admin', express.static(adminDist, { index: false, maxAge: '1h' }));
    app.get(/^\/admin(\/.*)?$/, (_req, res) => res.sendFile(path.join(adminDist, 'index.html'))); // single-page app: any /admin/* path
  } else {
    app.get(/^\/admin(\/.*)?$/, (_req, res) => res.status(503).type('text').send('The admin dashboard is not built. Run: cd admin && npm install && npm run build'));
  }

  app.use(notFound);
  app.use(errorHandler(onError));

  /** Every route as { method, path, guards }: path uses {param}. Used by scripts/gen-openapi.mjs and the completeness test. */
  app.locals.routeTable = () => {
    const rows = [{ method: 'GET', path: '/health', guards: [] }, { method: 'GET', path: '/ready', guards: [] }];
    for (const [prefix, router] of mounts) for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        const path = (prefix + layer.route.path).replace(/\/$/, '').replace(/:([A-Za-z]+)/g, '{$1}') || '/';
        rows.push({ method: method.toUpperCase(), path, guards: layer.route.stack.map((l) => l.handle.name).filter((n) => n === 'auth' || n.startsWith('role:')) });
      }
    }
    return rows;
  };
  return app;
}
