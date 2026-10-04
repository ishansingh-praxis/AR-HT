import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, messageOf, type ImportPreview } from '../api/client';

export default function ImportPage() {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [removeMissing, setRemove] = useState(false);
  const [done, setDone] = useState('');
  const preview = useMutation({
    mutationFn: () => { const f = new FormData(); f.set('file', file!); return api<ImportPreview>('/admin/import', { method: 'POST', form: f }); },
    onMutate: () => setDone(''),
  });
  const publish = useMutation({
    mutationFn: () => api<{ published: number; removed: number; version: number }>(`/admin/import/${preview.data!.id}/publish`, { method: 'POST', body: { removeMissing } }),
    onSuccess: (r) => { setDone(`Published ${r.published} products${r.removed ? `, removed ${r.removed}` : ''}. Catalogue version is now ${r.version}.`); preview.reset(); qc.invalidateQueries(); },
  });
  const p = preview.data;
  const list = (title: string, ids: string[], total: number) => ids.length ? <details><summary>{title} ({total})</summary><p className="small">{ids.join(', ')}{total > ids.length ? ` … and ${total - ids.length} more` : ''}</p></details> : null;

  return (
    <>
      <h1>Import the Shopify export</h1>
      <p className="muted">Upload HomeTown&apos;s product CSV. Nothing changes until you review the differences and press Publish.</p>
      <div className="card">
        <input type="file" accept=".csv,text/csv" aria-label="Shopify CSV" onChange={(e) => { setFile(e.target.files?.[0] ?? null); preview.reset(); setDone(''); }} />
        <button className="primary" disabled={!file || preview.isPending} onClick={() => preview.mutate()}>{preview.isPending ? 'Reading…' : 'Preview changes'}</button>
        {preview.error && <p role="alert" className="error">{messageOf(preview.error)}</p>}
        {done && <p role="status" className="ok">{done}</p>}
      </div>
      {p && (
        <div className="card">
          <h2>{p.products} importable products ({p.skipped} skipped)</h2>
          <div className="kpis">
            <div className="kpi"><b>{p.diff.counts.added}</b>added</div><div className="kpi"><b>{p.diff.counts.changed}</b>changed</div>
            <div className="kpi"><b>{p.diff.counts.removed}</b>not in the file</div><div className="kpi"><b>{p.diff.counts.flagged}</b>size flagged</div>
          </div>
          {list('Added', p.diff.added, p.diff.counts.added)}{list('Changed', p.diff.changed, p.diff.counts.changed)}{list('Not in the file', p.diff.removed, p.diff.counts.removed)}{list('Flagged for size review', p.diff.flagged, p.diff.counts.flagged)}
          {p.issues.length > 0 && <details><summary>Skipped rows ({p.skipped})</summary><ul className="small">{p.issues.map((i: Record<string, unknown>, n) => <li key={n}>{String(i.name)}: {String(i.problem)}</li>)}</ul></details>}
          <label className="check"><input type="checkbox" checked={removeMissing} onChange={(e) => setRemove(e.target.checked)} /> Also remove the {p.diff.counts.removed} products that are not in this file (products with a 3D model are always kept)</label>
          {removeMissing && p.diff.counts.removed > 20 && <p className="notice warn">That is a lot of products. Only tick this for a complete export.</p>}
          <button className="primary" disabled={publish.isPending} onClick={() => publish.mutate()}>{publish.isPending ? 'Publishing…' : 'Publish'}</button>
          {publish.error && <p role="alert" className="error">{messageOf(publish.error)}</p>}
        </div>
      )}
    </>
  );
}
