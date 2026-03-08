import './globals.css';
import { WalletProvider } from '@/context/WalletContext';
import Navbar from '@/components/Navbar';

export const metadata = {
  title: 'VotingDApp — Decentralized Voting',
  description: 'Secure, transparent blockchain-based elections powered by Ethereum',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Navbar />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
