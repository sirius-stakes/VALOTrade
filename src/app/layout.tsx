import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TEAMTRADE | マルチタイトル・ロスター追跡",
    template: "%s | TEAMTRADE",
  },
  description:
    "VALORANT / League of Legends / Identity V のプロチームロスター・移籍・順位を追跡する、完全ローカル完結型ダッシュボード。",
  applicationName: "TEAMTRADE",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
