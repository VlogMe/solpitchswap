# Validation notes

The homepage source is deliberately standalone and contains no swap engine, wallet adapter, Solana RPC, transaction, signing, or Jupiter code.

A dependency install and production build must run in a normal internet-connected development or CI environment because this execution environment cannot resolve the public npm registry.
