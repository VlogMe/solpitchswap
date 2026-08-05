import { FormEvent, useEffect, useState } from "react";
import { adminLogin, getAdminSession } from "./api";
import { deleteAdminProject, getAdminProjects, resetProjectVotes, updateAdminProject } from "./adminProjectApi";
import type { AdminProject } from "./adminProjectApi";

export default function AdminProjectsPanel({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  async function refresh(search = query) {
    setLoading(true);
    try {
      const session = await getAdminSession();
      setAuthenticated(session.authenticated);
      setProjects(session.authenticated ? await getAdminProjects(search) : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load projects.");
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(""); }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await adminLogin(String(data.get("password") || ""));
      await refresh("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    }
  }

  async function save(project: AdminProject) {
    const field = (name: string) => (document.getElementById(`${name}-${project.id}`) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value ?? "";
    const checked = (name: string) => (document.getElementById(`${name}-${project.id}`) as HTMLInputElement)?.checked ?? false;
    try {
      await updateAdminProject(project.id, {
        name: field("name"), symbol: field("symbol"), pitch: field("pitch"), description: field("description"),
        website: field("website"), xUrl: field("x"), telegramUrl: field("telegram"), logoUrl: field("logo"),
        claimStatus: field("claim") as AdminProject["claimStatus"], addedToSwap: checked("swap"), promoted: checked("promoted"),
      });
      setMessage(`${project.name} updated.`);
      await refresh();
      onChanged();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); }
  }

  async function remove(project: AdminProject) {
    if (!window.confirm(`Permanently remove ${project.name} from SolPitch?`)) return;
    try { await deleteAdminProject(project.id); await refresh(); onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Delete failed."); }
  }

  async function resetVotes(project: AdminProject) {
    if (!window.confirm(`Reset all votes for ${project.name} to zero?`)) return;
    try { await resetProjectVotes(project.id); await refresh(); onChanged(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Vote reset failed."); }
  }

  return <div className="workflow-overlay"><section className="workflow-shell admin-shell project-manager-shell">
    <button className="workflow-close" onClick={onClose}>×</button>
    <span className="eyebrow">PROJECT CONTROL CENTER</span>
    {loading ? <div className="workflow-message">Loading projects…</div> : !authenticated ? <>
      <h1>Admin sign in</h1>
      <p className="workflow-intro">Manage every approved project from one secured workspace.</p>
      {message && <div className="workflow-message error">{message}</div>}
      <form className="admin-login" onSubmit={login}><input name="password" type="password" required placeholder="Admin password"/><button className="primary" type="submit">Sign in</button></form>
    </> : <>
      <div className="admin-heading"><div><h1>Published projects</h1><p>{projects.length} project{projects.length === 1 ? "" : "s"}</p></div></div>
      <form className="project-search" onSubmit={event => { event.preventDefault(); void refresh(query); }}><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, ticker or contract"/><button type="submit">Search</button></form>
      {message && <div className="workflow-message">{message}</div>}
      <div className="review-list">{projects.length === 0 && <div className="review-empty">No published projects found.</div>}
        {projects.map(project => <article className="review-item project-manager-card" key={project.id}>
          <div className="review-title"><div><h2>{project.name} <span>${project.symbol}</span></h2><small>{project.contractAddress}</small></div><b>{project.votes} votes</b></div>
          <div className="workflow-grid compact-grid">
            <label>Name<input id={`name-${project.id}`} defaultValue={project.name}/></label>
            <label>Ticker<input id={`symbol-${project.id}`} defaultValue={project.symbol}/></label>
            <label className="wide">Short pitch<input id={`pitch-${project.id}`} defaultValue={project.pitch}/></label>
            <label className="wide">Description<textarea id={`description-${project.id}`} rows={4} defaultValue={project.description}/></label>
            <label>Website<input id={`website-${project.id}`} defaultValue={project.website}/></label>
            <label>X profile<input id={`x-${project.id}`} defaultValue={project.xUrl}/></label>
            <label>Telegram<input id={`telegram-${project.id}`} defaultValue={project.telegramUrl}/></label>
            <label>Logo URL<input id={`logo-${project.id}`} defaultValue={project.logoUrl}/></label>
            <label>Claim status<select id={`claim-${project.id}`} defaultValue={project.claimStatus}><option value="unclaimed">Unclaimed</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="disputed">Disputed</option></select></label>
          </div>
          <div className="review-options"><label><input id={`swap-${project.id}`} type="checkbox" defaultChecked={project.addedToSwap}/> Added to SolPitch Swap</label><label><input id={`promoted-${project.id}`} type="checkbox" defaultChecked={project.promoted}/> Promoted</label></div>
          <div className="project-admin-actions"><button onClick={() => void resetVotes(project)}>Reset votes</button><button className="danger" onClick={() => void remove(project)}>Delete project</button><button className="approve" onClick={() => void save(project)}>Save changes</button></div>
        </article>)}
      </div>
    </>}
  </section></div>;
}
