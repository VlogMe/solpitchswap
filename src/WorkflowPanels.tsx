import { FormEvent, useEffect, useRef, useState } from "react";
import { adminLogin, adminLogout, analyzeToken, getAdminSession, getPendingSubmissions, reviewSubmission, submitCoin } from "./api";
import type { TokenAnalysis } from "./api";
import type { CoinSubmission, ProjectStatus } from "./types";

const labels: Record<ProjectStatus, string> = { graduated: "Graduated", bonding: "Bonding", launched: "Live Trading", presale: "Presale", upcoming: "Upcoming" };
const categories = ["Memecoin", "AI", "Gaming", "DeFi", "Infrastructure", "Utility", "NFT", "RWA", "Other"] as const;

function submissionCategory(description: string) {
  return description.match(/^\[Category: ([^\]]+)\]/)?.[1] ?? "Other";
}
function cleanDescription(description: string) {
  return description.replace(/^\[Category: [^\]]+\]\s*/, "");
}
function money(value?: number) {
  if (!value) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
}

export function SubmitProjectPanel({ onClose }: { onClose: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  function field(name: string) {
    return formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | null;
  }
  function fillEmpty(name: string, value?: string) {
    const target = field(name);
    if (target && value && !target.value.trim()) target.value = value;
  }
  async function runAnalysis() {
    const address = field("contractAddress")?.value.trim() ?? "";
    setAnalyzing(true); setMessage(""); setSuccess(false); setAnalysis(null);
    try {
      const result = await analyzeToken(address);
      setAnalysis(result);
      if (!result.found) {
        setMessage("No active trading pair was found. You can still submit the project for manual review.");
        return;
      }
      fillEmpty("name", result.name);
      fillEmpty("symbol", result.symbol);
      fillEmpty("website", result.website);
      fillEmpty("xUrl", result.xUrl);
      fillEmpty("telegramUrl", result.telegramUrl);
      fillEmpty("statusProofUrl", result.dexScreenerUrl);
      fillEmpty("pitch", result.pitch);
      fillEmpty("description", result.description);
      setSuccess(true);
      const metadataNote = result.descriptionFound
        ? ` Real project description loaded from ${result.metadataSource ?? "public metadata"}.`
        : " No public description was found, so SolPitch left those fields blank instead of creating filler text.";
      setMessage((result.tradable ? "Token found and trading data loaded." : "Token metadata found, but active liquidity was not confirmed. SolPitch will review it manually.") + metadataNote + " Review every prefilled field before submitting.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Token analysis failed.");
    } finally { setAnalyzing(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    const form = event.currentTarget; const data = new FormData(form);
    const category = String(data.get("category") || "Other");
    try {
      await submitCoin({
        name: String(data.get("name") || ""), symbol: String(data.get("symbol") || "").replace(/^\$/, ""),
        contractAddress: String(data.get("contractAddress") || ""), projectStatus: "launched",
        pitch: String(data.get("pitch") || ""), description: `[Category: ${category}] ${String(data.get("description") || "")}`,
        website: String(data.get("website") || ""), xUrl: String(data.get("xUrl") || ""), telegramUrl: String(data.get("telegramUrl") || ""),
        logoUrl: analysis?.logoUrl || "", statusProofUrl: String(data.get("statusProofUrl") || ""), submitterEmail: String(data.get("submitterEmail") || ""),
      });
      form.reset(); setAnalysis(null); setSuccess(true); setMessage("Submission received. SolPitch will verify its trading status and swap eligibility during review.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Submission failed."); }
    finally { setBusy(false); }
  }
  return <div className="workflow-overlay"><section className="workflow-shell"><button className="workflow-close" onClick={onClose}>×</button><span className="eyebrow">SUBMIT A PROJECT</span><h1>Apply for a SolPitch listing</h1><p className="workflow-intro">Paste the Solana contract address first. SolPitch will look for public token, project description and trading information and fill in what it can.</p>{message && <div className={success ? "workflow-message success" : "workflow-message error"}>{message}</div>}<form ref={formRef} className="workflow-form" onSubmit={submit}><div className="workflow-grid"><label className="wide">Contract address<div className="contract-analyzer"><input name="contractAddress" required minLength={32} placeholder="Paste Solana contract address"/><button type="button" onClick={()=>void runAnalysis()} disabled={analyzing}>{analyzing ? "Analyzing…" : "Analyze token"}</button></div></label>{analysis?.found && <div className="token-analysis wide">{analysis.logoUrl ? <img src={analysis.logoUrl} alt=""/> : <div className="analysis-logo">{analysis.symbol?.slice(0,2) || "?"}</div>}<div><strong>{analysis.name || "Token found"} {analysis.symbol ? `$${analysis.symbol}` : ""}</strong><small>{analysis.dexId || "Solana DEX"} · {analysis.tradable ? "Trading detected" : "Manual review needed"}</small><span>Liquidity {money(analysis.liquidityUsd)} · Market cap {money(analysis.marketCap)} · 24h volume {money(analysis.volume24h)}</span>{analysis.metadataSource && <span>Metadata: {analysis.metadataSource} · {analysis.descriptionFound ? "Description found" : "Description not found"}</span>}</div>{analysis.dexScreenerUrl && <a href={analysis.dexScreenerUrl} target="_blank" rel="noreferrer">View market ↗</a>}</div>}<label>Project name<input name="name" required maxLength={80}/></label><label>Ticker<input name="symbol" required maxLength={16} placeholder="$TOKEN"/></label><label>Project category<select name="category" defaultValue="Memecoin">{categories.map(category=><option value={category} key={category}>{category}</option>)}</select></label><label>Contact email<input name="submitterEmail" type="email" required/></label><label className="wide">Short pitch<input name="pitch" required maxLength={300} placeholder="Automatically filled when public metadata includes a description"/></label><label className="wide">Full description<textarea name="description" required rows={5} maxLength={4900} placeholder="Automatically filled from public metadata when available"/></label><label>Website<input name="website" type="url"/></label><label>X profile<input name="xUrl" type="url"/></label><label>Telegram<input name="telegramUrl" type="url"/></label><label>Project proof URL<input name="statusProofUrl" type="url" required placeholder="Official X, website, Pump.fun or Dexscreener"/></label></div><div className="workflow-message">SolPitch uses public metadata only as a starting point. Submitters must review it. When no real description is available, the description fields remain blank rather than displaying generic promotional copy.</div><label className="workflow-check"><input type="checkbox" required/> I confirm this information is accurate and may be publicly reviewed.</label><button className="primary workflow-submit" disabled={busy} type="submit">{busy ? "Submitting…" : "Send for review"}</button></form></section></div>;
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
  return <div className="workflow-overlay"><section className="workflow-shell admin-shell"><button className="workflow-close" onClick={onClose}>×</button><span className="eyebrow">PRIVATE ADMIN</span>{loading ? <div className="workflow-message">Loading review workspace…</div> : !authenticated ? <><h1>Admin sign in</h1><p className="workflow-intro">Use the server-side password stored securely in Cloudflare.</p>{message && <div className="workflow-message error">{message}</div>}<form className="admin-login" onSubmit={login}><input name="password" type="password" required placeholder="Admin password"/><button className="primary" type="submit">Sign in</button></form></> : <><div className="admin-heading"><div><h1>Pending listings</h1><p>{submissions.length} awaiting review</p></div><button onClick={async()=>{await adminLogout();setAuthenticated(false)}}>Sign out</button></div>{message && <div className="workflow-message error">{message}</div>}<div className="review-list">{submissions.length === 0 && <div className="review-empty">No submissions are waiting.</div>}{submissions.map(item=><article className="review-item" key={item.id}><div className="review-title"><div><h2>{item.name} <span>${item.symbol}</span></h2><small>{submissionCategory(item.description)} · {new Date(item.submittedAt).toLocaleString()}</small></div><b>{submissionCategory(item.description)}</b></div><p>{item.pitch}</p><p>{cleanDescription(item.description)}</p><div className="review-data"><span><small>Contract</small>{item.contractAddress}</span><span><small>Email</small>{item.submitterEmail}</span><a href={item.statusProof} target="_blank" rel="noreferrer">Open project proof ↗</a></div><div className="workflow-message">Verify the description, tradability and swap eligibility before approval. Publicly fetched metadata can be incomplete or outdated.</div><input id={`logo-${item.id}`} type="url" placeholder="Logo image URL (optional)"/><textarea id={`note-${item.id}`} rows={3} placeholder="Private reviewer notes"/><div className="review-options"><label><input id={`swap-${item.id}`} type="checkbox"/> Verified tradable and added to SolPitch Swap</label><label><input id={`promoted-${item.id}`} type="checkbox"/> Promoted placement</label></div><div className="review-actions"><button className="reject" onClick={()=>void decide(item,"rejected")}>Reject</button><button className="approve" onClick={()=>void decide(item,"approved")}>Approve and publish</button></div></article>)}</div></>}</section></div>;
}
