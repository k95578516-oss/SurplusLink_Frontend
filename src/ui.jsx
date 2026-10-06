import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export const CATEGORIES = ['FOOD','MEDICINE','CLOTHING','EDUCATION','ELECTRONICS','FURNITURE','MEDICAL_EQUIPMENT','BOOKS','WATER','OTHER'];
export const CONDITIONS = ['NEW','GOOD','FAIR','POOR'];
export const URGENCY = ['LOW','MEDIUM','HIGH','CRITICAL'];
export const ORG_TYPES = ['CORPORATE','NGO','SCHOOL','HOSPITAL','GOVERNMENT','COMMUNITY','OTHER'];
export const DELIVERY_METHODS = ['PROVIDER_DELIVERY','RECIPIENT_PICKUP','THIRD_PARTY','VOLUNTEER'];

export function cx(...v){ return v.filter(Boolean).join(' '); }
export function label(v){ return String(v ?? '').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase()); }
export function initials(name){ return (name||'U').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
export function num(v, digits = 2){ const n = Number(v); return Number.isFinite(n) ? n.toLocaleString(undefined,{maximumFractionDigits:digits}) : '—'; }

// The backend sends LocalDateTime without a zone ("2026-10-02T10:30:00"); new Date() reads that as local time.
export function fmtDate(value){ if(!value) return '—'; const d=new Date(value); return isNaN(d)?'—':d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}); }
export function fmtDateTime(value){ if(!value) return '—'; const d=new Date(value); return isNaN(d)?'—':d.toLocaleString(undefined,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}); }

// <input type="datetime-local"> gives "2026-10-02T10:30". Send it as a zone-less local date-time.
// (The old code used toISOString(), which converts to UTC and shifted every time by the UTC offset.)
export function toApiDateTime(value){ if(!value) return undefined; return value.length === 16 ? `${value}:00` : value; }
export function toInputDateTime(date){ const p=n=>String(n).padStart(2,'0'); return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`; }
export function optNumber(v){ if(v===''||v===null||v===undefined) return undefined; const n=Number(v); return Number.isFinite(n)?n:undefined; }

/* ------------------------------------------------------------- toasts */
export function toast(message, type = 'info'){ window.dispatchEvent(new CustomEvent('surplus:toast',{detail:{message,type,id:Math.random()}})); }
export function Toasts(){
  const [items,setItems]=useState([]);
  useEffect(()=>{
    const on=e=>{ const t=e.detail; setItems(x=>[...x,t]); setTimeout(()=>setItems(x=>x.filter(i=>i.id!==t.id)),4500); };
    window.addEventListener('surplus:toast',on);
    return ()=>window.removeEventListener('surplus:toast',on);
  },[]);
  return <div className="toast-stack">{items.map(t=><div key={t.id} className={cx('toast',t.type)}>{t.message}</div>)}</div>;
}

/* ------------------------------------------------------------- data hook */
// Loads on mount / when deps change, ignores stale responses, exposes reload().
export function useAsync(fn, deps = []){
  const [state,setState]=useState({data:null,error:null,loading:true});
  const run=useRef(0);
  const load=useCallback(async()=>{
    const id=++run.current;
    setState(s=>({...s,loading:true,error:null}));
    try{ const data=await fn(); if(id===run.current) setState({data,error:null,loading:false}); }
    catch(error){ if(id===run.current) setState(s=>({data:s.data,error,loading:false})); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },deps);
  useEffect(()=>{ load(); return ()=>{ run.current++; }; },[load]);
  return {...state,reload:load};
}

/* ------------------------------------------------------------- small components */
export function Field({label:lab,children,wide=false}){return <label className={cx('field',wide&&'wide')}><span>{lab}</span>{children}</label>}
export function PageHeader({eyebrow,title,description,action}){return <div className="page-header"><div><span className="eyebrow green">{eyebrow}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>}
export function StatCard({icon,title,value,sub}){return <div className="stat-card"><div className="stat-icon">{icon}</div><div className="stat-body"><span>{title}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</div></div>}
export function Status({children,tone}){return <span className={cx('status',tone||String(children).toLowerCase())}>{label(children)}</span>}
export function LoadingScreen({text='Loading…'}){return <div className="loading-screen"><div className="spinner"></div><p>{text}</p></div>}
export function Empty({icon,text,action}){return <div className="empty">{icon}<span>{text}</span>{action}</div>}
export function ErrorBox({error,onRetry}){
  if(!error) return null;
  return <div className="alert error page-error"><AlertTriangle size={16}/>{error.message||'Something went wrong.'}{onRetry&&<button className="btn btn-secondary btn-sm" onClick={onRetry}>Retry</button>}</div>;
}
export function CategoryIcon({category}){const C={FOOD:'🍱',MEDICINE:'✚',CLOTHING:'◌',EDUCATION:'◫',ELECTRONICS:'⌁',FURNITURE:'⌂',MEDICAL_EQUIPMENT:'✚',BOOKS:'▤',WATER:'◒',OTHER:'◈'};return <span>{C[category]||'◈'}</span>}
export function CheckBox({checked,onChange,title,text}){return <label className={cx('check-card',checked&&'checked')}><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="fake-check">✓</span><div><strong>{title}</strong><small>{text}</small></div></label>}
export function DataTable({headers,rows,emptyText='Nothing here yet.'}){
  return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table>{!rows.length&&<Empty text={emptyText}/>}</div>;
}
export function Modal({title,children,close}){
  return <div className="drawer-overlay" onClick={close}><div className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><span className="eyebrow green">{title}</span><button className="icon-btn" onClick={close}>✕</button></div>{children}</div></div>;
}

/* "Use my location" for the latitude / longitude inputs (distance scoring needs coordinates). */
export function LocationFields({lat,lng,onChange}){
  const locate=()=>{
    if(!navigator.geolocation){ toast('Geolocation is not available in this browser.','error'); return; }
    navigator.geolocation.getCurrentPosition(
      p=>onChange(p.coords.latitude.toFixed(6),p.coords.longitude.toFixed(6)),
      ()=>toast('Could not read your location. Enter the coordinates manually.','error'),
      {timeout:8000}
    );
  };
  return <>
    <div className="form-grid">
      <Field label="Latitude"><input type="number" step="any" min="-90" max="90" value={lat} onChange={e=>onChange(e.target.value,lng)} placeholder="28.4744"/></Field>
      <Field label="Longitude"><input type="number" step="any" min="-180" max="180" value={lng} onChange={e=>onChange(lat,e.target.value)} placeholder="77.5040"/></Field>
    </div>
    <p className="hint">Coordinates drive the distance score and delivery ETA. Without them matches show “distance unknown”. <button type="button" className="tiny-btn" onClick={locate}>Use my location</button></p>
  </>;
}

/* Max score of each match signal as defined by MatchingServiceImpl. */
export const SIGNALS = [
  ['Category','categoryScore',30],['Quantity','quantityScore',20],['Distance','distanceScore',20],
  ['Urgency','urgencyScore',15],['Condition','conditionScore',10],['Availability','availabilityScore',5]
];