import { useEffect } from "react";

export default function NavListingPolicyPortal() {
  useEffect(() => {
    const updateCopy = () => {
      const summaries = Array.from(
        document.querySelectorAll<HTMLDetailsElement>(
          ".nav-rail details",
        ),
      );

      summaries.forEach((details) => {
        const summary = details.querySelector("summary");
        const label = summary?.textContent?.trim();

        if (label === "How approval works") {
          if (summary) summary.textContent = "How listing works";

          const list = details.querySelector("ul");
          if (list) {
            list.innerHTML = `
              <li>Submit your project for free</li>
              <li>Valid submissions are published to the SolPitch Network</li>
              <li>Listings are monitored for scams, fraud, impersonation, and other harmful activity</li>
              <li>Listings that violate our rules or put users at risk may be removed</li>
            `;
          }
        }

        if (label === "What happens next") {
          const content = details.querySelector(":scope > div");
          if (!content) return;

          const paragraphs = Array.from(
            content.querySelectorAll<HTMLElement>(":scope > div"),
          );

          const copy = [
            "Once your project is live, we don’t just list it and forget about it.",
            "SolPitch listings are free, but the network is monitored for scams, fraud, impersonation, malicious activity, and other rule violations. Projects that put users at risk may be removed.",
            "We also share projects through @solpitch2026 and our SolPitch News distribution so listings can gain additional exposure across social and search.",
            "Free listing. Ongoing monitoring. Multiple distribution channels.",
          ];

          paragraphs.slice(0, copy.length).forEach((paragraph, index) => {
            paragraph.textContent = copy[index];
          });
        }
      });
    };

    updateCopy();
  }, []);

  return null;
}
