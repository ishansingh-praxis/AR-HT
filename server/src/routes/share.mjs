import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { err, productFromRow } from '../lib/http.mjs';
import { designPlan, planSvg } from '../../../src/plan/planSvg.mjs';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes (i l o 0 1)
const slug = () => Array.from(randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join('');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const withUtm = (url, campaign) => {
  try { const u = new URL(url); u.searchParams.set('utm_source', 'hometown-ar'); u.searchParams.set('utm_medium', 'web'); u.searchParams.set('utm_campaign', campaign); return u.toString(); } catch { return url; }
};

/** Share links, the public share page and JSON, app-link files, and signed thumbnail uploads. */
export function shareRouter({ db, auth, storage, filesBase, share }) {
  const api = Router();   // mounted at /v1
  const web = Router();   // mounted at /
  const shareUrl = (s) => `${share.baseUrl}/d/${s}`;

  const ownDesign = (id, userId) => {
    const d = db.prepare('SELECT * FROM designs WHERE id=? AND user_id=? AND deleted_at IS NULL').get(id, userId);
    if (!d) throw err(404, 'Design not found');
    return d;
  };

  // Create (idempotent) or revoke a share link
  api.post('/designs/:id/share', auth, (req, res) => {
    const d = ownDesign(req.params.id, req.user.id);
    let s = d.share_slug;
    if (!s) { s = slug(); db.prepare('UPDATE designs SET share_slug=? WHERE id=?').run(s, d.id); }
    res.status(s === d.share_slug ? 200 : 201).json({ slug: s, url: shareUrl(s) });
  });
  api.delete('/designs/:id/share', auth, (req, res) => {
    const d = ownDesign(req.params.id, req.user.id);
    db.prepare('UPDATE designs SET share_slug=NULL WHERE id=?').run(d.id);
    res.status(204).end();
  });

  // Signed upload link for a design thumbnail. The key is under the user's own folder, so one user cannot overwrite another's.
  api.post('/thumbnails/upload-url', auth, (req, res) => {
    const { clientId } = z.object({ clientId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/) }).parse(req.body);
    const key = `thumbnails/${req.user.id}/${clientId}-${Date.now().toString(36)}.jpg`;
    const token = storage.signUpload(key, { maxBytes: 2 * 1024 * 1024 });
    res.json({ key, method: 'PUT', uploadUrl: `${share.apiUrl}/v1/uploads/${token}`, expiresInSec: 600 });
  });

  /** The shared design with everything needed to show it. No account details. */
  function loadShared(s) {
    const d = db.prepare('SELECT * FROM designs WHERE share_slug=? AND deleted_at IS NULL').get(String(s));
    if (!d) return null;
    const data = JSON.parse(d.data);
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const rows = ids.length ? db.prepare(`SELECT data FROM products WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
    const products = rows.map((r) => productFromRow(r, filesBase));
    return { design: d, data, products };
  }

  api.get('/shared/:slug', (req, res) => {
    const s = loadShared(req.params.slug);
    if (!s) throw err(404, 'This link is no longer available');
    res.set('Cache-Control', 'public, max-age=60').json({
      slug: req.params.slug, name: s.design.name, roomType: s.data.roomType, frame: s.data.frame ?? false, scan: s.data.scan,
      items: s.data.items, thumbnailUrl: s.design.thumbnail_key ? storage.publicUrl(s.design.thumbnail_key) : undefined,
      products: s.products.map((p) => ({ id: p.id, name: p.name, category: p.category, role: p.role, dimensionsCm: p.dimensionsCm, images: p.images?.slice(0, 1) ?? [], colors: p.colors, retailerUrl: p.retailerUrl })),
    });
  });

  // The public page: plain HTML, no scripts, Open Graph tags for chat previews.
  web.get('/d/:slug', (req, res) => {
    const s = loadShared(req.params.slug);
    res.set('Content-Security-Policy', "default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'");
    if (!s) return res.status(404).type('html').send(page({ title: 'Link not available', body: '<p>This shared design is no longer available. The owner may have stopped sharing it.</p>', share }));
    const find = (id) => s.products.find((p) => p.id === id);
    const plan = designPlan(s.data.items, find, s.data.scan ? { w: s.data.scan.widthCm, d: s.data.scan.depthCm } : undefined);
    const svg = planSvg({ ...plan, width: 520, title: `Plan of ${s.design.name}` });
    const count = new Map();
    for (const it of s.data.items) count.set(it.productId, (count.get(it.productId) ?? 0) + 1);
    const thumb = s.design.thumbnail_key ? storage.publicUrl(s.design.thumbnail_key) : null;
    const list = [...count].flatMap(([id, n]) => {
      const p = find(id);
      if (!p) return [];
      const d = p.dimensionsCm;
      return [`<li class="p">${p.images?.[0] ? `<img src="${esc(p.images[0])}" alt="" width="64" height="64" loading="lazy">` : '<span class="ph"></span>'}
        <div><strong>${esc(p.name)}${n > 1 ? ` × ${n}` : ''}</strong><br><span class="m">${d.w} × ${d.d} × ${d.h} cm</span>
        ${p.retailerUrl ? `<br><a href="${esc(withUtm(p.retailerUrl, 'share-page'))}" rel="noopener">View on HomeTown</a>` : ''}</div></li>`];
    }).join('');
    const desc = `${s.data.items.length} pieces, to scale. Plan the same room in your own space with HomeTown AR.`;
    const body = `${thumb ? `<img class="hero" src="${esc(thumb)}" alt="Photo of the design">` : ''}
      <div class="plan">${svg}</div>
      <h2>Pieces</h2><ul class="list">${list}</ul>
      <p><a class="btn" href="hometownar://d/${esc(req.params.slug)}">Open in the app</a></p>
      ${share.storeLinks}`;
    res.type('html').send(page({
      title: s.design.name, body, share,
      meta: { 'og:title': `${s.design.name} · HomeTown AR`, 'og:description': desc, 'og:type': 'website', 'og:url': shareUrl(req.params.slug), ...(thumb ? { 'og:image': thumb } : {}), 'twitter:card': thumb ? 'summary_large_image' : 'summary' },
    }));
  });

  // Files that make https://<domain>/d/* open the app. Values come from the environment (see docs/SHARING.md).
  web.get('/.well-known/apple-app-site-association', (_req, res) => {
    if (!share.appleTeamId) return res.status(404).json({ error: 'Not configured' });
    res.type('application/json').json({ applinks: { details: [{ appIDs: [`${share.appleTeamId}.${share.iosBundleId}`], components: [{ '/': '/d/*' }, { '/': '/item/*' }] }] } });
  });
  web.get('/.well-known/assetlinks.json', (_req, res) => {
    if (!share.androidCerts.length) return res.status(404).json({ error: 'Not configured' });
    res.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: share.androidPackage, sha256_cert_fingerprints: share.androidCerts } }]);
  });
  return { api, web };
}

function page({ title, body, meta = {}, share }) {
  const tags = Object.entries(meta).map(([k, v]) => `<meta property="${esc(k)}" content="${esc(v)}">`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · HomeTown AR</title>${tags}
<style>body{font:16px system-ui,sans-serif;margin:0;color:#14211f;background:#f3f5f4}main{max-width:560px;margin:0 auto;padding:20px}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:22px 0 8px}.hero{width:100%;border-radius:12px}.plan{background:#fff;border-radius:12px;padding:10px;margin-top:12px;overflow:auto}
.list{list-style:none;padding:0;margin:0}.p{display:flex;gap:12px;background:#fff;border-radius:12px;padding:10px;margin-bottom:8px;align-items:center}.p img,.ph{width:64px;height:64px;border-radius:8px;object-fit:cover;background:#dce3e1;flex:none}
.m{color:#6b7a77;font-size:14px}a{color:#2f6f5e}.btn{display:inline-block;background:#2f6f5e;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600}footer{color:#6b7a77;font-size:13px;margin-top:24px}</style></head>
<body><main><h1>${esc(title)}</h1><div class="m">HomeTown AR${share?.shortName ? '' : ''}</div>${body}<footer>Shared from the HomeTown AR app. No personal details are on this page.</footer></main></body></html>`;
}
