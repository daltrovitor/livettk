"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { getSocket } from "@/lib/socket-client";
import { soundFx } from "@/lib/audio-fx";
import { Crown, Volume2, VolumeX, Flame, Gift, Star, Smartphone, LayoutGrid } from "lucide-react";

export interface MatchData {
  id: string;
  title: string;
  teamAName: string;
  teamAPhoto: string;
  teamAColor: string;
  teamAScore: number;
  teamBName: string;
  teamBPhoto: string;
  teamBColor: string;
  teamBScore: number;
  status: string;
  multiplier: number;
  ruleTeamA: string;
  ruleTeamB: string;
  currentLeader: string;
}

interface FloatingPopup {
  id: string;
  text: string;
  team: "A" | "B";
  color: string;
}

const DEFAULT_LULA_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg/400px-Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg";
const DEFAULT_BOLSONARO_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jair_Bolsonaro_in_2023.jpg/400px-Jair_Bolsonaro_in_2023.jpg";

export default function Scoreboard({ initialMatch }: { initialMatch?: MatchData | null }) {
  const [match, setMatch] = useState<MatchData>(
    initialMatch || {
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
    }
  );

  const [popups, setPopups] = useState<FloatingPopup[]>([]);
  const [leaderTakeover, setLeaderTakeover] = useState<{ leaderName: string; leaderColor: string } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [screenShake, setScreenShake] = useState(false);
  const [isVerticalFormat, setIsVerticalFormat] = useState(true);

  const prevScoreA = useRef(match.teamAScore);
  const prevScoreB = useRef(match.teamBScore);

  useEffect(() => {
    // 0. Initial cached load
    try {
      const cached = localStorage.getItem("match_overlay_data");
      if (cached) setMatch(JSON.parse(cached));
    } catch (e) {}

    // BroadcastChannel listener
    let broadcastChan: BroadcastChannel | null = null;
    try {
      broadcastChan = new BroadcastChannel("match_overlay_channel");
      broadcastChan.onmessage = (event) => {
        if (event.data?.type === "MATCH_UPDATE" && event.data?.match) {
          setMatch(event.data.match);
        }
      };
    } catch (e) {}

    // Storage listeners
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "match_overlay_data" && e.newValue) {
        try { setMatch(JSON.parse(e.newValue)); } catch (err) {}
      }
    };
    const handleCustomMatchEvent = () => {
      try {
        const cached = localStorage.getItem("match_overlay_data");
        if (cached) setMatch(JSON.parse(cached));
      } catch (e) {}
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("match_state_updated", handleCustomMatchEvent);

    const socket = getSocket();

    socket.on("matchStateUpdated", (updated: MatchData) => {
      if (updated.teamAScore > prevScoreA.current) {
        soundFx.playVotePoint(false);
      }
      if (updated.teamBScore > prevScoreB.current) {
        soundFx.playVotePoint(true);
      }
      prevScoreA.current = updated.teamAScore;
      prevScoreB.current = updated.teamBScore;

      setMatch(updated);
    });

    socket.on("leaderChanged", (event: { newLeader: string; leaderName: string; leaderColor: string }) => {
      setLeaderTakeover(event);
      setScreenShake(true);
      soundFx.playLeaderTakeover();

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.5 },
          colors: [event.leaderColor, "#ffffff", "#f59e0b"]
        });
      } catch (e) {}

      setTimeout(() => setScreenShake(false), 800);
      setTimeout(() => setLeaderTakeover(null), 3500);
    });

    socket.on("giftReceived", (data: { username: string; giftName: string; icon: string; points: number; team: "A" | "B" }) => {
      soundFx.playGiftSound();
      addPopup(`${data.icon} +${data.points} (${data.username})`, data.team, data.team === "A" ? match.teamAColor : match.teamBColor);
    });

    socket.on("voteEffect", (data: { username: string; team: "A" | "B"; points: number; type: string; text: string }) => {
      addPopup(`+${data.points} @${data.username}`, data.team, data.team === "A" ? match.teamAColor : match.teamBColor);
    });

    return () => {
      if (broadcastChan) broadcastChan.close();
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("match_state_updated", handleCustomMatchEvent);
      socket.off("matchStateUpdated");
      socket.off("leaderChanged");
      socket.off("giftReceived");
      socket.off("voteEffect");
    };
  }, [match.teamAColor, match.teamBColor]);

  const addPopup = (text: string, team: "A" | "B", color: string) => {
    const newPopup: FloatingPopup = {
      id: Math.random().toString(),
      text,
      team,
      color
    };
    setPopups(prev => [...prev.slice(-8), newPopup]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== newPopup.id));
    }, 2000);
  };

  const toggleAudio = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.setEnabled(next);
  };

  const totalVotes = match.teamAScore + match.teamBScore;
  const pctA = totalVotes === 0 ? 50 : Math.round((match.teamAScore / totalVotes) * 100);
  const pctB = totalVotes === 0 ? 50 : 100 - pctA;

  return (
    <div className={`relative min-h-[calc(100vh-65px)] w-full overflow-hidden bg-slate-950 text-white flex flex-col justify-between p-4 md:p-6 transition-transform duration-100 ${screenShake ? "animate-bounce" : ""}`}>
      <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-red-600/20 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />

      <div className="relative z-10 flex items-center justify-between gap-4 max-w-5xl mx-auto w-full mb-4">
        <div>
          <h2 className="text-xl md:text-3xl font-black tracking-wider uppercase bg-gradient-to-r from-amber-400 via-white to-amber-200 bg-clip-text text-transparent">
            {match.title}
          </h2>
          <p className="text-slate-400 text-xs font-medium flex items-center gap-2 mt-0.5">
            <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
            Interativo TikTok Live • Proporção 9:16
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVerticalFormat(!isVerticalFormat)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-lg text-xs font-bold"
          >
            {isVerticalFormat ? <Smartphone className="w-4 h-4 text-amber-400" /> : <LayoutGrid className="w-4 h-4 text-blue-400" />}
            <span className="hidden sm:inline">
              {isVerticalFormat ? "MODO VERTICAL (9:16)" : "MODO HORIZONTAL"}
            </span>
          </button>

          <button
            onClick={toggleAudio}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all shadow-lg"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {leaderTakeover && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: -50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-8 py-3 rounded-2xl bg-amber-400 text-slate-950 font-black shadow-2xl flex items-center gap-3 border-2 border-white animate-pulse"
          >
            <Crown className="w-7 h-7 fill-slate-950" />
            <div className="text-center">
              <p className="text-[10px] tracking-widest uppercase font-extrabold text-slate-900">
                ULTRAPASSAGEM ÉPICA!
              </p>
              <h3 className="text-xl font-black uppercase tracking-wider">
                👑 NOVO LÍDER: {leaderTakeover.leaderName}
              </h3>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isVerticalFormat ? (
        <div className="relative z-10 aspect-[9/16] h-[640px] max-h-[85vh] w-auto mx-auto my-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 shadow-2xl flex flex-col justify-between">
          
          <div className="bg-slate-900/90 border-b border-slate-800 py-3 px-4 text-center relative flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-2">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <h2 className="text-lg font-black uppercase tracking-wider text-amber-400 truncate max-w-[260px]">
                {match.title || "BATALHA POPULAR"}
              </h2>
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            </div>
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase mt-0.5">
              AO VIVO
            </span>
          </div>

          <div className="relative flex-1 grid grid-cols-2">
            <div className="absolute top-[22%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
              <div className="w-10 h-10 rounded-full bg-amber-400 text-slate-950 border-2 border-white flex items-center justify-center font-black text-xs shadow-2xl tracking-wider">
                VS
              </div>
            </div>

            <div
              className="flex flex-col items-center justify-center p-3 text-center relative pt-6"
              style={{ backgroundColor: match.teamAColor || "#dc2626" }}
            >
              <div className="relative mb-2">
                <img
                  src={match.teamAPhoto}
                  alt={match.teamAName}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_LULA_PHOTO;
                  }}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-2xl"
                />
              </div>

              <h3 className="text-base sm:text-xl font-black uppercase tracking-wide text-white drop-shadow-md px-1 truncate max-w-full">
                {match.teamAName}
              </h3>

              <div className="mt-3 text-4xl sm:text-5xl font-black font-mono text-white tracking-tight drop-shadow-lg">
                {match.teamAScore.toLocaleString()}
              </div>
            </div>

            <div
              className="flex flex-col items-center justify-center p-3 text-center relative pt-6"
              style={{ backgroundColor: match.teamBColor || "#2563eb" }}
            >
              <div className="relative mb-2">
                <img
                  src={match.teamBPhoto}
                  alt={match.teamBName}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = DEFAULT_BOLSONARO_PHOTO;
                  }}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-2xl"
                />
              </div>

              <h3 className="text-base sm:text-xl font-black uppercase tracking-wide text-white drop-shadow-md px-1 truncate max-w-full">
                {match.teamBName}
              </h3>

              <div className="mt-3 text-4xl sm:text-5xl font-black font-mono text-white tracking-tight drop-shadow-lg">
                {match.teamBScore.toLocaleString()}
              </div>
            </div>

          </div>

          <div className="bg-slate-950 p-3 space-y-2 border-t border-slate-800">
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
      ) : (
        <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center my-auto">
          <div className="bg-red-950/40 border border-red-500/80 p-6 rounded-3xl">
            <div className="flex items-center gap-4">
              <img src={match.teamAPhoto} alt={match.teamAName} onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_LULA_PHOTO; }} className="w-24 h-24 rounded-2xl object-cover border-2 border-white" />
              <div>
                <h3 className="text-2xl font-black text-red-400 uppercase">{match.teamAName}</h3>
                <p className="text-4xl font-black font-mono text-white mt-2">{match.teamAScore.toLocaleString()} votos</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-950/40 border border-blue-500/80 p-6 rounded-3xl">
            <div className="flex items-center gap-4">
              <img src={match.teamBPhoto} alt={match.teamBName} onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_BOLSONARO_PHOTO; }} className="w-24 h-24 rounded-2xl object-cover border-2 border-white" />
              <div>
                <h3 className="text-2xl font-black text-blue-400 uppercase">{match.teamBName}</h3>
                <p className="text-4xl font-black font-mono text-white mt-2">{match.teamBScore.toLocaleString()} votos</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-md mx-auto w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-md flex items-center justify-around gap-2 text-center text-xs mt-4">
        <div className="flex items-center gap-1 text-amber-300 font-semibold">
          <Gift className="w-3.5 h-3.5" /> Presentes do TikTok Adicionam Votos ao Placar!
        </div>
      </div>
    </div>
  );
}
