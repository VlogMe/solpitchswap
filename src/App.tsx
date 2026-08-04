import { useMemo, useState } from "react";
import { mostVoted, projects, promoted } from "./data";
import type { Project, ProjectBadge } from "./types";
import "./styles.css";

const SWAP_URL = "https://solpitch.net";

function Badge({ badge }: { badge: ProjectBadge }) {
  return <span className={`badge badge-${badge.toLowerCase()}`}>{badge}</span>;
}

function LeftNavigation() {
  return (
    <aside className="left-sidebar panel">
      <a className="brand" href="#home"><span className="brand-mark">SP</span><span><strong>SolPitch</strong><small>Graduated listings only</small></span></a>
      <nav>
        {['Home','New Listings','Trending','Most Voted','Promoted','Top 100'].map((item, index) => <a className={index === 0 ? 'active' : ''} href="#home" key={item}><span className="nav-dot" />{item}</a>)}
      </nav>
      <p className="nav-label">PROJECT TOOLS</p>
      <nav>
        {['Submit Coin','Advertise','Listing Rules','Discord'].map(item => <a href="#home" key={item}><span className="nav-dot" />{item}</a>)}
      </nav>
      <div className="rule-card"><strong>Graduated projects only.</strong><span>No presales. No launches. No unbonded tokens.</span></div>
    </aside>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (project: Project) => void }) {
  const copyAddress = async () => navigator.clipboard?.writeText(project.contractAddress);
  return (
    <article className="project-card panel">
      <div className="project-top">
        <div className="project-logo">{project.name.slice(0, 1)}</div>
        <div className="project-heading">
          <div className="name-line"><h3>{project.name}</h3><span>${project.symbol}</span></div>
          <div className="badges">{project.badges.map(badge => <Badge badge={badge} key={badge} />)}</div>
        </div>
        <button className="vote-button">▲ {project.votes}</button>
      </div>
      <p className="pitch">{project.pitch}</p>
      <button className="contract" onClick={copyAddress}>{project.contractAddress.slice(0, 8)}...{project.contractAddress.slice(-6)} <span>Copy CA</span></button>
      <div className="metrics">
        {[['Market cap', project.marketCap], ['Liquidity', project.liquidity], ['24h volume', project.volume24h], ['Holders', project.holders], ['Votes', String(project.votes)]].map(([label,value]) => <div className="metric" key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      <div className="project-actions"><div className="socials"><span>WEB</span><span>X</span><span>TG</span></div><div><button onClick={() => onOpen(project)}>View Project</button><a href={SWAP_URL}>Swap</a></div></div>
    </article>
  );
}

function SwapPanel() {
  return (
    <section className="swap-card panel">
      <div className="card-heading"><div><small>SOLPITCH</small><h2>Swap</h2></div><span>Protected engine</span></div>
      <div className="token-box"><small>You pay</small><div><strong>0.00</strong><span>◎ SOL</span></div></div>
      <div className="swap-arrow">↓</div>
      <div className="token-box"><small>You receive</small><div><strong>0.00</strong><span>Select token</span></div></div>
      <a className="primary-action" href={SWAP_URL}>Open live swap</a>
      <p className="fine-print">The working Jupiter and Phantom transaction logic remains isolated at solpitch.net.</p>
    </section>
  );
}

function RightSidebar() {
  return <aside className="right-sidebar"><SwapPanel /><section className="side-card panel"><div className="card-heading"><h2>Promoted</h2><a href="#home">Advertise</a></div>{promoted.map(p => <div className="mini-project" key={p.slug}><span>{p.name[0]}</span><div><strong>{p.name}</strong><small>${p.symbol}</small></div><em>Featured</em></div>)}</section><section className="side-card panel"><div className="card-heading"><h2>Most voted</h2><span>24h</span></div>{mostVoted.map((p,i) => <div className="rank-row" key={p.slug}><b>{i+1}</b><span>{p.name[0]}</span><div><strong>{p.name}</strong><small>${p.symbol}</small></div><em>▲ {p.votes}</em></div>)}</section></aside>;
}

function ProjectPage({ project, onBack }: { project: Project; onBack: () => void }) {
  return <main className="project-page"><button className="back-button" onClick={onBack}>← Back to listings</button><section className="project-hero panel"><div className="project-logo large">{project.name[0]}</div><div><div className="name-line"><h1>{project.name}</h1><span>${project.symbol}</span></div><div className="badges">{project.badges.map(b => <Badge key={b} badge={b} />)}</div><p>{project.description}</p></div></section><section className="detail-grid"><div className="panel detail-card"><small>CONTRACT ADDRESS</small><strong>{project.contractAddress}</strong><button onClick={() => navigator.clipboard?.writeText(project.contractAddress)}>Copy address</button></div><div className="panel detail-card"><small>PROJECT STATUS</small><strong>Graduated and trading</strong><a href={SWAP_URL}>Trade on SolPitch</a></div></section><section className="panel content-section"><small>PROJECT PROFILE</small><h2>Pitch, story and updates</h2><p>{project.pitch}</p><p>This area is ready for the approved project story, roadmap, media, announcements and community links. No information is published until it has passed admin review.</p></section></main>;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Project | null>(null);
  const filtered = useMemo(() => projects.filter(p => `${p.name} ${p.symbol} ${p.contractAddress}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div className="app" id="home"><header className="topbar"><a className="mobile-brand" href="#home">SolPitch</a><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search graduated projects, tickers or contract addresses"/><div><button>Advertise</button><button className="top-primary">Submit Coin</button></div></header><div className="layout"><LeftNavigation />{selected ? <ProjectPage project={selected} onBack={() => setSelected(null)} /> : <main className="feed"><header className="feed-header"><div><small>GRADUATED SOLANA DIRECTORY</small><h1>Discover projects already trading.</h1><p>No presales. No upcoming launches. Every listing is reviewed.</p></div><button>Newest first ▾</button></header><div className="filters">{['All listings','Newest','Trending','Most voted','Highest liquidity'].map((x,i) => <button className={i===0?'active':''} key={x}>{x}</button>)}</div>{filtered.map(project => <ProjectCard project={project} onOpen={setSelected} key={project.slug} />)}{filtered.length===0 && <div className="empty panel">No approved projects match that search.</div>}</main>}<RightSidebar /></div></div>;
}
