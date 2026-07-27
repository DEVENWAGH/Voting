'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Shield, WifiOff, AlertTriangle, Fingerprint, Key,
  Lock, Network, Smartphone, EyeOff, Vote, CheckCircle2, ArrowRight,
  ShieldCheck, RefreshCw, ChevronRight, HelpCircle
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const TABS = [
  {
    id: 'security',
    label: 'Cryptographic Security',
    icon: Shield,
    tagline: 'Institutional-grade cryptographic safeguards enforcing absolute voter privacy and integrity.',
  },
  {
    id: 'offline',
    label: 'Offline Voting (No Internet)',
    icon: WifiOff,
    tagline: 'Bridging the digital divide in remote areas through decentralized mesh caching and offline QR payloads.',
  },
  {
    id: 'coercion',
    label: 'Coercion & Threat Resiliency',
    icon: AlertTriangle,
    tagline: 'Protecting democratic choices in high-threat, intimidated, or gangster-controlled environments.',
  },
];

const SECURITY_RULES = [
  {
    title: 'One-Way Cryptographic Nullifiers',
    icon: Key,
    desc: 'Each eligible voter maps to a unique, salted hash computed server-side: NullifierHash = keccak256(orgSlug || email || serverSecret). This acts as a single-use ticket on the Ethereum blockchain. It is mathematically impossible to link a nullifier back to a real email address, ensuring absolute anonymity while preventing duplicate voting.',
    details: [
      'Stored as bytes32 on-chain to ensure collision resistance.',
      'Salted with a secure server-side secret.',
      'Prevents linkage between a voter\'s identity and their selected candidate.'
    ]
  },
  {
    title: 'Biometric Sybil Defense & Liveness Verification',
    icon: Fingerprint,
    desc: 'Before a vote is relayed, the voter must perform a 3D facial liveness check. An AWS Rekognition facial similarity comparison verifies the selfie against their registered face and cross-compares it with the faces of all users who have already voted in the active election. If a similarity >= 85% is detected on another cast ballot, the transaction is rejected.',
    details: [
      'Checks for head rotation, lighting, and blink detection.',
      'Face parameters normalized locally to prevent camera distance bias.',
      'De-duplicates voters to block Sybil attacks using multiple email aliases.'
    ]
  },
  {
    title: '2-of-3 Guardian Upgrade Governance',
    icon: ShieldCheck,
    desc: 'To eliminate administrative centralization, all core smart contract upgrades require on-chain multi-signature approval. The Voting contract follows the UUPS proxy standard, where logic upgrades cannot be finalized unless at least two of the three independent Guardian public addresses sign the co-proposal.',
    details: [
      'Enforced directly within the Solidity _authorizeUpgrade execution path.',
      'Guardian actions are public and logged on the blockchain ledger.',
      'Guarantees that no single administrator can change the voting rules mid-election.'
    ]
  }
];

const OFFLINE_RULES = [
  {
    title: 'Decentralized Mesh-Pi Local Nodes',
    icon: Network,
    desc: 'In villages or voting centers without cellular/broadband connection, physical, battery-powered local Raspberry Pi servers are deployed. These local servers host a lightweight localized cache node that authenticates voters locally and registers encrypted votes.',
    details: [
      'Can operate continuously for up to 48 hours on battery backups.',
      'Uses local WiFi-hotspot mesh networks to connect devices within 100m.',
      'Ensures vote logging occurs locally even in absolute isolation.'
    ]
  },
  {
    title: 'Offline-Signed Cryptographic QR & SMS Payloads',
    icon: Smartphone,
    desc: 'Voters construct their ballot locally on a mobile device or a local offline terminal. The device performs offline cryptographic signing, producing an encrypted payload compiled into a high-density QR code. Election officials scan this QR code or transmit the raw text payload via basic cell network channels (SMS/USSD) to an internet-enabled base station.',
    details: [
      'No active cellular data or internet needed for voter devices.',
      'Payloads are compressed to fit into standard 160-character SMS structures.',
      'Tamper-proof on-chain verification checks the payload signature upon receipt.'
    ]
  },
  {
    title: 'Encrypted NFC Smart Keycards',
    icon: Lock,
    desc: 'Voters receive pre-registered, low-cost NFC/RFID smart cards containing custom-baked asymmetric keypairs. To vote, the card is tapped against an offline kiosk. A local facial matching scan verifies the voter, and the card\'s key signs the vote payload, caching it in the card\'s secure sector and the booth\'s memory.',
    details: [
      'Card chips use secure, write-once storage to prevent clone tampering.',
      'Booth synchronizes cached transactions once physical storage is transported to base.',
      'Protects voting access in regions without any personal device ownership.'
    ]
  }
];

