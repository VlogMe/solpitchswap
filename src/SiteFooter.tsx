import "./site-footer.css";

export default function SiteFooter() {
  const base = import.meta.env.BASE_URL;
  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <a href={`${base}privacy.html`}>Privacy Policy</a>
        <a href={`${base}terms.html`}>Terms &amp; Conditions</a>
        <a href="https://x.com/solpitch2026" target="_blank" rel="noreferrer">Contact @solpitch2026 on X</a>
      </div>
      <p>© 2026 solpitch.com All rights reserved.</p>
    </footer>
  );
}
