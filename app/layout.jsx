import "./globals.css";
import { WalletProvider } from "@/context/WalletContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import QueryProviderWrapper from "@/components/QueryProviderWrapper";

export const metadata = {
  title: "Block Vote — Blockchain Voting for Organizations",
  description:
    "Secure, transparent elections for colleges, companies, DAOs and communities. Powered by Ethereum.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BlockVote",
  },
};

export const viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
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
