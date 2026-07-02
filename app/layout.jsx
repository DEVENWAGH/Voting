import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

export const metadata = {
  title: "Block Vote — Blockchain Voting for Organizations",
  description:
    "Secure, transparent elections for colleges, companies, DAOs and communities. Powered by Ethereum.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <WalletProvider>
            <main>{children}</main>
          </WalletProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
