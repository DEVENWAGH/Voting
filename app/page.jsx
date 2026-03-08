import Link from 'next/link';
import { ArrowRight, Shield, Eye, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      
      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-between px-8 md:px-20 py-20 gap-12">
        <div className="max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 bg-green-900/30 border border-green-800 text-green-400 text-sm px-3 py-1 rounded-full">
            <span>Powered by Ethereum</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight">
            Decentralized{' '}
            <span className="text-green-400">Voting</span>{' '}
            for Everyone
          </h1>
          <p className="text-gray-300 text-lg leading-relaxed">
            Secure, transparent, and fair elections powered by blockchain technology.
            Register as a voter, cast your ballot securely, and see results in real time — all on-chain.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/connect-wallet"
              className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 px-6 py-3 rounded-xl text-lg font-semibold transition shadow-lg shadow-green-900/40"
            >
              Start Voting <ArrowRight size={20} />
            </Link>
            <Link
              href="/elections"
              className="inline-flex items-center gap-2 border border-gray-600 hover:border-green-500 px-6 py-3 rounded-xl text-lg font-semibold transition"
            >
              View Elections
            </Link>
          </div>
        </div>

        {/* Visual */}
        <div className="flex-shrink-0">
          <div className="relative w-72 h-72 md:w-96 md:h-96 rounded-full border-2 border-green-500/30 flex items-center justify-center">
            <div className="absolute inset-4 rounded-full border border-green-500/20 animate-pulse" />
            <div className="text-9xl select-none">🗳️</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 md:px-20 py-16 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-12">Why BlockVote?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: <Shield size={36} className="text-green-400" />,
              title: 'Aadhaar-Verified Identity',
              desc: 'Voters register with a hashed Aadhaar number ensuring one person, one vote — with complete anonymity on-chain.',
            },
            {
              icon: <Eye size={36} className="text-blue-400" />,
              title: 'Fully Transparent',
              desc: 'All elections, candidates, and vote counts are publicly verifiable on the Ethereum blockchain in real time.',
            },
            {
              icon: <Zap size={36} className="text-yellow-400" />,
              title: 'Multi-Election Support',
              desc: 'The Election Commission can run multiple elections simultaneously, each with its own candidates and phases.',
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex flex-col gap-4 hover:border-green-700 transition"
            >
              {icon}
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-8 md:px-20 py-16 border-t border-gray-800">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        <div className="flex flex-col md:flex-row gap-8 items-start justify-center">
          {[
            { step: '01', title: 'Connect Wallet', desc: 'Connect your MetaMask wallet to the platform.' },
            { step: '02', title: 'Register as Voter', desc: 'Submit your Aadhaar hash to register as an eligible voter.' },
            { step: '03', title: 'Browse Elections', desc: 'View active elections and learn about each candidate.' },
            { step: '04', title: 'Cast Your Vote', desc: 'Vote for your preferred candidate — securely and anonymously.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex-1 flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-green-900/40 border-2 border-green-500 flex items-center justify-center text-green-400 font-bold text-lg">
                {step}
              </div>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-gray-400 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 border-t border-gray-800 text-gray-500 text-sm">
        © {new Date().getFullYear()} BlockVote · Built on Ethereum · All Rights Reserved
      </footer>
    </div>
  );
}
