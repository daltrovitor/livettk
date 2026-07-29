"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { getSocket } from "@/lib/socket-client";
import { supabase } from "@/lib/supabase";
import { MatchData } from "./Scoreboard";
import { Crown, Star, Gift } from "lucide-react";

export interface GiftRuleItem {
  id: string;
  giftId: string;
  giftName: string;
  pointValue: number;
  icon: string;
  targetTeam: "A" | "B" | "BOTH";
}

const DEFAULT_LULA_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg/400px-Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg";
const DEFAULT_BOLSONARO_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jair_Bolsonaro_in_2023.jpg/400px-Jair_Bolsonaro_in_2023.jpg";

const sanitizePhoto = (url: string | undefined, defaultPhoto: string) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return defaultPhoto;
  if (url.includes("poder360.com.br") || url.includes("x.com") || url.includes("twitter.com") || url.includes("/noticias/") || url.includes("/justica/")) {
    return defaultPhoto;
  }
  return url;
};

export default function ObsOverlay() {
  const [match, setMatch] = useState<MatchData>({
    id: "1",
    title: "BATALHA POPULAR",
    teamAName: "Lula",
    teamAPhoto: DEFAULT_LULA_PHOTO,
    teamAColor: "#dc2626",
    teamAScore: 751,
    teamBName: "Bolsonaro",
    teamBPhoto: DEFAULT_BOLSONARO_PHOTO,
    teamBColor: "#2563eb",
    teamBScore: 1070,
    status: "VOTING",
    multiplier: 1,
    ruleTeamA: "13",
    ruleTeamB: "22",
    currentLeader: "B"
  });

  const [giftRules, setGiftRules] = useState<GiftRuleItem[]>([
    { id: "1", giftId: "football", giftName: "Bola", pointValue: 1, icon: "⚽", targetTeam: "A" },
    { id: "2", giftId: "panda", giftName: "Panda", pointValue: 10, icon: "🐼", targetTeam: "A" },
    { id: "3", giftId: "heart", giftName: "Coração", pointValue: 20, icon: "❤️", targetTeam: "A" },
    { id: "4", giftId: "rose", giftName: "Rosa", pointValue: 1, icon: "🌹", targetTeam: "B" },
    { id: "5", giftId: "fire", giftName: "Fogo", pointValue: 10, icon: "🔥", targetTeam: "B" },
    { id: "6", giftId: "gamepad", giftName: "Controle", pointValue: 20, icon: "🎮", targetTeam: "B" }
  ]);

  const [leaderTakeover, setLeaderTakeover] = useState<{ leaderName: string; leaderColor: string } | null>(null);
  const [giftBanner, setGiftBanner] = useState<{ icon: string; giftName: string; points: number; username: string } | null>(null);

  const normalizeMatchData = (raw: any): MatchData => {
    const photoA = sanitizePhoto(raw.teamAPhoto || raw.team_a_photo, DEFAULT_LULA_PHOTO);
    const photoB = sanitizePhoto(raw.teamBPhoto || raw.team_b_photo, DEFAULT_BOLSONARO_PHOTO);

    return {
      id: raw.id || "1",
      title: raw.title || "BATALHA POPULAR",
      teamAName: raw.teamAName || raw.team_a_name || "Lula",
      teamAPhoto: photoA,
      teamAColor: raw.teamAColor || raw.team_a_color || "#dc2626",
      teamAScore: raw.teamAScore ?? raw.team_a_score ?? 751,
      teamBName: raw.teamBName || raw.team_b_name || "Bolsonaro",
      teamBPhoto: photoB,
      teamBColor: raw.teamBColor || raw.team_b_color || "#2563eb",
      teamBScore: raw.teamBScore ?? raw.team_b_score ?? 1070,
      status: raw.status || "VOTING",
      multiplier: raw.multiplier || 1,
      ruleTeamA: raw.ruleTeamA || raw.rule_team_a || "13",
      ruleTeamB: raw.ruleTeamB || raw.rule_team_b || "22",
      currentLeader: raw.currentLeader || raw.current_leader || "B"
    };
  };

  const normalizeGiftRules = (rules: any[]): GiftRuleItem[] => {
    return rules.map(r => ({
      id: String(r.id || r.gift_id || Math.random()),
      giftId: r.giftId || r.gift_id || "",
      giftName: r.giftName || r.gift_name || "Gift",
      pointValue: Number(r.pointValue ?? r.point_value ?? 1),
      icon: r.icon || "🎁",
      targetTeam: (r.targetTeam || r.target_team || "A") as "A" | "B" | "BOTH"
    }));
  };

  const fetchMatchState = () => {
    fetch("/api/match")
      .then(res => res.json())
      .then(data => {
        if (data?.match) setMatch(normalizeMatchData(data.match));
        if (data?.giftRules && data.giftRules.length > 0) {
          setGiftRules(normalizeGiftRules(data.giftRules));
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    // Initial check from localStorage for 0ms initial load
    try {
      const cached = localStorage.getItem("match_overlay_data");
      if (cached) setMatch(normalizeMatchData(JSON.parse(cached)));
    } catch (e) {}

    // Initial fetch from API
    fetchMatchState();

    // BroadcastChannel Listener (for instant tab-to-tab/OBS browser sync on same origin)
    let broadcastChan: BroadcastChannel | null = null;
    try {
      broadcastChan = new BroadcastChannel("match_overlay_channel");
      broadcastChan.onmessage = (event) => {
        if (event.data?.type === "MATCH_UPDATE" && event.data?.match) {
          setMatch(normalizeMatchData(event.data.match));
        }
      };
    } catch (e) {}

    // Storage Event Listener
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "match_overlay_data" && e.newValue) {
        try {
          setMatch(normalizeMatchData(JSON.parse(e.newValue)));
        } catch (err) {}
      }
    };

    const handleCustomMatchEvent = () => {
      try {
        const cached = localStorage.getItem("match_overlay_data");
        if (cached) setMatch(normalizeMatchData(JSON.parse(cached)));
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("match_state_updated", handleCustomMatchEvent);

    // Fast Polling (1 second) to guarantee 100% sync in OBS and all browsers!
    const pollInterval = setInterval(() => {
      fetchMatchState();
    }, 1000);

    // Supabase Realtime Listener
    const channel = supabase
      .channel("realtime_matches_overlay")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          if (payload.new) {
            setMatch(normalizeMatchData(payload.new));
          }
        }
      )
      .subscribe();

    // Socket.io Listener
    const socket = getSocket();

    socket.on("matchStateUpdated", (updated: MatchData) => {
      setMatch(normalizeMatchData(updated));
    });

    socket.on("giftRulesUpdated", (rules: GiftRuleItem[]) => {
      if (rules && rules.length > 0) setGiftRules(normalizeGiftRules(rules));
    });

    socket.on("leaderChanged", (event: { newLeader: string; leaderName: string; leaderColor: string }) => {
      setLeaderTakeover(event);
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.4 },
          colors: [event.leaderColor, "#ffffff", "#f59e0b"]
        });
      } catch (e) {}
      setTimeout(() => setLeaderTakeover(null), 3000);
    });

    socket.on("giftReceived", (data: { username: string; giftName: string; icon: string; points: number }) => {
      setGiftBanner({
        icon: data.icon,
        giftName: data.giftName,
        points: data.points,
        username: data.username
      });
      setTimeout(() => setGiftBanner(null), 3000);
    });

    return () => {
      clearInterval(pollInterval);
      if (broadcastChan) broadcastChan.close();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("match_state_updated", handleCustomMatchEvent);
      supabase.removeChannel(channel);
      socket.off("matchStateUpdated");
      socket.off("giftRulesUpdated");
      socket.off("leaderChanged");
      socket.off("giftReceived");
    };
  }, []);

  const totalVotes = match.teamAScore + match.teamBScore;
  const pctA = totalVotes === 0 ? 50 : Math.round((match.teamAScore / totalVotes) * 100);
  const pctB = totalVotes === 0 ? 50 : 100 - pctA;

  const giftsTeamA = giftRules.filter(g => g.targetTeam === "A" || (g as any).target_team === "A");
  const giftsTeamB = giftRules.filter(g => g.targetTeam === "B" || (g as any).target_team === "B");

  return (
    <div className="w-screen h-screen bg-transparent text-white flex items-center justify-center select-none overflow-hidden font-sans p-2 sm:p-4">
      
      {/* Gift Event Popup */}
      <AnimatePresence>
        {giftBanner && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.8 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-slate-900/95 border border-amber-500/60 shadow-2xl backdrop-blur-md flex items-center gap-3"
          >
            <span className="text-2xl animate-bounce">{giftBanner.icon}</span>
            <div>
              <p className="text-[10px] text-amber-400 font-bold tracking-wider uppercase">
                PRESENTE RECEBIDO!
              </p>
              <h4 className="text-xs font-black text-white">
                @{giftBanner.username} enviou {giftBanner.giftName} (+{giftBanner.points} Votos)
              </h4>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leader Takeover Banner */}
      <AnimatePresence>
        {leaderTakeover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-6 py-2 rounded-xl bg-amber-400 text-slate-950 font-black shadow-2xl flex items-center gap-2 border-2 border-white"
          >
            <Crown className="w-5 h-5 fill-slate-950" />
            <span className="text-sm tracking-wider uppercase">
              👑 NOVO LÍDER: {leaderTakeover.leaderName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STRICT 9:16 ASPECT RATIO BOX */}
      <div className="relative aspect-[9/16] h-full max-h-[96vh] w-auto max-w-full flex flex-col justify-between bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl my-auto">
        
        {/* Top Header Bar */}
        <div className="bg-slate-900/90 border-b border-slate-800 py-3 px-4 text-center relative flex flex-col items-center justify-center z-10">
          <div className="flex items-center justify-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-amber-400 truncate max-w-[260px]">
              {match.title || "BATALHA POPULAR"}
            </h2>
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          </div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mt-0.5">
            AO VIVO • TIKTOK LIVE
          </span>
        </div>

        {/* Middle Split Columns */}
        <div className="relative flex-1 grid grid-cols-2">
          
          {/* VS Badge Floating Centered BETWEEN PHOTOS */}
          <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 border-2 border-white flex items-center justify-center font-black text-xs shadow-2xl tracking-wider">
              VS
            </div>
          </div>

          {/* Left Column (Lula / Red) */}
          <div
            className="flex flex-col items-center justify-center p-3 text-center relative pt-6"
            style={{ backgroundColor: match.teamAColor || "#dc2626" }}
          >
            <div className="relative mb-2">
              <img
                src={match.teamAPhoto}
                alt={match.teamAName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_LULA_PHOTO;
                }}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-2xl"
              />
            </div>

            <h3 className="text-base sm:text-xl font-black uppercase tracking-wide text-white drop-shadow-md px-1 truncate max-w-full">
              {match.teamAName}
            </h3>

            <div className="mt-3 text-3xl sm:text-5xl font-black font-mono text-white tracking-tight drop-shadow-lg">
              {match.teamAScore.toLocaleString()}
            </div>
          </div>

          {/* Right Column (Bolsonaro / Blue) */}
          <div
            className="flex flex-col items-center justify-center p-3 text-center relative pt-6"
            style={{ backgroundColor: match.teamBColor || "#2563eb" }}
          >
            <div className="relative mb-2">
              <img
                src={match.teamBPhoto}
                alt={match.teamBName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_BOLSONARO_PHOTO;
                }}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-2xl"
              />
            </div>

            <h3 className="text-base sm:text-xl font-black uppercase tracking-wide text-white drop-shadow-md px-1 truncate max-w-full">
              {match.teamBName}
            </h3>

            <div className="mt-3 text-3xl sm:text-5xl font-black font-mono text-white tracking-tight drop-shadow-lg">
              {match.teamBScore.toLocaleString()}
            </div>
          </div>

        </div>

        {/* 6 GIFTS BOARD */}
        <div className="bg-slate-900 border-t border-b border-slate-800 p-2 sm:p-2.5">
          <div className="text-[10px] font-bold text-amber-400 mb-1 uppercase tracking-wider text-center flex items-center justify-center gap-1">
            <Gift className="w-3.5 h-3.5" /> PRESENTES = VOTOS ADICIONAIS
          </div>

          <div className="grid grid-cols-2 gap-2 text-center font-mono">
            {/* Left Side: Team A Gifts */}
            <div className="space-y-1 bg-red-950/40 p-1 rounded-xl border border-red-500/30">
              <p className="text-[9px] font-bold text-red-400 uppercase truncate">
                {match.teamAName}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(giftsTeamA.length > 0 ? giftsTeamA : [
                  { icon: "⚽", pointValue: 1, giftName: "Bola" },
                  { icon: "🐼", pointValue: 10, giftName: "Panda" },
                  { icon: "❤️", pointValue: 20, giftName: "Coração" }
                ]).map((g, idx) => (
                  <div key={idx} className="bg-slate-950/90 p-1 rounded-lg border border-red-500/20">
                    <span className="text-base block">{g.icon}</span>
                    <p className="text-[9px] font-bold text-white">+{g.pointValue ?? (g as any).point_value ?? 1}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side: Team B Gifts */}
            <div className="space-y-1 bg-blue-950/40 p-1 rounded-xl border border-blue-500/30">
              <p className="text-[9px] font-bold text-blue-400 uppercase truncate">
                {match.teamBName}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(giftsTeamB.length > 0 ? giftsTeamB : [
                  { icon: "🌹", pointValue: 1, giftName: "Rosa" },
                  { icon: "🔥", pointValue: 10, giftName: "Fogo" },
                  { icon: "🎮", pointValue: 20, giftName: "Controle" }
                ]).map((g, idx) => (
                  <div key={idx} className="bg-slate-950/90 p-1 rounded-lg border border-blue-500/20">
                    <span className="text-base block">{g.icon}</span>
                    <p className="text-[9px] font-bold text-white">+{g.pointValue ?? (g as any).point_value ?? 1}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Dual Score Numbers & 100% Full Width Progress Bar */}
        <div className="bg-slate-950 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 px-1">
            <span className="text-sm font-black">{match.teamAScore.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest">VOTOS TOTAL</span>
            <span className="text-sm font-black">{match.teamBScore.toLocaleString()}</span>
          </div>

          <div className="w-full h-6 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center shadow-inner">
            <div
              style={{ width: `${pctA}%`, backgroundColor: match.teamAColor || "#dc2626" }}
              className="h-full flex items-center justify-center text-[11px] font-black font-mono text-white transition-all duration-300"
            >
              {pctA}%
            </div>
            <div
              style={{ width: `${pctB}%`, backgroundColor: match.teamBColor || "#2563eb" }}
              className="h-full flex items-center justify-center text-[11px] font-black font-mono text-white transition-all duration-300"
            >
              {pctB}%
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
