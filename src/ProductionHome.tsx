import { useEffect, useMemo, useState } from "react";
import {
  deleteMyProject,
  getMyProjects,
  updateMyProject,
  type MyProjectUpdate,
  type XSession,
} from "./api";
import type { Project, ProjectCategory } from "./types";
import "./production.css";

type Filter =
  | "all"
  | "swap"
  | "featured"
  | "newest"
  | "most-voted"
  | ProjectCategory;

const categories: ProjectCategory[] = [
  "Memecoin",
  "AI",
  "Gaming",
  "DeFi",
  "Infrastructure",
  "Utility",
  "NFT",
  "RWA",
  "Other",
];

function Logo() {
  return (
    <img
      className="official-logo"
      src={`${import.meta.env.BASE_URL}solpitch-logo.svg`}
      alt="SolPitch"
    />
  );
}

function ProjectAvatar({
  project,
  small = false,
}: {
  project: Project;
  small?: boolean;
}) {
  const className = small ? "mini-avatar" : "coin-avatar";

  return (
    <div className={className}>
      {project.logoURI ? (
        <img src={project.logoURI} alt={`${project.name} logo`} />
      ) : (
        project.symbol.slice(0, 2)
      )}
    </div>
  );
}

function openProject(
  project: Project,
  select: (project: Project) => void,
) {
  history.replaceState(
    null,
    "",
    `#/project/${encodeURIComponent(project.slug)}`,
  );
  select(project);
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

function ProjectCard({
  project,
  rank,
  favorite,
  onFavorite,
  onOpen,
}: {
  project: Project;
  rank: number;
  favorite: boolean;
  onFavorite: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      className="listing-card"
      data-project-slug={project.slug}
    >
      <div className="listing-top">
        <ProjectAvatar project={project} />

        <div className="coin-title">
          <div>
            {project.xUsername && (
              <a
                href={`https://x.com/${project.xUsername.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  display: "block",
                  marginBottom: "3px",
                  color: "#9ba4b8",
                  fontSize: ".72rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                @{project.xUsername.replace(/^@/, "")}
              </a>
            )}
            <h3>{project.name}</h3>
            <span>${project.symbol}</span>
          </div>

          <div className="tag-row">
            <span className="status status-launched">
              {project.category}
            </span>

            {rank <= 10 && (
              <span className="top-ten">Top 10</span>
            )}

            {project.addedToSwap && (
              <span className="claim-verified">
                Swap enabled
              </span>
            )}

            {project.promoted && (
              <span className="featured">Featured</span>
            )}
          </div>
        </div>

        <button
          className={`favorite ${favorite ? "selected" : ""}`}
          onClick={onFavorite}
        >
          {favorite ? "♥" : "♡"}
        </button>

        <button className="vote animated-count">
          ▲ {project.votes}
        </button>
      </div>

      <p>
        {project.pitch ||
          "No public short description has been provided."}
      </p>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "10px",
        }}
      >
        <button
          className="ca"
          onClick={() =>
            navigator.clipboard?.writeText(
              project.contractAddress,
            )
          }
        >
          {project.contractAddress.slice(0, 10)}…
          {project.contractAddress.slice(-7)}{" "}
          <b>Copy CA</b>
        </button>

        <span
          style={{
            fontSize: ".72rem",
            color: "#9ba4b8",
            whiteSpace: "nowrap",
          }}
        >
          Listed {project.listedLabel}
        </span>
      </div>

      <div className="listing-footer">
        <div className="listing-actions">
          <button className="ghost" onClick={onOpen}>
            View project
          </button>

          <button
            className="primary"
            type="button"
            onClick={() =>
              loadProjectInNativeSwap(project)
            }
          >
            Buy ${project.symbol}
          </button>

          <button
            className="ghost"
            type="button"
            onClick={() => shareProjectOnX(project)}
          >
            𝕏 Share
          </button>
        </div>
      </div>
    </article>
  );
}

function ProjectPage({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  const socialLinks = [
    ["Website", project.links.website],
    ["X", project.links.x],
    ["Telegram", project.links.telegram],
  ].filter(([, url]) => Boolean(url));

  return (
    <main
      className="project-detail"
      data-project-slug={project.slug}
    >
      <button className="back-link" onClick={onBack}>
        ← Back to all projects
      </button>

      <section
        className="detail-hero"
        data-project-slug={project.slug}
      >
        <div className="detail-identity">
          <div className="detail-avatar">
            {project.logoURI ? (
              <img
                src={project.logoURI}
                alt={`${project.name} logo`}
              />
            ) : (
              project.symbol.slice(0, 2)
            )}
          </div>

          <div>
            <div className="tag-row">
              <span className="status status-launched">
                {project.category}
              </span>

              {project.addedToSwap && (
                <span className="claim-verified">
                  Swap enabled
                </span>
              )}

              {project.promoted && (
                <span className="featured">Featured</span>
              )}
            </div>

            {project.xUsername && (
              <a
                href={`https://x.com/${project.xUsername.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                style={{
                  display: "inline-block",
                  marginTop: "8px",
                  marginBottom: "4px",
                  color: "#9ba4b8",
                  fontSize: ".78rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                @{project.xUsername.replace(/^@/, "")}
              </a>
            )}

            <h1>
              {project.name} <span>${project.symbol}</span>
            </h1>

            <p>
              {project.description ||
                "No public project description has been provided."}
            </p>
          </div>
        </div>

        <div className="detail-actions">
          <button className="vote animated-count">
            ▲ Vote {project.votes}
          </button>

          <button
            type="button"
            onClick={() => shareProjectOnX(project)}
          >
            𝕏 Share
          </button>

          <button
            className="primary"
            type="button"
            data-load-listed-token={project.contractAddress}
            onClick={() =>
              loadProjectInNativeSwap(project)
            }
          >
            Buy ${project.symbol}
          </button>
        </div>
      </section>

      <div className="detail-columns">
        <section className="detail-panel">
          <span className="eyebrow">PROJECT PROFILE</span>

          <h2>About {project.name}</h2>

          <p>
            {project.description ||
              "No public project description has been provided."}
          </p>

          <h3>Contract address</h3>

          <button
            className="full-ca"
            onClick={() =>
              navigator.clipboard?.writeText(
                project.contractAddress,
              )
            }
          >
            {project.contractAddress}
            <b>Copy</b>
          </button>

          {socialLinks.length > 0 && (
            <div className="detail-actions">
              {socialLinks.map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label} ↗
                </a>
              ))}
            </div>
          )}
        </section>

        <iframe
          src={`https://birdeye.so/tv-widget/${project.contractAddress}?chain=solana&viewMode=pair&chartInterval=15&chartType=Candle&theme=dark`}
          width="100%"
          height="420"
          frameBorder="0"
          allowFullScreen
          style={{
            borderRadius: "12px",
            border: "1px solid #2a2a3a",
            margin: "20px 0",
          }}
        />
      </div>
    </main>
  );
}

