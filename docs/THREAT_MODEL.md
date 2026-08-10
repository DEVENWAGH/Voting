# BlockVote Threat Model

> **Version**: 2.0  
> **Last Updated**: August 2026  
> **Status**: Active (VotingV3 Ready)

## Security Properties

| Property | Goal | Implementation Status |
|----------|------|----------------------|
| **Eligibility** | Only authorized voters can vote | ✅ Email lookup + on-chain registration + biometric |
| **One-person-one-vote** | Voter cannot vote twice | ✅ On-chain nullifier + preflight cache (re-vote replaces previous choice) |
| **Vote secrecy** | Nobody can learn who the voter selected | 🟡 Smart contract event is private (`VoteCastPrivate`), but relay server sees plaintext `candidateId` during submission |
| **Vote integrity** | Nobody can modify a submitted vote | ✅ Blockchain immutability + smart contract validation |
| **Coercion resistance** | Voter cannot easily prove how they voted | ✅ Re-voting supported in VotingV3 (`castVoteRelayedV3`), receipt email strips candidate name |
| **Receipt-freeness** | No useful "proof" of vote choice | ✅ Email receipt and public audit endpoint do NOT expose candidate choice |
| **Device security** | Malware shouldn't easily steal the vote | ⚠️ Browser is outside the trust boundary; shoulder-surfing blur protection added |
| **Network privacy** | Network observer shouldn't correlate voter → candidate | ❌ No privacy relay / mixnet |
| **Blockchain integrity** | Nobody can alter the election record | ✅ Smart contract + 2-of-3 guardian multi-sig governance |
| **Availability** | Attackers cannot easily take the election offline | 🟡 Rate limiting added (`lib/rateLimit.js`), AWS / standalone deployment options documented |
| **Auditability** | Anyone authorized can verify election correctness | ✅ Public audit explorer + `ballotHash` emission in VotingV3 |
| **Admin separation** | One admin cannot control entire election | ✅ 2-of-3 guardian multi-sig for contract upgrades |

---

## Threat Actors

### A1 — Malicious Voter
**Goal**: Double vote, fake credentials, replay attack.  
**Mitigations**:
- On-chain `hasVoted` and `voteChoice` mapping track voter state
- Nullifier hash computed server-side with `SERVER_IDENTITY_SECRET`
- OTP is bcrypt-hashed with 3-attempt limit and 5-min TTL
- Biometric face verification via AWS Rekognition

### A2 — Coercer (Physical / Observational)
**Goal**: Observe screen, force candidate selection, demand proof.  
**Mitigations**:
- ✅ **Re-voting Supported (VotingV3)**: Voter can re-vote privately later; only the latest choice counts in the final tally
- ✅ **Shoulder-Surfing Blur**: Selected candidate is blurred during OTP entry; tap-to-reveal
- ✅ **Receipt-freeness**: Email receipt and `/api/audit/verify` do NOT contain candidate name or ID
- ❌ No deniable credentials or fake PIN system yet (Level 3 recommendation)

### A3 — Malicious Administrator
**Goal**: Change candidates, modify votes, decrypt votes, alter tally.  
**Mitigations**:
- 2-of-3 guardian multi-sig for contract upgrades
- Guardian approval gate for elections going live
- Election configuration committed to blockchain (immutable after creation)
- IPFS pinning of election metadata

### A4 — Compromised Backend
**Goal**: Link identities to ballots, modify ballots, steal credentials.  
**Mitigations**:
- ✅ `VoteActivity` no longer stores `voterNullifier` — breaks DB voter→vote correlation
- ✅ `VoteActivity` no longer stores `voterLocation` — removes GPS metadata leak
- ⚠️ Server still sees plaintext `candidateId` during vote submission (requires client-side homomorphic/ballot encryption to fix)
- OTP is bcrypt-hashed, never stored in plaintext

### A5 — Blockchain Attacker
**Goal**: Modify ledger, censor transactions, manipulate consensus.  
**Mitigations**:
- UUPS upgradeable proxy with 2-of-3 guardian gate
- Phase transitions enforced by smart contract
- Candidate list locked after voting starts
- `VoteCastPrivate` event emits `ballotHash` instead of plaintext `candidateId`

### A6 — Network Attacker
**Goal**: MITM, traffic analysis, timing correlation.  
**Mitigations**:
- HTTPS/TLS enforced (HSTS header added)
- Stricter CSP headers on voting paths
- ❌ No privacy relay or mixnet — IP visible to application server

### A7 — Compromised Device
**Goal**: Screen capture, keylogging, malicious browser extension.  
**Mitigations**:
- ⚠️ Browser is explicitly outside the trust boundary
- CSP headers restrict script sources
- iframe embedding blocked (`X-Frame-Options: DENY`)
- Camera permissions restricted to self only

### A8 — Colluding Administrators
**Goal**: Identity server + voting server to reconstruct Voter → Vote.  
**Mitigations**:
- ❌ Single-server architecture — identity and voting currently run on same application server
- ✅ `VoteActivity` no longer stores nullifier, reducing correlation surface

---

## Trust Boundary

```
┌─────────────────────────────────────────────────┐
│                TRUSTED                           │
│                                                  │
│  Smart Contract (on-chain enforcement, V3)       │
│  Blockchain Network (immutable record)           │
│  Guardian Multi-sig (2-of-3)                     │
│  Server-side cryptographic operations            │
│  (nullifier computation, OTP hashing, JWT)       │
│                                                  │
├─────────────────────────────────────────────────┤
│             PARTIALLY TRUSTED                    │
│                                                  │
│  Application Server (sees plaintext candidateId) │
│  MongoDB (identity + vote data, separated at     │
│    field level but same database)                 │
│  Relay Wallet (single key, non-threshold)        │
│                                                  │
├─────────────────────────────────────────────────┤
│              UNTRUSTED                           │
│                                                  │
│  Voter's Browser / Device                        │
│  Network between voter and server                │
│  Third-party services (Resend, AWS, Pinata)      │
│  Physical environment around the voter           │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Current Known Limitations & Future Roadmap

1. **Relay sees candidateId**: The server receives plaintext `candidateId` during submission. Homomorphic / client-side encryption is needed to fully resolve this (Level 3).
2. **Single RPC node**: The system connects to a single RPC endpoint. Multi-provider RPC fallback or decentralized validator set recommended for production.
3. **Single database instance**: `Voter` (identity) and `VoteActivity` (anonymized votes) reside in the same MongoDB cluster, though unlinked at the schema level.
4. **Physical environment observation**: While UI blurring and re-voting mitigate physical coercion, a physical camera/observer looking at the screen during candidate selection remains outside cryptographic control.

---

## Disclaimer

> Blockchain provides tamper-evident, consensus-backed election records, but voter privacy and coercion resistance require additional cryptographic and system-level mechanisms beyond what blockchain alone offers. BlockVote v3 implements foundational privacy hardening, receipt-freeness, shoulder-surfing protection, and re-voting coercion resistance.

