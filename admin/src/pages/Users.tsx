import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getSession, messageOf } from '../api/client';

interface Row { id: number; email: string; name: string | null; role: string; emailVerified: boolean; disabled: boolean; createdAt: number }
interface Audit { id: number; actor_id: number | null; action: string; target: string | null; at: number; data: unknown }

export default function Users() {
  const qc = useQueryClient();
  const me = getSession()?.user;
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const users = useQuery({ queryKey: ['users', q], queryFn: () => api<Row[]>(`/admin/users?q=${encodeURIComponent(q)}`), enabled: me?.role === 'admin' });
  const audit = useQuery({ queryKey: ['audit'], queryFn: () => api<Audit[]>('/admin/audit?limit=100'), enabled: me?.role === 'admin' && tab === 'audit' });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { role?: string; disabled?: boolean } }) => api(`/admin/users/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const del = useMutation({ mutationFn: (id: number) => api(`/admin/users/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  if (me?.role !== 'admin') return <Navigate to="/products" replace />;
  const err = patch.error ?? del.error ?? users.error;
  return (
    <>
      <h1>Users &amp; audit</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'users'} className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Users</button>
        <button role="tab" aria-selected={tab === 'audit'} className={tab === 'audit' ? 'on' : ''} onClick={() => setTab('audit')}>Audit log</button>
      </div>
      {err && <p role="alert" className="error">{messageOf(err)}</p>}
      {tab === 'users' ? (
        <>
          <input placeholder="Search email or name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
          <table><thead><tr><th>User</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>
            {users.data?.map((u) => (
              <tr key={u.id}>
                <td>{u.email}<div className="muted small">{u.name ?? ''} {u.emailVerified ? '' : '· email not verified'}</div></td>
                <td><select value={u.role} disabled={u.id === me.id || patch.isPending} aria-label={`Role of ${u.email}`} onChange={(e) => patch.mutate({ id: u.id, body: { role: e.target.value } })}><option>user</option><option>editor</option><option>admin</option></select></td>
                <td>{u.disabled ? <span className="tag warn">disabled</span> : <span className="tag ok">active</span>}</td>
                <td className="row">
                  <button disabled={u.id === me.id} onClick={() => patch.mutate({ id: u.id, body: { disabled: !u.disabled } })}>{u.disabled ? 'Enable' : 'Disable'}</button>
                  <button className="danger" disabled={u.id === me.id} onClick={() => confirm(`Delete ${u.email} and all their designs?`) && del.mutate(u.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        </>
      ) : (
        <table><thead><tr><th>When</th><th>Action</th><th>Target</th><th>By</th><th>Details</th></tr></thead><tbody>
          {audit.data?.map((a) => <tr key={a.id}><td>{new Date(a.at).toLocaleString()}</td><td>{a.action}</td><td>{a.target}</td><td>{a.actor_id ?? 'cli'}</td><td className="small">{a.data ? JSON.stringify(a.data) : ''}</td></tr>)}
        </tbody></table>
      )}
    </>
  );
}
