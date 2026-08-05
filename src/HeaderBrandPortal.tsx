import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import "./header-brand.css";

const LOGO_URL = "https://solpitchswap.kevingpersson.workers.dev/logo.png";

export default function HeaderBrandPortal() {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findTarget = () => {
      const element = document.querySelector<HTMLElement>(".logo-button");
      if (element) {
        element.classList.add("network-brand-mounted");
        setTarget(element);
        return true;
      }
      return false;
    };

    if (findTarget()) return;
    const observer = new MutationObserver(() => {
      if (findTarget()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <span className="network-brand" aria-label="SolPitch Network">
      <img src={LOGO_URL} alt="SolPitch SP logo" />
      <span className="network-brand-copy">
        <strong><span>SOLPITCH</span> NETWORK</strong>
        <small>List. Discover. Vote. Swap.</small>
      </span>
    </span>,
    target,
  );
}
