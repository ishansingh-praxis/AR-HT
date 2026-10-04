import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { openDb, seedProducts, seedRooms } from './db.mjs';
import { createApp } from './app.mjs';
import { initMonitoring } from './lib/monitoring.mjs';
import pkg from '../package.json' with { type: 'json' };

const here = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
if (!process.env.JWT_SECRET) console.warn('JWT_SECRET not set: using an insecure development secret.');

const onError = initMonitoring({ dsn: config.sentryDsn, release: `hometown-ar-server@${pkg.version}`, environment: config.env });
const db = openDb(config.dbFile ?? path.join(here, '../data/furni.db'));
const data = path.join(here, '../../src/data');
seedProducts(db, JSON.parse(fs.readFileSync(path.join(data, 'catalogue.json'), 'utf8')));
seedRooms(db, JSON.parse(fs.readFileSync(path.join(data, 'rooms.json'), 'utf8')));

const app = createApp({
  db, jwtSecret: config.jwtSecret, uploadDir: config.uploadDir ?? path.join(here, '../uploads'), publicUrl: config.publicUrl, cdnBaseUrl: config.cdnBaseUrl,
  corsOrigins: config.corsOrigins, logLevel: config.logLevel, googleClientIds: config.googleClientIds, appleAudiences: config.appleAudiences, mail: config.mail, share: config.share, onError, anthropicKey: config.anthropicKey, layoutModel: config.layoutModel,
});
const server = app.listen(config.port, () => console.log(`HomeTown AR API on :${config.port}`));

// Graceful shutdown: stop accepting connections, let in-flight requests finish, close the database.
const stop = (signal) => {
  console.log(`${signal}: shutting down`);
  server.close(() => { db.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
