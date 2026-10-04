import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getSession, messageOf, signIn } from '../api/client';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (getSession()) return <Navigate to="/products" replace />;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { await signIn(email.trim(), password); nav('/products'); } catch (err) { setError(messageOf(err)); } finally { setBusy(false); }
  };
  return (
    <form className="login card" onSubmit={submit}>
      <h1>HomeTown AR admin</h1>
      <p className="muted">Sign in with an editor or admin account.</p>
      <label>Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p role="alert" className="error">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
