import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(16).optional(),
  PUBLIC_URL: z.string().default(''),
  /** Optional: serve model files from a CDN / static host in front of the uploads folder. */
  CDN_BASE_URL: z.string().default(''),
  /** Folder for uploaded files (models, thumbnails). Put it on a persistent disk in production. */
  UPLOAD_DIR: z.string().optional(),
  /** Comma-separated origins allowed to call the API from a browser (the admin page is same-origin). */
  CORS_ORIGINS: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  LAYOUT_MODEL: z.string().default('claude-sonnet-5-5'),
  DB_FILE: z.string().optional(),
  LOG_LEVEL: z.string().default('info'),
  /** Error reporting (Sentry). Leave empty to switch it off. */
  SENTRY_DSN: z.string().default(''),
  /** Comma-separated Google OAuth client ids (web/android/ios) that may sign users in. */
  GOOGLE_CLIENT_IDS: z.string().default(''),
  APPLE_BUNDLE_ID: z.string().default(''),
  APPLE_SERVICE_ID: z.string().default(''),
  MAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().default(''),
  /** Domain that serves shared design pages and opens the app, e.g. share.hometown.in (no scheme). Defaults to PUBLIC_URL. */
  SHARE_DOMAIN: z.string().default(''),
  APPLE_TEAM_ID: z.string().default(''),
  IOS_BUNDLE_ID: z.string().default('in.hometown.roomdesigner'),
  ANDROID_PACKAGE: z.string().default('in.hometown.roomdesigner'),
  /** Comma-separated SHA-256 fingerprints of the Android signing certificate(s). */
  ANDROID_SHA256_CERTS: z.string().default(''),
  APP_STORE_URL: z.string().default(''),
  PLAY_STORE_URL: z.string().default(''),
  MAIL_FROM: z.string().default('HomeTown AR <no-reply@example.com>'),
});

/** Reads and validates the environment. JWT_SECRET is required in production; development gets an insecure default. */
export function loadConfig(env = process.env) {
  const e = schema.parse(env);
  if (e.NODE_ENV === 'production' && !e.JWT_SECRET) throw new Error('JWT_SECRET (16+ characters) must be set in production');
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    jwtSecret: e.JWT_SECRET ?? 'dev-only-secret-change-me',
    publicUrl: e.PUBLIC_URL || `http://localhost:${e.PORT}`,
    corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    anthropicKey: e.ANTHROPIC_API_KEY,
    layoutModel: e.LAYOUT_MODEL,
    dbFile: e.DB_FILE,
    cdnBaseUrl: e.CDN_BASE_URL.replace(/\/$/, ''),
    uploadDir: e.UPLOAD_DIR,
    logLevel: e.LOG_LEVEL,
    sentryDsn: e.SENTRY_DSN,
    googleClientIds: e.GOOGLE_CLIENT_IDS.split(',').map((s) => s.trim()).filter(Boolean),
    appleAudiences: [e.APPLE_BUNDLE_ID, e.APPLE_SERVICE_ID].filter(Boolean),
    share: {
      domain: e.SHARE_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, ''), appleTeamId: e.APPLE_TEAM_ID, iosBundleId: e.IOS_BUNDLE_ID, androidPackage: e.ANDROID_PACKAGE,
      androidCerts: e.ANDROID_SHA256_CERTS.split(',').map((s) => s.trim()).filter(Boolean), appStoreUrl: e.APP_STORE_URL, playStoreUrl: e.PLAY_STORE_URL,
    },
    mail: { provider: e.MAIL_PROVIDER, apiKey: e.RESEND_API_KEY, from: e.MAIL_FROM },
  };
}
