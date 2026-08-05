import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import NativeSwapCard from "./NativeSwapCard";

function loadMintIntoSwap(mint: string) {
  const input = document.querySelector<HTMLInputElement>(".native-ca-row input");
  const findButton = document.querySelector<HTMLButtonElement>(".native-ca-row button");
  const swapCard = document.querySelector<HTMLElement>(".native-swap-card");
  if (!input || !findButton || !swapCard) return;

  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, mint);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  window.setTimeout(() => findButton.click(), 0);
  swapCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

function projectMint() {
  const contractButton = document.querySelector<HTMLButtonElement>(".project-detail .full-ca");
  const textNode = contractButton?.childNodes[0]?.textContent?.trim() ?? "";
  return textNode.match(/^[1-9A-HJ-NP-Za-km-z]{32,64}$/)?.[0] ?? "";
}

function attachProjectBuyButton() {
  const detail = document.querySelector<HTMLElement>(".project-detail");
  const actions = detail?.querySelector<HTMLElement>(".detail-hero .detail-actions");
  if (!detail || !actions || actions.querySelector("[data-load-listed-token]")) return;

  const mint = projectMint();
  if (!mint) return;

  const symbol = detail.querySelector("h1 span")?.textContent?.trim().replace(/^\$/, "") ?? "token";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary";
  button.dataset.loadListedToken = mint;
  button.textContent = `Buy $${symbol}`;
  button.addEventListener("click", () => loadMintIntoSwap(mint));
  actions.appendChild(button);
}

export default function NativeSwapPortal() {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    const findTarget = () => {
      const node = document.querySelector(".embedded-swap");
      if (!node) return false;
      node.classList.add("native-swap-mounted");
      setTarget(node);
      return true;
    };

    findTarget();
    attachProjectBuyButton();

    const observer = new MutationObserver(() => {
      findTarget();
      attachProjectBuyButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const loadFromEvent = (event: Event) => {
      const mint = (event as CustomEvent<{ mint?: string }>).detail?.mint?.trim() ?? "";
      if (mint) loadMintIntoSwap(mint);
    };
    window.addEventListener("solpitch:load-listed-token", loadFromEvent);

    return () => {
      observer.disconnect();
      window.removeEventListener("solpitch:load-listed-token", loadFromEvent);
    };
  }, []);

  return target ? createPortal(<NativeSwapCard />, target) : null;
}
