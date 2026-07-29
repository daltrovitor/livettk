"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, Tv, ShieldCheck, BarChart3, Radio } from "lucide-react";

interface NavbarProps {
  status?: string;
  multiplier?: number;
}

export default function Navbar({ status = "VOTING", multiplier = 1 }: NavbarProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Placar ao Vivo", icon: Gamepad2 },
    { href: "/overlay", label: "OBS Overlay", icon: Tv },
    { href: "/admin", label: "Painel Admin", icon: ShieldCheck },
    { href: "/admin/analytics", label: "Estatísticas", icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 py-3 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-purple-600 to-blue-600 p-[2px] shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Radio className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-red-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              TIKTOK LIVE BATTLE
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
              Interactive Scoreboard System
            </p>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-red-500/20 to-blue-500/20 text-white border border-slate-700 shadow-md"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-red-400" : ""}`} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Live Badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {multiplier > 1 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-bounce">
              🔥 {multiplier}X MULTIPLICADOR
            </span>
          )}
          
          <span
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-bold uppercase tracking-wider text-[11px] border ${
              status === "VOTING"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : status === "PAUSED"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-rose-500/10 text-rose-400 border-rose-500/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === "VOTING"
                  ? "bg-emerald-400 animate-ping"
                  : status === "PAUSED"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
            />
            {status === "VOTING" ? "AO VIVO" : status === "PAUSED" ? "PAUSADO" : "FINALIZADO"}
          </span>
        </div>
      </div>
    </header>
  );
}
