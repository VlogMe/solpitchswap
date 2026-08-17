import { useEffect, useState } from "react";

export default function PromotionOptionsPortal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const button = target.closest("button");
      if (
        !button ||
        !button.closest(".nav-rail") ||
        button.textContent?.trim() !== "Promotion options"
      ) {
        return;
      }

      event.preventDefault();
      setOpen(true);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (!open) return null;

  return (
    <div
      className="contract-search-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-options-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setOpen(false);
        }
      }}
    >
      <section
        className="contract-search-modal"
        style={{
          maxWidth: "620px",
          width: "calc(100% - 32px)",
          background: "#0f141d",
          border: "1px solid #2a3140",
          padding: "28px",
        }}
      >
        <button
          className="contract-search-close"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          ×
        </button>

        <h2
          id="promotion-options-title"
          style={{
            color: "#22c55e",
            fontSize: "2rem",
            lineHeight: 1.1,
            margin: "0 36px 18px 0",
          }}
        >
          Promotion Options
        </h2>

        <p
          style={{
            color: "#ffffff",
            fontSize: "1rem",
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          Coming soon: Listing holders will be able to use our $SCLN utility token to purchase exciting features on our SolPitch Network. Stay tuned and be sure to follow{" "}
          <a
            href="https://x.com/solpitch2026"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#55e59d",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            @solpitch2026
          </a>{" "}
          and turn on the notifications so you don’t miss our daily updates!
        </p>
      </section>
    </div>
  );
}
