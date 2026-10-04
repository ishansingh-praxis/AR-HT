import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getSession, signOut, subscribe } from './api/client';
import Login from './pages/Login';
import Products from './pages/Products';
import ProductEdit from './pages/ProductEdit';
import Models from './pages/Models';
import Rooms from './pages/Rooms';
import ImportPage from './pages/Import';
import Users from './pages/Users';
import Analytics from './pages/Analytics';
import './styles.css';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

function Shell() {
  const s = useSyncExternalStore(subscribe, getSession);
  if (!s) return <Navigate to="/login" replace />;
  const admin = s.user.role === 'admin';
  return (
    <div className="shell">
      <nav aria-label="Main">
        <div className="brand">HomeTown AR<small>admin</small></div>
        <NavLink to="/products">Products</NavLink>
        <NavLink to="/models">3D models</NavLink>
        <NavLink to="/rooms">Sample rooms</NavLink>
        <NavLink to="/import">Import</NavLink>
        {admin && <NavLink to="/users">Users &amp; audit</NavLink>}
        <NavLink to="/analytics">Analytics</NavLink>
        <div className="spacer" />
        <div className="who">{s.user.email}<br />{s.user.role}</div>
        <button className="link" onClick={signOut}>Sign out</button>
      </nav>
      <main><Outlet /></main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter basename="/admin">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Shell />}>
            <Route index element={<Navigate to="/products" replace />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductEdit />} />
            <Route path="/models" element={<Models />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/users" element={<Users />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
