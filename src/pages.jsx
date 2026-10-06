import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, Box, Check, Clock3, HeartHandshake, Leaf, MapPin, Package,
  Plus, Recycle, Search, ShieldCheck, Sparkles, Truck, Users
} from 'lucide-react';
import { api } from './api';
import {
  CATEGORIES, CONDITIONS, URGENCY, DELIVERY_METHODS, SIGNALS,
  CategoryIcon, CheckBox, DataTable, Empty, ErrorBox, Field, LoadingScreen, LocationFields, Modal,
  PageHeader, StatCard, Status, cx, fmtDate, fmtDateTime, initials, label, num, optNumber,
  toApiDateTime, toInputDateTime, toast, useAsync
} from './ui.jsx';

const isProviderRole = auth => auth.role === 'PROVIDER' || auth.role === 'ADMIN';
const isRecipientRole = auth => auth.role === 'RECIPIENT' || auth.role === 'ADMIN';

/* ------------------------------------------------------------------ shared loaders */

// GET /api/requests and /api/deliveries return EVERY organization's rows and are ADMIN-only now,
// so every role other than ADMIN uses the organization-scoped endpoints.
function loadRequests(auth, org) {
  if (auth.role === 'ADMIN') return api.getAllRequests();
  return auth.role === 'PROVIDER' ? api.getProviderRequests(org.id) : api.getRecipientRequests(org.id);
}
function loadDeliveries(auth, org) {
  return auth.role === 'ADMIN' ? api.getAllDeliveries() : api.getOrgDeliveries(org.id);
}
function useLookups() {
  return useAsync(async () => {
    const [surplus, needs] = await Promise.all([api.getSurplus(), api.getNeeds()]);
    return {
      surplus: Object.fromEntries(surplus.map(x => [x.id, x])),
      needs: Object.fromEntries(needs.map(x => [x.id, x]))
    };
  }, []);
}

/* ------------------------------------------------------------------ dashboard */

function Bar({ label: lab, value, max }) {
  const pct = max > 0 ? Math.min(100, Math.round((Number(value) / max) * 100)) : 0;
  return <div className="bar-row"><div><span>{lab}</span><strong>{num(value, 0)}</strong></div><div className="bar-track"><i style={{ width: `${pct}%` }} /></div></div>;
}

export function Dashboard({ auth, org }) {
  const nav = useNavigate();
  const q = useAsync(async () => {
    const calls = {
      surplus: api.getOrgSurplus(org.id),
      needs: api.getOrgNeeds(org.id),
      requests: loadRequests(auth, org),
      deliveries: loadDeliveries(auth, org),
      impact: api.getOrgImpact(org.id),
      emergencies: api.getActiveEmergencies(),
      matches: api.getActiveMatches(),
      all: api.getSurplus(),
      allNeeds: api.getNeeds()
    };
    const keys = Object.keys(calls);
    const settled = await Promise.allSettled(Object.values(calls));
    const out = {}; const failed = [];
    settled.forEach((r, i) => { if (r.status === 'fulfilled') out[keys[i]] = r.value; else failed.push(r.reason); });
    if (failed.length === keys.length) throw failed[0];
    const mySurplusIds = new Set((out.surplus || []).map(x => x.id));
    const myNeedIds = new Set((out.needs || []).map(x => x.id));
    out.myMatches = (out.matches || []).filter(m => mySurplusIds.has(m.surplusId) || myNeedIds.has(m.needId));
    out.partialError = failed[0] || null;
    return out;
  }, [org.id, auth.role]);

  const d = q.data || {};
  const surplus = d.surplus || [], needs = d.needs || [], deliveries = d.deliveries || [], emergencies = d.emergencies || [];
  const impact = d.impact || {};
  const quick = auth.role === 'RECIPIENT'
    ? { to: '/app/add-need', label: 'Create a need', icon: <HeartHandshake size={17} /> }
    : { to: '/app/add-surplus', label: 'List surplus', icon: <Package size={17} /> };
  const loading = q.loading && !q.data;
  const show = v => (loading ? '—' : v);
  const maxImpact = Math.max(1, Number(impact.organizationsSupported || 0), Number(impact.completedMatches || 0), Number(impact.estimatedBeneficiaries || 0));

  return <div className="page">
    <PageHeader eyebrow="OVERVIEW" title={`Good to see you, ${(auth.name || '').split(' ')[0] || 'there'}.`} description="Here’s what is moving through your redistribution network today."
      action={<button className="btn btn-primary" onClick={() => nav(quick.to)}>{quick.icon}{quick.label}</button>} />
    <ErrorBox error={q.error || d.partialError} onRetry={q.reload} />
    <div className="stat-grid">
      <StatCard icon={<Package />} title="Active surplus" value={show(surplus.filter(x => x.status === 'AVAILABLE').length)} sub="available listings" />
      <StatCard icon={<HeartHandshake />} title="Open needs" value={show(needs.filter(x => x.status === 'OPEN').length)} sub="requirements" />
      <StatCard icon={<Sparkles />} title="Active matches" value={show((d.myMatches || []).length)} sub="involving your organization" />
      <StatCard icon={<Truck />} title="Delivered" value={show(deliveries.filter(x => x.status === 'DELIVERED').length)} sub="completed handoffs" />
    </div>
    <div className="dashboard-grid">
      <div className="panel panel-wide">
        <div className="panel-head"><div><span className="panel-kicker">NETWORK ACTIVITY</span><h3>Recent {auth.role === 'RECIPIENT' ? 'needs' : 'surplus'}</h3></div><NavLink to={auth.role === 'RECIPIENT' ? '/app/needs' : '/app/surplus'} className="text-link">View all <ArrowRight size={15} /></NavLink></div>
        {(auth.role === 'RECIPIENT' ? needs : surplus).length === 0
          ? <Empty icon={<Package />} text="Nothing listed yet." action={<NavLink to={quick.to} className="text-link">{quick.label}</NavLink>} />
          : <div className="mini-list">{(auth.role === 'RECIPIENT' ? needs : surplus).slice(0, 5).map(x => <div className="mini-row" key={x.id}>
            <div className="mini-icon"><CategoryIcon category={x.category} /></div>
            <div className="mini-main"><strong>{x.resourceName}</strong><span>{num(x.quantity ?? x.quantityRequired)} {x.unit} · {label(x.category)}</span></div>
            <Status>{x.status}</Status><span className="row-date">{fmtDate(x.createdAt)}</span></div>)}</div>}
      </div>
      <div className="panel">
        <div className="panel-head"><div><span className="panel-kicker">IMPACT</span><h3>Your organization</h3></div><NavLink to="/app/impact" className="icon-link"><ArrowRight size={17} /></NavLink></div>
        <div className="impact-number"><strong>{num(impact.totalResourcesRedistributed || 0)}</strong><span>resource units redistributed</span></div>
        <div className="impact-bars">
          <Bar label="Organizations" value={impact.organizationsSupported || 0} max={maxImpact} />
          <Bar label="Matches completed" value={impact.completedMatches || 0} max={maxImpact} />
          <Bar label="Beneficiaries" value={impact.estimatedBeneficiaries || 0} max={maxImpact} />
        </div>
      </div>
    </div>
    <div className="dashboard-grid bottom">
      <div className="panel">
        <div className="panel-head"><div><span className="panel-kicker">ATTENTION</span><h3>Expiring soon</h3></div><Clock3 size={18} /></div>
        <div className="mini-list">
          {surplus.filter(x => x.expiryDate && x.status === 'AVAILABLE').sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate)).slice(0, 3).map(x =>
            <div className="mini-row" key={x.id}><div className="mini-icon warning"><Clock3 /></div><div className="mini-main"><strong>{x.resourceName}</strong><span>Expires {fmtDate(x.expiryDate)}</span></div><Status tone={new Date(x.expiryDate) < new Date() ? 'critical' : 'warning'}>{new Date(x.expiryDate) < new Date() ? 'Expired' : 'Priority'}</Status></div>)}
          {!surplus.some(x => x.expiryDate && x.status === 'AVAILABLE') && <Empty icon={<Check />} text="No expiry alerts right now." />}
        </div>
      </div>
      <div className="panel alert-panel">
        <div className="panel-head"><div><span className="panel-kicker">EMERGENCY RADAR</span><h3>Urgent needs</h3></div><AlertTriangle size={18} /></div>
        {emergencies.length ? <div className="emergency-list">{emergencies.slice(0, 3).map(e => <div className="emergency-row" key={e.id}>
          <div><strong>{label(e.category)} · {num(e.quantityRequired)}</strong><span>{e.reason}</span></div><Status tone="critical">{e.severity}</Status></div>)}</div>
          : <Empty icon={<ShieldCheck />} text="No active emergencies." />}
      </div>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ surplus / needs listing */

