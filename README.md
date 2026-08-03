# SolPitch Coin-Listing Homepage

This branch contains a standalone React/Vite homepage for SolPitch project discovery.

## Safety boundary

This project intentionally contains no swap implementation and no wallet-sensitive code. Do not add or modify:

- Jupiter quote or swap logic
- Phantom wallet connection logic
- Solana transaction construction, signing, or sending
- Buffer polyfills used by the working swap
- RPC configuration or confirmation handling
- Production swap deployment files

The homepage links users to the existing live swap at `https://solpitch.net`.

## Local development

```bash
npm install
npm run dev
```

The development server uses `http://localhost:8080`.

## Production build

```bash
npm run build
```

## Current status

- Clean responsive homepage created
- Lovable mock-heavy prototype not imported
- Onyx included as the first named listing placeholder
- All other project cards clearly marked as previews
- Development remains isolated on `agent/coin-listing-homepage`
