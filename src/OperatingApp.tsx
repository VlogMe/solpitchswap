import { useCallback, useEffect, useState } from "react";
import ProductionHome from "./ProductionHome";
import { analyzeToken, createVoteNonce, getAdminSession, getPublishedProjects, submitVote } from "./api";
import { AdminPanel, SubmitProjectPanel } from "./WorkflowPanels";
import { AdminClaimsPanel, ClaimProjectPanel } from "./ClaimPanels";
import AdminProjectsPanel from "./AdminProjectsPanel";
import type { Project } from "./types";
import "./workflows.css";

type Panel = "submit" | "admin" | "claims" | "projects" | null;
type PhantomProvider = { isPhantom?: boolean; publicKey?: { toString(): string }; connect(): Promise<{ publicKey: { toString(): string } }>; signMessage(message: Uint8Array, display?: "utf8"): Promise<{ signature: Uint8Array }> };
declare global { interface Window { solana?: PhantomProvider } }
function bytesToBase64(bytes: Uint8Array) { let binary = ""; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function money(value?: number) { return value ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value) : "Unavailable"; }

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
  const [claimProject, setClaimProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [voteBusy, setVoteBusy] = useState(false);
  const [adminRoute, setAdminRoute] = useState(() => window.location.hash === "#/admin-login");
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true); setProjectError("");
    try {
      const published = await getPublishedProjects();
      setProjects(published);
      setLoadingProjects(false);

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
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  useEffect(() => {
    const sync = () => {
      const active = window.location.hash === "#/admin-login";
      setAdminRoute(active);
      if (!active) {
        setAdminAuthenticated(false);
        setPanel(null);
      }
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!adminRoute) return;
    let cancelled = false;
    const check = async () => {
      try {
        const session = await getAdminSession();
        if (!cancelled) setAdminAuthenticated(session.authenticated);
      } catch {
        if (!cancelled) setAdminAuthenticated(false);
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 1200);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [adminRoute]);

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
          await refreshProjects();
          window.alert(`Vote counted. ${project.name} now has ${result.votes} verified vote${result.votes === 1 ? "" : "s"} this week.`);
        } catch (error) { window.alert(error instanceof Error ? error.message : "The vote could not be completed."); }
        finally { setVoteBusy(false); }
        return;
      }
      if (text === "submit project" || text === "submit coin") { event.preventDefault(); event.stopPropagation(); setPanel("submit"); return; }
      if (button.classList.contains("claim-button") || text.includes("claim project") || text.includes("claim official ownership") || text.includes("claim ownership") || text.includes("start free claim")) {
        event.preventDefault(); event.stopPropagation();
        const container = button.closest("article, .project-detail, .detail-hero");
        const slug = container?.getAttribute("data-project-slug") ?? container?.closest("[data-project-slug]")?.getAttribute("data-project-slug") ?? "";
        const project = projects.find(item => item.slug === slug) ?? null;
        if (project) setClaimProject(project);
      }
    };
    document.addEventListener("click", capture, true); return () => document.removeEventListener("click", capture, true);
  }, [projects, refreshProjects, voteBusy]);

  if (adminRoute) {
    if (!adminAuthenticated) {
      return <AdminPanel onClose={() => { window.location.hash = "#/"; }} onPublished={() => void refreshProjects()} />;
    }
    return <>
      <div className="workflow-overlay"><section className="workflow-shell admin-shell"><span className="eyebrow">PRIVATE ADMIN</span><div className="admin-heading"><div><h1>SolPitch Admin</h1><p>Private administration workspace</p></div></div><div className="operations-dock" style={{ position: "static", margin: "22px 0 0", width: "100%", justifyContent: "center" }}><span className={projectError ? "db-preview" : "db-live"}>{projectError ? "D1 ERROR" : "D1 LIVE"}</span><button onClick={() => setPanel("projects")}>Projects</button><button onClick={() => setPanel("claims")}>Claims</button><button onClick={() => setPanel("admin")}>Submissions</button></div><p className="workflow-intro" style={{ marginTop: "18px" }}>Bookmark https://solpitch.com/#/admin-login for private admin access.</p><a href="#/" style={{ color: "#b393ff", fontWeight: 800 }}>← Return to public site</a></section></div>
      {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} onPublished={() => void refreshProjects()} />}
      {panel === "claims" && <AdminClaimsPanel onClose={() => setPanel(null)} onApproved={() => { void refreshProjects(); }} />}
      {panel === "projects" && <AdminProjectsPanel onClose={() => setPanel(null)} onChanged={() => { void refreshProjects(); }} />}
    </>;
  }

  return <>
    <ProductionHome projects={projects} loading={loadingProjects} error={projectError} onRetry={() => void refreshProjects()} />
    {panel === "submit" && <SubmitProjectPanel onClose={() => setPanel(null)} />}
    {claimProject && <ClaimProjectPanel project={claimProject} onClose={() => setClaimProject(null)} />}
  </>;
}
