# Coin-listing homepage development

This branch is the isolated development workspace for the Lovable SolPitch coin-listing prototype.

## Safety boundary

- Do not connect this branch to the production SolPitch swap yet.
- Do not copy or modify the working Jupiter, Phantom, Buffer polyfill, transaction, RPC, or swap execution code.
- Treat the swap panel in this prototype as a visual placeholder only.
- Homepage and coin-listing work must be reviewed before merging into `main`.

## Prototype status

The supplied export is a TanStack Start / React / Vite project. It contains mock coin data and several visual-only controls. The first development phase is to clean the homepage, remove fake project claims and metrics, and replace mock interactions with clearly marked development states.
