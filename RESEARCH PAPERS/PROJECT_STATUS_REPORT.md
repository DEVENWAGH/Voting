# Blockchain-Based Decentralized E-Voting System

## Project Status Report — July 2026

> **Project Type:** College Research Project
> **Stack:** Next.js 15 · Solidity · Ethereum · MongoDB · Hardhat · OpenZeppelin
> **Contract:** `VotingV1.sol` (UUPS Upgradeable Proxy)

---

## Table of Contents

1. [Concept Clarifications](#concept-clarifications)
2. [Architecture Overview](#architecture-overview)
3. [Implemented Features](#implemented-features)
4. [Missing / Incomplete Features](#missing--incomplete-features)
5. [Dropped Features](#dropped-features)
6. [MVP Priority Checklist](#mvp-priority-checklist)
7. [Post-MVP / v2 Roadmap](#post-mvp--v2-roadmap)
8. [Tech Stack Status](#tech-stack-status)

---

## Concept Clarifications

### Verifiable Decryption

A cryptographic technique where vote tallying happens **publicly and provably**. Each voter gets a receipt (commitment), and after the election anyone can mathematically verify the final tally matches all receipts — without seeing _who_ voted for _whom_.

**Status in this project:** ❌ Not implemented — not needed for MVP.
The app stores `voteCount++` directly on-chain. The count is transparent (anyone can read the contract), but there is no cryptographic proof linking individual vote receipts to the final tally. This is **transparent but not verifiably decryptable**. Full verifiable decryption requires Pedersen commitments or ElGamal encryption — a research-grade stretch goal.

---

### Tallying with Cryptographic Commitments

Instead of storing `voteCount` directly, each vote would be stored as an encrypted ciphertext (e.g., `Encrypt(1)`). At the end, all ciphertexts are added homomorphically and decrypted — revealing only the total, never individual choices.

**Status in this project:** ❌ Not implemented — not needed for MVP.
The app correctly uses `voteCount++` on-chain: simple, fast, transparent, and gas-efficient. Cryptographic commitments add significant gas costs and require a trusted threshold decryption authority. This is a **Stretch Goal**.

---

### Decentralized Identity (DID)

DID means a voter owns their identity as a cryptographic key pair (like a wallet address) rather than through a username/password on a central server. Standards include W3C DID spec, ENS names, Polygon ID, and Verifiable Credentials.

**Status in this project:** ❌ Not implemented — intentionally replaced.
The app uses a **nullifier hash** model: `keccak256(orgId + memberId + SERVER_SECRET)`. This is server-controlled pseudonymous identity — not a DID, but practically sufficient. The gasless relay model is better UX for most orgs (no MetaMask required per voter).

---

### IPFS Storage

IPFS (InterPlanetary File System) is a **decentralized file storage** network, not a database. The model is:

| Layer      | What it stores                                                | Technology               |
| ---------- | ------------------------------------------------------------- | ------------------------ |
| Blockchain | Hashes, vote counts, nullifiers                               | Ethereum (on-chain)      |
| IPFS       | Large files — candidate photos, manifestos, voter list hashes | IPFS (decentralized CDN) |
| Database   | Metadata, analytics, voter records                            | MongoDB (off-chain)      |

You store a CID (content hash) from IPFS on-chain, proving the file hasn't been tampered with.

**Status in this project:** ❌ Not implemented.
Currently using **ImageKit CDN** (centralized) for photos and **MongoDB** for all data. IPFS is listed in the vision but not in the codebase. This is a **Post-MVP** feature.

---

### Multi-Chain Support

Deploying the smart contract on multiple blockchains (Ethereum, Polygon, BSC, Arbitrum) so orgs can choose their preferred chain.

**Status in this project:** ❌ Not implemented — but easy to add.
`VotingV1.sol` is standard Solidity and compiles for any EVM-compatible chain. Adding Polygon/Arbitrum only requires new network configs in `hardhat.config.js` and a new `NEXT_PUBLIC_CONTRACT_ADDRESS` env variable. This is a **Post-MVP config task**, not an architecture rewrite.

---

### Audit Trails

A verifiable record of every vote transaction that anyone can independently verify.

**Status in this project:** ✅ Partially implemented.
The analytics page already shows `txHash` + `blockNumber` for every vote in the activity feed. What's missing is a **dedicated public audit page** where any voter can verify their vote was counted using their transaction hash — without needing to be logged in.

---

## Architecture Overview

```
Voter Browser
    │
    ▼
Next.js Frontend (React)
    │
    ├── /api/auth/*         → Email OTP authentication
    ├── /api/relay/*        → Gas-station relay (submits blockchain txs)
    ├── /api/voters/*       → Voter registration & CSV import
    ├── /api/analytics/*    → MongoDB aggregation pipeline
    └── /api/biometric/*    → Face landmark register/verify
         │
         ├── MongoDB         → Voter records, elections, candidates, analytics
         ├── ImageKit CDN    → Candidate photos (centralized, temporary)
         └── Ethereum Node
              │
              └── VotingV1.sol (UUPS Proxy)
                   ├── registerVoterByRelay()
                   ├── castVoteRelayed()
                   ├── createElection()
                   ├── addCandidate()
                   ├── transitionPhase()
                   └── 2-of-3 Guardian upgrade system
```

---

## Implemented Features

### ✅ Blockchain & Smart Contract

| Feature                       | Details                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| Solidity smart contract       | `VotingV1.sol` — fully written and deployable                                  |
| UUPS Upgradeable Proxy        | OpenZeppelin `UUPSUpgradeable` — contract can be upgraded without redeployment |
| 2-of-3 Guardian multi-sig     | 3 guardians, 2 must approve any upgrade — **stretch goal already built**       |
| Gasless voting (relay model)  | Voters never need ETH or a wallet — relay wallet pays all gas                  |
| One-vote enforcement          | `hasVoted[nullifierHash][electionId]` mapping on-chain                         |
| No PII on-chain               | Only `keccak256` nullifier hashes stored, zero personal data                   |
| Election phase control        | `Registration → Voting → Completed` enforced in contract                       |
| Candidate management          | `addCandidate()` with name, party, symbol, manifesto, photoUrl                 |
| Winner calculation            | `getWinner()` returns highest vote-count candidate                             |
| Results on-chain              | `getElectionResults()` only accessible after `Completed` phase                 |
| Sepolia testnet deploy script | `scripts/deployProxy.js` with `--network sepolia`                              |

---

### ✅ Backend API Routes

| Route                                            | Purpose                              |
| ------------------------------------------------ | ------------------------------------ |
| `POST /api/auth/send-otp`                        | Send OTP email to voter              |
| `POST /api/auth/verify-otp`                      | Verify OTP, create session           |
| `POST /api/org-auth/signup`                      | Org registration                     |
| `POST /api/org-auth/verify-email`                | Org email verification               |
| `GET/POST /api/org/[slug]/elections`             | List / create elections              |
| `POST /api/org/[slug]/elections/[id]/candidates` | Add candidate                        |
| `POST /api/org/[slug]/elections/[id]/phase`      | Transition election phase            |
| `POST /api/voters/bulk-register`                 | Bulk register voters on-chain        |
| `POST /api/voters/upload-csv`                    | Import voters from CSV               |
| `GET /api/analytics/[electionId]`                | Full MongoDB aggregation analytics   |
| `GET /api/elections/[id]/results`                | Final results (completed phase only) |
| `GET /api/elections/[id]/activity`               | Vote activity feed                   |
| `POST /api/biometric/register`                   | Register face landmarks              |
| `POST /api/biometric/verify`                     | Verify face + issue 60s JWT          |
| `GET /api/relay/status`                          | Check relay wallet balance/status    |
| `POST /api/admin/elections/approve`              | Guardian approval flow               |
| `GET /api/imagekit/auth`                         | ImageKit upload authentication       |

---

### ✅ Frontend Pages

| Page              | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `/`               | Landing page                              |
| `/signup`         | Org registration                          |
| `/login`          | Org login                                 |
| `/dashboard`      | Org admin — elections, candidates, voters |
| `/vote/[slug]`    | Voter-facing voting interface             |
| `/analytics`      | Real-time analytics dashboard             |
| `/biometric`      | Face registration & verification          |
| `/connect-wallet` | Wallet connection page                    |
| `/admin`          | Super-admin panel                         |
| `/admin-auth`     | Admin authentication                      |
| `/elections/[id]` | Election detail view                      |

---

### ✅ Analytics (Cloud/Serverless)

| Metric                                         | Status  |
| ---------------------------------------------- | ------- |
| Total ballots cast                             | ✅ Live |
| Voting velocity (votes/min)                    | ✅ Live |
| Votes last 1 hour                              | ✅ Live |
| Peak voting hour                               | ✅ Live |
| Per-candidate vote breakdown (bar chart)       | ✅ Live |
| Hourly turnout trend (SVG line chart)          | ✅ Live |
| Recent activity feed with txHash + blockNumber | ✅ Live |
| Auto-refresh (5s / 10s / 30s)                  | ✅ Live |

---

### ✅ Biometric (Simulated — v2 will use real AWS)

| Component                                      | Status                                                   |
| ---------------------------------------------- | -------------------------------------------------------- |
| Camera access + oval face guide UI             | ✅ Done                                                  |
| Liveness indicators (face, centered, lighting) | ✅ Done (simulated)                                      |
| Landmark extraction                            | ✅ Done (**random numbers** — not real face recognition) |
| Normalize landmarks + similarity score         | ✅ Done                                                  |
| Store normalized ratios in MongoDB             | ✅ Done                                                  |
| 60-second JWT token on verify                  | ✅ Done                                                  |
| Register / Verify modes                        | ✅ Done                                                  |

> ⚠️ **Note:** Biometric is UI-complete but uses **simulated random landmark values**, not real face recognition. Real biometric (AWS Rekognition / MediaPipe) is planned for v2.

---

## Missing / Incomplete Features

### 🔴 Critical (Breaks Core Flow)

| Feature                    | Issue                                                              | Fix Needed                                                               |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `/api/relay/vote/route.js` | **File does not exist** — the vote casting relay is missing        | Create the relay vote API that calls `castVoteRelayed()` on the contract |
| End-to-end voter vote flow | Cannot verify if `/vote/[slug]` page works without the relay route | Test + fix after relay route is created                                  |

---

### 🟠 Near-MVP (Should have before demo)

| Feature                      | Issue                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Candidate photo upload       | ImageKit auth endpoint exists but upload is not wired to the Add Candidate form   |
| Public election results page | Results are accessible to admins; needs a public-facing results view              |
| Public election ledger       | `/api/elections/public` endpoint referenced in pages but missing                  |
| Audit trail page             | txHash exists in analytics feed but no dedicated "verify my vote" page for voters |
| Mobile responsiveness polish | Functional but needs testing on small screens                                     |

---

### 🟡 Post-MVP / v2 (Nice to have)

| Feature                          | Notes                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| IPFS storage                     | Replace ImageKit with IPFS for candidate photos/manifestos    |
| Real biometric (AWS Rekognition) | Replace simulated landmarks with real face recognition        |
| Digital Voter ID                 | Issue a cryptographic voter ID card post-registration         |
| Governance UI                    | Guardian upgrade proposal UI is placeholder only              |
| Multi-chain deployment           | Polygon, Arbitrum — just Hardhat config changes               |
| Layer-2 support                  | Lower gas costs — deploy on Polygon Mumbai / Arbitrum Sepolia |
| Verifiable decryption            | ZK-proof based vote tallying — research-grade                 |
| Cryptographic commitments        | Homomorphic encryption for votes — research-grade             |
| DID / Self-sovereign identity    | W3C DID, Polygon ID integration                               |
| Serverless edge functions        | Move analytics to Vercel Edge / Cloudflare Workers            |

---

## Dropped Features

| Feature                         | Reason                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Aadhaar Verification**        | Requires UIDAI partnership + government API access. Not feasible for a college research project. **Dropped permanently for this version.** OTP email verification serves as the primary identity check. |
| **MetaMask / Wallet per voter** | Replaced by gasless relay model — much better UX, especially for non-crypto users in an org/college setting.                                                                                            |

---

## MVP Priority Checklist

```
MVP MUST-HAVE (before final demo)
──────────────────────────────────
[ ] 1. Create /api/relay/vote/route.js  ← MOST CRITICAL
[ ] 2. Verify /vote/[slug] end-to-end voter flow works
[ ] 3. Wire candidate photo upload to ImageKit
[ ] 4. Create public election results page
[ ] 5. Create /api/elections/public endpoint

MVP NICE-TO-HAVE (if time allows)
──────────────────────────────────
[ ] 6. Basic "verify my vote" audit page (enter txHash → confirm)
[ ] 7. Mobile UI polish pass
[ ] 8. Guardian governance UI (not just backend)
```

---

## Post-MVP / v2 Roadmap

```
v2 Features (After Research Paper Submission)
──────────────────────────────────────────────
[ ] Real biometric — AWS Rekognition or MediaPipe WASM
[ ] IPFS storage — candidate photos + election documents
[ ] Digital Voter ID — NFT or cryptographic certificate
[ ] Multi-chain — Polygon / Arbitrum deployment
[ ] ZK proofs — anonymous voter verification
[ ] DAO governance — on-chain guardian management
[ ] Serverless analytics — Vercel Edge / Cloudflare
```

---

## Tech Stack Status

| Technology              | Planned | Implemented                 |
| ----------------------- | ------- | --------------------------- |
| React / Next.js 15      | ✅      | ✅                          |
| Node.js (API routes)    | ✅      | ✅                          |
| Solidity (VotingV1.sol) | ✅      | ✅                          |
| Ethereum / Hardhat      | ✅      | ✅                          |
| OpenZeppelin UUPS       | ✅      | ✅                          |
| Ethers.js v6            | ✅      | ✅                          |
| MongoDB + Mongoose      | ✅      | ✅                          |
| NextAuth.js             | ✅      | ✅                          |
| Email OTP (Nodemailer)  | ✅      | ✅                          |
| ImageKit CDN            | ✅      | ✅ (partial)                |
| Biometric (simulated)   | ✅      | ✅ (simulated)              |
| IPFS                    | ✅      | ❌                          |
| MetaMask / Wallet       | ✅      | ⚠️ Replaced by relay        |
| Aadhaar API             | ✅      | ❌ Dropped                  |
| Twilio OTP              | ✅      | ❌ Using Nodemailer instead |
| AWS Rekognition         | 🔮 v2   | ❌                          |
| Layer-2 / Polygon       | 🔮 v2   | ❌                          |
| ZK Proofs               | 🔮 v2   | ❌                          |

---

## Summary

> The core voting pipeline is **~75% complete**.
> Authentication → Org setup → Election creation → Candidate/voter management → Guardian approval → OTP voting → Analytics is all built.
> The single most critical missing piece is the **relay vote API route** that actually submits votes to the blockchain.
> Once that and the public-facing pages are done, the project is **MVP-ready for research submission**.

---

_Report generated: July 2026_
_Project: Block Vote — Blockchain-Based Decentralized E-Voting System_
