import { useMemo, useState } from "react";
import { projects } from "./data";
import type { Project, ProjectStatus } from "./types";
import "./production.css";

const SWAP_URL = "https://solpitch.net";
const PREVIEW_DEMO_VOTES = true; // Set false before public launch to start every project at zero.
const statusName: Record<ProjectStatus, string> = { graduated: "Graduated", bonding: "Bonding", launched: "Live", presale: "Presale", upcoming: "Upcoming" };
const tradable = new Set<ProjectStatus>(["graduated", "bonding", "launched"]);
type Filter = "all" | ProjectStatus;

function Logo() {
  return <img className="official-logo" src={`${import.meta.env.BASE_URL}solpitch-logo.svg`} alt="SolPitch" />;
}

function ProjectAvatar({ project, small = false }: { project: Project; small?: boolean }) {
  const className = small ? "mini-avatar" : "coin-avatar";
  return <div className={className}>{project.logoURI ? <img src={project.logoURI} alt="" /> : project.symbol.slice(0, 2)}</div>;
}

function OwnershipBadge({ project }: { project: Project }) {
  const labels = { verified: "Owner verified", pending: "Claim pending", disputed: "Ownership disputed", unclaimed: "Community listed · Claimable" } as const;
  return <span className={`claim claim-${project.claimStatus}`}>{labels[project.claimStatus]}</span>;
}

function ProjectCard({ project, votes, favorite, topTen, onVote, onFavorite, onOpen, onClaim }: {
  project: Project; votes: number; favorite: boolean; topTen: boolean; onVote: () => void; onFavorite: () => void; onOpen: () => void; onClaim: () => void;
}) {
  const canTrade = tradable.has(project.projectStatus);
  return <article className="listing-card">
    <div className="listing-top">
      <ProjectAvatar project={project} />
      <div className="coin-title"><div><h3>{project.name}</h3><span>${project.symbol}</span></div><div className="tag-row"><span className={`status status-${project.projectStatus}`}>{statusName[project.projectStatus]}</span><OwnershipBadge project={project} />{topTen && <span className="top-ten">Top 10</span>}{project.badges.includes("Founding Project") && <span className="founding">Founding project</span>}{project.badges.includes("Featured") && <span className="featured">Featured</span>}</div></div>
      <button className={`favorite ${favorite ? "selected" : ""}`} onClick={onFavorite}>{favorite ? "♥" : "♡"}</button>
      <button className="vote animated-count" onClick={onVote}>▲ {votes}</button>
    </div>
    <p>{project.pitch}</p>
    <button className="ca" onClick={() => navigator.clipboard?.writeText(project.contractAddress)}>{project.contractAddress.slice(0, 10)}…{project.contractAddress.slice(-7)} <b>Copy CA</b></button>
    <div className="stats"><div><small>Market cap</small><strong>{project.marketCap}</strong></div><div><small>Liquidity</small><strong>{project.liquidity}</strong></div><div><small>24h volume</small><strong>{project.volume24h}</strong></div><div><small>Listed</small><strong>{project.listedLabel}</strong></div></div>
    <div className="listing-footer"><div className="trust-note">{project.claimStatus === "verified" ? "Maintained by a verified project owner." : "Public community listing. The project team has not claimed this page."}</div><div className="listing-actions"><button className="ghost" onClick={onOpen}>View project</button>{project.claimStatus === "unclaimed" && <button className="claim-button" onClick={onClaim}>Claim project</button>}{canTrade ? <a href={SWAP_URL}>Swap</a> : <button disabled>Not trading</button>}</div></div>
  </article>;
}

