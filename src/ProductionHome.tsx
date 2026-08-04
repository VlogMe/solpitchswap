import { useMemo, useState } from "react";
import { projects } from "./data";
import type { Project, ProjectStatus } from "./types";
import "./production.css";

const SWAP_URL = "https://solpitch.net";
const statusName: Record<ProjectStatus, string> = { graduated: "Graduated", bonding: "Bonding", launched: "Live", presale: "Presale", upcoming: "Upcoming" };
const tradable = new Set<ProjectStatus>(["graduated", "bonding", "launched"]);

function Logo() {
  return <img className="official-logo" src="/solpitch-logo.svg" alt="SolPitch" />;
}

function ProjectCard({ project }: { project: Project }) {
  const canTrade = tradable.has(project.projectStatus);
  return <article className="listing-card">
    <div className="listing-top">
      <div className="coin-avatar">{project.symbol.slice(0, 2)}</div>
      <div className="coin-title"><div><h3>{project.name}</h3><span>${project.symbol}</span></div><div className="tag-row"><span className={`status status-${project.projectStatus}`}>{statusName[project.projectStatus]}</span><span className={`claim claim-${project.claimStatus}`}>{project.claimStatus === "verified" ? "Owner verified" : "Community listed · Claimable"}</span>{project.badges.includes("Featured") && <span className="featured">Featured</span>}</div></div>
      <button className="vote">▲ {project.votes}</button>
    </div>
    <p>{project.pitch}</p>
    <button className="ca" onClick={() => navigator.clipboard?.writeText(project.contractAddress)}>{project.contractAddress.slice(0, 10)}…{project.contractAddress.slice(-7)} <b>Copy CA</b></button>
    <div className="stats"><div><small>Market cap</small><strong>{project.marketCap}</strong></div><div><small>Liquidity</small><strong>{project.liquidity}</strong></div><div><small>24h volume</small><strong>{project.volume24h}</strong></div><div><small>Listed</small><strong>{project.listedLabel}</strong></div></div>
    <div className="listing-actions"><button className="ghost">View project</button>{project.claimStatus === "unclaimed" && <button className="claim-button">Claim project</button>}{canTrade ? <a href={SWAP_URL}>Swap</a> : <button disabled>Not trading</button>}</div>
  </article>;
}

export default function ProductionHome() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const filtered = useMemo(() => projects.filter(project => (filter === "all" || project.projectStatus === filter) && `${project.name} ${project.symbol} ${project.contractAddress}`.toLowerCase().includes(query.toLowerCase())), [query, filter]);
  return <div className="production-app">
    <header className="production-header"><Logo/><div className="global-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search projects, tickers or contract addresses" /></div><div className="header-actions"><button>Advertise</button><button className="primary">Submit project</button></div></header>
    <div className="production-grid">
      <aside className="nav-rail"><nav>{["Home","Featured","Trending","New listings","Most voted"].map((item, index) => <button className={index === 0 ? "active" : ""} key={item}><span>{["⌂","★","↗","＋","▲"][index]}</span>{item}</button>)}</nav><p>PROJECT STAGES</p><nav>{(["graduated","bonding","launched","presale","upcoming"] as ProjectStatus[]).map(status => <button className={filter === status ? "active" : ""} onClick={() => setFilter(status)} key={status}><i className={`stage-dot dot-${status}`}/>{statusName[status]}</button>)}</nav><p>FOR PROJECTS</p><nav><button>Claim a project</button><button>Submit project</button><button>Promotion options</button></nav><div className="trust-box"><strong>Clear ownership labels</strong><span>Community-listed pages are claimable. Owner-verified pages are signed and reviewed.</span></div></aside>
      <main className="project-feed">
        <section className="hero"><div><span className="eyebrow">SOLANA PROJECT DISCOVERY</span><h1>Discover projects.<br/><em>Know what you’re looking at.</em></h1><p>Explore Solana projects at every stage, see whether a page is community-listed or owner-verified, and trade live tokens through SolPitch Swap.</p><div className="hero-actions"><button className="primary">Explore projects</button><button>Submit your project</button></div><div className="hero-proof"><span>✓ Status clearly labeled</span><span>✓ Community pages claimable</span><span>✓ Paid promotion disclosed</span></div></div><div className="hero-orbit"><div className="orbit-logo"><span>S</span><span>P</span></div><b>Solana projects<br/>in one place</b></div></section>
        <section className="feed-toolbar"><div><span className="eyebrow">PROJECT DIRECTORY</span><h2>Fresh listings</h2></div><div className="filter-row"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>{(["graduated","bonding","launched","presale","upcoming"] as ProjectStatus[]).map(status => <button className={filter === status ? "active" : ""} onClick={() => setFilter(status)} key={status}>{statusName[status]}</button>)}</div></section>
        {filtered.map(project => <ProjectCard project={project} key={project.slug}/>)}
        {filtered.length === 0 && <div className="empty-state"><h3>No matching projects yet.</h3><p>Change the filter or submit a project for review.</p></div>}
      </main>
      <aside className="utility-rail"><section className="swap-widget"><div className="widget-title"><div><span className="eyebrow">SOLPITCH</span><h2>Swap</h2></div><span className="live-pill">LIVE</span></div><div className="swap-field"><small>You pay</small><div><strong>0.00</strong><button>◎ SOL</button></div></div><div className="switch">↓</div><div className="swap-field"><small>You receive</small><div><strong>0.00</strong><button>Select token</button></div></div><a href={SWAP_URL}>Open SolPitch Swap</a><p>Uses the existing protected swap at solpitch.net.</p></section>
        <section className="side-widget"><div className="widget-title"><h3>Promoted</h3><button>Advertise</button></div><div className="side-empty"><b>Paid placements will appear here</b><span>Promotion never means endorsement.</span></div></section>
        <section className="side-widget"><div className="widget-title"><h3>Most voted</h3><span>Community</span></div>{projects.slice().sort((a,b)=>b.votes-a.votes).slice(0,5).map((project,index)=><div className="rank" key={project.slug}><b>{index+1}</b><div className="mini-avatar">{project.symbol.slice(0,1)}</div><span><strong>{project.name}</strong><small>${project.symbol}</small></span><em>▲ {project.votes}</em></div>)}</section>
      </aside>
    </div>
  </div>;
}