const COERCION_RULES = [
  {
    title: 'Epoch-Based Re-Voting (Last Vote Counts)',
    icon: RefreshCw,
    desc: 'In areas where gang members physically intimidate voters or stand over their shoulders, the system allows voters to cast multiple ballots during the voting window. However, only the last cast vote is finalized. A coerced voter can vote under duress at a public booth and later overwrite it privately from a secure location.',
    details: [
      'Nullifier matches the previous vote and updates the index on-chain.',
      'Invalidates coerced ballots silently and securely.',
      'Discourages vote-buying since coercers can never confirm if the vote remained unchanged.'
    ]
  },
  {
    title: 'Duress OTP & Face Gestures',
    icon: EyeOff,
    desc: 'If forced to authenticate at gunpoint or under threat, a voter can input a predefined "Duress OTP" or blink in a specific biometric sequence. The interface mimics a successful vote casting to the attacker, but the system silently registers a zero-weight or dummy ballot, raising a silent flag to election guardians.',
    details: [
      'Maintains the identical UI flow to protect the voter\'s immediate physical safety.',
      'Applies a zero-multiplier to the ballot in the smart contract.',
      'Triggers real-time security alerts on the Guardian dashboard.'
    ]
  },
  {
    title: 'Zero-Knowledge Receipts',
    icon: CheckCircle2,
    desc: 'The system issues a receipt showing that a ballot has been successfully included in a block, allowing the voter to verify that their vote was counted. Crucially, the receipt contains no information about which candidate was selected, eliminating any physical proof that coercers could demand.',
    details: [
      'Voters verify their vote status using transaction hashes on the ledger.',
      'Protects against sell-your-vote schemes by making candidate choice unverifiable to outsiders.',
      'Bridges the gap between complete auditability and absolute ballot secrecy.'
    ]
  }
];

