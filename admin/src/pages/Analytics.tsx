import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, messageOf, type Stats } from '../api/client';

const pct = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v * 100)}%`);

/** Simple bar chart (inline SVG, no library): one series, labelled axis ends. */
function Bars({ data, label }: { data: { day: string; v: number }[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.v)), W = 640, H = 140, bw = W / Math.max(data.length, 1);
  return (
    <figure>
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={`${label}: ${data.map((d) => `${d.day} ${d.v}`).join(', ')}`} className="chart">
        {data.map((d, i) => <rect key={d.day} x={i * bw + 1} y={H - (d.v / max) * H} width={Math.max(bw - 2, 1)} height={(d.v / max) * H} fill="#2F6F5E"><title>{`${d.day}: ${d.v}`}</title></rect>)}
        <text x="0" y={H + 14} fontSize="11" fill="#6B7A77">{data[0]?.day ?? ''}</text>
        <text x={W} y={H + 14} fontSize="11" fill="#6B7A77" textAnchor="end">{data.at(-1)?.day ?? ''} (max {max})</text>
      </svg>
    </figure>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, error, isLoading } = useQuery({ queryKey: ['stats', days], queryFn: () => api<Stats>(`/admin/stats?from=${Date.now() - days * 86_400_000}&to=${Date.now()}`) });
  const t = data?.totals;
  return (
    <>
      <h1>Analytics</h1>
      <div className="tabs">{[7, 30, 90].map((n) => <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>Last {n} days</button>)}</div>
      {isLoading && <p>Loading…</p>}
      {error && <p role="alert" className="error">{messageOf(error)}</p>}
      {data && t && (
        <>
          <div className="kpis">
            <div className="kpi"><b>{t.devices}</b>active devices</div><div className="kpi"><b>{t.arSessions}</b>AR sessions</div>
            <div className="kpi"><b>{pct(t.scanSuccessRate)}</b>sessions with a scanned room</div><div className="kpi"><b>{t.placements}</b>pieces placed</div>
            <div className="kpi"><b>{pct(t.recPlacedRate)}</b>suggestions placed</div>
          </div>
          <Bars label="Active devices per day" data={data.daily.map((d) => ({ day: d.day, v: d.devices }))} />
          <Bars label="AR sessions per day" data={data.daily.map((d) => ({ day: d.day, v: d.arSessions }))} />
          <h2>Most placed products</h2>
          <table><tbody>{data.topProducts.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.count}</td></tr>)}</tbody></table>
          {!data.topProducts.length && <p className="muted">No placements in this period.</p>}
          <p className="muted small">Anonymous events only (ids and numbers). Scanned-room rate = sessions that ended with a scanned room ÷ AR sessions. Suggestions placed = rec_placed ÷ rec_shown.</p>
        </>
      )}
    </>
  );
}
