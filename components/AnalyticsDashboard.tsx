"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import { BarChart3, Trophy, Flame, MessageSquare, Gift, User, Clock } from "lucide-react";

interface Donor {
  id: string;
  username: string;
  avatar?: string;
  totalPoints: number;
  totalGifts: number;
}

interface VoteLog {
  id: string;
  username: string;
  type: string;
  payload?: string;
  points: number;
  team: string;
  timestamp: string;
}

export default function AnalyticsDashboard() {
  const [topDonors, setTopDonors] = useState<Donor[]>([]);
  const [recentLogs, setRecentLogs] = useState<VoteLog[]>([]);

  useEffect(() => {
    const socket = getSocket();

    socket.emit("getAnalytics");

    socket.on("analyticsData", (data: { topDonors: Donor[]; recentLogs: VoteLog[] }) => {
      setTopDonors(data.topDonors || []);
      setRecentLogs(data.recentLogs || []);
    });

    socket.on("voteEffect", () => {
      socket.emit("getAnalytics");
    });

    socket.on("giftReceived", () => {
      socket.emit("getAnalytics");
    });

    return () => {
      socket.off("analyticsData");
      socket.off("voteEffect");
      socket.off("giftReceived");
    };
  }, []);

  const totalPointsGiven = topDonors.reduce((acc, d) => acc + d.totalPoints, 0);
  const totalGiftsSent = topDonors.reduce((acc, d) => acc + d.totalGifts, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              ESTATÍSTICAS & ANALYTICS EM TEMPO REAL
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              Acompanhe engajamento, top doadores e fluxo de eventos da live.
            </p>
          </div>
        </div>

        {/* Overview Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
            <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Trophy className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase">Pontos Gerados por Doações</p>
              <h3 className="text-3xl font-black font-mono text-white mt-0.5">
                {totalPointsGiven.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
            <div className="p-4 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
              <Gift className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase">Total de Presentes Recebidos</p>
              <h3 className="text-3xl font-black font-mono text-white mt-0.5">
                {totalGiftsSent.toLocaleString()}
              </h3>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl flex items-center gap-4">
            <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <MessageSquare className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-400 uppercase">Total de Eventos Registrados</p>
              <h3 className="text-3xl font-black font-mono text-white mt-0.5">
                {recentLogs.length.toLocaleString()}
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Top Donors Ranking */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
            <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" /> Ranking dos Maiores Doadores
            </h3>

            {topDonors.length === 0 ? (
              <p className="text-slate-500 text-xs font-mono py-8 text-center">Nenhum doador registrado ainda.</p>
            ) : (
              <div className="space-y-2">
                {topDonors.map((donor, idx) => (
                  <div
                    key={donor.id || idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs font-mono ${
                        idx === 0 ? "bg-amber-400 text-slate-950" : idx === 1 ? "bg-slate-300 text-slate-950" : idx === 2 ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-400"
                      }`}>
                        #{idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-sm text-white">@{donor.username}</h4>
                        <p className="text-[10px] text-slate-400 font-mono">{donor.totalGifts} presentes</p>
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-400 text-sm">
                      +{donor.totalPoints.toLocaleString()} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Log Feed */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
            <h3 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-400" /> Histórico de Eventos Recentes
            </h3>

            {recentLogs.length === 0 ? (
              <p className="text-slate-500 text-xs font-mono py-8 text-center">Nenhum evento no histórico.</p>
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.team === "A" ? "bg-red-500/20 text-red-400" : log.team === "B" ? "bg-blue-500/20 text-blue-400" : "bg-slate-800 text-slate-300"
                      }`}>
                        {log.team === "A" ? "TIME A" : log.team === "B" ? "TIME B" : "GERAL"}
                      </span>
                      <span className="text-slate-200 font-bold">@{log.username}</span>
                      <span className="text-slate-400 text-[11px] truncate max-w-[160px]">{log.payload}</span>
                    </div>
                    <span className="font-bold text-emerald-400">+{log.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