export function SurplusPage({ org }) { return <DataListing title="Surplus inventory" eyebrow="PROVIDER WORKSPACE" description="Track resources, status and availability." type="surplus" org={org} />; }
export function NeedsPage({ org, auth }) { return <DataListing title="Needs" eyebrow="RECIPIENT WORKSPACE" description="Requirements your organization has published." type="needs" org={org} auth={auth} />; }

function DataListing({ title, eyebrow, description, type, org, auth }) {
  const nav = useNavigate();
  const [search, setSearch] = useState(''); const [filter, setFilter] = useState('ALL');
  const q = useAsync(() => (type === 'surplus' ? api.getOrgSurplus(org.id) : api.getOrgNeeds(org.id)), [org.id, type]);
  const emergencies = useAsync(() => (type === 'needs' ? api.getAllEmergencies() : Promise.resolve([])), [type, org.id]);
  const items = q.data || [];
  const emergencyByNeed = useMemo(() => Object.fromEntries((emergencies.data || []).map(e => [e.needId, e])), [emergencies.data]);
  const filtered = items.filter(x => (x.resourceName || '').toLowerCase().includes(search.toLowerCase()) && (filter === 'ALL' || x.status === filter));
  const statuses = type === 'surplus' ? ['AVAILABLE', 'MATCHED', 'PARTIALLY_RESERVED', 'RESERVED', 'IN_TRANSIT', 'DELIVERED', 'EXPIRED', 'CANCELLED'] : ['OPEN', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CLOSED', 'CANCELLED'];
  return <div className="page">
    <PageHeader eyebrow={eyebrow} title={title} description={description} action={<button className="btn btn-primary" onClick={() => nav(type === 'surplus' ? '/app/add-surplus' : '/app/add-need')}><Plus size={17} />{type === 'surplus' ? 'List surplus' : 'Create need'}</button>} />
    <ErrorBox error={q.error} onRetry={q.reload} />
    <div className="toolbar"><div className="searchbox"><Search size={17} /><input placeholder={`Search ${type}…`} value={search} onChange={e => setSearch(e.target.value)} /></div>
      <select value={filter} onChange={e => setFilter(e.target.value)}><option value="ALL">All status</option>{statuses.map(x => <option key={x} value={x}>{label(x)}</option>)}</select></div>
    {q.loading && !q.data ? <LoadingScreen /> : <div className="card-grid">
      {filtered.map(item => <ResourceCard key={item.id} item={item} type={type} org={org} emergency={emergencyByNeed[item.id]} onRefresh={() => { q.reload(); emergencies.reload(); }} />)}
      {!filtered.length && !q.error && <div className="panel empty-wide"><Empty icon={type === 'surplus' ? <Package /> : <HeartHandshake />} text={`No ${type} found.`} /></div>}
    </div>}
  </div>;
}

function ResourceCard({ item, type, org, emergency, onRefresh }) {
  const [busy, setBusy] = useState(false); const [raise, setRaise] = useState(false);
  const isSurplus = type === 'surplus';
  const act = async (fn, okMessage) => { setBusy(true); try { await fn(); if (okMessage) toast(okMessage, 'success'); onRefresh(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  const closable = isSurplus ? item.status === 'AVAILABLE' : item.status === 'OPEN';
  const deletable = isSurplus ? ['AVAILABLE', 'CANCELLED', 'EXPIRED'].includes(item.status) : ['OPEN', 'CLOSED', 'CANCELLED'].includes(item.status);
  const nav = useNavigate();
  return <div className="resource-card">
    <div className="resource-top"><div className="resource-symbol"><CategoryIcon category={item.category} /></div><Status>{item.status}</Status></div>
    <h3>{item.resourceName}</h3>
    <p>{item.description || item.purpose || 'No description provided.'}</p>
    <div className="resource-meta"><span><Box size={14} />{num(item.quantity ?? item.quantityRequired)} {item.unit}</span><span><MapPin size={14} />{item.city || 'Location not set'}</span></div>
    {item.expiryDate && <div className="expiry"><Clock3 size={14} /> Expires {fmtDate(item.expiryDate)}</div>}
    {!isSurplus && <div className="urgency-line"><span>Urgency</span><Status tone={item.urgency?.toLowerCase()}>{item.urgency}</Status></div>}
    {!isSurplus && item.isEmergency && <div className="urgency-line"><span>Emergency</span>{emergency ? <Status>{emergency.status}</Status> : <Status tone="critical">Flagged</Status>}</div>}
    <div className="resource-footer"><small>{fmtDate(item.createdAt)}</small>
      <div>
        {closable && <button className="tiny-btn" disabled={busy} onClick={() => act(() => (isSurplus ? api.updateSurplusStatus(item.id, 'CANCELLED') : api.updateNeedStatus(item.id, 'CLOSED')), isSurplus ? 'Listing cancelled' : 'Need closed')}>{isSurplus ? 'Cancel' : 'Close'}</button>}
        {!isSurplus && item.status === 'CLOSED' && <button className="tiny-btn" disabled={busy} onClick={() => act(() => api.updateNeedStatus(item.id, 'OPEN'), 'Need reopened')}>Reopen</button>}
        {isSurplus && item.status === 'CANCELLED' && <button className="tiny-btn" disabled={busy} onClick={() => act(() => api.updateSurplusStatus(item.id, 'AVAILABLE'), 'Listing is available again')}>Relist</button>}
        {!isSurplus && item.isEmergency && item.status === 'OPEN' && !emergency && <button className="tiny-btn danger" disabled={busy} onClick={() => setRaise(true)}>Raise emergency</button>}
        {deletable && <button className="tiny-btn danger" disabled={busy} onClick={() => { if (window.confirm(`Delete "${item.resourceName}"?`)) act(() => (isSurplus ? api.deleteSurplus(item.id) : api.deleteNeed(item.id)), 'Deleted'); }}>Delete</button>}
        {closable && <button className="tiny-btn primary" onClick={() => nav('/app/matches')}>Find matches <ArrowRight size={13} /></button>}
      </div>
    </div>
    {raise && <EmergencyModal need={item} close={() => setRaise(false)} done={() => { setRaise(false); onRefresh(); }} />}
  </div>;
}

function EmergencyModal({ need, close, done }) {
  const [form, setForm] = useState({ reason: need.purpose || '', severity: need.urgency === 'CRITICAL' ? 'CRITICAL' : 'URGENT', requiredBy: need.requiredBy ? need.requiredBy.slice(0, 16) : toInputDateTime(new Date(Date.now() + 24 * 3600 * 1000)), maxDeliveryMinutes: '' });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setError('');
    if (new Date(form.requiredBy) <= new Date()) { setError('Required-by must be in the future.'); return; }
    setBusy(true);
    try {
      await api.createEmergency({ needId: need.id, category: need.category, quantityRequired: need.quantityRequired, reason: form.reason, severity: form.severity, requiredBy: toApiDateTime(form.requiredBy), maxDeliveryMinutes: optNumber(form.maxDeliveryMinutes) });
      toast('Emergency request raised', 'success'); done();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Modal title="RAISE EMERGENCY" close={close}>
    <h2>{need.resourceName}</h2>
    {error && <div className="alert error page-alert"><AlertTriangle size={16} />{error}</div>}
    <form onSubmit={submit}>
      <Field label="Reason"><textarea required maxLength={2000} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></Field>
      <Field label="Severity"><select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}><option value="URGENT">Urgent</option><option value="CRITICAL">Critical</option></select></Field>
      <Field label="Required by"><input type="datetime-local" required value={form.requiredBy} onChange={e => setForm({ ...form, requiredBy: e.target.value })} /></Field>
      <Field label="Max delivery minutes (optional)"><input type="number" min="1" value={form.maxDeliveryMinutes} onChange={e => setForm({ ...form, maxDeliveryMinutes: e.target.value })} /></Field>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Raising…' : 'Raise emergency'}</button>
    </form>
  </Modal>;
}

/* ------------------------------------------------------------------ create surplus / need */

export function AddSurplus({ org }) { return <ResourceForm type="surplus" org={org} />; }
export function AddNeed({ org }) { return <ResourceForm type="need" org={org} />; }

function blankForm(type, org) {
  const common = { resourceName: '', unit: 'pieces', description: '', locationAddress: org.address || '', city: org.city || '', state: org.state || '', latitude: org.latitude ?? '', longitude: org.longitude ?? '' };
  return type === 'surplus'
    ? { ...common, category: 'ELECTRONICS', quantity: '', condition: 'GOOD', availableFrom: '', availableUntil: '', expiryDate: '', isPerishable: false, isEmergencyEligible: false, imageUrl: '' }
    : { ...common, category: 'EDUCATION', quantityRequired: '', urgency: 'HIGH', purpose: '', requiredBy: '', isEmergency: false };
}

function ResourceForm({ type, org }) {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false); const [success, setSuccess] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState(() => blankForm(type, org));
  const set = (k, v) => setForm(x => ({ ...x, [k]: v }));
  const isSurplus = type === 'surplus';

  const submit = async e => {
    e.preventDefault(); setError('');
    const qty = Number(isSurplus ? form.quantity : form.quantityRequired);
    if (!Number.isFinite(qty) || qty < 0.01) { setError('Quantity must be at least 0.01.'); return; }
    if (isSurplus && form.availableFrom && form.availableUntil && form.availableUntil < form.availableFrom) { setError('“Available until” must be after “Available from”.'); return; }
    if (!isSurplus && form.requiredBy && new Date(form.requiredBy) < new Date()) { setError('“Required by” cannot be in the past.'); return; }

    const body = isSurplus
      ? { resourceName: form.resourceName.trim(), category: form.category, quantity: qty, unit: form.unit.trim(), condition: form.condition, description: form.description || undefined, imageUrl: form.imageUrl || undefined, isPerishable: form.isPerishable, isEmergencyEligible: form.isEmergencyEligible, availableFrom: toApiDateTime(form.availableFrom), availableUntil: toApiDateTime(form.availableUntil), expiryDate: toApiDateTime(form.expiryDate) }
      : { resourceName: form.resourceName.trim(), category: form.category, quantityRequired: qty, unit: form.unit.trim(), urgency: form.urgency, purpose: form.purpose || undefined, isEmergency: form.isEmergency, requiredBy: toApiDateTime(form.requiredBy) };
    Object.assign(body, { locationAddress: form.locationAddress || undefined, city: form.city || undefined, state: form.state || undefined, latitude: optNumber(form.latitude), longitude: optNumber(form.longitude) });

    setLoading(true);
    try { await (isSurplus ? api.createSurplus(org.id, body) : api.createNeed(org.id, body)); setSuccess(true); }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  if (success) return <div className="page success-page"><div className="success-card"><div className="success-icon"><Check /></div><span className="eyebrow green">SUCCESS</span><h1>{isSurplus ? 'Surplus listed.' : 'Need created.'}</h1><p>It is saved and will be considered by the matching engine.</p>
    <div className="success-actions"><button className="btn btn-primary" onClick={() => nav(isSurplus ? '/app/surplus' : '/app/needs')}>View {isSurplus ? 'surplus' : 'needs'} <ArrowRight size={17} /></button>
      <button className="btn btn-secondary" onClick={() => { setForm(blankForm(type, org)); setSuccess(false); }}>Add another</button></div></div></div>;

  return <div className="page">
    <PageHeader eyebrow={isSurplus ? 'NEW SURPLUS' : 'NEW REQUIREMENT'} title={isSurplus ? 'List a surplus resource.' : 'Tell the network what you need.'} description={isSurplus ? 'Give recipients enough context to act quickly.' : 'Clear requirements improve match quality.'} />
    {error && <div className="alert error page-alert"><AlertTriangle size={16} />{error}</div>}
    <form className="form-panel" onSubmit={submit}>
      <div className="form-section"><div><span className="panel-kicker">RESOURCE</span><h3>What are you sharing?</h3></div>
        <div className="form-grid">
          <Field label="Resource name"><input required value={form.resourceName} onChange={e => set('resourceName', e.target.value)} placeholder={isSurplus ? 'e.g. Dell laptops' : 'e.g. Laptops for students'} /></Field>
          <Field label="Category"><select value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(x => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
          <Field label={isSurplus ? 'Quantity' : 'Quantity required'}><input required type="number" min="0.01" step="0.01" value={isSurplus ? form.quantity : form.quantityRequired} onChange={e => set(isSurplus ? 'quantity' : 'quantityRequired', e.target.value)} placeholder="25" /></Field>
          <Field label="Unit"><input required value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="pieces / kg / boxes" /></Field>
          {isSurplus ? <Field label="Condition"><select value={form.condition} onChange={e => set('condition', e.target.value)}>{CONDITIONS.map(x => <option key={x} value={x}>{label(x)}</option>)}</select></Field>
            : <Field label="Urgency"><select value={form.urgency} onChange={e => set('urgency', e.target.value)}>{URGENCY.map(x => <option key={x} value={x}>{label(x)}</option>)}</select></Field>}
        </div>
        <p className="hint">Matching compares quantities only when the unit text is identical on both sides (e.g. “pieces” and “pieces”).</p>
        <Field label={isSurplus ? 'Description' : 'Purpose'}><textarea maxLength={2000} value={isSurplus ? form.description : form.purpose} onChange={e => set(isSurplus ? 'description' : 'purpose', e.target.value)} placeholder={isSurplus ? 'Describe condition, model, packaging, etc.' : 'Explain who needs this resource and why.'} /></Field>
      </div>
      <div className="form-section"><div><span className="panel-kicker">LOCATION & TIMING</span><h3>Where and when?</h3></div>
        <Field label="Address"><input value={form.locationAddress} onChange={e => set('locationAddress', e.target.value)} placeholder="Pickup / delivery address" /></Field>
        <div className="form-grid"><Field label="City"><input value={form.city} onChange={e => set('city', e.target.value)} /></Field><Field label="State"><input value={form.state} onChange={e => set('state', e.target.value)} /></Field></div>
        <LocationFields lat={form.latitude} lng={form.longitude} onChange={(la, lo) => setForm(x => ({ ...x, latitude: la, longitude: lo }))} />
        <div className="form-grid">
          {isSurplus ? <>
            <Field label="Available from"><input type="datetime-local" value={form.availableFrom} onChange={e => set('availableFrom', e.target.value)} /></Field>
            <Field label="Available until"><input type="datetime-local" value={form.availableUntil} onChange={e => set('availableUntil', e.target.value)} /></Field>
            <Field label="Expiry date"><input type="datetime-local" value={form.expiryDate} onChange={e => set('expiryDate', e.target.value)} /></Field></>
            : <Field label="Required by"><input type="datetime-local" value={form.requiredBy} onChange={e => set('requiredBy', e.target.value)} /></Field>}
        </div>
      </div>
      <div className="form-section"><div><span className="panel-kicker">FLAGS</span><h3>Help the system prioritize.</h3></div>
        <div className="check-grid">{isSurplus ? <>
          <CheckBox checked={form.isPerishable} onChange={v => set('isPerishable', v)} title="Perishable" text="Needs faster redistribution." />
          <CheckBox checked={form.isEmergencyEligible} onChange={v => set('isEmergencyEligible', v)} title="Emergency eligible" text="Can support urgent requests." /></>
          : <CheckBox checked={form.isEmergency} onChange={v => set('isEmergency', v)} title="Emergency need" text="Maximum urgency score; you can then raise an emergency request from the Needs page." />}</div>
      </div>
      <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>Cancel</button><button className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : isSurplus ? 'List surplus' : 'Create need'} <ArrowRight size={17} /></button></div>
    </form>
  </div>;
}

/* ------------------------------------------------------------------ matches */

export function MatchesPage({ auth, org }) {
  const [selected, setSelected] = useState(null); const [discovering, setDiscovering] = useState(false);
  const q = useAsync(async () => {
    const [matches, surplus, needs] = await Promise.all([api.getActiveMatches(), api.getSurplus(), api.getNeeds()]);
    const s = Object.fromEntries(surplus.map(x => [x.id, x])); const n = Object.fromEntries(needs.map(x => [x.id, x]));
    // /matches/active is network-wide; only show matches that involve this organization.
    return matches
      .filter(m => auth.role === 'ADMIN' || s[m.surplusId]?.providerOrganizationId === org.id || n[m.needId]?.recipientOrganizationId === org.id)
      .map(m => ({ ...m, surplus: s[m.surplusId], need: n[m.needId] }));
  }, [org.id, auth.role]);

  const discover = async (silent = false) => {
    setDiscovering(true);
    try {
      const [mySurplus, myNeeds] = await Promise.all([api.getOrgSurplus(org.id), api.getOrgNeeds(org.id)]);
      const calls = [];
      if (auth.role !== 'RECIPIENT') mySurplus.filter(x => x.status === 'AVAILABLE').forEach(x => calls.push(api.getBestMatchesForSurplus(x.id)));
      if (auth.role !== 'PROVIDER') myNeeds.filter(x => x.status === 'OPEN').forEach(x => calls.push(api.getBestMatchesForNeed(x.id)));
      await Promise.allSettled(calls);
      await q.reload();
      if (!silent) toast('Matches refreshed', 'success');
    } catch (e) { if (!silent) toast(e.message, 'error'); } finally { setDiscovering(false); }
  };
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; discover(true); } }, []); // eslint-disable-line

  const matches = q.data || [];
  return <div className="page">
    <PageHeader eyebrow="INTELLIGENCE LAYER" title="Smart matches" description="Scores combine category, quantity, distance, urgency, condition and availability (max 100)."
      action={<button className="btn btn-primary" disabled={discovering} onClick={() => discover(false)}><Sparkles size={16} />{discovering ? 'Searching…' : 'Find new matches'}</button>} />
    <ErrorBox error={q.error} onRetry={q.reload} />
    <div className="match-hero"><div><div className="ai-badge"><Sparkles size={15} /> MATCH ENGINE</div><h2>Turn proximity into purpose.</h2><p>Only same-category matches scoring 50+ are created automatically. Add coordinates to your listings to get distance scores.</p></div><div className="score-orbit"><div><strong>{matches.length}</strong><span>active matches</span></div></div></div>
    {q.loading && !q.data ? <LoadingScreen /> : <div className="match-list">
      {matches.map(m => <MatchCard key={m.id} match={m} onClick={() => setSelected(m)} />)}
      {!matches.length && !q.error && <div className="panel empty-wide"><Empty icon={<Sparkles />} text="No active matches yet. List surplus or needs in the same category and press “Find new matches”." /></div>}
    </div>}
    {selected && <MatchDrawer match={selected} auth={auth} org={org} close={() => setSelected(null)} done={() => { setSelected(null); q.reload(); }} />}
  </div>;
}

function MatchCard({ match, onClick }) {
  const score = Math.round(match.overallScore || 0);
  return <button className="match-card" onClick={onClick}>
    <div className="match-score"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" /><circle className="progress" cx="22" cy="22" r="18" strokeDasharray={`${score * 1.13} 200`} /></svg><strong>{score}</strong><span>%</span></div>
    <div className="match-content">
      <div className="match-head"><Status>{match.status}</Status><span>{fmtDate(match.createdAt)}</span></div>
      <h3>{match.surplus?.resourceName || 'Surplus'} → {match.need?.resourceName || 'Need'}</h3>
      <p>{match.distanceKm != null ? `${num(match.distanceKm, 1)} km away · ` : 'Distance unknown · '}{match.matchReason}</p>
      <div className="signal-row">{SIGNALS.map(([name, key, max]) => <span key={key}><i style={{ width: `${Math.min(100, Math.max(0, ((match[key] || 0) / max) * 100))}%` }} />{name}</span>)}</div>
    </div>
    <ArrowRight className="match-arrow" />
  </button>;
}

function MatchDrawer({ match, auth, org, close, done }) {
  const needOwner = match.need?.recipientOrganizationId === org.id;
  const canRequest = auth.role === 'ADMIN' || (auth.role === 'RECIPIENT' && needOwner);
  const maxQty = Math.min(Number(match.need?.quantityRequired ?? Infinity), Number(match.surplus?.quantity ?? Infinity));
  const [qty, setQty] = useState(Number.isFinite(maxQty) ? String(maxQty) : '1');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const unitMismatch = match.surplus && match.need && match.surplus.unit?.trim().toLowerCase() !== match.need.unit?.trim().toLowerCase();

  const send = async () => {
    setError('');
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) { setError('Enter a quantity greater than zero.'); return; }
    if (Number.isFinite(maxQty) && n > maxQty) { setError(`The most you can request is ${num(maxQty)}.`); return; }
    setBusy(true);
    try { await api.createRequest({ matchId: match.id, quantityRequested: n, message: message || undefined }); toast('Request sent to the provider', 'success'); done(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return <Modal title="MATCH DETAIL" close={close}>
    <div className="drawer-score"><strong>{Math.round(match.overallScore || 0)}%</strong><span>overall match</span></div>
    <h2>{match.surplus?.resourceName} → {match.need?.resourceName}</h2>
    <p>{match.matchReason}</p>
    <div className="score-grid">{SIGNALS.map(([name, key, max]) => <div key={key}><span>{name}</span><strong>{num(match[key] || 0, 1)}<small> / {max}</small></strong></div>)}
      <div><span>Distance</span><strong>{match.distanceKm != null ? `${num(match.distanceKm, 1)} km` : 'Unknown'}</strong></div></div>
    <p className="hint">Surplus: {num(match.surplus?.quantity)} {match.surplus?.unit} · Need: {num(match.need?.quantityRequired)} {match.need?.unit}</p>
    {unitMismatch && <div className="alert error page-alert"><AlertTriangle size={16} />The units differ, so quantities are not directly comparable.</div>}
    {error && <div className="alert error page-alert"><AlertTriangle size={16} />{error}</div>}
    {canRequest ? <>
      <Field label="Quantity to request"><input type="number" min="0.01" step="0.01" value={qty} onChange={e => setQty(e.target.value)} /></Field>
      <Field label="Message to provider"><textarea maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} placeholder="We would like to request this resource…" /></Field>
      <button className="btn btn-primary btn-block" disabled={busy} onClick={send}>{busy ? 'Sending…' : 'Request this resource'} <ArrowRight size={17} /></button></>
      : <p className="hint">{auth.role === 'PROVIDER' ? 'The recipient organization sends the request; you will be notified and can accept or reject it on the Requests page.' : 'Only the organization that owns the need can request this resource.'}</p>}
  </Modal>;
}

/* ------------------------------------------------------------------ requests */

export function RequestsPage({ auth, org }) {
  const [deliveryFor, setDeliveryFor] = useState(null); const [busyId, setBusyId] = useState(null);
  const q = useAsync(async () => {
    const [requests, deliveries, lookups] = await Promise.all([loadRequests(auth, org), loadDeliveries(auth, org), api.getSurplus()]);
    return { requests, deliveries: Object.fromEntries(deliveries.map(d => [d.requestId, d])), surplus: Object.fromEntries(lookups.map(s => [s.id, s])) };
  }, [org.id, auth.role]);
  const data = q.data || { requests: [], deliveries: {}, surplus: {} };
  const provider = isProviderRole(auth), recipient = isRecipientRole(auth);

  const run = async (id, fn, ok) => { setBusyId(id); try { await fn(); toast(ok, 'success'); await q.reload(); } catch (e) { toast(e.message, 'error'); } finally { setBusyId(null); } };

  const rows = [...data.requests].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)).map(r => {
    const s = data.surplus[r.surplusId]; const delivery = data.deliveries[r.id]; const busy = busyId === r.id;
    return [
      <strong>{s?.resourceName || `#${String(r.id).slice(0, 8)}`}</strong>,
      `${num(r.quantityRequested)} ${s?.unit || ''}`,
      <Status>{r.status}</Status>,
      <span>{r.message || '—'}</span>,
      fmtDateTime(r.requestedAt),
      <div className="row-actions">
        {provider && r.status === 'PENDING' && <><button className="tiny-btn solid" disabled={busy} onClick={() => run(r.id, () => api.updateRequestStatus(r.id, 'ACCEPTED'), 'Request accepted')}>Accept</button><button className="tiny-btn danger" disabled={busy} onClick={() => run(r.id, () => api.updateRequestStatus(r.id, 'REJECTED'), 'Request rejected')}>Reject</button></>}
        {provider && r.status === 'ACCEPTED' && !delivery && <button className="tiny-btn primary" disabled={busy} onClick={() => setDeliveryFor(r)}>Create delivery</button>}
        {delivery && <NavLink className="tiny-btn" to="/app/deliveries">Delivery: {label(delivery.status)}</NavLink>}
        {recipient && r.status === 'PENDING' && <button className="tiny-btn danger" disabled={busy} onClick={() => run(r.id, () => api.cancelRequest(r.id), 'Request cancelled')}>Cancel</button>}
      </div>
    ];
  });

  return <div className="page">
    <PageHeader eyebrow="HANDOFFS" title="Resource requests" description={auth.role === 'PROVIDER' ? 'Requests for your surplus. Accept to reserve it, then create the delivery.' : auth.role === 'RECIPIENT' ? 'Requests your organization has sent.' : 'All requests in the network.'} />
    <ErrorBox error={q.error} onRetry={q.reload} />
    <div className="panel table-panel">{q.loading && !q.data ? <LoadingScreen /> : <DataTable headers={['Resource', 'Quantity', 'Status', 'Message', 'Requested', 'Actions']} rows={rows} emptyText="No requests yet. Recipients create them from the Smart matches page." />}</div>
    {deliveryFor && <DeliveryModal request={deliveryFor} close={() => setDeliveryFor(null)} done={() => { setDeliveryFor(null); q.reload(); }} />}
  </div>;
}