function ProjectPage({ project, votes, onBack, onVote, onClaim }: { project: Project; votes: number; onBack: () => void; onVote: () => void; onClaim: () => void }) {
  return <main className="project-detail"><button className="back-link" onClick={onBack}>← Back to all projects</button><section className="detail-hero"><div className="detail-identity"><div className="detail-avatar">{project.logoURI ? <img src={project.logoURI} alt="" /> : project.symbol.slice(0, 2)}</div><div><div className="tag-row"><span className={`status status-${project.projectStatus}`}>{statusName[project.projectStatus]}</span><OwnershipBadge project={project} /></div><h1>{project.name} <span>${project.symbol}</span></h1><p>{project.description}</p></div></div><div className="detail-actions"><button className="vote animated-count" onClick={onVote}>▲ Vote {votes}</button>{project.claimStatus === "unclaimed" && <button className="claim-button" onClick={onClaim}>Claim official ownership</button>}{tradable.has(project.projectStatus) && <a href={SWAP_URL}>Trade on SolPitch</a>}</div></section><section className="detail-stats">{[["Market cap",project.marketCap],["Liquidity",project.liquidity],["24h volume",project.volume24h],["Holders",project.holders]].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</section><div className="detail-columns"><section className="detail-panel"><span className="eyebrow">PROJECT PROFILE</span><h2>About {project.name}</h2><p>{project.description}</p><h3>Contract address</h3><button className="full-ca" onClick={()=>navigator.clipboard?.writeText(project.contractAddress)}>{project.contractAddress}<b>Copy</b></button></section><section className="detail-panel claim-panel"><span className="eyebrow">OWNERSHIP</span><h2>{project.claimStatus === "verified" ? "Official page" : "This page is claimable"}</h2><p>{project.claimStatus === "verified" ? "The project owner has been verified." : "The legitimate project owner can claim this page by connecting a recognized project wallet and signing a free message."}</p>{project.claimStatus === "unclaimed" && <button className="primary wide" onClick={onClaim}>Start free claim</button>}</section></div></main>;
}

function ClaimDialog({ project, onClose }: { project: Project; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="claim-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={onClose}>×</button><span className="eyebrow">CLAIM OFFICIAL OWNERSHIP</span><h2>Verify ownership of {project.name}</h2><p>Connect a recognized project wallet and sign a one-time message. Signing is free and cannot move funds.</p><div className="claim-steps"><div><b>1</b><span><strong>Connect Phantom</strong><small>Use the creator or recognized project wallet.</small></span></div><div><b>2</b><span><strong>Sign a message</strong><small>No transaction or gas fee.</small></span></div><div><b>3</b><span><strong>Ownership review</strong><small>SolPitch compares public creator records.</small></span></div></div><button className="primary wide" disabled>Phantom verification coming next</button></section></div>;
}

function RankedProject({ project, rank, votes, onOpen }: { project: Project; rank: number; votes: number; onOpen: () => void }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
  const movement = ["▲ 2", "—", "▲ 1", "▼ 1", "▲ 3"][rank - 1] ?? "—";
  return <button className="rank leaderboard-rank" onClick={onOpen}><b>{medal}</b><ProjectAvatar project={project} small/><span><strong>{project.name}</strong><small>${project.symbol} <i>{movement}</i></small></span><em className="animated-count">▲ {votes}</em></button>;
}

export default function ProductionHome() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Project | null>(null);
  const [claiming, setClaiming] = useState<Project | null>(null);
  const [votes, setVotes] = useState<Record<string, number>>(() => Object.fromEntries(projects.map(p => [p.slug, PREVIEW_DEMO_VOTES ? p.votes : 0])));
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => projects.filter(p => (filter === "all" || p.projectStatus === filter) && `${p.name} ${p.symbol} ${p.contractAddress}`.toLowerCase().includes(query.toLowerCase())), [query, filter]);
  const ranked = useMemo(() => [...projects].sort((a,b)=>(votes[b.slug]??0)-(votes[a.slug]??0)), [votes]);
  const vote = (project: Project) => setVotes(v => ({ ...v, [project.slug]: (v[project.slug] ?? 0) + 1 }));
  const favorite = (project: Project) => setFavorites(current => { const next = new Set(current); next.has(project.slug) ? next.delete(project.slug) : next.add(project.slug); return next; });
  const verifiedCount = projects.filter(p => p.claimStatus === "verified").length;
  const communityCount = projects.length - verifiedCount;

  return <div className="production-app">
    <header className="production-header"><button className="logo-button" onClick={()=>setSelected(null)}><Logo /></button><div className="global-search"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects, tickers or contract addresses" /></div><div className="header-actions"><button>Advertise</button><button className="primary">Submit project</button></div></header>
    <div className="production-grid">
      <aside className="nav-rail"><nav>{["Home","Featured","Trending","New listings","Most voted"].map((item,index)=><button className={index===0&&!selected?"active":""} onClick={()=>setSelected(null)} key={item}><span>{["⌂","★","↗","＋","▲"][index]}</span>{item}</button>)}</nav><p>PROJECT STAGES</p><nav>{(["graduated","bonding","launched","presale","upcoming"] as ProjectStatus[]).map(status=><button className={filter===status?"active":""} onClick={()=>{setFilter(status);setSelected(null)}} key={status}><i className={`stage-dot dot-${status}`}/>{statusName[status]}</button>)}</nav><p>FOR PROJECTS</p><nav><button onClick={()=>setClaiming(projects.find(p=>p.claimStatus==="unclaimed")??null)}>Claim a project</button><button>Submit project</button><button>Promotion options</button></nav></aside>
      {selected ? <ProjectPage project={selected} votes={votes[selected.slug]??0} onBack={()=>setSelected(null)} onVote={()=>vote(selected)} onClaim={()=>setClaiming(selected)} /> : <main className="project-feed">
        <section className="directory-summary"><div><small>Listed projects</small><strong>{projects.length}</strong></div><div><small>Owner verified</small><strong>{verifiedCount}</strong></div><div><small>Community listed</small><strong>{communityCount}</strong></div><div><small>Network</small><strong>Solana</strong></div></section>
        <section className="trending-strip"><span>🔥 Trending</span>{ranked.slice(0,5).map((project,index)=><button key={project.slug} onClick={()=>setSelected(project)}><b>${project.symbol}</b><em>{index===0?"#1 THIS WEEK":`▲ ${index+3}%`}</em></button>)}</section>
        <section className="feed-toolbar" id="directory"><div><span className="eyebrow">PROJECT DIRECTORY</span><h2>Fresh listings <small>{filtered.length} projects</small></h2></div><div className="filter-row"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>All</button>{(["graduated","bonding","launched","presale","upcoming"] as ProjectStatus[]).map(status=><button className={filter===status?"active":""} onClick={()=>setFilter(status)} key={status}>{statusName[status]}</button>)}</div></section>
        {filtered.map(project=><ProjectCard key={project.slug} project={project} votes={votes[project.slug]??0} favorite={favorites.has(project.slug)} topTen={ranked.slice(0,10).some(p=>p.slug===project.slug)} onVote={()=>vote(project)} onFavorite={()=>favorite(project)} onOpen={()=>setSelected(project)} onClaim={()=>setClaiming(project)} />)}
      </main>}
      <aside className="utility-rail">
        <section className="swap-widget swap-placeholder"><div className="widget-title"><div><span className="eyebrow">SOLPITCH</span><h2>Swap</h2></div><span className="live-pill">COMING SOON</span></div><div className="swap-field"><small>You pay</small><div><strong>0.00</strong><button>◎ SOL</button></div></div><div className="switch">↓</div><div className="swap-field"><small>You receive</small><div><strong>0.00</strong><button>Select token</button></div></div><button className="placeholder-button" disabled>Swap integration will appear here</button><p>The live swap remains at solpitch.net until we embed it safely.</p></section>
        <section className="side-widget leaderboard-widget"><div className="widget-title"><div><h3>Most Voted This Week</h3><small>Community leaderboard</small></div><span className="competition-live">LIVE</span></div>{ranked.slice(0,5).map((project,index)=><RankedProject key={project.slug} project={project} rank={index+1} votes={votes[project.slug]??0} onOpen={()=>setSelected(project)} />)}<button className="view-all-ranking">View Top 100 →</button><p className="ranking-note">Top positions earn homepage visibility. Preview votes reset to zero before launch.</p></section>
        <section className="side-widget"><div className="widget-title"><div><h3>Recently Claimed</h3><small>Verified owners</small></div></div>{projects.filter(p=>p.claimStatus==="verified").slice(0,4).map(project=><button className="activity-project" key={project.slug} onClick={()=>setSelected(project)}><ProjectAvatar project={project} small/><span><strong>{project.name}</strong><small>Owner verified ✓</small></span></button>)}</section>
        <section className="side-widget"><div className="widget-title"><div><h3>Recently Added to Swap</h3><small>Newest first</small></div></div>{projects.filter(p=>tradable.has(p.projectStatus)).map((project,index)=><button className={`activity-project swap-added ${index===0?"newest-added":""}`} key={project.slug} onClick={()=>setSelected(project)}><ProjectAvatar project={project} small/><span><strong>{project.name}</strong><small>${project.symbol} · {index===0?"Just added":"Available to swap"}</small></span><em>Swap →</em></button>)}</section>
      </aside>
    </div>
    {claiming && <ClaimDialog project={claiming} onClose={()=>setClaiming(null)} />}
  </div>;
}
