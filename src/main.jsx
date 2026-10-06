import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Bell, Building2, ChevronDown, FileCheck2, HeartHandshake, Home, Leaf,
  LogOut, Menu, Package, Plus, Settings, Sparkles, Truck, X
} from 'lucide-react';
import { api, clearAuth, getStoredAuth, storeAuth, ApiError, UNAUTHORIZED_EVENT } from './api';
import { Landing, Brand } from './Landing.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import {
  AddNeed, AddSurplus, Dashboard, DeliveriesPage, EmergenciesPage, ImpactPage, MatchesPage,
  NeedsPage, RequestsPage, SettingsPage, SurplusPage
} from './pages.jsx';
import {
  Empty, ErrorBox, Field, LoadingScreen, LocationFields, ORG_TYPES, Toasts, cx, initials, label, optNumber, toast
} from './ui.jsx';
import './styles.css';
import './extra.css';

// ADMIN is not offered here: the backend now rejects self-registration as ADMIN.
const SELF_SERVICE_ROLES = ['PROVIDER', 'RECIPIENT'];

/* ------------------------------------------------------------------ auth */

function useAuth() {
  const [auth, setAuth] = useState(() => getStoredAuth());
  const login = useCallback(data => { storeAuth(data); setAuth(data); }, []);
  const logout = useCallback(() => { clearAuth(); setAuth(null); }, []);

  // api.js fires this on any 401 outside /auth/*, and the token may also simply run out.
  useEffect(() => {
    const onUnauthorized = () => setAuth(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    const timer = setInterval(() => { if (!getStoredAuth()) setAuth(null); }, 60000);
    return () => { window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized); clearInterval(timer); };
  }, []);
  return { auth, login, logout };
}

