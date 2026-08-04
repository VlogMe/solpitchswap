import { FormEvent, useEffect, useMemo, useState } from "react";
import { mostVoted, projects, promoted } from "./data";
import { createSubmission, loadSubmissions, saveSubmissions, updateSubmissionStatus } from "./submissionStore";
import type { CoinSubmission, Project, ProjectBadge } from "./types";
import "./styles.css";

const SWAP_URL = "https://solpitch.net";
type View = "listings" | "submit" | "admin";

function Badge({ badge }: { badge: ProjectBadge }) {
  return <span className={`badge badge-${badge.toLowerCase()}`}>{badge}</span>;
}

function LeftNavigation({ view, onView }: { view: View; onView: (view: View) => void }) {
  return (
    <aside className="left-sidebar panel">
      <button className="brand brand-button" onClick={() => onView("listings")}><span className="brand-mark">SP</span><span><strong>SolPitch</strong><small>Graduated listings only</small></span></button>
      <nav>
        <button className={view === "listings" ? "active" : ""} onClick={() => onView("listings")}><span className="nav-dot" />Home</button>
        {['New Listings','Trending','Most Voted','Promoted','Top 100'].map(item => <button onClick={() => onView("listings")} key={item}><span className="nav-dot" />{item}</button>)}
      </nav>
      <p className="nav-label">PROJECT TOOLS</p>
      <nav>
        <button className={view === "submit" ? "active" : ""} onClick={() => onView("submit")}><span className="nav-dot" />Submit Coin</button>
        <button onClick={() => onView("listings")}><span className="nav-dot" />Advertise</button>
        <button onClick={() => onView("listings")}><span className="nav-dot" />Listing Rules</button>
        <button className={view === "admin" ? "active" : ""} onClick={() => onView("admin")}><span className="nav-dot" />Admin Review</button>
      </nav>
      <div className="rule-card"><strong>Graduated projects only.</strong><span>No presales. No launches. No unbonded tokens.</span></div>
    </aside>
  );
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: (project: Project) => void }) {
  return <article className="project-card panel"><div className="project-top"><div className="project-logo">{project.name[0]}</div><div className="project-heading"><div className="name-line"><h3>{project.name}</h3><span>${project.symbol}</span></div><div className="badges">{project.badges.map(b => <Badge key={b} badge={b} />)}</div></div><button className="vote-button">▲ {project.votes}</button></div><p className="pitch">{project.pitch}</p><button className="contract" onClick={() => navigator.clipboard?.writeText(project.contractAddress)}>{project.contractAddress.slice(0,8)}...{project.contractAddress.slice(-6)} <span>Copy CA</span></button><div className="metrics">{[['Market cap',project.marketCap],['Liquidity',project.liquidity],['24h volume',project.volume24h],['Holders',project.holders],['Votes',String(project.votes)]].map(([l,v]) => <div className="metric" key={l}><small>{l}</small><strong>{v}</strong></div>)}</div><div className="project-actions"><div className="socials"><span>WEB</span><span>X</span><span>TG</span></div><div><button onClick={() => onOpen(project)}>View Project</button><a href={SWAP_URL}>Swap</a></div></div></article>;
}

function SwapPanel() {
  return <section className="swap-card panel"><div className="card-heading"><div><small>SOLPITCH</small><h2>Swap</h2></div><span>Protected engine</span></div><div className="token-box"><small>You pay</small><div><strong>0.00</strong><span>◎ SOL</span></div></div><div className="swap-arrow">↓</div><div className="token-box"><small>You receive</small><div><strong>0.00</strong><span>Select token</span></div></div><a className="primary-action" href={SWAP_URL}>Open live swap</a><p className="fine-print">The working Jupiter and Phantom transaction logic remains isolated at solpitch.net.</p></section>;
}

function RightSidebar() {
  return <aside className="right-sidebar"><SwapPanel /><section className="side-card panel"><div className="card-heading"><h2>Promoted</h2><span>Approved only</span></div>{promoted.map(p => <div className="mini-project" key={p.slug}><span>{p.name[0]}</span><div><strong>{p.name}</strong><small>${p.symbol}</small></div><em>Featured</em></div>)}</section><section className="side-card panel"><div className="card-heading"><h2>Most voted</h2><span>24h</span></div>{mostVoted.map((p,i) => <div className="rank-row" key={p.slug}><b>{i+1}</b><span>{p.name[0]}</span><div><strong>{p.name}</strong><small>${p.symbol}</small></div><em>▲ {p.votes}</em></div>)}</section></aside>;
}

function SubmissionForm({ onSubmit }: { onSubmit: (submission: CoinSubmission) => void }) {
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const submission = createSubmission({
      name: String(data.get("name") ?? "").trim(), symbol: String(data.get("symbol") ?? "").trim().replace(/^\$/, "").toUpperCase(), contractAddress: String(data.get("contractAddress") ?? "").trim(), pitch: String(data.get("pitch") ?? "").trim(), description: String(data.get("description") ?? "").trim(), website: String(data.get("website") ?? "").trim(), x: String(data.get("x") ?? "").trim(), telegram: String(data.get("telegram") ?? "").trim(), graduationProof: String(data.get("graduationProof") ?? "").trim(), reviewerNote: "",
    });
    onSubmit(submission); event.currentTarget.reset(); setSent(true);
  };
  return <main className="workflow-page"><header className="feed-header"><div><small>PROJECT SUBMISSION</small><h1>List a graduated Solana coin.</h1><p>Every field is reviewed. Submission does not guarantee publication.</p></div></header>{sent && <div className="success panel">Submission received and added to the admin review queue.</div>}<form className="submission-form panel" onSubmit={submit}><div className="form-grid"><label>Coin name<input name="name" required maxLength={60}/></label><label>Ticker<input name="symbol" required maxLength={12}/></label><label className="full">Contract address<input name="contractAddress" required minLength={32}/></label><label className="full">Short pitch<input name="pitch" required maxLength={220}/></label><label className="full">Full description<textarea name="description" required rows={5}/></label><label>Website<input name="website" type="url"/></label><label>X profile<input name="x" type="url"/></label><label>Telegram<input name="telegram" type="url"/></label><label>Graduation proof<input name="graduationProof" type="url" required/></label></div><label className="check-row"><input type="checkbox" required/> I confirm this token is already graduated or bonded and actively trading.</label><button className="primary-action form-submit" type="submit">Send for review</button></form></main>;
}

