import { useEffect, useMemo, useRef, useState } from "react";
import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import "./native-swap.css";

if (!(globalThis as { Buffer?: typeof Buffer }).Buffer) {
  (globalThis as { Buffer?: typeof Buffer }).Buffer = Buffer;
}

type SwapToken = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  logoURI?: string;
};

type Quote = {
  inAmount: string;
  outAmount: string;
  priceImpactPct?: string;
  routePlan?: unknown[];
} & Record<string, unknown>;

type SwapPhantomProvider = {
  isPhantom?: boolean;
  publicKey?: { toString(): string };
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signAndSendTransaction?(tx: VersionedTransaction): Promise<{ signature: string } | string>;
  signTransaction?(tx: VersionedTransaction): Promise<VersionedTransaction>;
};

declare global {
  interface Window {
    phantom?: { solana?: SwapPhantomProvider };
  }
}

const SOL: SwapToken = {
  symbol: "SOL",
  name: "Solana",
  mint: "So11111111111111111111111111111111111111112",
  decimals: 9,
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
};

const USDC: SwapToken = {
  symbol: "USDC",
  name: "USD Coin",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
  logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
};

const PRESET_TOKENS: SwapToken[] = [
  SOL,
  USDC,
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", decimals: 6, logoURI: "https://static.jup.ag/jup/icon.png" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", decimals: 5, logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, logoURI: "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr", decimals: 9, logoURI: "https://arweave.net/A1etRNMKxhlNGTf-gNBtJ75QJJ4NJtbKh_UXQTlLXzI" },
  { symbol: "MOODENG", name: "Moo Deng", mint: "ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY", decimals: 6, logoURI: "https://ipfs.io/ipfs/Qmf1g7dJZNDJHRQru7E7ENwDjcvu7swMUB6x9ZqPXr4RV2" },
  { symbol: "PNUT", name: "Peanut the Squirrel", mint: "2qEHjDLDLbuBgRYvsxhc5D6uDWAivNFZGan56P1tpump", decimals: 6, logoURI: "https://ipfs.io/ipfs/QmNdTtJauw39u4DzGyTaZ35rRx4VgAxqb91wE89zjyHWd2" },
  { symbol: "ONYX", name: "Onyx Kitty", mint: "5uHh5i8KUHmu6334mcQpc6FejLuoJQSjJZYPgQ8cpump", decimals: 6, logoURI: "https://ipfs.io/ipfs/bafkreibw4ewc2pi2muwgsnwt3uc6wapmzlsmy24h5if2ta27anysqf4p6i" },
  { symbol: "TOEZ", name: "TOEZ", mint: "3DRCui7ZbEykhrUHMbyXSvn5731fbKchFTFvs1Wjpump", decimals: 6, logoURI: "https://ipfs.io/ipfs/QmQojwpFsx6GQeFkVxL87fcKVKacchjbEDWqXuPDcg5uJu" },
  { symbol: "FARTCOIN", name: "Fartcoin", mint: "9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump", decimals: 6, logoURI: "https://coin-images.coingecko.com/coins/images/50891/small/fart.jpg?1729503972" },
  { symbol: "GOAT", name: "Goatseus Maximus", mint: "CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump", decimals: 6, logoURI: "https://ipfs.io/ipfs/QmapAq9WtNrtyaDtjZPAHHNYmpSZAQU6HywwvfSWq4dQVV" },
];

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://solpitchswap.kevingpersson.workers.dev";

function provider() {
  return (window.phantom?.solana ?? (window as unknown as { solana?: SwapPhantomProvider }).solana) as SwapPhantomProvider | undefined;
}

function toRaw(value: string, decimals: number) {
  const [whole = "0", fraction = ""] = value.split(".");
  return (BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fraction.slice(0, decimals).padEnd(decimals, "0") || "0")).toString();
}

