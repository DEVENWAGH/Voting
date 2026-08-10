# BlockVote Threat Model

> **Version**: 1.0  
> **Last Updated**: August 2026  
> **Status**: Active

## Security Properties

| Property | Goal | Implementation Status |
|----------|------|----------------------|
| **Eligibility** | Only authorized voters can vote | ✅ Email lookup + on-chain registration + biometric |
| **One-person-one-vote** | Voter cannot vote twice | ✅ On-chain nullifier + preflight cache |
| **Vote secrecy** | Nobody can learn who the voter selected | 🟡 Server sees plaintext candidateId (P2 improvement) |
| **Vote integrity** | Nobody can modify a submitted vote | ✅ Blockchain immutability |
| **Coercion resistance** | Voter cannot easily prove how they voted | 🟡 Receipt email no longer reveals candidate (P0 done), re-voting not yet supported |
| **Receipt-freeness** | No useful "proof" of vote choice | ✅ Email receipt and audit endpoint no longer expose candidate choice |
| **Device security** | Malware shouldn't easily steal the vote | ⚠️ Browser is outside the trust boundary |
| **Network privacy** | Network observer shouldn't correlate voter → candidate | ❌ No privacy relay / mixnet |
| **Blockchain integrity** | Nobody can alter the election record | ✅ Smart contract + multi-sig governance |
| **Availability** | Attackers cannot easily take the election offline | 🟡 Rate limiting added, no DDoS infrastructure |
| **Auditability** | Anyone authorized can verify election correctness | ✅ Public audit explorer + blockchain events |
| **Admin separation** | One admin cannot control entire election | ✅ 2-of-3 guardian multi-sig |

---

## Threat Actors

### A1 — Malicious Voter
**Goal**: Double vote, fake credentials, replay attack.  
**Mitigations**:
- On-chain `hasVoted` mapping prevents duplicate votes
- Nullifier hash computed server-side with `SERVER_IDENTITY_SECRET`
- OTP is bcrypt-hashed with 3-attempt limit and 5-min TTL
- Biometric face verification via AWS Rekognition

### A2 — Coercer (Physical)
**Goal**: Observe screen, force candidate selection, demand proof.  
**Mitigations**:
- ✅ Receipt email does NOT contain candidate name
- ✅ Audit endpoint does NOT expose candidate choice
- ❌ Re-voting not yet supported (planned for VotingV3)
- ❌ No deniable credentials

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
- ✅ VoteActivity no longer stores `voterNullifier` — breaks voter→vote correlation
- ✅ VoteActivity no longer stores `voterLocation` — removes GPS metadata leak
- ⚠️ Server still sees plaintext `candidateId` during vote casting (requires client-side encryption to fix)
- OTP is bcrypt-hashed, never stored in plaintext

### A5 — Blockchain Attacker
**Goal**: Modify ledger, censor transactions, manipulate consensus.  
**Mitigations**:
- UUPS upgradeable proxy with 2-of-3 guardian gate
- Phase transitions enforced by smart contract
- Candidate list locked after voting starts
- ⚠️ Currently single node — decentralization needed for production

### A6 — Network Attacker
**Goal**: MITM, traffic analysis, timing correlation.  
**Mitigations**:
- HTTPS/TLS enforced (HSTS header added)
- ❌ No privacy relay or mixnet — IP visible to server
- ❌ No timing obfuscation

### A7 — Compromised Device
**Goal**: Screen capture, keylogging, malicious browser extension.  
**Mitigations**:
- ⚠️ Browser is explicitly outside the trust boundary
- CSP headers restrict script sources
- iframe embedding blocked (X-Frame-Options: DENY)
- Camera permissions restricted to self only

### A8 — Colluding Administrators
**Goal**: Identity server + voting server to reconstruct Voter → Vote.  
**Mitigations**:
- ❌ Currently a single-server architecture — identity and voting not separated
- ✅ VoteActivity no longer stores nullifier, reducing correlation surface

---

## Trust Boundary

```
┌─────────────────────────────────────────────────┐
│                TRUSTED                           │
│                                                  │
│  Smart Contract (on-chain enforcement)           │
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

## Known Limitations

1. **The server can read votes**: The relay server receives plaintext `candidateId`. A compromised server operator can see all votes. This requires client-side encryption (Level 2) to fix.

2. **No re-voting**: If a voter is coerced, they cannot change their vote later. The `hasVoted` flag is a permanent boolean. VotingV3 should support re-voting.

3. **Single blockchain node**: The system currently runs against a single RPC endpoint. A compromised node could censor transactions.

4. **Same database for identity and votes**: While `VoteActivity` no longer stores `voterNullifier`, both `Voter` (with email) and `VoteActivity` (with candidateId) are in the same MongoDB instance. A database compromise exposes both.

5. **Blockchain events leak candidateId**: The `VoteCast` event includes `candidateId`. This cannot be fixed without a contract upgrade (VotingV3).

---

## Disclaimer

> Blockchain provides tamper-evident, consensus-backed election records, but voter privacy and coercion resistance require additional cryptographic and system-level mechanisms beyond what blockchain alone offers. BlockVote v1 implements foundational security (Level 1) and privacy hardening, but does not yet implement anonymous credentials, zero-knowledge eligibility proofs, homomorphic tallying, or verifiable shuffles.