function RankedProject({
  project,
  rank,
  onOpen,
}: {
  project: Project;
  rank: number;
  onOpen: () => void;
}) {
  const medal =
    rank === 1
      ? "🥇"
      : rank === 2
        ? "🥈"
        : rank === 3
          ? "🥉"
          : String(rank);

  return (
    <button
      className="rank leaderboard-rank"
      onClick={onOpen}
    >
      <b>{medal}</b>

      <ProjectAvatar project={project} small />

      <span>
        <strong>{project.name}</strong>
        <small>${project.symbol}</small>
      </span>

      <em className="animated-count">
        ▲ {project.votes}
      </em>
    </button>
  );
}

function FeaturedProject({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  return (
    <button
      className="rank featured-project-rank"
      onClick={onOpen}
    >
      <b>★</b>

      <ProjectAvatar project={project} small />

      <span>
        <strong>{project.name}</strong>
        <small>${project.symbol}</small>
      </span>

      <em>View</em>
    </button>
  );
}

type EditFields = {
  name: string;
  pitch: string;
  description: string;
  website: string;
  xUrl: string;
  telegramUrl: string;
  logoUrl: string;
};

function editFieldsFromProject(
  project: Project,
): EditFields {
  return {
    name: project.name,
    pitch: project.pitch,
    description: project.description,
    website: project.links.website ?? "",
    xUrl: project.links.x ?? "",
    telegramUrl: project.links.telegram ?? "",
    logoUrl: project.logoURI ?? "",
  };
}

function MyListingsModal({
  onClose,
  onProjectsChanged,
}: {
  onClose: () => void;
  onProjectsChanged: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(
    null,
  );
  const [fields, setFields] =
    useState<EditFields | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<
    string | null
  >(null);

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const mine = await getMyProjects();
      setProjects(mine);
    } catch (loadError) {
      setProjects([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your listings.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const beginEdit = (project: Project) => {
    if (!project.id) return;

    setEditingId(project.id);
    setFields(editFieldsFromProject(project));
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFields(null);
  };

  const saveEdit = async () => {
    if (!editingId || !fields || saving) return;

    const payload: MyProjectUpdate = {
      name: fields.name,
      pitch: fields.pitch,
      description: fields.description,
      website: fields.website,
      xUrl: fields.xUrl,
      telegramUrl: fields.telegramUrl,
      logoUrl: fields.logoUrl,
    };

    setSaving(true);
    setError("");

    try {
      await updateMyProject(editingId, payload);
      cancelEdit();
      await load();
      onProjectsChanged();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update this listing.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeProject = async (project: Project) => {
    if (!project.id || deletingId) return;

    const confirmed = window.confirm(
      `Delete ${project.name} from SolPitch? This cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingId(project.id);
    setError("");

    try {
      await deleteMyProject(project.id);

      if (editingId === project.id) {
        cancelEdit();
      }

      await load();
      onProjectsChanged();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete this listing.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const fieldStyle = {
    width: "100%",
    boxSizing: "border-box" as const,
    borderRadius: "8px",
    border: "1px solid #30384b",
    background: "#111722",
    color: "#fff",
    padding: "10px 12px",
    marginTop: "5px",
  };

  const labelStyle = {
    display: "block",
    color: "#aeb7c9",
    fontSize: ".75rem",
    fontWeight: 700,
  };

  return (
    <div
      className="contract-search-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="contract-search-modal"
        style={{
          maxWidth: "760px",
          width: "calc(100% - 32px)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <button
          className="contract-search-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <span className="eyebrow">MY LISTINGS</span>
        <h2>Your SolPitch projects</h2>

        <p>
          Edit or delete projects submitted through your
          authenticated X account.
        </p>

        {error && (
          <div
            style={{
              margin: "14px 0",
              padding: "12px",
              borderRadius: "8px",
              background: "rgba(255,80,80,.08)",
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <div className="empty-state">
            Loading your listings…
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="empty-state">
            <strong>No listings yet.</strong>
            <p>
              Projects you submit while signed in with X
              will appear here.
            </p>
          </div>
        )}

        {!loading &&
          projects.map((project) => {
            const isEditing =
              Boolean(project.id) &&
              editingId === project.id;

            return (
              <article
                key={project.id ?? project.slug}
                className="listing-card"
                style={{ marginTop: "14px" }}
              >
                {!isEditing ? (
                  <>
                    <div className="listing-top">
                      <ProjectAvatar project={project} />

                      <div className="coin-title">
                        <div>
                          <h3>{project.name}</h3>
                          <span>${project.symbol}</span>
                        </div>
                      </div>
                    </div>

                    <p>
                      {project.pitch ||
                        "No short description provided."}
                    </p>

                    <button
                      className="ca"
                      type="button"
                      onClick={() =>
                        navigator.clipboard?.writeText(
                          project.contractAddress,
                        )
                      }
                    >
                      {project.contractAddress.slice(
                        0,
                        10,
                      )}
                      …
                      {project.contractAddress.slice(-7)}
                      <b> Copy CA</b>
                    </button>

                    <div
                      className="listing-actions"
                      style={{ marginTop: "14px" }}
                    >
                      <button
                        className="ghost"
                        type="button"
                        onClick={() => beginEdit(project)}
                        disabled={!project.id}
                      >
                        Edit
                      </button>

                      <button
                        className="ghost"
                        type="button"
                        disabled={
                          !project.id ||
                          deletingId === project.id
                        }
                        onClick={() =>
                          void removeProject(project)
                        }
                      >
                        {deletingId === project.id
                          ? "Deleting…"
                          : "Delete"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3>
                      Edit {project.name}
                    </h3>

                    <div
                      style={{
                        display: "grid",
                        gap: "12px",
                        marginTop: "14px",
                      }}
                    >
                      <label style={labelStyle}>
                        Project name
                        <input
                          style={fieldStyle}
                          value={fields?.name ?? ""}
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    name: event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>

                      <label style={labelStyle}>
                        Short pitch
                        <textarea
                          style={{
                            ...fieldStyle,
                            minHeight: "80px",
                            resize: "vertical",
                          }}
                          value={fields?.pitch ?? ""}
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    pitch:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>

                      <label style={labelStyle}>
                        Description
                        <textarea
                          style={{
                            ...fieldStyle,
                            minHeight: "120px",
                            resize: "vertical",
                          }}
                          value={
                            fields?.description ?? ""
                          }
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    description:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>

                      <label style={labelStyle}>
                        Website
                        <input
                          style={fieldStyle}
                          value={fields?.website ?? ""}
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    website:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>

                      <label style={labelStyle}>
                        X URL
                        <input
                          style={fieldStyle}
                          value={fields?.xUrl ?? ""}
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    xUrl: event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>

                      <label style={labelStyle}>
                        Telegram URL
                        <input
                          style={fieldStyle}
                          value={
                            fields?.telegramUrl ?? ""
                          }
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    telegramUrl:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>

                      <label style={labelStyle}>
                        Logo URL
                        <input
                          style={fieldStyle}
                          value={fields?.logoUrl ?? ""}
                          onChange={(event) =>
                            setFields((current) =>
                              current
                                ? {
                                    ...current,
                                    logoUrl:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                        />
                      </label>
                    </div>

                    <div
                      className="listing-actions"
                      style={{ marginTop: "16px" }}
                    >
                      <button
                        className="primary"
                        type="button"
                        onClick={() => void saveEdit()}
                        disabled={saving}
                      >
                        {saving
                          ? "Saving…"
                          : "Save changes"}
                      </button>

                      <button
                        className="ghost"
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
      </section>
    </div>
  );
}

export default function ProductionHome({
  projects,
  loading,
  error,
  onRetry,
  xSession,
  onSignIn,
  onLogout,
  onProjectsChanged,
  onSubmitProject,
}: {
  projects: Project[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  xSession: XSession;
  onSignIn: () => void;
  onLogout: () => void;
  onProjectsChanged: () => void;
  onSubmitProject: () => void;
}) {
  const [contractQuery, setContractQuery] =
    useState("");
  const [searchOpen, setSearchOpen] =
    useState(false);
  const [filter, setFilter] =
    useState<Filter>("all");
  const [selected, setSelected] =
    useState<Project | null>(null);
  const [favorites, setFavorites] = useState<
    Set<string>
  >(new Set());
  const [myListingsOpen, setMyListingsOpen] =
    useState(false);

  useEffect(() => {
    const sync = () => {
      const slug = decodeURIComponent(
        window.location.hash.match(
          /^#\/project\/([^/?#]+)/,
        )?.[1] ?? "",
      );

      setSelected(
        slug
          ? projects.find(
              (project) => project.slug === slug,
            ) ?? null
          : null,
      );
    };

    sync();

    window.addEventListener("hashchange", sync);

    return () =>
      window.removeEventListener("hashchange", sync);
  }, [projects]);

  useEffect(() => {
    if (!xSession.authenticated) {
      setMyListingsOpen(false);
    }
  }, [xSession.authenticated]);

  const ranked = useMemo(
    () =>
      [...projects].sort(
        (a, b) => b.votes - a.votes,
      ),
    [projects],
  );

  const filtered = useMemo(() => {
    let result = projects;

    if (filter === "swap") {
      result = result.filter(
        (project) => project.addedToSwap,
      );
    } else if (filter === "featured") {
      result = result.filter(
        (project) => project.promoted,
      );
    } else if (filter === "newest") {
      result = [...result].sort((a, b) =>
        (b.publishedAt ?? "").localeCompare(
          a.publishedAt ?? "",
        ),
      );
    } else if (filter === "most-voted") {
      result = [...result].sort(
        (a, b) => b.votes - a.votes,
      );
    } else if (filter !== "all") {
      result = result.filter(
        (project) => project.category === filter,
      );
    }

    return result;
  }, [projects, filter]);

  const featuredProjects = projects.filter(
    (project) => project.promoted,
  );

  const swapProjects = projects.filter(
    (project) => project.addedToSwap,
  );

  const favorite = (project: Project) =>
    setFavorites((current) => {
      const next = new Set(current);

      next.has(project.slug)
        ? next.delete(project.slug)
        : next.add(project.slug);

      return next;
    });

  const goHome = () => {
    history.replaceState(null, "", "#/");
    setSelected(null);
  };

  const findProjectByContract = () => {
    const query = contractQuery.trim();

    const match = projects.find(
      (project) =>
        project.contractAddress.trim() === query,
    );

    if (match) {
      openProject(match, setSelected);
      setSearchOpen(false);
      return;
    }

    setSearchOpen(true);
  };

  return (
    <div className="production-app">
      <header className="production-header">
        <button
          className="logo-button"
          onClick={goHome}
        >
          <Logo />
        </button>

        <form
          className="global-search contract-search"
          onSubmit={(event) => {
            event.preventDefault();
            findProjectByContract();
          }}
        >
          <span
            className="contract-search-arrow"
            aria-hidden="true"
          >
            ➜
          </span>

          <input
            value={contractQuery}
            onChange={(event) =>
              setContractQuery(event.target.value)
            }
            placeholder="Paste a listed project contract address"
            aria-label="Listed project contract address"
          />

          <button
            className="contract-find-button"
            type="submit"
          >
            Find
          </button>
        </form>

        <div className="header-actions">
          {!xSession.authenticated ? (
            <button
              className="ghost"
              type="button"
              onClick={onSignIn}
            >
              Sign in with X
            </button>
          ) : (
            <>
              <span
                style={{
                  color: "#dfe5f1",
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                @{xSession.username}
              </span>

              <button
                className="ghost"
                type="button"
                onClick={() =>
                  setMyListingsOpen(true)
                }
              >
                My Listings
              </button>

              <button
                className="ghost"
                type="button"
                onClick={onLogout}
              >
                Logout
              </button>
            </>
          )}

          <button
            className="primary"
            type="button"
            onClick={onSubmitProject}
          >
            Submit project
          </button>
        </div>
      </header>

      <div className="production-grid">
        <aside className="nav-rail">
          <nav>
            {[
              ["Home", "all", "⌂"],
              ["Featured", "featured", "★"],
            ].map(([label, value, icon]) => (
              <button
                className={
                  filter === value && !selected
                    ? "active"
                    : ""
                }
                onClick={() => {
                  setFilter(value as Filter);
                  goHome();
                }}
                key={value}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <p>CATEGORIES</p>

          <nav>
            {categories.map((category) => (
              <button
                className={
                  filter === category ? "active" : ""
                }
                onClick={() => {
                  setFilter(category);
                  goHome();
                }}
                key={category}
              >
                <i className="stage-dot dot-launched" />
                {category}
              </button>
            ))}
          </nav>

          <p>FOR PROJECTS</p>

          <nav>
            <button
              type="button"
              onClick={onSubmitProject}
            >
              Submit project
            </button>

            {xSession.authenticated && (
              <button
                type="button"
                onClick={() =>
                  setMyListingsOpen(true)
                }
              >
                My Listings
              </button>
            )}

            <button>Promotion options</button>

            <div
              style={{
                color: "#9ba4b8",
                padding: "2px 12px 0",
                fontSize: ".72rem",
                lineHeight: 1.5,
                fontWeight: 700,
              }}
            >
              If you want to launch your own meme coin the right way, use MemeWarzone.
              <br />
              Pre-bond heat + post-bond battles and rewards keep your project alive long after graduation.
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "5px 0 2px",
              }}
              aria-hidden="true"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" role="img">
                <text
                  x="12"
                  y="18"
                  textAnchor="middle"
                  fontSize="20"
                  fontWeight="900"
                  fill="#22c55e"
                >
                  ↓
                  <animate
                    attributeName="opacity"
                    values="0.4;1;0.4"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </text>
              </svg>
            </div>

            <a
              href="https://app.memewar.zone/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                margin: "0 12px 8px",
                padding: "9px 10px",
                border: "1px solid rgba(34,197,94,.28)",
                borderRadius: "8px",
                background: "rgba(34,197,94,.08)",
                color: "#55e59d",
                fontSize: ".78rem",
                fontWeight: 800,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Launch your Memecoin
            </a>

            <details
              style={{
                color: "#9ba4b8",
                padding: "0 12px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 750,
                  padding: "11px 0",
                }}
              >
                Listing requirements
              </summary>

              <ul
                style={{
                  margin: "0 0 10px 18px",
                  padding: 0,
                  fontSize: ".72rem",
                  lineHeight: 1.5,
                }}
              >
                <li>Project must be on Solana</li>
                <li>
                  Must have a valid contract address
                </li>
                <li>
                  Basic info required (name, symbol,
                  description, socials)
                </li>
                <li>
                  No obvious scams or copied projects
                </li>
                <li>Free to submit</li>
              </ul>
            </details>

            <details
              style={{
                color: "#9ba4b8",
                padding: "0 12px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 750,
                  padding: "11px 0",
                }}
              >
                How approval works
              </summary>

              <ul
                style={{
                  margin: "0 0 10px 18px",
                  padding: 0,
                  fontSize: ".72rem",
                  lineHeight: 1.5,
                }}
              >
                <li>Submit your project</li>
                <li>
                  Our team reviews it (usually within
                  24–48 hours)
                </li>
                <li>
                  If approved, it appears in the live
                  listings
                </li>
                <li>
                  Rejected projects can be improved and
                  resubmitted
                </li>
              </ul>
            </details>

            <details
              style={{
                color: "#9ba4b8",
                padding: "0 12px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 750,
                  padding: "11px 0",
                }}
              >
                What happens next
              </summary>

              <div
                style={{
                  fontSize: ".72rem",
                  lineHeight: 1.5,
                  paddingBottom: "10px",
                }}
              >
                <div style={{ margin: "0 0 8px" }}>
                  Once your project is approved, we
                  don’t just list it and forget about
                  it.
                </div>

                <div style={{ margin: "0 0 8px" }}>
                  We share your project on our X
                  account @solpitch2026, then our
                  automation system republishes that
                  post to the SolPitch SEO blog,
                  giving your project additional
                  exposure across social and search.
                </div>

                <div style={{ margin: "0 0 8px" }}>
                  One submission. Multiple
                  distribution channels.
                </div>

                <div style={{ margin: "0 0 8px" }}>
                  You list it. We put it in front of
                  people.
                </div>

                <button
                  className="primary"
                  type="button"
                  onClick={onSubmitProject}
                  style={{
                    padding: "11px 15px",
                    fontWeight: 800,
                    justifyContent: "center",
                    textAlign: "center",
                    color: "#fff",
                  }}
                >
                  Submit Project
                </button>
              </div>
            </details>

            <details
              style={{
                color: "#9ba4b8",
                padding: "0 12px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 750,
                  padding: "11px 0",
                }}
              >
                Contact Us
              </summary>

              <div
                style={{
                  fontSize: ".72rem",
                  lineHeight: 1.5,
                  paddingBottom: "10px",
                }}
              >
                <div style={{ margin: "0 0 8px" }}>
                  Have problems, questions, or need
                  help with your listing?
                </div>

                <div style={{ margin: "0 0 8px" }}>
                  DM us on X:
                </div>

                <a
                  href="https://x.com/solpitch2026"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: "#b393ff",
                    fontWeight: 800,
                  }}
                >
                  @solpitch2026
                </a>
              </div>
            </details>
          </nav>
        </aside>

        {selected ? (
          <ProjectPage
            project={selected}
            onBack={goHome}
          />
        ) : (
          <main className="project-feed">
            <section className="directory-summary">
              <div>
                <small>Listed projects</small>
                <strong>{projects.length}</strong>
              </div>

              <div>
                <small>Swap enabled</small>
                <strong>{swapProjects.length}</strong>
              </div>

              <div>
                <small>Network</small>
                <strong>Solana</strong>
              </div>
            </section>

            {ranked.length > 0 && (
              <section className="trending-strip">
                <span>🔥 Most Voted</span>

                {ranked
                  .slice(0, 5)
                  .map((project, index) => (
                    <button
                      key={project.slug}
                      onClick={() =>
                        openProject(
                          project,
                          setSelected,
                        )
                      }
                    >
                      <b>${project.symbol}</b>
                      <em>
                        {index === 0
                          ? "#1 THIS WEEK"
                          : `#${index + 1}`}
                      </em>
                    </button>
                  ))}
              </section>
            )}

            <section
              className="feed-toolbar"
              id="directory"
            >
              <div>
                <span className="eyebrow">
                  PROJECT DIRECTORY
                </span>

                <h2>
                  Live listings{" "}
                  <small>
                    {filtered.length} projects
                  </small>
                </h2>
              </div>

              <div className="filter-row">
                <button
                  className={
                    filter === "all" ? "active" : ""
                  }
                  onClick={() => setFilter("all")}
                >
                  All
                </button>

                <button
                  className={
                    filter === "newest"
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setFilter("newest")
                  }
                >
                  Newest
                </button>

                <button
                  className={
                    filter === "swap"
                      ? "active"
                      : ""
                  }
                  onClick={() => setFilter("swap")}
                >
                  Swap enabled
                </button>
              </div>
            </section>

            {loading && (
              <div className="empty-state">
                Loading live SolPitch listings…
              </div>
            )}

            {!loading && error && (
              <div className="empty-state">
                <strong>
                  Unable to load live listings.
                </strong>

                <p>{error}</p>

                <button
                  className="primary wide"
                  onClick={onRetry}
                >
                  Try again
                </button>
              </div>
            )}

            {!loading &&
              !error &&
              projects.length === 0 && (
                <div className="empty-state">
                  <strong>
                    No projects are published yet.
                  </strong>

                  <p>
                    Approved listings will appear here
                    automatically.
                  </p>

                  <button
                    className="primary"
                    type="button"
                    onClick={onSubmitProject}
                  >
                    Submit project
                  </button>
                </div>
              )}

            {!loading &&
              !error &&
              filtered.map((project) => (
                <ProjectCard
                  key={project.slug}
                  project={project}
                  rank={
                    ranked.findIndex(
                      (item) =>
                        item.slug === project.slug,
                    ) + 1
                  }
                  favorite={favorites.has(
                    project.slug,
                  )}
                  onFavorite={() =>
                    favorite(project)
                  }
                  onOpen={() =>
                    openProject(
                      project,
                      setSelected,
                    )
                  }
                />
              ))}
          </main>
        )}

        <aside className="utility-rail">
          <section className="swap-widget embedded-swap" />

          <section className="side-widget leaderboard-widget">
            <div className="widget-title">
              <div>
                <h3>Most Voted Projects</h3>
                <small>
                  Verified wallet leaderboard
                </small>
              </div>

              <span className="competition-live">
                LIVE
              </span>
            </div>

            {ranked.length ? (
              ranked
                .slice(0, 15)
                .map((project, index) => (
                  <RankedProject
                    key={project.slug}
                    project={project}
                    rank={index + 1}
                    onOpen={() =>
                      openProject(
                        project,
                        setSelected,
                      )
                    }
                  />
                ))
            ) : (
              <div className="side-empty">
                <strong>0 votes yet</strong>
                <span>
                  Published projects will compete here.
                </span>
              </div>
            )}

            <p className="ranking-note">
              One verified Phantom wallet can vote once
              per project each week.
            </p>
          </section>

          <section className="side-widget featured-projects-widget">
            <div className="widget-title">
              <div>
                <h3>Featured Project's</h3>
                <small>Promoted by SolPitch</small>
              </div>
            </div>

            {featuredProjects.length ? (
              featuredProjects.map((project) => (
                <FeaturedProject
                  key={project.slug}
                  project={project}
                  onOpen={() =>
                    openProject(
                      project,
                      setSelected,
                    )
                  }
                />
              ))
            ) : (
              <div className="side-empty">
                <strong>
                  No featured projects yet
                </strong>
                <span>
                  Promoted projects will appear here
                  automatically.
                </span>
              </div>
            )}
          </section>
        </aside>
      </div>

      {searchOpen && (
        <div
          className="contract-search-backdrop"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSearchOpen(false);
            }
          }}
        >
          <section className="contract-search-modal">
            <button
              className="contract-search-close"
              onClick={() => setSearchOpen(false)}
              aria-label="Close"
            >
              ×
            </button>

            <span className="eyebrow">
              PROJECT SEARCH
            </span>

            <h2>Project listing not found</h2>

            <p>
              Please double-check the contract address.
              It appears this project has not been
              listed on the SolPitch Network yet.
            </p>

            <button
              className="primary wide"
              onClick={() => setSearchOpen(false)}
            >
              Check the CA and try again
            </button>
          </section>
        </div>
      )}

      {myListingsOpen &&
        xSession.authenticated && (
          <MyListingsModal
            onClose={() =>
              setMyListingsOpen(false)
            }
            onProjectsChanged={
              onProjectsChanged
            }
          />
        )}
    </div>
  );
}