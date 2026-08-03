type Coin = {
  name: string;
  symbol: string;
  pitch: string;
  status: string;
};

const coins: Coin[] = [
  { name: "Onyx", symbol: "$ONYX", pitch: "Community-listed Solana token.", status: "Listed" },
  { name: "Project listings", symbol: "COMING SOON", pitch: "Verified project submissions will appear here.", status: "Preview" },
  { name: "Community picks", symbol: "COMING SOON", pitch: "Voting and discovery features are being prepared.", status: "Preview" },
];

export default function App() {
  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="SolPitch home">
          <span className="brand-mark">SP</span>
          <span>SolPitch</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#discover">Discover</a>
          <a href="#safety">Safety</a>
          <a className="nav-button" href="https://solpitch.net">Open Swap</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <p className="eyebrow">SOLANA PROJECT DISCOVERY</p>
            <h1>Find the project.<br />Read the pitch.<br /><span>Trade when ready.</span></h1>
            <p className="hero-copy">
              SolPitch is a focused discovery homepage for launched Solana projects. The live swap stays separate, protected, and untouched.
            </p>
            <div className="hero-actions">
              <a className="primary-button" href="#discover">Explore listings</a>
              <a className="secondary-button" href="https://solpitch.net">Go to live swap</a>
            </div>
          </div>
          <aside className="hero-panel" aria-label="Development status">
            <span className="status-dot" />
            <p>Homepage development branch</p>
            <strong>Isolated from production swap logic</strong>
            <small>No wallet, Jupiter, RPC, signing, or transaction code exists in this project.</small>
          </aside>
        </section>

        <section className="section" id="discover">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DISCOVER</p>
              <h2>Project listings</h2>
            </div>
            <p>Real listings will replace preview cards as project data is approved.</p>
          </div>
          <div className="coin-grid">
            {coins.map((coin) => (
              <article className="coin-card" key={coin.name}>
                <div className="coin-topline">
                  <span className="coin-logo">{coin.name.slice(0, 1)}</span>
                  <span className="status-pill">{coin.status}</span>
                </div>
                <h3>{coin.name}</h3>
                <p className="symbol">{coin.symbol}</p>
                <p>{coin.pitch}</p>
                <a href="https://solpitch.net">Open on SolPitch</a>
              </article>
            ))}
          </div>
        </section>

        <section className="safety" id="safety">
          <div>
            <p className="eyebrow">SAFETY BOUNDARY</p>
            <h2>The homepage informs. The swap executes.</h2>
          </div>
          <p>
            This codebase intentionally contains no swap engine. All wallet connections, quotes, signing, routing, and transaction execution remain in the existing working application.
          </p>
        </section>
      </main>

      <footer>
        <span>© 2026 SolPitch</span>
        <span>Solana project discovery</span>
      </footer>
    </div>
  );
}