function DeliveryModal({ request, close, done }) {
  const [method, setMethod] = useState('PROVIDER_DELIVERY'); const [pickup, setPickup] = useState(toInputDateTime(new Date(Date.now() + 3600 * 1000)));
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await api.createDelivery({ requestId: request.id, deliveryMethod: method, expectedPickupAt: toApiDateTime(pickup) }); toast('Delivery created', 'success'); done(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Modal title="CREATE DELIVERY" close={close}>
    <h2>How will it be delivered?</h2>
    {error && <div className="alert error page-alert"><AlertTriangle size={16} />{error}</div>}
    <form onSubmit={submit}>
      <Field label="Delivery method"><select value={method} onChange={e => setMethod(e.target.value)}>{DELIVERY_METHODS.map(m => <option key={m} value={m}>{label(m)}</option>)}</select></Field>
      <Field label="Expected pickup"><input type="datetime-local" value={pickup} onChange={e => setPickup(e.target.value)} /></Field>
      <p className="hint">The ETA is pickup time plus travel time at 40 km/h; it needs coordinates on both the surplus and the need.</p>
      <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create delivery'}</button>
    </form>
  </Modal>;
}

/* ------------------------------------------------------------------ deliveries */

// Mirrors DeliveryServiceImpl.validateStatusTransition.
const NEXT_STATUS = {
  REQUESTED: ['ACCEPTED'], ACCEPTED: ['PICKUP_SCHEDULED', 'IN_TRANSIT'], PICKUP_SCHEDULED: ['READY_FOR_PICKUP', 'IN_TRANSIT'],
  READY_FOR_PICKUP: ['IN_TRANSIT'], IN_TRANSIT: ['DELIVERED']
};
const CAN_CANCEL = ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'READY_FOR_PICKUP'];
const STEPS = ['REQUESTED', 'ACCEPTED', 'PICKUP_SCHEDULED', 'READY_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED'];
const ACTION_LABEL = { ACCEPTED: 'Accept delivery', PICKUP_SCHEDULED: 'Schedule pickup', READY_FOR_PICKUP: 'Ready for pickup', IN_TRANSIT: 'Start transit', DELIVERED: 'Mark delivered' };

