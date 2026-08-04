import { FormEvent, useEffect, useState } from "react";
import { adminLogin, adminLogout, getAdminSession, getPendingSubmissions, reviewSubmission, submitCoin } from "./api";
import type { CoinSubmission, ProjectStatus } from "./types";

const labels: Record<ProjectStatus, string> = { graduated: "Graduated", bonding: "Bonding", launched: "Live", presale: "Presale", upcoming: "Upcoming" };

export function SubmitProjectPanel({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    const form = event.currentTarget; const data = new FormData(form);
    try {
      await submitCoin({
        name: String(data.get("name") || ""), symbol: String(data.get("symbol") || "").replace(/^\$/, ""),
        contractAddress: String(data.get("contractAddress") || ""), projectStatus: String(data.get("projectStatus")) as ProjectStatus,
        pitch: String(data.get("pitch") || ""), description: String(data.get("description") || ""),
        website: String(data.get("website") || ""), xUrl: String(data.get("xUrl") || ""), telegramUrl: String(data.get("telegramUrl") || ""),
        statusProofUrl: String(data.get("statusProofUrl") || ""), submitterEmail: String(data.get("submitterEmail") || ""),
      });
      form.reset(); setSuccess(true); setMessage("Submission received. It is now waiting in the private SolPitch review queue.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed."); }
    finally { setBusy(false); }
  }
  return <div className="workflow-overlay"><section className="workflow-shell"><button className="workflow-close" onClick={onClose}>×</button><span className="eyebrow">SUBMIT A PROJECT</span><h1>Apply for a SolPitch listing</h1><p className="workflow-intro">Submit accurate public information. Nothing appears on the homepage until it is reviewed and approved.</p>{message && <div className={success ? "workflow-message success" : "workflow-message error"}>{message}</div>}<form className="workflow-form" onSubmit={submit}><div className="workflow-grid"><label>Project name<input name="name" required maxLength={80}/></label><label>Ticker<input name="symbol" required maxLength={16} placeholder="$TOKEN"/></label><label>Project stage<select name="projectStatus" defaultValue="graduated">{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Contact email<input name="submitterEmail" type="email" required/></label><label className="wide">Contract address<input name="contractAddress" required minLength={32}/></label><label className="wide">Short pitch<input name="pitch" required maxLength={300}/></label><label className="wide">Full description<textarea name="description" required rows={5} maxLength={5000}/></label><label>Website<input name="website" type="url"/></label><label>X profile<input name="xUrl" type="url"/></label><label>Telegram<input name="telegramUrl" type="url"/></label><label>Status proof URL<input name="statusProofUrl" type="url" required placeholder="Pump.fun, Dexscreener or official proof"/></label></div><label className="workflow-check"><input type="checkbox" required/> I confirm this information is accurate and may be publicly reviewed.</label><button className="primary workflow-submit" disabled={busy} type="submit">{busy ? "Submitting…" : "Send for review"}</button></form></section></div>;
}

export function AdminPanel({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [authenticated, setAuthenticated] = useState(false); const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<CoinSubmission[]>([]); const [message, setMessage] = useState("");
  async function refresh() { setLoading(true); try { const session = await getAdminSession(); setAuthenticated(session.authenticated); setSubmissions(session.authenticated ? await getPendingSubmissions() : []); } catch { setAuthenticated(false); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  async function login(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); try { await adminLogin(String(data.get("password") || "")); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Login failed."); } }
  async function decide(item: CoinSubmission, status: "approved" | "rejected") {
    const note = (document.getElementById(`note-${item.id}`) as HTMLTextAreaElement)?.value ?? "";
    const addedToSwap = (document.getElementById(`swap-${item.id}`) as HTMLInputElement)?.checked ?? false;
    const promoted = (document.getElementById(`promoted-${item.id}`) as HTMLInputElement)?.checked ?? false;
    const logoUrl = (document.getElementById(`logo-${item.id}`) as HTMLInputElement)?.value ?? "";
    try { await reviewSubmission(item.id, status, note, { addedToSwap, promoted, logoUrl }); await refresh(); if (status === "approved") onPublished(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Review failed."); }
  }
  return <div className="workflow-overlay"><section className="workflow-shell admin-shell"><button className="workflow-close" onClick={onClose}>×</button><span className="eyebrow">PRIVATE ADMIN</span>{loading ? <div className="workflow-message">Loading review workspace…</div> : !authenticated ? <><h1>Admin sign in</h1><p className="workflow-intro">Use the server-side password stored securely in Cloudflare.</p>{message && <div className="workflow-message error">{message}</div>}<form className="admin-login" onSubmit={login}><input name="password" type="password" required placeholder="Admin password"/><button className="primary" type="submit">Sign in</button></form></> : <><div className="admin-heading"><div><h1>Pending listings</h1><p>{submissions.length} awaiting review</p></div><button onClick={async()=>{await adminLogout();setAuthenticated(false)}}>Sign out</button></div>{message && <div className="workflow-message error">{message}</div>}<div className="review-list">{submissions.length === 0 && <div className="review-empty">No submissions are waiting.</div>}{submissions.map(item=><article className="review-item" key={item.id}><div className="review-title"><div><h2>{item.name} <span>${item.symbol}</span></h2><small>{labels[item.projectStatus]} · {new Date(item.submittedAt).toLocaleString()}</small></div><b>{labels[item.projectStatus]}</b></div><p>{item.pitch}</p><div className="review-data"><span><small>Contract</small>{item.contractAddress}</span><span><small>Email</small>{item.submitterEmail}</span><a href={item.statusProof} target="_blank" rel="noreferrer">Open status proof ↗</a></div><input id={`logo-${item.id}`} type="url" placeholder="Logo image URL (optional)"/><textarea id={`note-${item.id}`} rows={3} placeholder="Private reviewer notes"/><div className="review-options"><label><input id={`swap-${item.id}`} type="checkbox"/> Added to SolPitch Swap</label><label><input id={`promoted-${item.id}`} type="checkbox"/> Promoted placement</label></div><div className="review-actions"><button className="reject" onClick={()=>void decide(item,"rejected")}>Reject</button><button className="approve" onClick={()=>void decide(item,"approved")}>Approve and publish</button></div></article>)}</div></>}</section></div>;
}
