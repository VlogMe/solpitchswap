import { FormEvent, useEffect, useState } from "react";
import { adminLogin, getAdminSession, getPendingClaims, createClaimNonce, reviewClaim, submitClaim, type ClaimRequest } from "./api";
import type { Project } from "./types";

type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: "utf8"): Promise<{ signature: Uint8Array }>;
};

declare global { interface Window { solana?: PhantomProvider } }

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function ClaimProjectPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setSuccess(false);
    try {
      const provider = window.solana;
      if (!provider?.isPhantom) throw new Error("Phantom was not detected. Install or open Phantom, then try again.");
      const connection = await provider.connect();
      const walletAddress = connection.publicKey.toString();
      const { nonce, message: signText } = await createClaimNonce(project.slug, walletAddress);
      const signed = await provider.signMessage(new TextEncoder().encode(signText), "utf8");
      const form = event.currentTarget;
      const data = new FormData(form);
      await submitClaim({
        nonce,
        walletAddress,
        signature: bytesToBase64(signed.signature),
        evidenceUrl: String(data.get("evidenceUrl") || ""),
        submitterEmail: String(data.get("email") || ""),
      });
      setSuccess(true);
      setMessage("Signed claim received. SolPitch will review the wallet and public project records before awarding the Verified Owner badge.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ownership claim failed.");
    } finally { setBusy(false); }
  }

  return <div className="workflow-overlay"><section className="workflow-shell claim-workflow"><button className="workflow-close" onClick={onClose}>×</button><span className="eyebrow">PHANTOM OWNERSHIP CLAIM</span><h1>Claim {project.name}</h1><p className="workflow-intro">Connect a recognized project wallet and sign a one-time message. This is not a transaction, costs no SOL, and cannot move funds.</p>{message && <div className={`workflow-message ${success ? "success" : "error"}`}>{message}</div>}{!success && <form className="workflow-form" onSubmit={claim}><div className="claim-steps"><div><b>1</b><span><strong>Connect Phantom</strong><small>Use the creator, deployer, treasury, or publicly recognized project wallet.</small></span></div><div><b>2</b><span><strong>Sign the SolPitch message</strong><small>The exact project, wallet, and one-time nonce are included.</small></span></div><div><b>3</b><span><strong>Admin verification</strong><small>SolPitch compares your wallet with public project evidence.</small></span></div></div><label>Contact email<input name="email" type="email" required placeholder="owner@project.com" /></label><label>Public ownership evidence URL<input name="evidenceUrl" type="url" required placeholder="Official X post, website, launch page, or explorer evidence" /></label><button className="primary workflow-submit" disabled={busy} type="submit">{busy ? "Connecting and signing…" : "Connect Phantom and sign"}</button></form>}</section></div>;
}

export function AdminClaimsPanel({ onClose, onApproved }: { onClose: () => void; onApproved: () => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<ClaimRequest[]>([]);
  const [message, setMessage] = useState("");
  async function refresh() { setLoading(true); try { const session = await getAdminSession(); setAuthenticated(session.authenticated); setClaims(session.authenticated ? await getPendingClaims() : []); } catch (error) { setAuthenticated(false); setMessage(error instanceof Error ? error.message : "Could not load claims."); } finally { setLoading(false); } }
  useEffect(() => { void refresh(); }, []);
  async function login(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); try { await adminLogin(String(data.get("password") || "")); await refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Login failed."); } }
  async function decide(claim: ClaimRequest, status: "approved" | "rejected") { const note=(document.getElementById(`claim-note-${claim.id}`) as HTMLTextAreaElement)?.value??""; try { await reviewClaim(claim.id,status,note); await refresh(); if(status==="approved")onApproved(); } catch(error){setMessage(error instanceof Error?error.message:"Claim review failed.");} }

  return <div className="workflow-overlay"><section className="workflow-shell admin-shell"><button className="workflow-close" onClick={onClose}>×</button><span className="eyebrow">PRIVATE CLAIM REVIEW</span>{loading ? <div className="workflow-message">Loading claims…</div> : !authenticated ? <><h1>Admin sign in</h1>{message && <div className="workflow-message error">{message}</div>}<form className="admin-login" onSubmit={login}><input name="password" type="password" required placeholder="Admin password"/><button className="primary" type="submit">Sign in</button></form></> : <><div className="admin-heading"><div><h1>Ownership claims</h1><p>{claims.length} pending verification</p></div></div>{message && <div className="workflow-message error">{message}</div>}<div className="review-list">{claims.length===0 && <div className="review-empty">No ownership claims are waiting.</div>}{claims.map(claim=><article className="review-item" key={claim.id}><div className="review-title"><div><h2>{claim.projectName} <span>${claim.projectSymbol}</span></h2><small>Signed {new Date(claim.createdAt).toLocaleString()}</small></div><b>CLAIM</b></div><div className="review-data"><span><small>Phantom wallet</small>{claim.walletAddress}</span><span><small>Contact</small>{claim.submitterEmail || "Not provided"}</span>{claim.evidenceUrl && <a href={claim.evidenceUrl} target="_blank" rel="noreferrer">Open ownership evidence ↗</a>}</div><div className="workflow-message">The wallet signature has already been cryptographically verified. Confirm the wallet is publicly connected to the project before approval.</div><textarea id={`claim-note-${claim.id}`} rows={3} placeholder="Private verification notes"/><div className="review-actions"><button className="reject" onClick={()=>void decide(claim,"rejected")}>Reject claim</button><button className="approve" onClick={()=>void decide(claim,"approved")}>Approve Verified Owner</button></div></article>)}</div></>}</section></div>;
}