function AdminReview({ submissions, onDecision }: { submissions: CoinSubmission[]; onDecision: (id: string, status: "approved" | "rejected", note: string) => void }) {
  const pending = submissions.filter(s => s.status === "pending");
  return <main className="workflow-page"><header className="feed-header"><div><small>ADMIN WORKSPACE</small><h1>Submission review queue</h1><p>{pending.length} project{pending.length === 1 ? "" : "s"} awaiting review.</p></div></header>{pending.length === 0 && <div className="empty panel">No pending submissions.</div>}{pending.map(submission => <article className="review-card panel" key={submission.id}><div className="review-heading"><div><h2>{submission.name} <span>${submission.symbol}</span></h2><small>Submitted {new Date(submission.submittedAt).toLocaleString()}</small></div><span className="badge badge-featured">PENDING</span></div><p>{submission.pitch}</p><dl><div><dt>Contract</dt><dd>{submission.contractAddress}</dd></div><div><dt>Graduation proof</dt><dd><a href={submission.graduationProof} target="_blank" rel="noreferrer">Open evidence</a></dd></div><div><dt>Website</dt><dd>{submission.website || "Not supplied"}</dd></div></dl><textarea id={`note-${submission.id}`} placeholder="Reviewer note" rows={3}/><div className="decision-row"><button className="reject" onClick={() => onDecision(submission.id,"rejected",(document.getElementById(`note-${submission.id}`) as HTMLTextAreaElement)?.value ?? "")}>Reject</button><button className="approve" onClick={() => onDecision(submission.id,"approved",(document.getElementById(`note-${submission.id}`) as HTMLTextAreaElement)?.value ?? "")}>Approve listing</button></div></article>)}</main>;
}

function ProjectPage({ project, onBack }: { project: Project; onBack: () => void }) {
  return <main className="project-page"><button className="back-button" onClick={onBack}>← Back to listings</button><section className="project-hero panel"><div className="project-logo large">{project.name[0]}</div><div><div className="name-line"><h1>{project.name}</h1><span>${project.symbol}</span></div><div className="badges">{project.badges.map(b => <Badge key={b} badge={b}/>)}</div><p>{project.description}</p></div></section><section className="detail-grid"><div className="panel detail-card"><small>CONTRACT ADDRESS</small><strong>{project.contractAddress}</strong><button onClick={() => navigator.clipboard?.writeText(project.contractAddress)}>Copy address</button></div><div className="panel detail-card"><small>PROJECT STATUS</small><strong>Graduated and trading</strong><a href={SWAP_URL}>Trade on SolPitch</a></div></section><section className="panel content-section"><small>PROJECT PROFILE</small><h2>Pitch, story and updates</h2><p>{project.pitch}</p><p>Roadmap, media, announcements and community links will be published only after admin approval.</p></section></main>;
}

export default function App() {
  const [query,setQuery] = useState(""); const [selected,setSelected] = useState<Project|null>(null); const [view,setView] = useState<View>("listings"); const [submissions,setSubmissions] = useState<CoinSubmission[]>(() => loadSubmissions());
  useEffect(() => saveSubmissions(submissions),[submissions]);
  const filtered = useMemo(() => projects.filter(p => `${p.name} ${p.symbol} ${p.contractAddress}`.toLowerCase().includes(query.toLowerCase())),[query]);
  const changeView = (next: View) => { setSelected(null); setView(next); };
  const decide = (id: string,status: "approved"|"rejected",note: string) => setSubmissions(current => updateSubmissionStatus(current,id,status,note));
  return <div className="app"><header className="topbar"><button className="mobile-brand" onClick={() => changeView("listings")}>SolPitch</button><input value={query} onChange={e => setQuery(e.target.value)} disabled={view !== "listings" || Boolean(selected)} placeholder="Search graduated projects, tickers or contract addresses"/><div><button>Advertise</button><button className="top-primary" onClick={() => changeView("submit")}>Submit Coin</button></div></header><div className="layout"><LeftNavigation view={view} onView={changeView}/>{selected ? <ProjectPage project={selected} onBack={() => setSelected(null)}/> : view === "submit" ? <SubmissionForm onSubmit={submission => setSubmissions(current => [submission,...current])}/> : view === "admin" ? <AdminReview submissions={submissions} onDecision={decide}/> : <main className="feed"><header className="feed-header"><div><small>GRADUATED SOLANA DIRECTORY</small><h1>Discover projects already trading.</h1><p>No presales. No upcoming launches. Every listing is reviewed.</p></div><button>Newest first ▾</button></header><div className="filters">{['All listings','Newest','Trending','Most voted','Highest liquidity'].map((x,i) => <button className={i===0?'active':''} key={x}>{x}</button>)}</div>{filtered.map(p => <ProjectCard project={p} onOpen={setSelected} key={p.slug}/>)}{filtered.length===0 && <div className="empty panel">No approved projects match that search.</div>}</main>}<RightSidebar/></div></div>;
