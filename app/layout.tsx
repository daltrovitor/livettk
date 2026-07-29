import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TikTok Live Interactive Minigame - Placar ao Vivo",
  description: "Sistema interativo para lives do TikTok com placar em tempo real, presentes, OBS overlay e controle admin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-red-500 selection:text-white`}>
        {children}
      </body>
    </html>
  );
}
