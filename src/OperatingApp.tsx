import { useCallback, useEffect, useState } from "react";
import ProductionHome from "./ProductionHome";
import { projects as fallbackProjects } from "./data";
import { createVoteNonce, getActivity, getPublishedProjects, submitVote, type ActivityEvent } from "./api";
import { AdminPanel, SubmitProjectPanel } from "./WorkflowPanels";
import { AdminClaimsPanel, ClaimProjectPanel } from "./ClaimPanels";
import type { Project } from "./types";
import "./workflows.css";

type Panel = "submit" | "admin" | "claims" | null;
type PhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
};

declare global { interface Window { solana?: PhantomProvider } }

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
  const [claimProject, setClaimProject] = useState<Project | null>(null);
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState<"database" | "preview">("preview");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityOpen, setActivityOpen] = useState(true);
  const [voteBusy, setVoteBusy] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      const published = await getPublishedProjects();
      if (published.length > 0) {
        fallbackProjects.splice(0, fallbackProjects.length, ...published);
        setSource("database");
        setRevision(value => value + 1);
      }
    } catch { setSource("preview"); }
  }, []);

  const refreshActivity = useCallback(async () => {
    try { setActivity(await getActivity()); } catch { setActivity([]); }
  }, []);

  useEffect(() => { void refreshProjects(); void refreshActivity(); }, [refreshProjects, refreshActivity]);

  useEffect(() => {
    const capture = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      const text = button.textContent?.trim().toLowerCase() ?? "";

      if (button.classList.contains("vote")) {
        event.preventDefault(); event.stopPropagation();
        if (voteBusy) return;
        const container = button.closest("article, .project-detail");
        const heading = container?.querySelector("h3,h1")?.textContent?.trim() ?? "";
        const project = fallbackProjects.find(item => heading.toLowerCase().startsWith(item.name.toLowerCase()));
        if (!project) { window.alert("This project must be published in the live database before voting opens."); return; }
        const phantom = window.solana;
        if (!phantom?.isPhantom) { window.alert("Install or open Phantom to cast a verified weekly vote."); return; }
        setVoteBusy(true);
        try {
          const connection = await phantom.connect();
          const walletAddress = connection.publicKey.toString();
          const nonce = await createVoteNonce(project.slug, walletAddress);
          const signed = await phantom.signMessage(new TextEncoder().encode(nonce.message), "utf8");
          const result = await submitVote({ nonce: nonce.nonce, walletAddress, signature: bytesToBase64(signed.signature) });
          await refreshProjects(); await refreshActivity();
          window.alert(`Vote counted. ${project.name} now has ${result.votes} verified vote${result.votes === 1 ? "" : "s"} this week.`);
        } catch (error) {
          window.alert(error instanceof Error ? error.message : "The vote could not be completed.");
        } finally { setVoteBusy(false); }
        return;
      }

      if (text === "submit project" || text === "submit coin") {
        event.preventDefault(); event.stopPropagation(); setPanel("submit"); return;
      }
      if (text.includes("claim project") || text.includes("claim official ownership") || text.includes("start free claim")) {
        event.preventDefault(); event.stopPropagation();
        const container = button.closest("article, .project-detail, .detail-hero");
        const visibleName = container?.querySelector("h3,h1")?.textContent?.trim().replace(/\s+\$[A-Z0-9]+.*$/, "") ?? "";
        const project = fallbackProjects.find(item => item.name.toLowerCase() === visibleName.toLowerCase()) ?? fallbackProjects.find(item => item.claimStatus === "unclaimed") ?? null;
        if (project) setClaimProject(project);
      }
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, [refreshActivity, refreshProjects, voteBusy]);

  return <>
    <ProductionHome key={revision} />
    {activityOpen && <aside className="live-activity-panel">
      <div className="live-activity-heading"><div><span>LIVE</span><strong>Network Activity</strong></div><button onClick={() => setActivityOpen(false)}>×</button></div>
      {activity.length === 0 ? <p>No verified activity yet. The first live vote or approved claim will appear here.</p> : activity.slice(0, 6).map(item => <div className="live-activity-item" key={item.id}><b>{item.eventType === "vote" ? "▲" : "●"}</b><span>{item.eventText}<small>{new Date(item.createdAt).toLocaleString()}</small></span></div>)}
    </aside>}
    <div className="operations-dock">
      <span className={source === "database" ? "db-live" : "db-preview"}>{source === "database" ? "D1 LIVE" : "PREVIEW DATA"}</span>
      {!activityOpen && <button onClick={() => setActivityOpen(true)}>Activity</button>}
      <button onClick={() => setPanel("claims")}>Claims</button>
      <button onClick={() => setPanel("admin")}>Admin</button>
    </div>
    {panel === "submit" && <SubmitProjectPanel onClose={() => setPanel(null)} />}
    {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} onPublished={() => void refreshProjects()} />}
    {panel === "claims" && <AdminClaimsPanel onClose={() => setPanel(null)} onApproved={() => { void refreshProjects(); void refreshActivity(); }} />}
    {claimProject && <ClaimProjectPanel project={claimProject} onClose={() => setClaimProject(null)} />}
  </>;
}
