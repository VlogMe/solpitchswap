(() => {
  const FOOTER_ID = "solpitch-live-footer";

  function installFooter() {
    if (document.getElementById(FOOTER_ID)) return;

    const footer = document.createElement("footer");
    footer.id = FOOTER_ID;
    footer.setAttribute("aria-label", "SolPitch legal footer");
    footer.innerHTML = `
      <nav aria-label="Legal and contact links">
        <a href="/solpitchswap/privacy.html">Privacy Policy</a>
        <a href="/solpitchswap/terms.html">Terms &amp; Conditions</a>
        <a href="https://x.com/solpitch2026" target="_blank" rel="noreferrer">Contact @solpitch2026 on X</a>
      </nav>
      <p>© 2026 solpitch.com All rights reserved.</p>
    `;

    Object.assign(footer.style, {
      position: "relative",
      zIndex: "9999",
      margin: "28px 24px 24px",
      padding: "24px 20px",
      border: "1px solid #232838",
      borderRadius: "18px",
      background: "linear-gradient(180deg, #111620, #0b0f17)",
      color: "#8d95aa",
      textAlign: "center",
      fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    });

    const nav = footer.querySelector("nav");
    Object.assign(nav.style, {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "10px 20px",
      marginBottom: "12px"
    });

    footer.querySelectorAll("a").forEach((link) => {
      Object.assign(link.style, {
        color: "#b99cff",
        fontWeight: "800",
        textDecoration: "none"
      });
    });

    const copy = footer.querySelector("p");
    Object.assign(copy.style, { margin: "0", fontSize: ".82rem" });

    document.body.appendChild(footer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installFooter, { once: true });
  } else {
    installFooter();
  }

  window.addEventListener("load", installFooter, { once: true });
  window.addEventListener("hashchange", () => window.setTimeout(installFooter, 50));
})();