export function DeliveriesPage({ auth, org }) {
  const [busyId, setBusyId] = useState(null);
  const q = useAsync(async () => {
    const [deliveries, requests, surplus] = await Promise.all([loadDeliveries(auth, org), loadRequests(auth, org), api.getSurplus()]);
    const r = Object.fromEntries(requests.map(x => [x.id, x])); const s = Object.fromEntries(surplus.map(x => [x.id, x]));
    return deliveries.map(d => ({ ...d, request: r[d.requestId], surplus: s[r[d.requestId]?.surplusId] }));
  }, [org.id, auth.role]);
  const provider = isProviderRole(auth);
  const change = async (d, status) => {
    if ((status === 'CANCELLED' || status === 'FAILED') && !window.confirm(`Mark this delivery as ${label(status)}? The reserved resources will be released.`)) return;
    setBusyId(d.id);
    try { await api.updateDeliveryStatus(d.id, status); toast(`Delivery ${label(status)}`, 'success'); await q.reload(); } catch (e) { toast(e.message, 'error'); } finally { setBusyId(null); }
  };
  const items = q.data || [];
  return <div className="page">
    <PageHeader eyebrow="LOGISTICS" title="Deliveries" description="Track accepted requests from pickup to completion. Completing a delivery records the impact." />
    <ErrorBox error={q.error} onRetry={q.reload} />
    <div className="delivery-grid">{q.loading && !q.data ? <LoadingScreen /> : items.map(d => {
      const idx = STEPS.indexOf(d.status); const next = NEXT_STATUS[d.status] || []; const primary = next[0]; const busy = busyId === d.id;
      return <div className="delivery-card" key={d.id}>
        <div className="delivery-top"><div className="delivery-icon"><Truck /></div><Status>{d.status}</Status></div>
        <h3>{d.surplus?.resourceName || 'Delivery'}</h3>
        <span className="sub-note">{num(d.request?.quantityRequested)} {d.surplus?.unit || ''} · {label(d.deliveryMethod)}</span>
        <div className="timeline">{STEPS.map((s, i) => <div className={cx('timeline-step', idx >= i && 'done')} key={s}><i>{idx >= i ? <Check size={11} /> : i + 1}</i><span>{label(s)}</span></div>)}</div>
        <div className="delivery-meta">
          <span><Clock3 size={14} /> {d.actualDeliveryAt ? `Delivered ${fmtDateTime(d.actualDeliveryAt)}` : d.expectedDeliveryAt ? `ETA ${fmtDateTime(d.expectedDeliveryAt)}` : 'ETA unavailable (no coordinates)'}</span>
          {d.distanceKm != null && <span><MapPin size={14} />{num(d.distanceKm, 1)} km</span>}
        </div>
        {provider && (primary || CAN_CANCEL.includes(d.status) || d.status === 'IN_TRANSIT') && <div className="delivery-actions">
          {primary && <button className="btn btn-primary" disabled={busy} onClick={() => change(d, primary)}>{ACTION_LABEL[primary]} <ArrowRight size={15} /></button>}
          {d.status === 'IN_TRANSIT' && <button className="btn btn-secondary" disabled={busy} onClick={() => change(d, 'FAILED')}>Mark failed</button>}
          {CAN_CANCEL.includes(d.status) && <button className="btn btn-secondary" disabled={busy} onClick={() => change(d, 'CANCELLED')}>Cancel</button>}
        </div>}
      </div>;
    })}
      {!items.length && !q.loading && !q.error && <div className="panel empty-wide"><Empty icon={<Truck />} text="No deliveries yet. Providers create one from an accepted request." /></div>}
    </div>
  </div>;
}

