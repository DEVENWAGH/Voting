'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, Shield, Zap, BarChart3, Users, Globe2,
  Building2, GraduationCap, Briefcase, Cpu, CheckCircle2, Vote
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const FEATURES = [
  {
    icon: Shield,
    title: 'Blockchain-Secured Votes',
    desc: 'Every vote is cryptographically signed and stored on-chain. Tamper-proof by design with zero single point of failure.',
  },
  {
    icon: Zap,
    title: 'Launch in Minutes',
    desc: 'Create your organization, set up an election, and invite voters. An intuitive interface requires no technical expertise.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Results',
    desc: 'Watch vote counts update live. Fully transparent public audit trails can be accessed by anyone, at any time.',
  },
  {
    icon: Users,
    title: 'Bulk Voter Management',
    desc: 'Import thousands of eligible voters via CSV. Automatic deduplication and on-chain registration occur instantly.',
  },
];

const ORG_TYPES = [
  { icon: GraduationCap, label: 'Universities' },
  { icon: Briefcase,     label: 'Companies' },
  { icon: Globe2,        label: 'Communities' },
  { icon: Building2,     label: 'Governments' },
  { icon: Cpu,           label: 'DAOs' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Register your org', desc: 'Sign up with your email and create your organization profile in under 2 minutes.' },
  { step: '02', title: 'Create an election', desc: 'Set a title, description, start and end time. Add candidates with full bios and symbols.' },
  { step: '03', title: 'Invite your voters', desc: 'Upload a CSV of eligible voters. The platform registers them securely on the blockchain.' },
  { step: '04', title: 'Collect votes & share results', desc: 'Voters cast ballots via secure links. Live results are public and verifiable.' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas text-ink overflow-x-hidden font-sans selection:bg-primary/20 selection:text-primary">
      
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-hairline bg-canvas/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Vote size={16} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight text-ink">Block Vote</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-body">
            <a href="#features" className="hover:text-ink transition">Features</a>
            <a href="#how-it-works" className="hover:text-ink transition">How it works</a>
            <Link href="/elections" className="hover:text-ink transition">Results</Link>
            <Link href="/verify" className="hover:text-ink transition">Verify Vote</Link>
            <Link href="/rules" className="hover:text-ink transition">Rules & Security</Link>
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

      {/* ── Hero (Dark Editorial Canvas) ────────────────────────────────── */}
      <section className="relative pt-24 pb-32 px-6 bg-surface-dark text-white overflow-hidden">
        {/* Abstract grids / glows to represent blockchain structure */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Text */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8 text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-primary text-xs font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Trusted Blockchain Infrastructure
            </div>

            <h1 className="text-5xl md:text-7xl font-display font-normal tracking-[-2px] leading-[1.0] text-white">
              Run Elections <br />
              <span className="text-primary">Your Way.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-soft max-w-lg leading-relaxed">
              Secure, transparent, and verifiable voting for modern organizations. 
              No crypto wallets required for voters. Just clean, trusted governance.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 bg-primary hover:bg-primary-active text-white font-semibold px-8 py-4 rounded-full text-base transition-all shadow-lg"
              >
                Create election free <ArrowRight size={18} />
              </Link>
              <Link
                href="/verify"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-white/40 bg-white/5 text-white font-semibold px-8 py-4 rounded-full text-base transition-all"
              >
                Verify vote
              </Link>
            </div>

            {/* Check marks */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-soft">
              {['No crypto required', 'Free to start', '100% on-chain proof'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right Layered Mockup Cards */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative h-[480px] hidden lg:block"
          >
            {/* Base Mockup Card */}
            <div className="absolute top-10 left-10 w-[420px] bg-surface-dark-elevated border border-white/5 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
                <div>
                  <h4 className="font-semibold text-white text-sm">Active Organization</h4>
                  <p className="text-xs text-muted-soft">Acme University Senate</p>
                </div>
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">Live</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-white">Student Body President</span>
                  <span className="text-xs text-primary font-mono">Voting phase</span>
                </div>
                <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-white">Total Eligible Voters</span>
                  <span className="text-xs text-white font-mono">1,480</span>
                </div>
                <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-white/5">
                  <span className="text-xs text-white">On-chain transaction</span>
                  <span className="text-xs text-muted-soft font-mono">0x71C...a3f9</span>
                </div>
              </div>
            </div>

            {/* Overlay Angled Card */}
            <motion.div 
              whileHover={{ y: -5, x: 5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="absolute top-36 left-48 w-[380px] bg-canvas border border-hairline rounded-xl p-6 shadow-2xl text-ink"
            >
              <div className="flex items-center justify-between border-b border-hairline pb-4 mb-4">
                <div>
                  <h4 className="font-semibold text-ink text-sm">Real-time Turnout</h4>
                  <p className="text-xs text-body">Live update via relayer</p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
              </div>
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-display font-normal text-ink font-mono">68.4%</span>
                  <span className="text-xs text-primary font-mono font-medium">+12.3% last hour</span>
                </div>
                {/* Visual bar */}
                <div className="h-2 w-full bg-surface-strong rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: '68%' }} />
                </div>
                <div className="flex justify-between text-xs text-body font-mono">
                  <span>1,012 votes cast</span>
                  <span>468 remaining</span>
                </div>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* ── Stats Strip (Soft Gray Elevated Band) ─────────────────────────── */}
      <div className="border-b border-hairline bg-surface-soft py-12">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '200+', label: 'Organizations' },
            { num: '50,000+', label: 'Votes Cast' },
            { num: '99.99%', label: 'Relayer Uptime' },
            { num: '0',     label: 'Security Breaches' },
          ].map(({ num, label }) => (
            <div key={label} className="space-y-1">
              <p className="text-3xl md:text-4xl font-mono font-medium text-ink tracking-tight">{num}</p>
              <p className="text-body text-xs uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features Section ──────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20 space-y-4">
          <p className="text-primary font-semibold text-xs uppercase tracking-wider">Features</p>
          <h2 className="text-3xl md:text-5xl font-display font-normal tracking-[-1.3px] text-ink">Institutional-grade security</h2>
          <p className="text-body max-w-lg mx-auto text-base">Built to support high-stakes elections with the cryptographic assurance of blockchain governance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              key={title}
              className="bg-canvas border border-hairline rounded-xl p-8 hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center mb-6 text-primary">
                <Icon size={20} />
              </div>
              <h3 className="text-ink font-semibold text-lg mb-3">{title}</h3>
              <p className="text-body leading-relaxed text-sm">{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Organization Types Band (Monochromatic Grid) ────────────────────── */}
      <section className="py-20 border-t border-b border-hairline bg-surface-soft px-6">
        <div className="max-w-5xl mx-auto text-center space-y-10">
          <h2 className="text-2xl font-display font-normal text-ink">Supports any organization structure</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {ORG_TYPES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-canvas border border-hairline hover:border-body transition cursor-default shadow-sm"
              >
                <Icon size={18} className="text-primary" />
                <span className="text-ink font-semibold text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works Section ──────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-20 space-y-4">
          <p className="text-primary font-semibold text-xs uppercase tracking-wider">Workflow</p>
          <h2 className="text-3xl md:text-5xl font-display font-normal tracking-[-1.3px] text-ink">Simple setup process</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div key={step} className="space-y-4">
              <span className="text-4xl font-mono font-medium text-primary/30 block">{step}</span>
              <h3 className="text-ink font-semibold text-base">{title}</h3>
              <p className="text-body text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pre-footer Banner ──────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-t border-hairline bg-surface-soft">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-display font-normal tracking-[-1.3px] text-ink leading-tight">
            Take control of your organization&apos;s governance
          </h2>
          <p className="text-body max-w-md mx-auto text-sm">
            Create an account in 2 minutes. Launch elections, invite candidates, and register eligible voters on-chain.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center bg-primary hover:bg-primary-active text-white font-semibold px-8 py-4.5 rounded-full text-base transition-all"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center bg-surface-strong hover:bg-hairline text-ink font-semibold px-8 py-4.5 rounded-full text-base transition-all"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-hairline bg-canvas py-16 px-6 text-sm text-body">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-hairline pb-12 mb-12">
          
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Vote size={12} className="text-white" />
            </div>
            <span className="font-bold text-ink text-base">Block Vote</span>
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
