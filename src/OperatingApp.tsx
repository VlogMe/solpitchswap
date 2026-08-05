import { useCallback, useEffect, useState } from "react";
import ProductionHome from "./ProductionHome";
import { analyzeToken, createVoteNonce, getActivity, getPublishedProjects, submitVote, type ActivityEvent } from "./api";
import { AdminPanel, SubmitProjectPanel } from "./WorkflowPanels";
import { AdminClaimsPanel, ClaimProjectPanel } from "./ClaimPanels";
import AdminProjectsPanel from "./AdminProjectsPanel";
import type { Project } from "./types";
import "./workflows.css";

type Panel = "submit" | "admin" | "claims" | "projects" | null;
type PhantomProvider = { isPhantom?: boolean; publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }>; signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }> };
declare global { interface Window { solana?: PhantomProvider } }
function bytesToBase64(bytes: Uint8Array) { let binary = ""; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function money(value?: number) { return value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value) : "Unavailable"; }

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
  const [claimProject, setClaimProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityOpen, setActivityOpen] = useState(true);
  const [voteBusy, setVoteBusy] = useState(false);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true); setProjectError("");
    try {
      const published = await getPublishedProjects();
      const enriched = await Promise.all(published.map(async project => {
        try {
          const metadata = await analyzeToken(project.contractAddress);
          return {
            ...project,
            name: metadata.name || project.name,
            symbol: metadata.symbol || project.symbol,
            logoURI: metadata.logoUrl || project.logoURI,
            pitch: metadata.pitch || project.pitch,
            description: metadata.description || project.description,
            marketCap: money(metadata.marketCap),
            liquidity: money(metadata.liquidityUsd),
            volume24h: money(metadata.volume24h),
            links: {
              website: metadata.website || project.links.website,
              x: metadata.xUrl || project.links.x,
              telegram: metadata.telegramUrl || project.links.telegram,
            },
          } satisfies Project;
        } catch { return project; }
      }));
      setProjects(enriched);
    } catch (error) {
      setProjects([]);
      setProjectError(error instanceof Error ? error.message : "Unable to load live listings.");
    } finally { setLoadingProjects(false); }
  }, []);

  const refreshActivity = useCallback(async () => { try { setActivity(await getActivity()); } catch { setActivity([]); } }, []);
  useEffect(() => { void refreshProjects(); void refreshActivity(); }, [refreshProjects, refreshActivity]);

  useEffect(() => {
    const capture = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button"); if (!button) return;
      const text = button.textContent?.trim().toLowerCase() ?? "";
      if (button.classList.contains("vote")) {
        event.preventDefault(); event.stopPropagation(); if (voteBusy) return;
        const container = button.closest("article, .project-detail");
        const slug = container?.getAttribute("data-project-slug") ?? "";
        const project = projects.find(item => item.slug === slug);
        if (!project) { window.alert("This project is not available in the live database."); return; }
        const phantom = window.solana; if (!phantom?.isPhantom) { window.alert("Install or open Phantom to cast a verified weekly vote."); return; }
        setVoteBusy(true);
        try {
          const connection = await phantom.connect();
          const walletAddress = connection.publicKey.toString();
          const nonce = await createVoteNonce(project.slug, walletAddress);
          const signed = await phantom.signMessage(new TextEncoder().encode(nonce.message), "utf8");
          const result = await submitVote({ nonce: nonce.nonce, walletAddress, signature: bytesToBase64(signed.signature) });
          await refreshProjects(); await refreshActivity();
          window.alert(`Vote counted. ${project.name} now has ${result.votes} verified vote${result.votes === 1 ? "" : "s"} this week.`);
        } catch (error) { window.alert(error instanceof Error ? error.message : "The vote could not be completed."); }
        finally { setVoteBusy(false); }
        return;
      }
      if (text === "submit project" || text === "submit coin") { event.preventDefault(); event.stopPropagation(); setPanel("submit"); return; }
      if (text.includes("claim project") || text.includes("claim official ownership") || text.includes("start free claim")) {
        event.preventDefault(); event.stopPropagation();
        const container = button.closest("article, .project-detail, .detail-hero");
        const slug = container?.getAttribute("data-project-slug") ?? container?.closest("[data-project-slug]")?.getAttribute("data-project-slug") ?? "";
        const project = projects.find(item => item.slug === slug) ?? null;
        if (project) setClaimProject(project);
      }
    };
    document.addEventListener("click", capture, true); return () => document.removeEventListener("click", capture, true);
  }, [projects, refreshActivity, refreshProjects, voteBusy]);

  return <>
    <ProductionHome projects={projects} loading={loadingProjects} error={projectError} onRetry={() => void refreshProjects()} />
    {activityOpen && <aside className="live-activity-panel"><div className="live-activity-heading"><div><span>LIVE</span><strong>Network Activity</strong></div><button onClick={() => setActivityOpen(false)}>×</button></div>{activity.length === 0 ? <p>No verified activity yet. The first live vote or approved claim will appear here.</p> : activity.slice(0, 6).map(item => <div className="live-activity-item" key={item.id}><b>{item.eventType === "vote" ? "▲" : "●"}</b><span>{item.eventText}<small>{new Date(item.createdAt).toLocaleString()}</small></span></div>)}</aside>}
    <div className="operations-dock"><span className={projectError ? "db-preview" : "db-live"}>{projectError ? "D1 ERROR" : "D1 LIVE"}</span>{!activityOpen && <button onClick={() => setActivityOpen(true)}>Activity</button>}<button onClick={() => setPanel("projects")}>Projects</button><button onClick={() => setPanel("claims")}>Claims</button><button onClick={() => setPanel("admin")}>Submissions</button></div>
    {panel === "submit" && <SubmitProjectPanel onClose={() => setPanel(null)} />}
    {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} onPublished={() => void refreshProjects()} />}
    {panel === "claims" && <AdminClaimsPanel onClose={() => setPanel(null)} onApproved={() => { void refreshProjects(); void refreshActivity(); }} />}
    {panel === "projects" && <AdminProjectsPanel onClose={() => setPanel(null)} onChanged={() => { void refreshProjects(); void refreshActivity(); }} />}
    {claimProject && <ClaimProjectPanel project={claimProject} onClose={() => setClaimProject(null)} />}
  </>;
}
