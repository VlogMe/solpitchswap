# SolPitch homepage development

This branch is the isolated development workspace for the SolPitch coin-listing homepage.

## Protected boundary

Do not add or modify Jupiter, Phantom, Buffer polyfill, RPC, signing, transaction execution, or production swap code here. The homepage links to the existing live swap as a separate application.

## Current implementation

A clean React/Vite homepage has replaced the mock-heavy Lovable prototype. It includes responsive navigation, project-listing cards, a clearly labeled development status panel, an Onyx listing placeholder, safety messaging, and a link to the live swap.
