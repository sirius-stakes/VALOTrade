import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VALO-ROSTER JP | プロチーム移籍・ロスター追跡",
    template: "%s | VALO-ROSTER JP",
  },
  description:
    "日本のVALORANTプロシーンのチームロスター・移籍・LFT/FA情報を追跡する、完全ローカル完結型ダッシュボード。",
  applicationName: "VALO-ROSTER JP",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#070a0f",
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
