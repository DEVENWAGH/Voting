import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import QueryProviderWrapper from "@/components/QueryProviderWrapper";

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
          <QueryProviderWrapper>
            <WalletProvider>
              <main>{children}</main>
            </WalletProvider>
          </QueryProviderWrapper>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
