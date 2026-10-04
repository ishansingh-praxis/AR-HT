import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { plausible, sizeFlag } from '@shared/catalogue-rules.mjs';
import { api, fetchAllProducts, messageOf, type Product } from '../api/client';

type Draft = { name: string; category: string; role: string; subcategory: string; brand: string; description: string; material: string; colorFamily: string; family: string; collection: string; retailerUrl: string; images: string; w: string; d: string; h: string; setSize: string; placements: string };
const toDraft = (p: Product & Record<string, any>): Draft => ({
  name: p.name, category: p.category, role: p.role ?? '', subcategory: p.subcategory ?? '', brand: p.brand ?? '', description: p.description ?? '', material: p.material ?? '', colorFamily: p.colorFamily ?? '',
  family: p.family ?? '', collection: p.collection ?? '', retailerUrl: p.retailerUrl ?? '', images: (p.images ?? []).join('\n'), w: String(p.dimensionsCm.w), d: String(p.dimensionsCm.d), h: String(p.dimensionsCm.h),
  setSize: p.setSize ? String(p.setSize) : '', placements: (p.ar?.placements ?? ['floor']).join(','),
});

export default function ProductEdit() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['products'], queryFn: fetchAllProducts });
  const product = data?.find((p) => p.id === id) as (Product & Record<string, any>) | undefined;
  const [d, setD] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { if (product) setD(toDraft(product)); }, [product]);

  const save = useMutation({
    mutationFn: async () => {
      if (!product || !d) return;
      const body: Record<string, unknown> = { id: product.id, name: d.name.trim(), category: d.category.trim(), dimensionsCm: { w: +d.w, d: +d.d, h: +d.h } };
      const put = (k: string, v: unknown) => { if (v !== undefined && v !== '') body[k] = v; };
      put('role', d.role); put('subcategory', d.subcategory); put('brand', d.brand); put('description', d.description); put('material', d.material);
      put('colorFamily', d.colorFamily); put('family', d.family); put('collection', d.collection); put('retailerUrl', d.retailerUrl);
      put('images', d.images.split('\n').map((s) => s.trim()).filter(Boolean)); put('setSize', d.setSize ? +d.setSize : undefined);
      put('ar', { placements: d.placements.split(',').map((s) => s.trim()).filter(Boolean) });
      const f = new FormData(); f.set('product', JSON.stringify(body));
      await api(`/admin/products/${product.id}`, { method: 'PUT', form: f });
    },
    onSuccess: () => { setMsg({ ok: true, text: 'Saved. Apps pick it up on their next catalogue refresh.' }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e) => setMsg({ ok: false, text: messageOf(e) }),
  });
  const checked = useMutation({
    mutationFn: () => api(`/admin/products/${id}/size-checked`, { method: 'POST' }),
    onSuccess: () => { setMsg({ ok: true, text: 'Marked as checked.' }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (e) => setMsg({ ok: false, text: messageOf(e) }),
  });

  if (!data) return <p>Loading…</p>;
  if (!product || !d) return <p>Product not found. <Link to="/products">Back</Link></p>;
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  const w = +d.w, dd = +d.d, h = +d.h;
  // Live plausibility, using the same rules as the importer.
  const warnings = [!plausible(w, dd, h) && 'This size is outside the plausible range for furniture (check units and which number is height).', sizeFlag(d.category, d.name, w, dd, h)].filter(Boolean) as string[];
  const dimsChanged = w !== product.dimensionsCm.w || dd !== product.dimensionsCm.d || h !== product.dimensionsCm.h;
  const field = (label: string, k: keyof Draft, type = 'text') => <label>{label}<input type={type} value={d[k]} onChange={set(k)} /></label>;

  return (
    <>
      <p><Link to="/products">← Products</Link></p>
      <h1>{product.name}</h1>
      <p className="muted">{product.id}</p>
      {product.sizeReview && <div className="notice warn">Size needs review: {product.sizeReview}. Not placeable in the app until it is checked.
        <button onClick={() => checked.mutate()} disabled={checked.isPending}>Mark size checked</button></div>}
      <form className="card form" onSubmit={(e) => { e.preventDefault(); setMsg(null); save.mutate(); }}>
        <div className="grid">
          {field('Name', 'name')}{field('Category', 'category')}{field('Role', 'role')}{field('Subcategory', 'subcategory')}
          {field('Brand', 'brand')}{field('Material', 'material')}{field('Colour family', 'colorFamily')}{field('Family (colour variants share it)', 'family')}
          {field('Collection', 'collection')}{field('Sold as a set of', 'setSize', 'number')}{field('HomeTown product URL', 'retailerUrl')}{field('Placements (floor, wall)', 'placements')}
        </div>
        <fieldset><legend>Real size (cm)</legend>
          <div className="grid three">{field('Width', 'w', 'number')}{field('Depth', 'd', 'number')}{field('Height', 'h', 'number')}</div>
          {warnings.map((m) => <p key={m} className="error" role="status">{m}</p>)}
          {dimsChanged && product.model3D && <p className="notice warn">This product has a 3D model. Changing its size means the model must be uploaded again and validated against the new size (3D models page).</p>}
        </fieldset>
        <label>Description<textarea rows={3} value={d.description} onChange={set('description')} /></label>
        <label>Image URLs (one per line)<textarea rows={4} value={d.images} onChange={set('images')} /></label>
        <div className="thumbs">{d.images.split('\n').filter(Boolean).slice(0, 4).map((u) => <img key={u} src={u} alt="" />)}</div>
        {msg && <p role="status" className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
        <button className="primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
      </form>
    </>
  );
}