/* ------------------------------------------------------------------ impact */

export function ImpactPage({ org }) {
  // (The old version assigned to the destructured const `impact`, which throws a TypeError and crashed this page.)
  const q = useAsync(() => api.getOrgImpact(org.id), [org.id]);
  const network = useAsync(() => api.getImpact(), []);
  const impact = q.data || { totalResourcesRedistributed: 0, organizationsSupported: 0, completedMatches: 0, estimatedBeneficiaries: 0, estimatedWasteDivertedKg: 0 };
  return <div className="page">
    <PageHeader eyebrow="MEASURABLE CHANGE" title="Impact dashboard" description="Figures come from completed deliveries (impact records)." />
    <ErrorBox error={q.error} onRetry={q.reload} />
    <div className="impact-hero"><div className="impact-copy"><span className="ai-badge"><Leaf size={15} /> IMPACT ENGINE</span><h2>Every successful handoff counts.</h2><p>Waste diverted counts only resources measured in kg. Beneficiary estimates are not collected yet.</p></div><div className="impact-leaf"><Leaf /></div></div>
    <div className="impact-stat-grid">
      <StatCard icon={<Recycle />} title="Resource units moved" value={num(impact.totalResourcesRedistributed)} sub="your organization" />
      <StatCard icon={<Users />} title="Organizations involved" value={num(impact.organizationsSupported, 0)} sub="including yours" />
      <StatCard icon={<Check />} title="Completed matches" value={num(impact.completedMatches, 0)} sub="successful" />
      <StatCard icon={<Leaf />} title="Waste diverted" value={`${num(impact.estimatedWasteDivertedKg)} kg`} sub="estimated" />
    </div>
    {network.data && <div className="panel impact-story"><div><span className="panel-kicker">WHOLE NETWORK</span><h3>{num(network.data.totalResourcesRedistributed)} units moved</h3><p>{num(network.data.completedMatches, 0)} completed handoffs across {num(network.data.organizationsSupported, 0)} organizations.</p></div>
      <div className="loop"><LoopStep n="01" icon={<Package />} text="Resource listed" /><LoopStep n="02" icon={<Sparkles />} text="Best match found" /><LoopStep n="03" icon={<Truck />} text="Delivered" /><LoopStep n="04" icon={<Leaf />} text="Impact recorded" /></div></div>}
  </div>;
}
function LoopStep({ n, icon, text }) { return <div className="loop-step"><span>{n}</span><div>{icon}</div><strong>{text}</strong></div>; }

