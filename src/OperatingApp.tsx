import { useCallback, useEffect, useState } from "react";
import ProductionHome from "./ProductionHome";
import { projects as fallbackProjects } from "./data";
import { getPublishedProjects } from "./api";
import { AdminPanel, SubmitProjectPanel } from "./WorkflowPanels";
import { AdminClaimsPanel, ClaimProjectPanel } from "./ClaimPanels";
import type { Project } from "./types";
import "./workflows.css";

type Panel = "submit" | "admin" | "claims" | null;

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
  const [claimProject, setClaimProject] = useState<Project | null>(null);
  const [revision, setRevision] = useState(0);
  const [source, setSource] = useState<"database" | "preview">("preview");

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

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  useEffect(() => {
    const capture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      const text = button.textContent?.trim().toLowerCase() ?? "";
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
  }, []);

  return <>
    <ProductionHome key={revision} />
    <div className="operations-dock">
      <span className={source === "database" ? "db-live" : "db-preview"}>{source === "database" ? "D1 LIVE" : "PREVIEW DATA"}</span>
      <button onClick={() => setPanel("claims")}>Claims</button>
      <button onClick={() => setPanel("admin")}>Admin</button>
    </div>
    {panel === "submit" && <SubmitProjectPanel onClose={() => setPanel(null)} />}
    {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} onPublished={() => void refreshProjects()} />}
    {panel === "claims" && <AdminClaimsPanel onClose={() => setPanel(null)} onApproved={() => void refreshProjects()} />}
    {claimProject && <ClaimProjectPanel project={claimProject} onClose={() => setClaimProject(null)} />}
  </>;
}
