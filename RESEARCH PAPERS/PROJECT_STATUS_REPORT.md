# Blockchain-Based Decentralized E-Voting System

## Project Status Report — July 2026

> **Project Type:** College Research Project
> **Stack:** Next.js 15 · Solidity · Ethereum · MongoDB · Pinata IPFS · ImageKit · Hardhat · OpenZeppelin
> **Contract:** `VotingV1.sol` (UUPS Upgradeable Proxy)

---

## Table of Contents

1. [Concept Clarifications](#concept-clarifications)
2. [Data Persistence Model](#data-persistence-model)
3. [Architecture Overview](#architecture-overview)
4. [Implemented Features](#implemented-features)
5. [Missing / Incomplete Features](#missing--incomplete-features)
6. [Dropped Features](#dropped-features)
7. [MVP Priority Checklist](#mvp-priority-checklist)
8. [Post-MVP / v2 Roadmap](#post-mvp--v2-roadmap)
9. [Tech Stack Status](#tech-stack-status)

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

**Status in this project:** ✅ Partially implemented via **Pinata IPFS**.

`lib/ipfs.js` pins JSON metadata to IPFS through the Pinata API. CIDs are stored in MongoDB and returned in API responses:

| Action | What gets pinned to IPFS |
| ------ | ------------------------ |
| Create election | Election metadata (title, description, times, org) |
| Add candidate | Candidate metadata (name, party, symbol, manifesto, txHash) |
| Upload voter CSV | Anonymised voter roster audit snapshot |

Candidate **photos** still use **ImageKit CDN** (centralized), not IPFS files yet. IPFS pinning is **non-fatal** — if `PINATA_JWT` is missing, the app continues but skips pinning.

**Persistence:** Pinata pins survive dev server restarts. Data remains on IPFS/Pinata cloud as long as the pin is active and your Pinata account/quota allows it. MongoDB stores the `ipfsCid` reference so the app can link back to the content.

---

### Multi-Chain Support

Deploying the smart contract on multiple blockchains (Ethereum, Polygon, BSC, Arbitrum) so orgs can choose their preferred chain.

**Status in this project:** ❌ Not implemented — but easy to add.
`VotingV1.sol` is standard Solidity and compiles for any EVM-compatible chain. Adding Polygon/Arbitrum only requires new network configs in `hardhat.config.js` and a new `NEXT_PUBLIC_CONTRACT_ADDRESS` env variable. This is a **Post-MVP config task**, not an architecture rewrite.

---

### Audit Trails

A verifiable record of every vote transaction that anyone can independently verify.

**Status in this project:** ✅ Implemented.
Public page at `/verify` + `GET /api/audit/verify?txHash=0x...`. Voters receive a receipt email after voting with their transaction hash and a direct verify link.

---

## Data Persistence Model

The app uses **four storage layers**. They do **not** all behave the same when you stop `yarn dev`.

| Layer | Technology | What it stores | Survives dev server stop? |
| ----- | ---------- | -------------- | --------------------------- |
| App database | **MongoDB Atlas** (`MONGODB_URI` → `votingdapp`) | Orgs, elections metadata, voters, OTP, analytics, gas tx log, `ipfsCid` references | ✅ Yes |
| Audit / metadata archive | **Pinata IPFS** (`PINATA_JWT`) | Election JSON, candidate JSON, voter roster snapshots | ✅ Yes (cloud pins) |
| Candidate photos | **ImageKit CDN** | Uploaded candidate images | ✅ Yes (cloud CDN) |
| Vote ledger | **Hardhat local node** (`http://127.0.0.1:8545`) | Elections, votes, registrations, vote counts on-chain | ❌ No — in-memory chain resets |

### MongoDB (persistent)

- Connection: `lib/db.js` → `MONGODB_URI`
- Stores operational data the app queries every day
- Survives Next.js restarts and laptop reboots (if Atlas/local Mongo is running)
- **Does not** store on-chain vote counts — those live on the blockchain

### Pinata IPFS (persistent)

- Utility: `lib/ipfs.js` — `pinJSON()`, `pinFile()`, `getIPFSUrl()`, `fetchFromIPFS()`
- Pins are uploaded to Pinata's cloud pinning service → content stays on IPFS network
- Each pin gets a **CID** (content identifier); immutable content address
- MongoDB `Election.ipfsCid` stores the reference; API responses also return `ipfsUrl`
- **Requires:** `PINATA_JWT` in `.env` (optional `PINATA_GATEWAY` for custom gateway)
- **Free tier limits:** Pinata has storage/pin quotas — old pins remain until you unpin or account expires
- Pinning failures are logged as **non-fatal** — MongoDB + on-chain flow still works

### ImageKit (persistent)

- Candidate photo upload via `POST /api/imagekit/upload`
- Photo URLs stored on-chain in `Candidate.photoUrl`
- Survives restarts (cloud CDN)
- **Requires:** `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT`

### Hardhat local blockchain (NOT persistent)

- `yarn dev` starts a fresh in-memory chain and redeploys the contract
- All on-chain state (elections, votes, registrations) is **lost** when the Hardhat node stops
- MongoDB may still reference old `electionId`s → **split-brain** if chain resets but DB does not

### Recommended dev workflow (keep data)

```bash
# Terminal 1 — keep running (do not stop)
yarn hardhat:node

# Terminal 2 — only once, or when you want a clean chain
yarn deploy:proxy

# Terminal 3 — Next.js only (no redeploy)
yarn dev:next-only
```

### Recommended production persistence

| Component | Recommendation |
| --------- | -------------- |
| MongoDB | MongoDB Atlas (always on) |
| IPFS | Pinata paid/free tier with `PINATA_JWT` |
| Photos | ImageKit or migrate to IPFS `pinFile()` in v2 |
| Blockchain | Sepolia / Polygon testnet or mainnet — persistent chain |

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
         ├── MongoDB         → Voter records, elections, analytics, ipfsCid refs
         ├── Pinata IPFS     → Election/candidate/voter-list JSON audit pins
         ├── ImageKit CDN    → Candidate photos (centralized CDN)
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
| `POST /api/auth/verify-otp`                      | Verify OTP, cast vote, send receipt email |
| `GET /api/audit/verify`                          | Public vote verification by txHash      |
| `GET /api/elections/public`                      | Global public election ledger           |
| `GET /api/org/[slug]/elections/[id]/results`     | Org-scoped on-chain results             |
| `GET /api/relay/transactions`                    | Gas station history + analytics         |
| `POST /api/imagekit/upload`                      | Candidate photo upload to ImageKit      |
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
| `/vote/[slug]`    | Voter portal — live voting + published results |
| `/elections`      | Global public results ledger                   |
| `/verify`         | Public vote verification by txHash             |
| `/analytics`      | Real-time analytics dashboard                  |
| `/biometric`      | Face registration & verification               |
| `/connect-wallet` | Wallet connection page                         |
| `/admin`          | Guardian portal (approvals, gas, governance)    |
| `/admin-auth`     | Guardian authentication                        |
| `/elections/[id]` | Election detail + on-chain results             |

---

### ✅ IPFS / Pinata (Audit Metadata)

| Feature | Details |
| ------- | ------- |
| Pinata JSON pinning | `lib/ipfs.js` — election, candidate, voter-roster snapshots |
| CID storage | `Election.ipfsCid` in MongoDB + `ipfsUrl` in API responses |
| Non-fatal pinning | App continues if `PINATA_JWT` unset; logs warning only |
| Persistence | Pins survive dev restarts (cloud-hosted on Pinata/IPFS network) |
| Candidate photos | Still on ImageKit — `pinFile()` for images is v2 |

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

### 🟡 Post-MVP / v2 (Nice to have)

| Feature                          | Notes                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| IPFS for candidate photos        | JSON metadata pinned today; photos still on ImageKit CDN      |
| Real biometric (AWS Rekognition) | Replace simulated landmarks with real face recognition        |
| Digital Voter ID                 | Issue a cryptographic voter ID card post-registration         |
| Multi-chain deployment           | Polygon, Arbitrum — Hardhat config + env changes              |
| Layer-2 support                  | Lower gas costs — deploy on Polygon / Arbitrum Sepolia        |
| Verifiable decryption            | ZK-proof based vote tallying — research-grade                 |
| Cryptographic commitments        | Homomorphic encryption for votes — research-grade             |
| DID / Self-sovereign identity    | W3C DID, Polygon ID integration                               |
| Serverless edge functions        | Move analytics to Vercel Edge / Cloudflare Workers            |
| Skip-redeploy on `yarn dev`      | Optional: detect existing contract before redeploying         |

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
[x] 1. Relay vote API + OTP voting flow
[x] 2. End-to-end /vote/[slug] voter flow
[x] 3. Candidate photo upload (ImageKit)
[x] 4. Public election results (/elections, /vote/[slug] results tab)
[x] 5. /api/elections/public endpoint
[x] 6. Verify my vote page (/verify) + receipt email
[x] 7. Guardian governance UI (2-of-3 UUPS upgrades)
[x] 8. Gas station history + analytics on Guardian portal
[~] 9. Mobile UI polish (basic pass done; full QA optional)

MVP NICE-TO-HAVE (if time allows)
──────────────────────────────────
[ ] 10. IPFS pinFile for candidate photos (photos still on ImageKit)
[ ] 11. Skip-redeploy logic for yarn dev
[ ] 12. Sepolia testnet as default persistent chain
```

---

## Post-MVP / v2 Roadmap

```
v2 Features (After Research Paper Submission)
──────────────────────────────────────────────
[ ] Real biometric — AWS Rekognition or MediaPipe WASM
[ ] IPFS pinFile — candidate photos + binary documents on IPFS
[ ] Digital Voter ID — NFT or cryptographic certificate
[ ] Multi-chain — Polygon / Arbitrum deployment
[ ] ZK proofs — anonymous voter verification
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
| ImageKit CDN            | ✅      | ✅                          |
| Pinata IPFS (JSON pins) | ✅      | ✅ (metadata audit trail)   |
| Biometric (simulated)   | ✅      | ✅ (simulated)              |
| IPFS candidate photos   | 🔮 v2   | ❌ (ImageKit used instead)  |
| MetaMask / Wallet       | ✅      | ⚠️ Replaced by relay        |
| Aadhaar API             | ✅      | ❌ Dropped                  |
| Twilio OTP              | ✅      | ❌ Using Nodemailer instead |
| AWS Rekognition         | 🔮 v2   | ❌                          |
| Layer-2 / Polygon       | 🔮 v2   | ❌                          |
| ZK Proofs               | 🔮 v2   | ❌                          |

---

## Summary

> The project is **MVP-complete (~95%)** for research submission.
> Full pipeline works: org signup → election creation → guardian approval → voter CSV → on-chain registration → OTP voting → receipt email → public results → vote verification → gas analytics → guardian governance.
>
> **Data persistence:** MongoDB Atlas + Pinata IPFS + ImageKit survive dev restarts. The **local Hardhat blockchain does not** — use `dev:next-only` with a persistent node, or deploy to Sepolia for durable on-chain state.

---

_Report updated: July 2026_
_Project: Block Vote — Blockchain-Based Decentralized E-Voting System_
