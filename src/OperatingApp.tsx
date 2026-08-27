import { useCallback, useEffect, useState } from "react";
import ProductionHome from "./ProductionHome";
import SpotlightPortal from "./SpotlightPortal";
import {
  analyzeToken,
  castXVote,
  getAdminSession,
  getPublishedProjects,
  getXLoginUrl,
  getXSession,
  logoutX,
  type XSession,
} from "./api";
import { AdminPanel, SubmitProjectPanel } from "./WorkflowPanels";
import AdminProjectsPanel from "./AdminProjectsPanel";
import type { Project } from "./types";
import "./workflows.css";

type Panel = "submit" | "admin" | "projects" | null;
type XLoginIntent =
  | { intent: "submit" }
  | { intent: "vote"; slug: string; hash: string };

type VoteNotice = {
  slug: string;
  message: string;
};

function money(value?: number) {
  return value
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(value)
    : "Unavailable";
}

const X_LOGIN_INTENT_KEY = "solpitch_x_login_intent";

function readXLoginIntent(): XLoginIntent | null {
  const raw = sessionStorage.getItem(X_LOGIN_INTENT_KEY);
  if (!raw) return null;

  if (raw === "submit") return { intent: "submit" };

  try {
    const parsed = JSON.parse(raw) as Partial<XLoginIntent>;
    if (parsed.intent === "submit") return { intent: "submit" };
    if (
      parsed.intent === "vote" &&
      typeof parsed.slug === "string" &&
      typeof parsed.hash === "string"
    ) {
      return { intent: "vote", slug: parsed.slug, hash: parsed.hash };
    }
  } catch {
    return null;
  }

  return null;
}