/* ------------------------------------------------------------------ emergencies */

export function EmergenciesPage({ auth, org }) {
  const q = useAsync(async () => {
    const [active, all, myNeeds] = await Promise.all([api.getActiveEmergencies(), api.getAllEmergencies(), isRecipientRole(auth) ? api.getOrgNeeds(org.id) : Promise.resolve([])]);
    const byNeed = new Set(all.map(e => e.needId));
    return { active, mine: all.filter(e => e.recipientOrganizationId === org.id), raisable: myNeeds.filter(n => n.isEmergency && n.status === 'OPEN' && !byNeed.has(n.id)) };
  }, [org.id, auth.role]);
  const [raiseFor, setRaiseFor] = useState(null);
  const d = q.data || { active: [], mine: [], raisable: [] };
  const cancel = async e => { try { await api.updateEmergencyStatus(e.id, 'CANCELLED'); toast('Emergency cancelled', 'success'); q.reload(); } catch (err) { toast(err.message, 'error'); } };
  return <div className="page">
    <PageHeader eyebrow="PRIORITY LAYER" title="Emergency radar" description="Emergency requests raised for needs flagged as emergencies." />
    <ErrorBox error={q.error} onRetry={q.reload} />
    <div className="radar-banner"><div className="radar-pulse"><AlertTriangle /></div><div><strong>Act quickly when time matters.</strong><span>Emergency needs score maximum urgency in matching. Providers can find them on the Smart matches page.</span></div></div>
    {d.raisable.length > 0 && <div className="panel" style={{ marginBottom: 14 }}><div className="panel-head"><div><span className="panel-kicker">YOUR NEEDS</span><h3>Flagged as emergency, no request yet</h3></div></div>
      <div className="mini-list">{d.raisable.map(n => <div className="mini-row" key={n.id}><div className="mini-icon"><CategoryIcon category={n.category} /></div><div className="mini-main"><strong>{n.resourceName}</strong><span>{num(n.quantityRequired)} {n.unit}</span></div><button className="tiny-btn danger" onClick={() => setRaiseFor(n)}>Raise emergency</button></div>)}</div></div>}
    {q.loading && !q.data ? <LoadingScreen /> : <div className="emergency-grid">
      {d.active.map(e => <div className="emergency-card" key={e.id}>
        <div className="emergency-card-top"><Status tone="critical">{e.severity}</Status><span>{fmtDateTime(e.createdAt)}</span></div>
        <h3>{label(e.category)} · {num(e.quantityRequired)}</h3><p>{e.reason}</p>
        <div className="emergency-meta"><span><Clock3 size={14} />Needed by {fmtDateTime(e.requiredBy)}</span><span><Status>{e.status}</Status></span>{e.recipientOrganizationId === org.id && e.status !== 'RESOLVED' && <button className="tiny-btn danger" onClick={() => cancel(e)}>Cancel</button>}</div>
      </div>)}
      {!d.active.length && !q.error && <div className="panel empty-wide"><Empty icon={<ShieldCheck />} text="No active emergencies. That's a good thing." /></div>}
    </div>}
    {raiseFor && <EmergencyModal need={raiseFor} close={() => setRaiseFor(null)} done={() => { setRaiseFor(null); q.reload(); }} />}
  </div>;
}

