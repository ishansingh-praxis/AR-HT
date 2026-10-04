import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { planSvg } from '@plan/planSvg.mjs';
import { checkRoom } from '@shared/room-checks.mjs';
import { api, fetchAllProducts, messageOf, type Product, type Room } from '../api/client';
import { PAD, pieceAt, pointToCm, scaleOf, turn, uniqueId } from '../lib';

const WIDTH = 560;
const TYPES = ['living', 'bedroom', 'dining', 'study', 'other'];
type Piece = Room['pieces'][number];
const blank = (taken: string[]): Room => ({ id: uniqueId('new room', taken), title: 'New room', roomType: 'living', style: [], blurb: '', roomCm: { w: 400, d: 350 }, pieces: [] });

export default function Rooms() {
  const qc = useQueryClient();
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: () => api<Room[]>('/admin/rooms') });
  const products = useQuery({ queryKey: ['products'], queryFn: fetchAllProducts });
  const [room, setRoom] = useState<Room | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [sel, setSel] = useState(-1);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const drag = useRef<{ i: number; dx: number; dz: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const checks = useMemo(() => (room ? checkRoom(room as never, (id: string) => byId.get(id) as never) : { problems: [], pieceProblems: {} as Record<number, string[]> }), [room, byId]);
  const geo = room?.pieces.map((p) => { const pr = byId.get(p.productId); return pr ? { ...p, w: pr.dimensionsCm.w, d: pr.dimensionsCm.d } : null; });

  const save = useMutation({
    mutationFn: () => api<Room>(`/admin/rooms/${room!.id}`, { method: 'PUT', body: room }),
    onSuccess: () => { setMsg({ ok: true, text: 'Published. It is now served at /v1/rooms.' }); setIsNew(false); qc.invalidateQueries({ queryKey: ['rooms'] }); },
    onError: (e) => setMsg({ ok: false, text: messageOf(e) }),
  });
  const del = useMutation({
    mutationFn: () => api(`/admin/rooms/${room!.id}`, { method: 'DELETE' }),
    onSuccess: () => { setRoom(null); qc.invalidateQueries({ queryKey: ['rooms'] }); },
    onError: (e) => setMsg({ ok: false, text: messageOf(e) }),
  });

  const open = (r: Room) => { setRoom(structuredClone(r)); setIsNew(false); setSel(-1); setMsg(null); };
  const patchPiece = (i: number, f: Partial<Piece>) => setRoom((r) => r && { ...r, pieces: r.pieces.map((p, n) => (n === i ? { ...p, ...f } : p)) });

  const svgPoint = (e: React.PointerEvent) => {
    const b = svgRef.current!.getBoundingClientRect();
    const sx = (e.clientX - b.left) * (WIDTH / b.width), sy = (e.clientY - b.top) * (WIDTH / b.width);
    return pointToCm(sx, sy, room!.roomCm, WIDTH);
  };
  const down = (e: React.PointerEvent) => {
    const raw = (() => { const b = svgRef.current!.getBoundingClientRect(); const k = scaleOf(room!.roomCm.w, WIDTH); return { x: ((e.clientX - b.left) * (WIDTH / b.width) - PAD) / k, z: ((e.clientY - b.top) * (WIDTH / b.width)) / k }; })();
    const i = pieceAt(raw.x, raw.z, (geo ?? []).map((g) => g ?? { x: -1e6, z: -1e6, rot: 0, w: 0, d: 0 }));
    setSel(i);
    if (i >= 0) { drag.current = { i, dx: room!.pieces[i].x - raw.x, dz: room!.pieces[i].z - raw.z }; (e.target as Element).setPointerCapture(e.pointerId); }
  };
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = svgPoint(e), { i, dx, dz } = drag.current;
    patchPiece(i, { x: Math.min(room!.roomCm.w, Math.max(0, Math.round((p.x + dx) / 5) * 5)), z: Math.min(room!.roomCm.d, Math.max(0, Math.round((p.z + dz) / 5) * 5)) });
  };

  const add = (p: Product) => {
    if (!room) return;
    const piece: Piece = { productId: p.id, x: Math.round(room.roomCm.w / 2), z: Math.round(room.roomCm.d / 2), rot: 0, anchor: room.pieces.length === 0 };
    setRoom({ ...room, pieces: [...room.pieces, piece] }); setSel(room.pieces.length); setSearch('');
  };
  const candidates = search.length < 2 ? [] : (products.data ?? []).filter((p) => !p.sizeReview && (p.proxy || p.model3D) && `${p.name} ${p.role}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  const svg = room ? planSvg({
    roomCm: room.roomCm, width: WIDTH, highlight: sel, flagged: Object.keys(checks.pieceProblems).map(Number), title: `Plan of ${room.title}`,
    pieces: room.pieces.flatMap((p) => { const pr = byId.get(p.productId); return pr ? [{ x: p.x, z: p.z, rot: p.rot, w: pr.dimensionsCm.w, d: pr.dimensionsCm.d, fill: (pr as { colors?: { hex: string }[] }).colors?.[0]?.hex, label: String(pr.role).replace('-', ' ') }] : []; }),
  }) : '';
  const k = room ? scaleOf(room.roomCm.w, WIDTH) : 1;
  const selected = room && sel >= 0 ? room.pieces[sel] : null;

  return (
    <>
      <h1>Sample rooms</h1>
      <div className="split">
        <aside className="card">
          <button className="primary" onClick={() => { setRoom(blank(rooms.data?.map((r) => r.id) ?? [])); setIsNew(true); setSel(-1); setMsg(null); }}>New room</button>
          {rooms.isLoading && <p>Loading…</p>}
          <ul className="list">{rooms.data?.map((r) => <li key={r.id}><button className={`link ${room?.id === r.id ? 'on' : ''}`} onClick={() => open(r)}>{r.title}</button><span className="muted small"> {r.roomType} · {((r.roomCm.w * r.roomCm.d) / 1e4).toFixed(0)} m²</span></li>)}</ul>
        </aside>
        {room ? (
          <section>
            <div className="card form">
              <div className="grid">
                <label>Title<input value={room.title} onChange={(e) => setRoom({ ...room, title: e.target.value, ...(isNew ? { id: uniqueId(e.target.value, rooms.data?.map((r) => r.id) ?? []) } : {}) })} /></label>
                <label>Type<select value={room.roomType} onChange={(e) => setRoom({ ...room, roomType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
                <label>Width (cm)<input type="number" value={room.roomCm.w} onChange={(e) => setRoom({ ...room, roomCm: { ...room.roomCm, w: +e.target.value } })} /></label>
                <label>Depth (cm)<input type="number" value={room.roomCm.d} onChange={(e) => setRoom({ ...room, roomCm: { ...room.roomCm, d: +e.target.value } })} /></label>
              </div>
              <label>Blurb<textarea rows={2} value={room.blurb} onChange={(e) => setRoom({ ...room, blurb: e.target.value })} /></label>
            </div>
            <div className="editor">
              <div className="canvas" style={{ width: WIDTH }}>
                <div dangerouslySetInnerHTML={{ __html: svg }} />
                {/* Transparent layer on top of the drawing: pointer events for dragging pieces. */}
                <svg ref={svgRef} className="hit" width={WIDTH} height={room.roomCm.d * k + PAD} viewBox={`0 0 ${WIDTH} ${room.roomCm.d * k + PAD}`}
                  onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} aria-label="Drag pieces to move them" role="application" />
              </div>
              <div className="side">
                <label>Add a piece<input placeholder="Search products (2+ letters)" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
                <ul className="list">{candidates.map((p) => <li key={p.id}><button className="link" onClick={() => add(p)}>{p.name}</button> <span className="muted small">{p.dimensionsCm.w}×{p.dimensionsCm.d}</span></li>)}</ul>
                {selected ? (
                  <div className="card">
                    <strong>{byId.get(selected.productId)?.name ?? selected.productId}</strong>
                    <div className="row">
                      <button onClick={() => patchPiece(sel, { rot: turn(selected.rot, -90) })} aria-label="Rotate 90 degrees left">⟲ 90°</button>
                      <button onClick={() => patchPiece(sel, { rot: turn(selected.rot, 90) })} aria-label="Rotate 90 degrees right">⟳ 90°</button>
                      <button onClick={() => patchPiece(sel, { rot: turn(selected.rot, -15) })}>-15°</button>
                      <button onClick={() => patchPiece(sel, { rot: turn(selected.rot, 15) })}>+15°</button>
                    </div>
                    <div className="grid three">
                      <label>x (cm)<input type="number" value={selected.x} onChange={(e) => patchPiece(sel, { x: +e.target.value })} /></label>
                      <label>z (cm)<input type="number" value={selected.z} onChange={(e) => patchPiece(sel, { z: +e.target.value })} /></label>
                      <label>rotation<input type="number" value={selected.rot} onChange={(e) => patchPiece(sel, { rot: +e.target.value })} /></label>
                    </div>
                    <label className="check"><input type="checkbox" checked={selected.anchor} onChange={() => setRoom({ ...room, pieces: room.pieces.map((p, n) => ({ ...p, anchor: n === sel })) })} /> Anchor piece (the one suggestions are built around)</label>
                    <button className="danger" onClick={() => { setRoom({ ...room, pieces: room.pieces.filter((_, n) => n !== sel) }); setSel(-1); }}>Remove piece</button>
                  </div>
                ) : <p className="muted">Click a piece to select it. Drag to move (5 cm steps).</p>}
              </div>
            </div>
            <div className="card" aria-live="polite">
              <strong>{checks.problems.length ? `${checks.problems.length} problem${checks.problems.length === 1 ? '' : 's'}` : 'All checks pass'}</strong>
              <ul>{checks.problems.map((m, i) => <li key={i} className="error">{m}</li>)}</ul>
              {msg && <p role="status" className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
              <div className="row">
                <button className="primary" disabled={save.isPending || checks.problems.length > 0 || !room.pieces.length} onClick={() => { setMsg(null); save.mutate(); }}>{save.isPending ? 'Publishing…' : 'Publish'}</button>
                {!isNew && <button className="danger" disabled={del.isPending} onClick={() => confirm(`Delete "${room.title}"?`) && del.mutate()}>Delete room</button>}
              </div>
            </div>
          </section>
        ) : <p className="muted">Pick a room or create a new one.</p>}
      </div>
    </>
  );
}
