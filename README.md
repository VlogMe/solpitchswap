# SolPitch Graduated Listings Platform

This branch contains the fresh React/Vite/TypeScript build for SolPitch.

## Current features

- Three-column graduated-project directory
- Reusable project cards, rankings, promoted placements and swap panel
- Search by project name, ticker or contract address
- Project detail view for Onyx
- Graduated-coin submission form
- Admin review queue with approve and reject controls
- Persistent development submissions using browser localStorage

## Permanent listing rule

SolPitch accepts graduated or bonded Solana projects only. No presales, upcoming launches or unbonded tokens.

## Important production note

The current submission and review persistence is a development implementation stored in the browser. A production deployment requires authenticated admin access and a server-side database before public launch.

## Swap safety boundary

The existing Jupiter, Phantom, Buffer, RPC, signing and transaction code is not included or modified here. The sidebar links to the proven live swap at https://solpitch.net.
