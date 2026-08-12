import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./jupiter-plugin.css";

declare global {
  interface Window {
    Jupiter?: {
      init: (props: {
        displayMode: "integrated";
        integratedTargetId: string;
        containerStyles?: Record<string, string>;
      }) => void;
      close?: () => void;
    };
  }
}

const JUPITER_SCRIPT_ID = "jupiter-plugin-script";
const JUPITER_TARGET_ID = "jupiter-plugin";

function loadJupiterPlugin() {
  return new Promise<void>((resolve, reject) => {
    if (window.Jupiter) {
      resolve();
      return;
    }

    const existing = document.getElementById(
      JUPITER_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = JUPITER_SCRIPT_ID;
    script.src = "https://plugin.jup.ag/plugin-v1.js";
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject();
    document.head.appendChild(script);
  });
}

function JupiterPlugin() {
  useEffect(() => {
    let cancelled = false;

    void loadJupiterPlugin().then(() => {
      if (cancelled || !window.Jupiter) return;

      window.Jupiter.init({
        displayMode: "integrated",
        integratedTargetId: JUPITER_TARGET_ID,
        containerStyles: {
          width: "100%",
          height: "380px",
          borderRadius: "16px",
          overflow: "hidden",
        },
      });
    });

    return () => {
      cancelled = true;
      window.Jupiter?.close?.();
    };
  }, []);

  return <div id={JUPITER_TARGET_ID} className="solpitch-jupiter-plugin" />;
}

export default function JupiterSwapPortal() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const findTarget = () => {
      const node = document.querySelector(".embedded-swap");
      if (!node) return;
      setTarget(node);
    };

    findTarget();

    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return target ? createPortal(<JupiterPlugin />, target) : null;
}
