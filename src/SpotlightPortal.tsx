import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getSpotlight, type SpotlightEntry } from "./api";
import type { Project } from "./types";
import "./spotlight.css";

function openProject(project: Project) {
  window.location.hash = `/project/${encodeURIComponent(project.slug)}`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function loadProjectInNativeSwap(project: Project) {
  window.dispatchEvent(
    new CustomEvent("solpitch:load-listed-token", {
      detail: { mint: project.contractAddress },
    }),
  );
}

function shareProjectOnX(project: Project) {
  const projectUrl = `${window.location.origin}${window.location.pathname}#/project/${encodeURIComponent(project.slug)}`;
  const handle = project.xUsername?.replace(/^@/, "") || "";
  const listedBy = handle ? ` by @${handle}` : "";
  const text =
    `🔥 $${project.symbol} was just listed${listedBy} on SolPitch\n\n` +
    `View · vote · trade 👇\n${projectUrl}\n\n#Solana`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(shareUrl, "_blank", "noopener,noreferrer");
}

function SpotlightCard({ entry }: { entry: SpotlightEntry }) {
  const { project, rank } = entry;

  return (
    <article className={`spotlight-card spotlight-rank-${rank}`}>
      <div className="spotlight-rank">#{rank}</div>

      <div className="spotlight-card-top">
        <div className="spotlight-avatar">
          {project.logoURI ? (
            <img src={project.logoURI} alt={`${project.name} logo`} />
          ) : (
            project.symbol.slice(0, 2)
          )}
        </div>
        <div className="spotlight-title">${project.symbol}</div>
      </div>

      <div className="spotlight-actions">
        <button type="button" className="ghost" onClick={() => openProject(project)}>
          View project
        </button>
        <button type="button" className="ghost" onClick={() => shareProjectOnX(project)}>
          𝕏 Share
        </button>
        <button type="button" className="primary" onClick={() => loadProjectInNativeSwap(project)}>
          Buy ${project.symbol}
        </button>
      </div>
    </article>
  );
}

function SpotlightBlock() {
  const [entries, setEntries] = useState<SpotlightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await getSpotlight();
        if (!cancelled) {
          setEntries(result.entries);
        }
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="spotlight-section" aria-label="SolPitch Spotlight">
      <div className="spotlight-heading">
        <div>
          <span className="spotlight-eyebrow">🔥 SOLPITCH SPOTLIGHT</span>
          <h2>SolPitch Spotlight</h2>
        </div>
      </div>

      {loading ? (
        <div className="spotlight-empty">Loading Spotlight…</div>
      ) : entries.length > 0 ? (
        <div className="spotlight-grid">
          {entries.map((entry) => (
            <SpotlightCard key={`${entry.rank}-${entry.project.slug}`} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="spotlight-empty">Spotlight will appear when projects have community votes.</div>
      )}
    </section>
  );
}

export default function SpotlightPortal() {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let currentHost: HTMLElement | null = null;

    const mount = () => {
      if (disposed) return;

      const feed = document.querySelector<HTMLElement>(".project-feed");
      if (!feed) {
        setHost(null);
        return;
      }

      currentHost = document.getElementById("solpitch-spotlight-host");
      if (!currentHost) {
        currentHost = document.createElement("div");
        currentHost.id = "solpitch-spotlight-host";
        feed.prepend(currentHost);
      }
      setHost(currentHost);
    };

    mount();
    const observer = new MutationObserver(mount);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer.disconnect();
      currentHost?.remove();
    };
  }, []);

  return host ? createPortal(<SpotlightBlock />, host) : null;
}
