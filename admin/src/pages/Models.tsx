import { lazy, Suspense, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, messageOf, type GlbReport, type ModelQueue, type Product } from '../api/client';

const ModelStage = lazy(() => import('../ModelStage').then((m) => ({ default: m.ModelStage })));
type Tab = 'needs' | 'pending' | 'rejected' | 'groups';

function Report({ r }: { r: GlbReport }) {
  return (
    <div className="report">
      <div className={r.ok ? 'ok' : 'error'}>{r.ok ? 'Size matches the listed size' : 'Size does not match'}</div>
      <table className="mini"><tbody>
        {r.sizeCm && <tr><th>Model size (cm)</th><td>{r.sizeCm.w.toFixed(0)} × {r.sizeCm.d.toFixed(0)} × {r.sizeCm.h.toFixed(0)}</td></tr>}
        {r.origin && <tr><th>Origin offset / floor</th><td>x {r.origin.x} cm, z {r.origin.z} cm; base {r.origin.baseY} cm above the floor</td></tr>}
        <tr><th>File</th><td>{r.fileMb} MB</td></tr>
        <tr><th>Triangles</th><td>{r.triangles?.toLocaleString()}</td></tr>
        <tr><th>Textures</th><td>{r.textures?.length ? r.textures.map((t) => `${t.size?.join('×') ?? '?'}`).join(', ') : 'none'}</td></tr>
      </tbody></table>
      {[...(r.issues ?? [])].map((m) => <p key={m} className="error">{m}</p>)}
      {[...(r.warnings ?? [])].map((m) => <p key={m} className="warn-text">{m}</p>)}
    </div>
  );
}

/** Upload a GLB through the signed link, then submit it for review. */
function UploadForReview({ product, onDone }: { product: Product; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<GlbReport | null>(null);
  const [msg, setMsg] = useState<string>('');
  const run = useMutation({
    mutationFn: async () => {
      const up = await api<{ key: string; uploadUrl: string }>(`/admin/models/${product.id}/upload-url`, { method: 'POST' });
      const put = await fetch(up.uploadUrl.replace(/^https?:\/\/[^/]+/, ''), { method: 'PUT', body: file! });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      return api<{ validation: GlbReport }>(`/admin/models/${product.id}/validate`, { method: 'POST', body: { key: up.key, review: true } });
    },
    onSuccess: (r) => { setReport(r.validation); setMsg('Submitted for review.'); onDone(); },
    onError: (e) => { setMsg(messageOf(e)); setReport(e instanceof ApiError ? ((e.body as unknown) as GlbReport) : null); },
  });
  return (
    <div className="upload">
      <input type="file" accept=".glb" aria-label={`Model file for ${product.name}`} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMsg(''); setReport(null); }} />
      <button disabled={!file || run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Checking…' : 'Upload for review'}</button>
      {msg && <span className={report?.ok === false ? 'error' : 'muted'}> {msg}</span>}
      {report && !report.ok && <Report r={report} />}
    </div>
  );
}

function Pending({ m, onDone }: { m: ModelQueue['pending'][number]; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const act = useMutation({
    mutationFn: (kind: 'approve' | 'reject') => api(`/admin/models/${m.productId}/${m.version}/${kind}`, { method: 'POST', body: kind === 'reject' ? { reason } : undefined }),
    onSuccess: onDone, onError: (e) => setErr(messageOf(e)),
  });
  const p = m.product!;
  return (
    <div className="card review">
      <h3>{p.name} <span className="muted small">v{m.version}</span></h3>
      <div className="review-grid">
        <div className="photos">{p.images?.map((u) => <img key={u} src={u} alt={`Photo of ${p.name}`} />)}</div>
        <Suspense fallback={<p>Loading viewer…</p>}><ModelStage url={m.url} dims={p.dimensionsCm} /></Suspense>
      </div>
      {m.report && <Report r={m.report} />}
      <div className="row">
        <button className="primary" disabled={act.isPending} onClick={() => act.mutate('approve')}>Approve and publish</button>
        <input placeholder="Reason for rejecting" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Rejection reason" />
        <button disabled={act.isPending || reason.trim().length < 3} onClick={() => act.mutate('reject')}>Reject</button>
      </div>
      {err && <p role="alert" className="error">{err}</p>}
    </div>
  );
}

export default function Models() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['queue'], queryFn: () => api<ModelQueue>('/admin/models-queue') });
  const [tab, setTab] = useState<Tab>('pending');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['queue'] }); qc.invalidateQueries({ queryKey: ['products'] }); };
  const data = q.data;
  // Products that share collection + role + size can reuse one model with a colour swap.
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of data?.needsModel ?? []) {
      const k = `${p.collection ?? p.family ?? ''}|${p.role}|${p.dimensionsCm.w}x${p.dimensionsCm.d}x${p.dimensionsCm.h}`;
      if (k.startsWith('|')) continue;
      (m.get(k) ?? m.set(k, []).get(k)!).push(p);
    }
    return [...m.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
  }, [data]);

  return (
    <>
      <h1>3D models</h1>
      <p className="muted">Every product already works with a true-size simplified shape. Real models replace the shape once approved here.</p>
      <div className="tabs" role="tablist">
        {([['pending', `Awaiting review (${data?.pending.length ?? 0})`], ['needs', `Needs model (${data?.needsModel.length ?? 0})`], ['rejected', `Rejected (${data?.rejected.length ?? 0})`], ['groups', `Shape groups (${groups.length})`]] as [Tab, string][]).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{label}</button>
        ))}
      </div>
      {q.isLoading && <p>Loading…</p>}
      {q.error && <p role="alert" className="error">{messageOf(q.error)}</p>}
      {tab === 'pending' && (data?.pending.length ? data.pending.map((m) => m.product && <Pending key={`${m.productId}-${m.version}`} m={m} onDone={refresh} />) : <p className="muted">Nothing is waiting for review.</p>)}
      {tab === 'needs' && (
        <table><thead><tr><th>Product</th><th>Size (cm)</th><th>Upload a GLB</th></tr></thead><tbody>
          {data?.needsModel.slice(0, 100).map((p) => (
            <tr key={p.id}><td>{p.name}<div className="muted small">{p.category} · {p.role}</div></td><td>{p.dimensionsCm.w} × {p.dimensionsCm.d} × {p.dimensionsCm.h}</td><td><UploadForReview product={p} onDone={refresh} /></td></tr>
          ))}
        </tbody></table>
      )}
      {tab === 'rejected' && (data?.rejected.length ? (
        <table><thead><tr><th>Product</th><th>Version</th><th>Reason</th></tr></thead><tbody>
          {data.rejected.map((m) => <tr key={`${m.productId}-${m.version}`}><td>{m.productId}</td><td>v{m.version}</td><td>{String((m.report as { rejectedReason?: string } | null)?.rejectedReason ?? '')}</td></tr>)}
        </tbody></table>
      ) : <p className="muted">No rejected models.</p>)}
      {tab === 'groups' && (groups.length ? groups.map(([k, ps]) => (
        <div key={k} className="card"><strong>{ps.length} products, same shape</strong> <span className="muted">({k.split('|')[1]} · {k.split('|')[2]} cm)</span>
          <div className="muted small">{ps.map((p) => p.name).join(' · ')}</div>
          <div className="small">One model can serve all of them with a colour swap: upload it for the first, then reuse the file.</div></div>
      )) : <p className="muted">No products share a shape yet.</p>)}
    </>
  );
}