function App() {
  const authHook = useAuth();
  return <>
    <Routes>
      <Route path="/" element={<Landing auth={authHook.auth} />} />
      <Route path="/login" element={authHook.auth ? <Navigate to="/app" replace /> : <AuthPage mode="login" onAuth={authHook.login} />} />
      <Route path="/register" element={authHook.auth ? <Navigate to="/app" replace /> : <AuthPage mode="register" onAuth={authHook.login} />} />
      <Route path="/app/*" element={authHook.auth ? <Shell {...authHook} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Toasts />
  </>;
}

function AuthPage({ mode, onAuth }) {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => { try { const n = sessionStorage.getItem('surplus_notice'); sessionStorage.removeItem('surplus_notice'); return n || ''; } catch { return ''; } });
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'PROVIDER' });
  const isReg = mode === 'register';

  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const email = form.email.trim();
      const data = isReg
        ? await api.register({ name: form.name.trim(), email, password: form.password, phone: form.phone.trim() || undefined, role: form.role })
        : await api.login({ email, password: form.password });
      if (!data?.token) throw new ApiError('The server did not return a token.', 500);
      onAuth(data); nav('/app');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return <div className="auth-page"><div className="auth-side"><Brand light /><div className="auth-side-copy"><span className="eyebrow">SURPLUSLINK</span><h1>Make unused resources matter.</h1><p>A focused workspace for organizations that want to redistribute surplus with less friction.</p></div></div>
    <div className="auth-form-wrap"><button className="back-link" onClick={() => nav('/')}><ArrowRight size={15} style={{ transform: 'rotate(180deg)' }} /> Back home</button>
      <div className="auth-form"><div className="auth-title"><span className="eyebrow green">{isReg ? 'CREATE WORKSPACE' : 'WELCOME BACK'}</span><h2>{isReg ? 'Start making surplus useful.' : 'Good to see you again.'}</h2><p>{isReg ? 'Create an account and connect your organization.' : 'Sign in to continue to your redistribution workspace.'}</p></div>
        {error && <div className="alert error"><AlertTriangle size={16} />{error}</div>}
        <form onSubmit={submit}>
          {isReg && <div className="form-grid"><Field label="Full name"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Aarav Sharma" /></Field><Field label="Phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98xxxxxx" /></Field></div>}
          <Field label="Email"><input required type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@organization.org" /></Field>
          <Field label="Password"><input required minLength={isReg ? 8 : 1} maxLength={100} type="password" autoComplete={isReg ? 'new-password' : 'current-password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></Field>
          {isReg && <Field label="Account type"><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{SELF_SERVICE_ROLES.map(x => <option key={x} value={x}>{x === 'PROVIDER' ? 'Provider (I have surplus to give)' : 'Recipient (I need resources)'}</option>)}</select></Field>}
          <button className="btn btn-primary btn-block" disabled={loading}>{loading ? 'Connecting…' : isReg ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></button>
        </form>
        <div className="auth-switch">{isReg ? 'Already have an account?' : 'New to SurplusLink?'} <button onClick={() => nav(isReg ? '/login' : '/register')}>{isReg ? 'Log in' : 'Create one'}</button></div>
      </div></div></div>;
}

/* ------------------------------------------------------------------ organization setup */

function OrganizationSetup({ auth, onCreated }) {
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', type: auth.role === 'RECIPIENT' ? 'NGO' : 'CORPORATE', registrationNumber: '', description: '', email: auth.email || '', phone: '', address: '', city: '', state: '', country: 'India', latitude: '', longitude: '' });
  const set = (k, v) => setForm(x => ({ ...x, [k]: v }));
  const submit = async e => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const created = await onCreated({ ...form, name: form.name.trim(), latitude: optNumber(form.latitude), longitude: optNumber(form.longitude) });
      if (created) toast('Organization created', 'success');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return <div className="page setup-page"><div className="setup-card"><div className="setup-icon"><Building2 /></div><span className="eyebrow green">ONE LAST STEP</span><h1>Create your organization</h1>
    <p>Surplus, needs and deliveries are linked to an organization. Set yours up once to unlock the workspace.</p>
    {error && <div className="alert error"><AlertTriangle size={16} />{error}</div>}
    <form onSubmit={submit}>
      <div className="form-grid"><Field label="Organization name"><input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="ABC Foundation" /></Field><Field label="Type"><select value={form.type} onChange={e => set('type', e.target.value)}>{ORG_TYPES.map(x => <option key={x} value={x}>{label(x)}</option>)}</select></Field></div>
      <div className="form-grid"><Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field><Field label="Phone"><input value={form.phone} onChange={e => set('phone', e.target.value)} /></Field></div>
      <Field label="Address"><input value={form.address} onChange={e => set('address', e.target.value)} /></Field>
      <div className="form-grid"><Field label="City"><input value={form.city} onChange={e => set('city', e.target.value)} /></Field><Field label="State"><input value={form.state} onChange={e => set('state', e.target.value)} /></Field></div>
      <LocationFields lat={form.latitude} lng={form.longitude} onChange={(la, lo) => setForm(x => ({ ...x, latitude: la, longitude: lo }))} />
      <button className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create organization'} <ArrowRight size={17} /></button>
    </form></div></div>;
}

/* ------------------------------------------------------------------ shell */

function orgErrorTitle(e) {
  if (!(e instanceof ApiError)) return 'Could not load your organization';
  if (e.status === 0) return 'Cannot reach the server';
  if (e.status === 401) return 'Authentication problem';
  if (e.status === 403) return 'Access denied';
  if (e.status >= 500) return 'The server had a problem';
  return 'Could not load your organization';
}

function RoleRoute({ allow, auth, children }) { return allow.includes(auth.role) ? children : <Navigate to="/app" replace />; }

function Shell({ auth, logout }) {
  const [mobile, setMobile] = useState(false);
  const [org, setOrg] = useState(null); const [orgState, setOrgState] = useState('loading'); const [orgError, setOrgError] = useState(null);
  const location = useLocation();
  useEffect(() => { setMobile(false); }, [location.pathname]);

  const loadOrg = useCallback(async () => {
    setOrgState('loading'); setOrgError(null);
    try { setOrg(await api.getOrganizationByUser(auth.userId)); setOrgState('ready'); }
    catch (e) {
      // Only a 404 means "no organization yet". Any other failure (backend down, 403, 500) used to
      // fall through to the setup form, which then failed again on create ("already exists").
      if (e instanceof ApiError && e.status === 404) { setOrg(null); setOrgState('missing'); }
      else { setOrgError(e); setOrgState('error'); }
    }
  }, [auth.userId]);
  useEffect(() => { loadOrg(); }, [loadOrg]);

  const createOrg = async body => {
    try {
      const o = await api.createOrganization(auth.userId, body);
      setOrg(o); setOrgState('ready');
      return o;
    } catch (e) {
      // 409 = "Organization already exists for this user" (e.g. created in another tab): load it instead of failing.
      if (e instanceof ApiError && e.status === 409) { await loadOrg(); return null; }
      throw e;
    }
  };
  const providerSide = auth.role === 'PROVIDER' || auth.role === 'ADMIN';
  const recipientSide = auth.role === 'RECIPIENT' || auth.role === 'ADMIN';
  const navItems = [
    { to: '/app', label: 'Overview', icon: Home, end: true },
    ...(providerSide ? [{ to: '/app/surplus', label: 'Surplus', icon: Package }, { to: '/app/add-surplus', label: 'List surplus', icon: Plus }] : []),
    ...(recipientSide ? [{ to: '/app/needs', label: 'Needs', icon: HeartHandshake }, { to: '/app/add-need', label: 'Create need', icon: Plus }] : []),
    { to: '/app/matches', label: 'Smart matches', icon: Sparkles },
    { to: '/app/requests', label: 'Requests', icon: FileCheck2 },
    { to: '/app/deliveries', label: 'Deliveries', icon: Truck },
    { to: '/app/impact', label: 'Impact', icon: Leaf },
    { to: '/app/emergencies', label: 'Emergency radar', icon: AlertTriangle }
  ];

  let content;
  if (orgState === 'loading') content = <LoadingScreen text="Loading workspace…" />;
  else if (orgState === 'error') content = <div className="error-screen"><AlertTriangle /><strong>{orgErrorTitle(orgError)}</strong><span>{orgError?.message}</span><div className="row-actions"><button className="btn btn-primary" onClick={loadOrg}>Retry</button><button className="btn btn-secondary" onClick={logout}>Log out</button></div></div>;
  else if (orgState === 'missing') content = <OrganizationSetup auth={auth} onCreated={createOrg} />;
  else content = <ErrorBoundary resetKey={location.pathname}><Routes>
    <Route index element={<Dashboard auth={auth} org={org} />} />
    <Route path="surplus" element={<RoleRoute allow={['PROVIDER', 'ADMIN']} auth={auth}><SurplusPage org={org} /></RoleRoute>} />
    <Route path="add-surplus" element={<RoleRoute allow={['PROVIDER', 'ADMIN']} auth={auth}><AddSurplus org={org} /></RoleRoute>} />
    <Route path="needs" element={<RoleRoute allow={['RECIPIENT', 'ADMIN']} auth={auth}><NeedsPage org={org} auth={auth} /></RoleRoute>} />
    <Route path="add-need" element={<RoleRoute allow={['RECIPIENT', 'ADMIN']} auth={auth}><AddNeed org={org} /></RoleRoute>} />
    <Route path="matches" element={<MatchesPage auth={auth} org={org} />} />
    <Route path="requests" element={<RequestsPage auth={auth} org={org} />} />
    <Route path="deliveries" element={<DeliveriesPage auth={auth} org={org} />} />
    <Route path="impact" element={<ImpactPage org={org} />} />
    <Route path="emergencies" element={<EmergenciesPage auth={auth} org={org} />} />
    <Route path="settings" element={<SettingsPage auth={auth} org={org} />} />
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes></ErrorBoundary>;

  return <div className="app-shell">
    <aside className={cx('sidebar', mobile && 'mobile-open')}><div className="sidebar-head"><Brand /><button className="icon-btn mobile-close" onClick={() => setMobile(false)}><X /></button></div>
      <div className="workspace-mini"><div className="org-avatar">{initials(org?.name || auth.name)}</div><div><strong>{org?.name || auth.name}</strong><span>{label(org?.type || auth.role)}</span></div><ChevronDown size={15} /></div>
      <nav className="side-nav">{navItems.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx('side-link', isActive && 'active')}><item.icon size={18} /><span>{item.label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><NavLink to="/app/settings" className="side-link"><Settings size={18} /><span>Settings</span></NavLink><button className="side-link logout" onClick={logout}><LogOut size={18} /><span>Log out</span></button></div>
    </aside>
    {mobile && <div className="mobile-overlay" onClick={() => setMobile(false)}></div>}
    <main className="main-area"><header className="topbar"><button className="icon-btn menu-btn" onClick={() => setMobile(true)}><Menu /></button><div className="crumb"><span>Workspace</span><ChevronDown size={14} /></div>
      <div className="top-actions"><NotificationBell userId={auth.userId} /><div className="user-pill"><div className="avatar">{initials(auth.name)}</div><div><strong>{auth.name}</strong><span>{label(auth.role)}</span></div></div></div></header>
      {content}
    </main>
  </div>;
}

/* ------------------------------------------------------------------ notifications */

function NotificationBell({ userId }) {
  const [count, setCount] = useState(0); const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const wrap = useRef(null);

  const refreshCount = useCallback(() => { api.getUnreadCount(userId).then(c => setCount(Number(c) || 0)).catch(e => { console.warn('Could not refresh the unread notification count:', e.message); }); }, [userId]);
  // The old code passed a function that returned a Promise straight to useEffect, which React rejects
  // ("An effect function must not return anything besides a function"). Poll + clean up properly.
  useEffect(() => { refreshCount(); const t = setInterval(refreshCount, 30000); return () => clearInterval(t); }, [refreshCount]);
  useEffect(() => {
    if (!open) return undefined;
    const close = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const loadList = async () => { setLoading(true); setError(''); try { setItems((await api.getNotifications(userId)).slice(0, 15)); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  const toggle = () => { const next = !open; setOpen(next); if (next) loadList(); };
  const markOne = async n => {
    if (n.isRead) return;
    try { await api.markNotificationRead(n.id); setItems(list => list.map(x => (x.id === n.id ? { ...x, isRead: true } : x))); setCount(c => Math.max(0, c - 1)); } catch (e) { toast(e.message, 'error'); }
  };
  const markAll = async () => {
    try { await api.markAllNotificationsRead(userId); setItems(list => list.map(x => ({ ...x, isRead: true }))); setCount(0); } catch (e) { toast(e.message, 'error'); }
  };

  return <div className="notif-wrap" ref={wrap}>
    <button className="icon-btn" onClick={toggle} aria-label="Notifications"><Bell size={19} />{count > 0 && <b>{count > 9 ? '9+' : count}</b>}</button>
    {open && <div className="notif-pop"><div className="notif-head"><strong>Notifications</strong><button onClick={markAll} disabled={!count}>Mark all read</button></div>
      {loading ? <LoadingScreen text="Loading…" /> : error ? <div className="alert error">{error}</div>
        : items.length ? items.map(n => <div className={cx('notif-item', !n.isRead && 'unread')} key={n.id} onClick={() => markOne(n)}><div><strong>{n.title}</strong><span>{n.message}</span></div></div>)
          : <Empty icon={<Bell />} text="You're all caught up." />}
    </div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><BrowserRouter><App /></BrowserRouter></ErrorBoundary>);