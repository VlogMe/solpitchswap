import { useEffect } from "react";
import { projects } from "./data";

export default function ProjectRouteBridge() {
  useEffect(() => {
    const openFromHash = () => {
      const match = window.location.hash.match(/^#\/project\/([^/?#]+)/);
      if (!match) return;
      const slug = decodeURIComponent(match[1]);
      const project = projects.find(item => item.slug === slug);
      if (!project) return;
      window.setTimeout(() => {
        const cards = [...document.querySelectorAll<HTMLElement>("article.listing-card")];
        const card = cards.find(item => item.querySelector("h3")?.textContent?.trim() === project.name);
        const button = [...(card?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(item => item.textContent?.toLowerCase().includes("view project"));
        button?.click();
      }, 250);
    };

    const capture = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      const text = button.textContent?.trim().toLowerCase() ?? "";
      if (text.includes("view project")) {
        const card = button.closest("article.listing-card");
        const name = card?.querySelector("h3")?.textContent?.trim() ?? "";
        const project = projects.find(item => item.name === name);
        if (project) history.replaceState(null, "", `#/project/${encodeURIComponent(project.slug)}`);
      }
      if (text.includes("back to all projects")) history.replaceState(null, "", "#/");
    };

    window.addEventListener("hashchange", openFromHash);
    document.addEventListener("click", capture, true);
    openFromHash();
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      document.removeEventListener("click", capture, true);
    };
  }, []);
  return null;
}