function fromRaw(value: string, decimals: number) {
  const padded = value.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals) || "0";
  const fraction = padded.slice(-decimals).replace(/0+$/g, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function compact(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "0";
}

function TokenLogo({ token }: { token: SwapToken }) {
  const [failed, setFailed] = useState(false);
  if (!token.logoURI || failed) return <span className="native-token-fallback">{token.symbol.slice(0, 2)}</span>;
  return <img src={token.logoURI} alt={`${token.name} logo`} onError={() => setFailed(true)} />;
}

function TokenButton({ token, onClick }: { token: SwapToken; onClick: () => void }) {
  return (
    <button type="button" className="native-token-trigger" onClick={onClick} aria-label={`Select token, current token ${token.symbol}`}>
      <TokenLogo token={token} />
      <span>{token.symbol}</span>
      <b>⌄</b>
    </button>
  );
}

function TokenPicker({
  open,
  selected,
  extraToken,
  onClose,
  onSelect,
}: {
  open: boolean;
  selected: SwapToken;
  extraToken?: SwapToken;
  onClose: () => void;
  onSelect: (token: SwapToken) => void;
}) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const tokens = useMemo(() => {
    const list = extraToken && !PRESET_TOKENS.some(token => token.mint === extraToken.mint)
      ? [extraToken, ...PRESET_TOKENS]
      : PRESET_TOKENS;
    const normalized = query.trim().toLowerCase();
    return normalized
      ? list.filter(token => `${token.symbol} ${token.name} ${token.mint}`.toLowerCase().includes(normalized))
      : list;
  }, [extraToken, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const timer = window.setTimeout(() => searchInput.current?.focus(), 50);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="native-token-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="native-token-modal" role="dialog" aria-modal="true" aria-label="Select a token">
        <div className="native-token-modal-head">
          <h3>Select a token</h3>
          <button type="button" onClick={onClose} aria-label="Close token selector">×</button>
        </div>
        <div className="native-token-search">
          <span>⌕</span>
          <input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search supported liquid tokens" />
        </div>
        <div className="native-token-list">
          {tokens.map(token => (
            <button
              type="button"
              className={token.mint === selected.mint ? "selected" : ""}
              key={token.mint}
              onClick={() => { onSelect(token); onClose(); }}
            >
              <TokenLogo token={token} />
              <span><strong>{token.symbol}</strong><small>{token.name}</small></span>
              {token.mint === selected.mint && <b>✓</b>}
            </button>
          ))}
          {tokens.length === 0 && <p>No supported preset token matches that search. Paste its CA in the swap card instead.</p>}
        </div>
      </section>
    </div>
  );
}

export default function NativeSwapCard() {
  const [from, setFrom] = useState<SwapToken>(SOL);
  const [to, setTo] = useState<SwapToken>(USDC);
  const [amount, setAmount] = useState("0.1");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [wallet, setWallet] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [slippage, setSlippage] = useState(50);
  const [picker, setPicker] = useState<"from" | "to" | null>(null);
  const debounce = useRef<number | undefined>(undefined);

  const output = useMemo(() => quote ? fromRaw(String(quote.outAmount), to.decimals) : "", [quote, to.decimals]);

  useEffect(() => {
    window.clearTimeout(debounce.current);
    setQuote(null);
    if (!amount || Number(amount) <= 0 || from.mint === to.mint) return;
    debounce.current = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`${API_BASE}/api/swap/quote?inputMint=${from.mint}&outputMint=${to.mint}&amount=${toRaw(amount, from.decimals)}&slippageBps=${slippage}`);
        const body = await response.json() as Quote & { error?: string };
        if (!response.ok) throw new Error(body.error || "Quote unavailable");
        setQuote(body);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Quote unavailable");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => window.clearTimeout(debounce.current);
  }, [amount, from, to, slippage]);

  async function connect() {
    const phantom = provider();
    if (!phantom?.isPhantom) {
      setMessage("Phantom was not detected.");
      return;
    }
    try {
      const result = await phantom.connect();
      setWallet(result.publicKey.toString());
      setMessage("");
    } catch {
      setMessage("Wallet connection was cancelled.");
    }
  }

  async function findToken() {
    const mint = search.trim();
    if (!mint) return;
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/swap/token?mint=${encodeURIComponent(mint)}`);
      const body = await response.json() as SwapToken & { error?: string };
      if (!response.ok) throw new Error(body.error || "Token not found");
      setTo(body);
      setSearch("");
      setQuote(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Token not found");
    }
  }

  async function execute() {
    if (!quote) {
      setMessage("Enter an amount and wait for a quote.");
      return;
    }
    const phantom = provider();
    if (!phantom || !wallet) {
      await connect();
      return;
    }
    setSwapping(true);
    setMessage("");
    try {
      const response = await fetch(`${API_BASE}/api/swap/build`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quoteResponse: quote, userPublicKey: wallet }),
      });
      const body = await response.json() as { swapTransaction?: string; error?: string };
      if (!response.ok || !body.swapTransaction) throw new Error(body.error || "Swap transaction unavailable");
      const transaction = VersionedTransaction.deserialize(Buffer.from(body.swapTransaction, "base64"));
      let signature = "";
      if (phantom.signAndSendTransaction) {
        const sent = await phantom.signAndSendTransaction(transaction);
        signature = typeof sent === "string" ? sent : sent.signature;
      } else if (phantom.signTransaction) {
        const signed = await phantom.signTransaction(transaction);
        const sent = await fetch(`${API_BASE}/api/swap/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signedTransaction: Buffer.from(signed.serialize()).toString("base64") }),
        });
        const result = await sent.json() as { signature?: string; error?: string };
        if (!sent.ok || !result.signature) throw new Error(result.error || "Transaction submission failed");
        signature = result.signature;
      } else {
        throw new Error("Phantom cannot sign this transaction.");
      }
      setMessage(`Swap submitted: ${signature.slice(0, 8)}…${signature.slice(-8)}`);
      setAmount("");
      setQuote(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Swap failed");
    } finally {
      setSwapping(false);
    }
  }

  function reverse() {
    setFrom(to);
    setTo(from);
    setQuote(null);
  }

  function chooseFrom(token: SwapToken) {
    setFrom(token);
    if (token.mint === to.mint) setTo(token.mint === SOL.mint ? USDC : SOL);
    setQuote(null);
  }

  function chooseTo(token: SwapToken) {
    setTo(token);
    if (token.mint === from.mint) setFrom(token.mint === SOL.mint ? USDC : SOL);
    setQuote(null);
  }

  return (
    <section className="native-swap-card">
      <div className="native-swap-heading">
        <div><span>SOLPITCH</span><h2>Swap</h2></div>
        <select value={slippage} onChange={event => setSlippage(Number(event.target.value))} aria-label="Slippage tolerance">
          <option value={50}>0.5%</option><option value={100}>1%</option><option value={200}>2%</option>
        </select>
      </div>
      <label className="native-ca-label">Paste CA to select token</label>
      <div className="native-ca-row">
        <input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void findToken(); } }} placeholder="Solana contract address" />
        <button type="button" onClick={() => void findToken()}>Find</button>
      </div>
      <div className="native-token-box">
        <div><small>You pay</small><input value={amount} onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal" /></div>
        <TokenButton token={from} onClick={() => setPicker("from")} />
      </div>
      <button type="button" className="native-reverse" onClick={reverse}>⇅</button>
      <div className="native-token-box">
        <div><small>You receive</small><strong>{loading ? "Loading…" : output ? compact(output) : "0.00"}</strong></div>
        <TokenButton token={to} onClick={() => setPicker("to")} />
      </div>
      {quote && <div className="native-quote"><span>Price impact</span><strong>{quote.priceImpactPct ?? "0"}%</strong></div>}
      {message && <p className="native-swap-message">{message}</p>}
      <button type="button" className="native-swap-action" onClick={() => wallet ? void execute() : void connect()} disabled={loading || swapping}>{swapping ? "Confirming swap…" : wallet ? "Swap now" : "Connect Phantom"}</button>
      <TokenPicker open={picker === "from"} selected={from} extraToken={to} onClose={() => setPicker(null)} onSelect={chooseFrom} />
      <TokenPicker open={picker === "to"} selected={to} extraToken={to} onClose={() => setPicker(null)} onSelect={chooseTo} />
    </section>
  );
}
