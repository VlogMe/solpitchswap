import { useCallback, useEffect, useState } from "react";
import ProductionHome from "./ProductionHome";
import { projects as fallbackProjects } from "./data";
import { getPublishedProjects } from "./api";
import { AdminPanel, SubmitProjectPanel } from "./WorkflowPanels";
import "./workflows.css";

type Panel = "submit" | "admin" | null;

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
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
    } catch {
      setSource("preview");
    }
  }, []);

  useEffect(() => { void refreshProjects(); }, [refreshProjects]);

  useEffect(() => {
    const capture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      const text = button.textContent?.trim().toLowerCase() ?? "";
      if (text === "submit project" || text === "submit coin") {
        event.preventDefault(); event.stopPropagation(); setPanel("submit");
      }
    };
    document.addEventListener("click", capture, true);
    return () => document.removeEventListener("click", capture, true);
  }, []);

  return <>
    <ProductionHome key={revision} />
    <div className="operations-dock">
      <span className={source === "database" ? "db-live" : "db-preview"}>{source === "database" ? "D1 LIVE" : "PREVIEW DATA"}</span>
      <button onClick={() => setPanel("admin")}>Admin</button>
    </div>
    {panel === "submit" && <SubmitProjectPanel onClose={() => setPanel(null)} />}
    {panel === "admin" && <AdminPanel onClose={() => setPanel(null)} onPublished={() => void refreshProjects()} />}
  </>;
}