/* ------------------------------------------------------------------ settings */

function Info({ label: lab, value }) { return <div><span>{lab}</span><strong>{String(value ?? '—')}</strong></div>; }
export function SettingsPage({ auth, org }) {
  return <div className="page"><PageHeader eyebrow="WORKSPACE" title="Settings" description="Account and organization information." />
    <div className="settings-grid">
      <div className="form-panel"><div className="form-section"><span className="panel-kicker">ACCOUNT</span><h3>{auth.name}</h3><div className="info-list"><Info label="Email" value={auth.email} /><Info label="Role" value={label(auth.role)} /><Info label="User ID" value={auth.userId} /></div></div></div>
      <div className="form-panel"><div className="form-section"><span className="panel-kicker">ORGANIZATION</span><h3>{org.name}</h3><div className="info-list"><Info label="Type" value={label(org.type)} /><Info label="Verification" value={label(org.verificationStatus || 'PENDING')} /><Info label="Location" value={[org.city, org.state].filter(Boolean).join(', ') || 'Not set'} /><Info label="Coordinates" value={org.latitude != null && org.longitude != null ? `${org.latitude}, ${org.longitude}` : 'Not set'} /><Info label="Contact" value={org.email || 'Not set'} /></div></div></div>
    </div></div>;
}

export { initials };