function writeXLoginIntent(intent: XLoginIntent) {
  sessionStorage.setItem(X_LOGIN_INTENT_KEY, JSON.stringify(intent));
}

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [voteBusy, setVoteBusy] = useState(false);
  const [voteNotice, setVoteNotice] = useState<VoteNotice | null>(null);
  const [adminRoute, setAdminRoute] = useState(
    () => window.location.hash === "#/admin-login",
  );
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [xSession, setXSession] = useState<XSession>({
    authenticated: false,
  });

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    setProjectError("");

    try {
      const published = await getPublishedProjects();
      setProjects(published);
      setLoadingProjects(false);

      const enriched = await Promise.all(
        published.map(async (project) => {
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
          } catch {
            return project;
          }
        }),
      );

      setProjects(enriched);
    } catch (error) {
      setProjects([]);
      setProjectError(
        error instanceof Error
          ? error.message
          : "Unable to load live listings.",
      );
      setLoadingProjects(false);
    }
  }, []);

  const refreshXSession = useCallback(async () => {
    try {
      const session = await getXSession();
      setXSession(session);
      return session;
    } catch {
      const session: XSession = { authenticated: false };
      setXSession(session);
      return session;
    }
  }, []);

  const beginXLogin = useCallback((intent?: XLoginIntent) => {
    if (intent) {
      writeXLoginIntent(intent);
    } else {
      sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
    }

    window.location.href = getXLoginUrl();
  }, []);

  const openSubmitProject = useCallback(async () => {
    let session = xSession;

    if (!session.authenticated) {
      session = await refreshXSession();
    }

    if (!session.authenticated) {
      beginXLogin({ intent: "submit" });
      return;
    }

    setPanel("submit");
  }, [beginXLogin, refreshXSession, xSession]);

  const handleXLogout = useCallback(async () => {
    try {
      await logoutX();
    } finally {
      sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
      setXSession({ authenticated: false });
      setPanel((current) => (current === "submit" ? null : current));
    }
  }, []);

  const showVoteNotice = useCallback((slug: string, message: string) => {
    setVoteNotice({ slug, message });
    window.setTimeout(() => {
      setVoteNotice((current) =>
        current?.slug === slug && current.message === message ? null : current,
      );
    }, 4500);
  }, []);

  const restoreVoteTarget = useCallback((slug: string, hash: string) => {
    if (hash) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hash}`,
      );
    }

    window.requestAnimationFrame(() => {
      const target = document.querySelector(
        `[data-project-slug="${CSS.escape(slug)}"]`,
      );
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    let cancelled = false;

    const initializeXSession = async () => {
      const session = await refreshXSession();

      if (cancelled) return;

      const params = new URLSearchParams(window.location.search);
      const authResult = params.get("auth");
      const intent = readXLoginIntent();

      if (authResult) {
        params.delete("auth");
        const query = params.toString();
        const cleanUrl = `${window.location.pathname}${
          query ? `?${query}` : ""
        }${window.location.hash}`;

        window.history.replaceState(null, "", cleanUrl);
      }

      if (
        authResult === "success" &&
        session.authenticated &&
        intent?.intent === "submit"
      ) {
        sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
        setPanel("submit");
      }

      if (
        authResult === "success" &&
        session.authenticated &&
        intent?.intent === "vote"
      ) {
        const voteIntent = intent;
        sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
        restoreVoteTarget(voteIntent.slug, voteIntent.hash);

        let liveProjects: Project[];
        try {
          liveProjects = await getPublishedProjects();
        } catch {
          showVoteNotice(
            voteIntent.slug,
            "The project list could not be verified. Please try again.",
          );
          return;
        }

        if (!liveProjects.some((project) => project.slug === voteIntent.slug)) {
          showVoteNotice(
            voteIntent.slug,
            "This project is not available in the live database.",
          );
          return;
        }

        await refreshProjects();
        restoreVoteTarget(voteIntent.slug, voteIntent.hash);

        if (session.votingEligible === false) {
          showVoteNotice(
            voteIntent.slug,
            session.eligibilityReason === "account_too_new"
              ? "Your X account must be at least 7 days old to vote on SolPitch."
              : "Sign out and sign in with X again so SolPitch can verify your account age.",
          );
          return;
        }

        try {
          setVoteBusy(true);
          await castXVote(voteIntent.slug);
          await refreshProjects();
          restoreVoteTarget(voteIntent.slug, voteIntent.hash);
          showVoteNotice(voteIntent.slug, "Vote counted.");
        } catch (error) {
          restoreVoteTarget(voteIntent.slug, voteIntent.hash);
          showVoteNotice(
            voteIntent.slug,
            error instanceof Error
              ? error.message
              : "The vote could not be completed.",
          );
        } finally {
          setVoteBusy(false);
        }
      }

      if (authResult === "error") {
        sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
      }
    };

    void initializeXSession();

    return () => {
      cancelled = true;
    };
  }, [refreshProjects, refreshXSession, restoreVoteTarget, showVoteNotice]);

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

        if (!cancelled) {
          setAdminAuthenticated(session.authenticated);
        }
      } catch {
        if (!cancelled) {
          setAdminAuthenticated(false);
        }
      }
    };

    void check();

    const timer = window.setInterval(() => void check(), 1200);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [adminRoute]);

  useEffect(() => {
    const capture = async (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (!button?.classList.contains("vote")) return;

      event.preventDefault();
      event.stopPropagation();

      if (voteBusy) return;

      const container = button.closest("article, .project-detail");
      const slug = container?.getAttribute("data-project-slug") ?? "";
      const project = projects.find((item) => item.slug === slug);

      if (!project) {
        showVoteNotice(slug, "This project is not available in the live database.");
        return;
      }

      if (!xSession.authenticated) {
        beginXLogin({
          intent: "vote",
          slug: project.slug,
          hash: window.location.hash,
        });
        return;
      }

      if (xSession.votingEligible === false) {
        showVoteNotice(
          project.slug,
          xSession.eligibilityReason === "account_too_new"
            ? "Your X account must be at least 7 days old to vote on SolPitch."
            : "Sign out and sign in with X again so SolPitch can verify your account age.",
        );
        restoreVoteTarget(project.slug, window.location.hash);
        return;
      }

      setVoteBusy(true);

      try {
        await castXVote(project.slug);
        await refreshProjects();
        restoreVoteTarget(project.slug, window.location.hash);
        showVoteNotice(project.slug, "Vote counted.");
      } catch (error) {
        restoreVoteTarget(project.slug, window.location.hash);
        showVoteNotice(
          project.slug,
          error instanceof Error
            ? error.message
            : "The vote could not be completed.",
        );
      } finally {
        setVoteBusy(false);
      }
    };

    document.addEventListener("click", capture, true);

    return () =>
      document.removeEventListener("click", capture, true);
  }, [
    beginXLogin,
    projects,
    refreshProjects,
    restoreVoteTarget,
    showVoteNotice,
    voteBusy,
    xSession,
  ]);

  if (adminRoute) {
    if (!adminAuthenticated) {
      return (
        <AdminPanel
          onClose={() => {
            window.location.hash = "#/";
          }}
          onPublished={() => void refreshProjects()}
        />
      );
    }

    return (
      <>
        <div className="workflow-overlay">
          <section className="workflow-shell admin-shell">
            <span className="eyebrow">PRIVATE ADMIN</span>

            <div className="admin-heading">
              <div>
                <h1>SolPitch Admin</h1>
                <p>Private administration workspace</p>
              </div>
            </div>

            <div
              className="operations-dock"
              style={{
                position: "static",
                margin: "22px 0 0",
                width: "100%",
                justifyContent: "center",
              }}
            >
              <span
                className={projectError ? "db-preview" : "db-live"}
              >
                {projectError ? "D1 ERROR" : "D1 LIVE"}
              </span>

              <button onClick={() => setPanel("projects")}>
                Projects
              </button>

              <button onClick={() => setPanel("admin")}>
                Submissions
              </button>
            </div>

            <p
              className="workflow-intro"
              style={{ marginTop: "18px" }}
            >
              Bookmark https://solpitch.com/#/admin-login for private
              admin access.
            </p>

            <a
              href="#/"
              style={{ color: "#b393ff", fontWeight: 800 }}
            >
              ← Return to public site
            </a>
          </section>
        </div>

        {panel === "admin" && (
          <AdminPanel
            onClose={() => setPanel(null)}
            onPublished={() => void refreshProjects()}
          />
        )}

        {panel === "projects" && (
          <AdminProjectsPanel
            onClose={() => setPanel(null)}
            onChanged={() => {
              void refreshProjects();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ProductionHome
        projects={projects}
        loading={loadingProjects}
        error={projectError}
        onRetry={() => void refreshProjects()}
        xSession={xSession}
        onSignIn={() => beginXLogin()}
        onLogout={() => void handleXLogout()}
        onProjectsChanged={() => void refreshProjects()}
        onSubmitProject={() => void openSubmitProject()}
      />

      {voteNotice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "22px",
            transform: "translateX(-50%)",
            zIndex: 9999,
            maxWidth: "min(92vw, 560px)",
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid #2a2a3a",
            background: "#11131a",
            color: "#f4f6fb",
            boxShadow: "0 10px 30px rgba(0,0,0,.35)",
            fontWeight: 700,
          }}
        >
          {voteNotice.message}
        </div>
      )}

      <SpotlightPortal
        refreshKey={projects
          .map((project) => `${project.slug}:${project.votes}:${project.publishedAt ?? ""}`)
          .join("|")}
      />

      {panel === "submit" && xSession.authenticated && (
        <SubmitProjectPanel onClose={() => setPanel(null)} />
      )}
    </>
  );
}
