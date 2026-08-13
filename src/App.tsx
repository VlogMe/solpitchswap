import { useEffect } from "react";
import "./detail-layout-fix.css";
import "./project-action-buttons.css";
import OperatingApp from "./OperatingApp";
import SiteFooter from "./SiteFooter";
import CopyCaToast from "./CopyCaToast";

function PublicListingCopy() {
  useEffect(() => {
    const update = () => {
      const shell = Array.from(document.querySelectorAll(".workflow-shell")).find(item => item.querySelector("h1")?.textContent === "Submit Solana Projects");
      if (shell) {
        const intro = shell.querySelector(".workflow-intro");
        if (intro) intro.textContent = "Paste a valid Solana token contract address, confirm the project details, and publish the listing immediately to the SolPitch Network.";
        shell.querySelectorAll(".workflow-message").forEach(message => {
          if (message.textContent?.includes("admin") || message.textContent?.includes("approval")) message.textContent = "Valid submissions are published immediately.";
        });
        shell.querySelectorAll("small").forEach(item => {
          if (item.textContent?.includes("Pending admin review")) item.textContent = "Valid Solana mint · Ready to publish";
        });
        const submit = shell.querySelector("button.workflow-submit");
        if (submit && !submit.textContent?.includes("Publishing")) submit.textContent = "Publish listing";
      }
      const success = document.querySelector(".submission-success-popup");
      if (success) {
        const heading = success.querySelector("h2");
        const paragraph = success.querySelector("p");
        const note = success.querySelector("small");
        if (heading) heading.textContent = "Listing Live!";
        if (paragraph) paragraph.textContent = "Your project has been published to the SolPitch Network.";
        if (note) note.textContent = "It is now public and can be viewed, claimed and voted on.";
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    update();
    return () => observer.disconnect();
  }, []);
  return null;
}

export default function App() {
  return (
    <>
      <OperatingApp />
      <PublicListingCopy />
      <CopyCaToast />
      <SiteFooter />
    </>
  );
}
