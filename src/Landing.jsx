import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, HeartHandshake, Leaf, Package, Recycle, ShieldCheck, Sparkles, Truck, Zap } from 'lucide-react';

function cx(...v){ return v.filter(Boolean).join(' '); }

export function Landing({auth}){
  const nav=useNavigate();
  return <div className="landing">
    <nav className="landing-nav">
      <Brand light/>
      <div className="landing-links">
        <a href="#how">How it works</a><a href="#impact">Impact</a><a href="#features">Features</a>
      </div>
      <div className="landing-actions">{auth ? <button className="btn btn-primary" onClick={()=>nav('/app')}>Open dashboard <ArrowRight size={16}/></button> :
        <><button className="btn btn-ghost-light" onClick={()=>nav('/login')}>Log in</button><button className="btn btn-light" onClick={()=>nav('/register')}>Get started</button></>}</div>
    </nav>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><Sparkles size={15}/> SMART SURPLUS REDISTRIBUTION</div>
        <h1>Don't waste surplus.<br/><span>Redistribute it.</span></h1>
        <p>Connect unused resources with verified organizations that need them. Match smarter, move faster, and measure the impact.</p>
        <div className="hero-buttons"><button className="btn btn-light btn-lg" onClick={()=>nav('/register')}>Start redistributing <ArrowRight size={18}/></button><button className="btn btn-ghost-light btn-lg" onClick={()=>nav('/login')}>Sign in</button></div>
        <div className="hero-trust"><div className="trust-avatars"><i>NG</i><i>SC</i><i>CO</i><i>+</i></div><span>Built for companies, NGOs, schools & communities</span></div>
      </div>
      <div className="hero-visual">
        <div className="orb orb-a"></div><div className="orb orb-b"></div>
        <div className="network-card">
          <div className="network-top"><span>LIVE REDISTRIBUTION</span><span className="live-dot"></span></div>
          <div className="network-map">
            <div className="map-grid"></div>
            <div className="route r1"></div><div className="route r2"></div><div className="route r3"></div>
            <div className="node n1"><Package size={16}/></div><div className="node n2"><HeartHandshake size={16}/></div><div className="node n3"><Building2 size={16}/></div>
            <div className="match-pill"><Zap size={14} fill="currentColor"/> 94% match</div>
          </div>
          <div className="network-footer"><div><small>Surplus</small><strong>25 laptops</strong></div><ArrowRight size={20}/><div><small>Recipient</small><strong>Digital Learning NGO</strong></div></div>
        </div>
      </div>
    </section>
    <section className="landing-stats" id="impact">
      <div><strong>01</strong><span>List surplus</span></div><div><strong>02</strong><span>Smart match</span></div><div><strong>03</strong><span>Deliver</span></div><div><strong>04</strong><span>Measure impact</span></div>
    </section>
    <section className="landing-section" id="features">
      <div className="section-heading"><div><span className="eyebrow green">WHY SURPLUSLINK</span><h2>A complete loop from excess to impact.</h2></div><p>Designed around the backend's real workflow: resources, needs, matching, requests, delivery and measurable impact.</p></div>
      <div className="feature-grid">
        <Feature icon={<Sparkles/>} title="Smart matching" text="Compare category, quantity, urgency, condition, availability and distance."/>
        <Feature icon={<ShieldCheck/>} title="Verification-ready" text="Keep recipient organizations accountable with verification workflows."/>
        <Feature icon={<Truck/>} title="Delivery tracking" text="Move accepted requests through pickup, transit and delivery states."/>
        <Feature icon={<Leaf/>} title="Impact dashboard" text="Turn successful redistribution into clear environmental and social metrics."/>
      </div>
    </section>
    <section className="landing-cta" id="how"><div><span className="eyebrow">ONE PLATFORM</span><h2>Resources should find their next purpose.</h2></div><button className="btn btn-light" onClick={()=>nav('/register')}>Create your workspace <ArrowRight size={17}/></button></section>
    <footer className="landing-footer"><Brand light/><span>SurplusLink · Smart redistribution platform</span></footer>
  </div>
}

function Feature({icon,title,text}){ return <div className="feature-card"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p><ArrowRight className="feature-arrow" size={18}/></div> }
export function Brand({light=false}){ return <div className={cx("brand",light&&"brand-light")}><span className="brand-mark"><Recycle size={19}/></span><span>Surplus<span>Link</span></span></div> }

