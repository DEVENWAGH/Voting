import Link from 'next/link';
import {
  ArrowRight, Shield, Zap, BarChart3, Users, Globe2,
  Building2, GraduationCap, Briefcase, Cpu, CheckCircle2, Vote
} from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.15)',
    title: 'Blockchain-Secured Votes',
    desc: 'Every vote is cryptographically signed and stored on-chain. Tamper-proof by design — no single point of failure.',
  },
  {
    icon: Zap,
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.15)',
    title: 'Launch in Minutes',
    desc: 'Create your organization, set up an election, and invite voters. No technical knowledge required.',
  },
  {
    icon: BarChart3,
    color: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
    title: 'Real-Time Results',
    desc: 'Watch vote counts update live. Fully transparent audit trail accessible by anyone, anytime.',
  },
  {
    icon: Users,
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.15)',
    title: 'Bulk Voter Management',
    desc: 'Import thousands of eligible voters via CSV. Automatic deduplication and on-chain registration.',
  },
];

const ORG_TYPES = [
  { icon: GraduationCap, label: 'Universities',  color: '#6366f1' },
  { icon: Briefcase,     label: 'Companies',      color: '#06b6d4' },
  { icon: Globe2,        label: 'Communities',    color: '#10b981' },
  { icon: Building2,     label: 'Governments',    color: '#f59e0b' },
  { icon: Cpu,           label: 'DAOs',           color: '#ec4899' },
];

const HOW_IT_WORKS = [
  { step: '01', title: 'Register your org', desc: 'Sign up with your email and create your organization profile in under 2 minutes.' },
  { step: '02', title: 'Create an election', desc: 'Set a title, description, start and end time. Add candidates with full bios and photos.' },
  { step: '03', title: 'Invite your voters', desc: 'Upload a CSV of eligible voters. The platform registers them securely on the blockchain.' },
  { step: '04', title: 'Collect votes & share results', desc: 'Voters cast ballots via a one-time secure link. Live results are public and verifiable.' },
];

export const metadata = {
  title: 'Block Vote — Blockchain Voting for Organizations',
  description: 'Run secure, transparent elections for your college, company, DAO or community. Powered by Ethereum. No crypto knowledge needed.',
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white overflow-x-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Vote size={16} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">Block Vote</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how-it-works" className="hover:text-white transition">How it works</a>
            <a href="#who-uses-it" className="hover:text-white transition">For who</a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-lg transition">
              Sign in
            </Link>
            <Link href="/signup" className="text-sm font-bold px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 transition shadow-lg shadow-indigo-950/50">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-32 px-6 text-center overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-violet-600/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-cyan-600/6 rounded-full blur-[100px] pointer-events-none" />

        {/* Grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/25 bg-indigo-950/40 text-indigo-300 text-xs font-semibold uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            Trusted by 200+ Organizations Worldwide
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Run Elections
            </span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Your Way.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed">
            Secure, transparent, and verifiable voting for colleges, companies, communities and DAOs.
            No crypto wallets needed for your voters. Just simple, trustworthy elections.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              id="hero-cta-signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold px-8 py-4 rounded-2xl text-base transition shadow-2xl shadow-indigo-950/60"
            >
              Start for free <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              id="hero-cta-signin"
              className="inline-flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 text-white font-semibold px-8 py-4 rounded-2xl text-base transition backdrop-blur"
            >
              Sign in to dashboard
            </Link>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
            {['No crypto wallet required', 'Free to start', 'Blockchain-verified'].map(t => (
              <div key={t} className="flex items-center gap-2 text-slate-400 text-sm">
                <CheckCircle2 size={15} className="text-indigo-400 shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <div className="border-y border-white/5 bg-white/[0.02] py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: '200+', label: 'Organizations' },
            { num: '50K+', label: 'Votes Cast' },
            { num: '99.9%', label: 'Uptime' },
            { num: '0',     label: 'Hacks Ever' },
          ].map(({ num, label }) => (
            <div key={label}>
              <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">{num}</p>
              <p className="text-slate-500 text-sm mt-1 font-medium">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-indigo-400 font-semibold text-sm uppercase tracking-widest">Why Aegis</p>
            <h2 className="text-4xl md:text-5xl font-black text-white">Everything you need</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Built for real organizations that need real elections — with the security of blockchain and the simplicity of a web app.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map(({ icon: Icon, color, glow, title, desc }) => (
              <div
                key={title}
                className="group relative bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm"
                style={{ boxShadow: `0 0 0 0 transparent` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: glow, border: `1px solid ${color}30` }}
                >
                  <Icon size={22} style={{ color }} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who uses it ────────────────────────────────────────────────────── */}
      <section id="who-uses-it" className="py-20 px-6 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <p className="text-indigo-400 font-semibold text-sm uppercase tracking-widest">Built for everyone</p>
            <h2 className="text-4xl font-black text-white">Who uses Block Vote?</h2>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {ORG_TYPES.map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-600 transition cursor-default"
              >
                <Icon size={20} style={{ color }} />
                <span className="text-white font-semibold text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <p className="text-indigo-400 font-semibold text-sm uppercase tracking-widest">Simple process</p>
            <h2 className="text-4xl md:text-5xl font-black text-white">Up and running in 4 steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, desc }, idx) => (
              <div key={step} className="relative">
                {idx < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-indigo-500/40 to-transparent z-0 -translate-y-1/2" style={{ width: 'calc(100% - 2rem)', left: '80%' }} />
                )}
                <div className="relative bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-3 hover:border-indigo-500/30 transition">
                  <div className="w-12 h-12 rounded-xl bg-indigo-950/80 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-sm">
                    {step}
                  </div>
                  <h3 className="text-white font-bold">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-indigo-500/20 p-12 text-center space-y-6"
            style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(6,182,212,0.06) 100%)' }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="relative space-y-6">
              <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                Ready to run your<br />
                <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">first election?</span>
              </h2>
              <p className="text-slate-400 max-w-md mx-auto">Create your organization in 2 minutes. No credit card required.</p>
              <Link
                href="/signup"
                id="bottom-cta-signup"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold px-10 py-4 rounded-2xl text-base transition shadow-2xl shadow-indigo-950/60"
              >
                Create free account <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Vote size={12} className="text-white" />
            </div>
            <span className="font-semibold text-slate-400">Block Vote</span>
          </div>
          <p>© {new Date().getFullYear()} Block Vote · Blockchain-secured elections for modern organizations</p>
          <div className="flex gap-4">
            <Link href="/admin-auth" className="hover:text-slate-300 transition text-xs">Guardian Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
