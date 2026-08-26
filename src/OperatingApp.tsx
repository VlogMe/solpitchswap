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

export default function OperatingApp() {
  const [panel, setPanel] = useState<Panel>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [voteBusy, setVoteBusy] = useState(false);
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

  const beginXLogin = useCallback((intent?: "submit") => {
    if (intent) {
      sessionStorage.setItem(X_LOGIN_INTENT_KEY, intent);
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
      beginXLogin("submit");
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
      const intent = sessionStorage.getItem(X_LOGIN_INTENT_KEY);

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
        intent === "submit"
      ) {
        sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
        setPanel("submit");
      }

      if (authResult === "error") {
        sessionStorage.removeItem(X_LOGIN_INTENT_KEY);
      }
    };

    void initializeXSession();

    return () => {
      cancelled = true;
    };
  }, [refreshXSession]);

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
        window.alert("This project is not available in the live database.");
        return;
      }

      if (!xSession.authenticated) {
        window.alert("Sign in with X to vote. Eligible X accounts must be at least 60 days old.");
        beginXLogin();
        return;
      }

      if (xSession.votingEligible === false) {
        window.alert(
          xSession.eligibilityReason === "account_too_new"
            ? "Your X account must be at least 60 days old to vote on SolPitch."
            : "Sign out and sign in with X again so SolPitch can verify your account age.",
        );
        return;
      }

      setVoteBusy(true);

      try {
        const result = await castXVote(project.slug);
        await refreshProjects();
        window.alert(
          `Vote counted. ${project.name} now has ${result.votes} X vote${result.votes === 1 ? "" : "s"} this week.`,
        );
      } catch (error) {
        window.alert(
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
  }, [beginXLogin, projects, refreshProjects, voteBusy, xSession]);

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

      <SpotlightPortal />

      {panel === "submit" && xSession.authenticated && (
        <SubmitProjectPanel onClose={() => setPanel(null)} />
      )}
    </>
  );
}
