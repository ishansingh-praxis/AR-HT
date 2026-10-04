import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchAllProducts, messageOf, type Product } from '../api/client';

const PAGE = 50;
type Model = 'real' | 'proxy' | 'none';
const modelOf = (p: Product): Model => (p.model3D ? 'real' : p.proxy ? 'proxy' : 'none');

export default function Products() {
  const { data, error, isLoading } = useQuery({ queryKey: ['products'], queryFn: fetchAllProducts });
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [role, setRole] = useState('');
  const [model, setModel] = useState('');
  const [review, setReview] = useState('');
  const [conf, setConf] = useState('');
  const [page, setPage] = useState(0);

  const options = useMemo(() => ({
    categories: [...new Set((data ?? []).map((p) => p.category))].sort(),
    roles: [...new Set((data ?? []).map((p) => p.role).filter(Boolean))].sort() as string[],
  }), [data]);
  const rows = useMemo(() => (data ?? []).filter((p) =>
    (!q || `${p.name} ${p.id}`.toLowerCase().includes(q.toLowerCase())) && (!category || p.category === category) && (!role || p.role === role) &&
    (!model || modelOf(p) === model) && (!review || (review === 'yes') === !!p.sizeReview) && (!conf || p.dimsConfidence === conf)), [data, q, category, role, model, review, conf]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  return (
    <>
      <h1>Products</h1>
      <div className="filters" role="search">
        <input placeholder="Search name or id" value={q} onChange={(e) => reset(setQ)(e.target.value)} aria-label="Search" />
        <select value={category} onChange={(e) => reset(setCategory)(e.target.value)} aria-label="Category"><option value="">All categories</option>{options.categories.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={role} onChange={(e) => reset(setRole)(e.target.value)} aria-label="Role"><option value="">All roles</option>{options.roles.map((c) => <option key={c}>{c}</option>)}</select>
        <select value={model} onChange={(e) => reset(setModel)(e.target.value)} aria-label="Model status"><option value="">Any model</option><option value="real">Real 3D model</option><option value="proxy">Simplified shape</option><option value="none">No shape</option></select>
        <select value={review} onChange={(e) => reset(setReview)(e.target.value)} aria-label="Size review"><option value="">Any size status</option><option value="yes">Needs size review</option><option value="no">Size OK</option></select>
        <select value={conf} onChange={(e) => reset(setConf)(e.target.value)} aria-label="Confidence"><option value="">Any confidence</option><option value="high">High</option><option value="low">Low</option></select>
      </div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="error">{messageOf(error)}</p>}
      <p className="muted">{rows.length} of {data?.length ?? 0} products</p>
      <table>
        <thead><tr><th>Product</th><th>Category</th><th>Role</th><th>Size (cm)</th><th>Model</th><th>Size check</th></tr></thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id}>
              <td><Link to={`/products/${p.id}`}>{p.name}</Link><div className="muted small">{p.id}</div></td>
              <td>{p.category}</td><td>{p.role}</td>
              <td>{p.dimensionsCm.w} × {p.dimensionsCm.d} × {p.dimensionsCm.h}</td>
              <td><span className={`tag ${modelOf(p)}`}>{{ real: 'real model', proxy: 'shape', none: 'none' }[modelOf(p)]}</span></td>
              <td>{p.sizeReview ? <span className="tag warn" title={p.sizeReview}>review</span> : <span className="tag ok">{p.dimsConfidence === 'low' ? 'low confidence' : 'ok'}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page + 1} of {pages}</span>
        <button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </>
  );
}
