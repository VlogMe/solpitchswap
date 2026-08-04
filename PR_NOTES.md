# Fresh SolPitch implementation notes

## Added

- React/Vite/TypeScript application structure
- Typed project and submission models
- Public graduated-coin submission form
- Persistent local development review queue
- Admin approve and reject controls with reviewer notes
- Search, project detail view, rankings and promoted placements
- Responsive workflow styling

## Production requirement

The current localStorage queue is for development and preview use. Public launch requires a server-side database, authenticated admin access and protected API routes.

## Protected boundary

No Jupiter, Phantom, Buffer, RPC, signing, transaction or production swap execution code was changed.