export default function RulesPage() {
  const [activeTab, setActiveTab] = useState('security');

  const getRulesData = () => {
    switch (activeTab) {
      case 'security':
        return SECURITY_RULES;
      case 'offline':
        return OFFLINE_RULES;
      case 'coercion':
        return COERCION_RULES;
      default:
        return SECURITY_RULES;
    }
  };

  const getTabLabel = () => {
    return TABS.find((t) => t.id === activeTab)?.label || '';
  };

  const getTabTagline = () => {
    return TABS.find((t) => t.id === activeTab)?.tagline || '';
  };

  return (
    <div className="min-h-screen bg-canvas text-ink overflow-x-hidden font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Vote size={16} className="text-white" />
              </div>
              <span className="text-lg font-black tracking-tight text-ink">Block Vote</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-body">
            <Link href="/" className="hover:text-ink transition">Home</Link>
            <Link href="/elections" className="hover:text-ink transition">Results</Link>
            <Link href="/verify" className="hover:text-ink transition">Verify Vote</Link>
            <Link href="/rules" className="text-primary font-semibold hover:text-primary-active transition">Rules & Security</Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login" className="text-sm font-semibold text-body hover:text-ink px-4 py-2 transition">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-semibold px-5 py-2.5 rounded-full bg-primary hover:bg-primary-active text-white transition-all shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Segment (Dark Editorial) ─────────────────────────────────── */}
      <section className="relative pt-20 pb-24 px-6 bg-surface-dark text-white overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-soft hover:text-white transition bg-white/5 border border-white/10 px-3 py-1.5 rounded-full font-medium"
          >
            <ArrowLeft size={12} /> Back to Homepage
          </Link>
          
          <h1 className="text-4xl md:text-6xl font-display font-normal tracking-[-1.5px] leading-tight text-white animate-fade-in">
            Rules, Regulations & <br />
            <span className="text-primary">High-Security Protocols</span>
          </h1>
          
          <p className="text-base md:text-lg text-muted-soft max-w-2xl mx-auto leading-relaxed">
            Democratic processes require maximum trust. Block Vote implements cutting-edge cryptographic structures, offline synchronization models, and anti-coercion layers to protect every voter.
          </p>
        </div>
      </section>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <section className="border-b border-hairline bg-surface-soft py-6 sticky top-[64px] z-40">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row gap-2 border-b border-hairline/60 pb-2">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center justify-center sm:justify-start gap-2.5 px-4 py-3 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'text-primary bg-primary/5 border border-primary/20 shadow-sm'
                      : 'text-body hover:text-ink hover:bg-canvas/50 border border-transparent'
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="activeRuleTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full hidden sm:block"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Rules Display ──────────────────────────────────────────────────── */}
      <section className="py-16 max-w-4xl mx-auto px-6">
        <div className="mb-10 space-y-2">
          <h2 className="text-2xl font-display font-normal text-ink">{getTabLabel()}</h2>
          <p className="text-body text-sm leading-relaxed max-w-2xl">{getTabTagline()}</p>
        </div>

        <div className="space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {getRulesData().map((rule, idx) => {
                const RuleIcon = rule.icon;
                return (
                  <div
                    key={rule.title}
                    className="bg-canvas border border-hairline rounded-xl p-6 md:p-8 hover:shadow-md transition-shadow relative overflow-hidden group"
                  >
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 rounded-full bg-surface-strong text-primary flex items-center justify-center shrink-0">
                        <RuleIcon size={22} />
                      </div>
                      
                      <div className="space-y-4 w-full">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono text-primary font-bold tracking-widest uppercase">Protocol 0{idx + 1}</span>
                            <span className="w-1 h-1 rounded-full bg-hairline" />
                            <span className="text-[10px] font-mono text-muted uppercase">Ready for Deploy</span>
                          </div>
                          <h3 className="text-ink font-semibold text-lg md:text-xl mt-1">{rule.title}</h3>
                        </div>

                        <p className="text-body text-sm leading-relaxed font-normal">
                          {rule.desc}
                        </p>

                        <div className="bg-surface-soft p-4 rounded-lg border border-hairline">
                          <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-primary" /> Key Integrity Checks
                          </h4>
                          <ul className="space-y-1.5">
                            {rule.details.map((detail, dIdx) => (
                              <li key={dIdx} className="text-xs text-body flex items-start gap-2">
                                <span className="font-mono text-primary font-bold mt-0.5">•</span>
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ── Real World Integration FAQ ───────────────────────────────────────── */}
      <section className="border-t border-hairline bg-surface-soft py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-display font-normal text-ink">System Deployment & FAQs</h2>
            <p className="text-body text-sm max-w-md mx-auto">Answers to critical questions regarding the implementation and verification of this voting architecture.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-canvas border border-hairline rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <HelpCircle size={16} className="text-primary shrink-0" />
                How are gangster-controlled locations physically protected?
              </h3>
              <p className="text-body text-xs leading-relaxed">
                Besides digital protections (like dummy votes and re-voting), physical booths in high-risk zones use armored, portable voting kiosks. These kiosks require active 3D face liveness checks, meaning gangs cannot submit photos, videos, or pre-recorded biometric details of citizens. Real-time GPS and network heartbeat monitoring automatically alert central authorities if a kiosk is tampered with or moved.
              </p>
            </div>

            <div className="bg-canvas border border-hairline rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <HelpCircle size={16} className="text-primary shrink-0" />
                What happens to data when an offline booth syncs?
              </h3>
              <p className="text-body text-xs leading-relaxed">
                When an offline booth is brought back to a location with internet access, the cached block of vote payloads is uploaded to the Next.js backend server. The backend validates each transaction signature on the server, verifies that the voter nullifiers have not already cast votes on-chain, and passes them to the smart contract relayer queue for serialized, collision-free writing onto the Ethereum ledger.
              </p>
            </div>

            <div className="bg-canvas border border-hairline rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <HelpCircle size={16} className="text-primary shrink-0" />
                Is the biometric data stored on the public blockchain?
              </h3>
              <p className="text-body text-xs leading-relaxed">
                No. To preserve absolute privacy, raw images and biometric ratios are never recorded on the public ledger. Facial comparisons are executed off-chain inside secure server-side API environments. Only the hashed metadata CID (IPFS) and the cryptographically secure Nullifier Hash are stored on-chain to block Sybil attacks.
              </p>
            </div>

            <div className="bg-canvas border border-hairline rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-ink text-base flex items-center gap-2">
                <HelpCircle size={16} className="text-primary shrink-0" />
                Can a voter verify their vote was counted?
              </h3>
              <p className="text-body text-xs leading-relaxed">
                Yes. After voting, voters receive a transaction hash via email (or a printed receipt in offline areas). By visiting the <Link href="/verify" className="text-primary hover:underline">/verify</Link> page, they can query the blockchain directly. The interface fetches the transaction data, confirming the block number, timestamp, and that their nullifier was registered, without exposing their ballot choices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pre-footer Banner ──────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-hairline bg-canvas">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-display font-normal tracking-[-1.3px] text-ink leading-tight">
            Ready to integrate Block Vote?
          </h2>
          <p className="text-body max-w-md mx-auto text-sm">
            Launch elections with institutional-grade cryptographic protections. Protect voter freedoms anywhere, anytime.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold px-8 py-3.5 rounded-full text-sm transition-all"
            >
              Get started free <ArrowRight size={14} />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center bg-surface-strong hover:bg-hairline text-ink font-semibold px-8 py-3.5 rounded-full text-sm transition-all"
            >
              Explore platform
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-hairline bg-surface-soft py-16 px-6 text-sm text-body">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-hairline pb-12 mb-12">
          
          <div className="flex items-center gap-2.5">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                <Vote size={12} className="text-white" />
              </div>
              <span className="font-bold text-ink text-base">Block Vote</span>
            </Link>
          </div>

          <div className="flex md:justify-center gap-6">
            <Link href="/elections" className="hover:text-ink transition">Public Results</Link>
            <Link href="/verify" className="hover:text-ink transition">Verify Ballots</Link>
            <Link href="/admin-auth" className="hover:text-ink transition">Guardian Portal</Link>
            <Link href="/rules" className="hover:text-ink transition">Rules & Security</Link>
          </div>

          <div className="flex md:justify-end gap-4 text-xs text-muted">
            <span>Secured by Ethereum</span>
            <span>·</span>
            <span>Relayed transactions</span>
          </div>

        </div>

        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs text-muted gap-4">
          <p>© {new Date().getFullYear()} Block Vote. All rights reserved. Coinbase platform design analysis implementation.</p>
          <p>Institutional Cryptographic Voting Systems v1.0.0</p>
        </div>
      </footer>

    </div>
  );
}
