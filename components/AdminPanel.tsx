"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import { supabase } from "@/lib/supabase";
import { MatchData } from "./Scoreboard";
import {
  ShieldCheck,
  RotateCcw,
  Play,
  Pause,
  Save,
  CheckCircle2,
  Image as ImageIcon,
  Zap,
  HelpCircle,
  RefreshCw
} from "lucide-react";

const DEFAULT_LULA_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg/400px-Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg";
const DEFAULT_BOLSONARO_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jair_Bolsonaro_in_2023.jpg/400px-Jair_Bolsonaro_in_2023.jpg";

export default function AdminPanel() {
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

  const [photoA, setPhotoA] = useState(DEFAULT_LULA_PHOTO);
  const [photoB, setPhotoB] = useState(DEFAULT_BOLSONARO_PHOTO);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveMsg, setSaveMsg] = useState("Alterações Salvas!");

  const normalizeMatchData = (raw: any): MatchData => {
    return {
      id: raw.id || "1",
      title: raw.title || "BATALHA POPULAR",
      teamAName: raw.teamAName || raw.team_a_name || "Lula",
      teamAPhoto: raw.teamAPhoto || raw.team_a_photo || photoA,
      teamAColor: raw.teamAColor || raw.team_a_color || "#dc2626",
      teamAScore: raw.teamAScore ?? raw.team_a_score ?? 751,
      teamBName: raw.teamBName || raw.team_b_name || "Bolsonaro",
      teamBPhoto: raw.teamBPhoto || raw.team_b_photo || photoB,
      teamBColor: raw.teamBColor || raw.team_b_color || "#2563eb",
      teamBScore: raw.teamBScore ?? raw.team_b_score ?? 1070,
      status: raw.status || "VOTING",
      multiplier: raw.multiplier || 1,
      ruleTeamA: raw.ruleTeamA || raw.rule_team_a || "13",
      ruleTeamB: raw.ruleTeamB || raw.rule_team_b || "22",
      currentLeader: raw.currentLeader || raw.current_leader || "B"
    };
  };

  const [tiktokUsername, setTiktokUsername] = useState("");
  const [tiktokStatus, setTiktokStatus] = useState<{ status: string; username?: string; message?: string }>({ status: "disconnected" });

  useEffect(() => {
    fetch("/api/match")
      .then(res => res.json())
      .then(data => {
        if (data?.match) {
          const norm = normalizeMatchData(data.match);
          setMatch(norm);
          if (norm.teamAPhoto) setPhotoA(norm.teamAPhoto);
          if (norm.teamBPhoto) setPhotoB(norm.teamBPhoto);
        }
      })
      .catch(() => {});

    const channel = supabase
      .channel("realtime_admin_matches")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          if (payload.new) {
            setMatch(normalizeMatchData(payload.new));
          }
        }
      )
      .subscribe();

    const socket = getSocket();
    socket.on("matchStateUpdated", (updated: MatchData) => {
      setMatch(normalizeMatchData(updated));
    });

    socket.on("tiktokStatus", (statusData) => {
      setTiktokStatus(statusData);
    });

    return () => {
      supabase.removeChannel(channel);
      socket.off("matchStateUpdated");
      socket.off("tiktokStatus");
    };
  }, []);

  const handleConnectTikTok = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tiktokUsername) return;
    try {
      getSocket().emit("admin:connectTikTok", { username: tiktokUsername });
      showToast(`Conectando à Live de @${tiktokUsername}...`);
    } catch (e) {}
  };

  const handleDisconnectTikTok = () => {
    try {
      getSocket().emit("admin:disconnectTikTok");
      showToast("Desconectado da Live.");
    } catch (e) {}
  };

  const handleSimulateGift = (team: "A" | "B", giftName: string, points: number) => {
    handleAddVotes(team, points);
    try {
      getSocket().emit("admin:simulateEvent", {
        type: "GIFT",
        team,
        giftName,
        username: "Fã_TikTok"
      });
    } catch (e) {}
    showToast(`🎁 Presente ${giftName} (+${points}) computado!`);
  };

  const showToast = (msg: string) => {
    setSaveMsg(msg);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const broadcastMatchUpdate = (updatedMatch: MatchData) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("match_overlay_data", JSON.stringify(updatedMatch));
        window.dispatchEvent(new Event("match_state_updated"));
      } catch (e) {}
      try {
        const channel = new BroadcastChannel("match_overlay_channel");
        channel.postMessage({ type: "MATCH_UPDATE", match: updatedMatch });
        channel.close();
      } catch (e) {}
    }
  };

  // 1. ADD VOTES (DIRECT TO SUPABASE REALTIME & API)
  const handleAddVotes = async (team: "A" | "B", amount: number) => {
    const currentA = match.teamAScore;
    const currentB = match.teamBScore;
    const newA = Math.max(0, currentA + (team === "A" ? amount : 0));
    const newB = Math.max(0, currentB + (team === "B" ? amount : 0));
    const newLeader = newA > newB ? "A" : newB > newA ? "B" : "TIE";

    const updated = { ...match, teamAScore: newA, teamBScore: newB, currentLeader: newLeader };
    setMatch(updated);
    broadcastMatchUpdate(updated);

    try {
      await supabase.from("matches").upsert({
        id: match.id || "00000000-0000-0000-0000-000000000001",
        team_a_score: newA,
        team_b_score: newB,
        current_leader: newLeader
      });
    } catch (e) {}

    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addVotes", team, amount })
    }).catch(() => {});

    try { getSocket().emit("admin:addVotes", { team, amount }); } catch (e) {}
  };

  // 2. RESET MATCH
  const handleResetMatch = async () => {
    if (confirm("Tem certeza que deseja resetar o placar para 0?")) {
      const updated = { ...match, teamAScore: 0, teamBScore: 0, currentLeader: "TIE" };
      setMatch(updated);
      broadcastMatchUpdate(updated);

      try {
        await supabase.from("matches").upsert({
          id: match.id || "00000000-0000-0000-0000-000000000001",
          team_a_score: 0,
          team_b_score: 0,
          current_leader: "TIE"
        });
      } catch (e) {}

      fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
      }).catch(() => {});

      try { getSocket().emit("admin:reset"); } catch (e) {}
      showToast("Placar zerado com sucesso!");
    }
  };

  // 3. SET STATUS (START / PAUSE)
  const handleSetStatus = async (newStatus: "VOTING" | "PAUSED" | "ENDED") => {
    const updated = { ...match, status: newStatus };
    setMatch(updated);
    broadcastMatchUpdate(updated);

    try {
      await supabase.from("matches").upsert({
        id: match.id || "00000000-0000-0000-0000-000000000001",
        status: newStatus
      });
    } catch (e) {}

    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setStatus", status: newStatus })
    }).catch(() => {});

    try { getSocket().emit("admin:setStatus", newStatus); } catch (e) {}

    showToast(`Status: ${newStatus === "VOTING" ? "AO VIVO" : "PAUSADO"}`);
  };

  // 4. SAVE PHOTOS DIRECTLY TO SUPABASE
  const handleSavePhotos = async (e: React.FormEvent) => {
    e.preventDefault();

    const updated = {
      ...match,
      teamAPhoto: photoA,
      teamBPhoto: photoB
    };
    setMatch(updated);
    broadcastMatchUpdate(updated);

    try {
      await supabase.from("matches").upsert({
        id: match.id || "00000000-0000-0000-0000-000000000001",
        team_a_photo: photoA,
        team_b_photo: photoB
      });
    } catch (e) {}

    fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateMatchInfo",
        matchInfo: {
          title: match.title,
          teamAName: match.teamAName,
          teamAPhoto: photoA,
          ruleTeamA: match.ruleTeamA,
          teamBName: match.teamBName,
          teamBPhoto: photoB,
          ruleTeamB: match.ruleTeamB
        }
      })
    }).catch(() => {});

    try {
      getSocket().emit("admin:updateMatchInfo", {
        title: match.title,
        teamAName: match.teamAName,
        teamAPhoto: photoA,
        ruleTeamA: match.ruleTeamA,
        teamBName: match.teamBName,
        teamBPhoto: photoB,
        ruleTeamB: match.ruleTeamB
      });
    } catch (e) {}

    showToast("✅ Fotos salvas com sucesso!");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Success Toast */}
        {saveSuccess && (
          <div className="fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-black shadow-2xl flex items-center gap-2 border-2 border-white animate-bounce">
            <CheckCircle2 className="w-5 h-5 fill-slate-950 text-emerald-500" />
            <span className="text-sm">{saveMsg}</span>
          </div>
        )}

        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-white">
                PAINEL DE CONTROLE DAS LIVES
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Sincronizado via Supabase DB • Overlay 9:16 TikTok Live
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSetStatus(match.status === "VOTING" ? "PAUSED" : "VOTING")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase shadow-lg transition-all ${
                match.status === "VOTING"
                  ? "bg-amber-500 hover:bg-amber-600 text-slate-950"
                  : "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
              }`}
            >
              {match.status === "VOTING" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {match.status === "VOTING" ? "Pausar Votação" : "Iniciar Votação"}
            </button>

            <button
              onClick={handleResetMatch}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase shadow-lg transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Zerar Placar
            </button>
          </div>
        </div>

        {/* SECTION: CONEXÃO TIKTOK LIVE */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <span className="text-xl">🎵</span> CONEXÃO TIKTOK LIVE (CAPTURA DE PRESENTES)
            </h2>
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
              tiktokStatus.status === "connected"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : tiktokStatus.status === "connecting"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                : "bg-slate-800 text-slate-400 border border-slate-700"
            }`}>
              {tiktokStatus.status === "connected"
                ? `● CONECTADO (@${tiktokStatus.username})`
                : tiktokStatus.status === "connecting"
                ? `⌛ CONECTANDO...`
                : "○ DESCONECTADO"}
            </span>
          </div>

          <form onSubmit={handleConnectTikTok} className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={tiktokUsername}
              onChange={(e) => setTiktokUsername(e.target.value)}
              placeholder="Digite seu @username do TikTok (ex: @seu_canal)"
              className="flex-1 min-w-[260px] bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
            />
            {tiktokStatus.status === "connected" ? (
              <button
                type="button"
                onClick={handleDisconnectTikTok}
                className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase rounded-xl shadow-lg transition-transform hover:scale-105"
              >
                Desconectar
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl shadow-lg transition-transform hover:scale-105"
              >
                Conectar na Live
              </button>
            )}
          </form>

          {/* Quick Gift Simulation Buttons */}
          <div className="pt-2 border-t border-slate-800/80">
            <p className="text-[11px] text-slate-400 font-mono mb-2 uppercase">
              🧪 TESTAR RECEBIMENTO DE PRESENTES NO OVERLAY:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSimulateGift("A", "Bola", 1)}
                className="px-3 py-2 bg-red-950/60 border border-red-500/30 hover:bg-red-900/60 text-white text-xs rounded-xl font-mono font-bold"
              >
                ⚽ Simular Bola (+1 Lula)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateGift("A", "Panda", 10)}
                className="px-3 py-2 bg-red-950/60 border border-red-500/30 hover:bg-red-900/60 text-white text-xs rounded-xl font-mono font-bold"
              >
                🐼 Simular Panda (+10 Lula)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateGift("B", "Rosa", 1)}
                className="px-3 py-2 bg-blue-950/60 border border-blue-500/30 hover:bg-blue-900/60 text-white text-xs rounded-xl font-mono font-bold"
              >
                🌹 Simular Rosa (+1 Bolsonaro)
              </button>
              <button
                type="button"
                onClick={() => handleSimulateGift("B", "Fogo", 10)}
                className="px-3 py-2 bg-blue-950/60 border border-blue-500/30 hover:bg-blue-900/60 text-white text-xs rounded-xl font-mono font-bold"
              >
                🔥 Simular Fogo (+10 Bolsonaro)
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 1: AJUSTE MANUAL DO PLACAR */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> AJUSTE MANUAL DO PLACAR
            </h2>
            <div className="text-xs font-mono font-bold text-slate-400">
              {match.teamAName}: <span className="text-red-400 text-base">{match.teamAScore.toLocaleString()}</span> | {match.teamBName}: <span className="text-blue-400 text-base">{match.teamBScore.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Lula Controls */}
            <div className="bg-red-950/30 border border-red-500/40 p-5 rounded-2xl space-y-3 text-center">
              <h3 className="font-black text-red-400 uppercase text-base">🔴 {match.teamAName}</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleAddVotes("A", 1)}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black shadow-lg"
                >
                  +1 Voto
                </button>
                <button
                  onClick={() => handleAddVotes("A", 10)}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black shadow-lg"
                >
                  +10 Votos
                </button>
                <button
                  onClick={() => handleAddVotes("A", 100)}
                  className="py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-black shadow-lg"
                >
                  +100 Votos
                </button>
              </div>
            </div>

            {/* Bolsonaro Controls */}
            <div className="bg-blue-950/30 border border-blue-500/40 p-5 rounded-2xl space-y-3 text-center">
              <h3 className="font-black text-blue-400 uppercase text-base">🔵 {match.teamBName}</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleAddVotes("B", 1)}
                  className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black shadow-lg"
                >
                  +1 Voto
                </button>
                <button
                  onClick={() => handleAddVotes("B", 10)}
                  className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black shadow-lg"
                >
                  +10 Votos
                </button>
                <button
                  onClick={() => handleAddVotes("B", 100)}
                  className="py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-black shadow-lg"
                >
                  +100 Votos
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 2: EDITAR FOTOS DOS CANDIDATOS */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-400" /> TROCAR FOTOS DOS CANDIDATOS
            </h2>
            
            {/* Helpful Explanation Box */}
            <div className="mt-3 p-3.5 bg-slate-950 border border-amber-500/30 rounded-2xl flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-amber-400">Atenção ao copiar links:</strong> O link precisa ser um <strong className="text-white">link direto de imagem</strong> (terminado em <code className="text-amber-300 font-mono">.jpg</code>, <code className="text-amber-300 font-mono">.png</code> ou <code className="text-amber-300 font-mono">.webp</code>).
                Se você colar o link de uma página de notícias (como <em>poder360.com.br/materia/...</em>), o navegador não exibirá a imagem.
              </p>
            </div>
          </div>

          <form onSubmit={handleSavePhotos} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Photo Lula */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-red-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-red-400 uppercase">URL da Foto ({match.teamAName})</label>
                  <button
                    type="button"
                    onClick={() => setPhotoA(DEFAULT_LULA_PHOTO)}
                    className="text-[10px] text-red-400 hover:text-white flex items-center gap-1 font-mono"
                  >
                    <RefreshCw className="w-3 h-3" /> Usar Foto Oficial
                  </button>
                </div>

                <input
                  type="text"
                  value={photoA}
                  onChange={(e) => setPhotoA(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-red-500"
                  placeholder="https://link-direto-da-imagem.jpg"
                />

                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={photoA}
                    alt="Preview Lula"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_LULA_PHOTO;
                    }}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white"
                  />
                  <div className="text-[11px] font-mono">
                    <span className="text-slate-400 block">Pré-visualização</span>
                    <span className="text-emerald-400 text-[10px]">✓ Foto Carregada</span>
                  </div>
                </div>
              </div>

              {/* Photo Bolsonaro */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-400 uppercase">URL da Foto ({match.teamBName})</label>
                  <button
                    type="button"
                    onClick={() => setPhotoB(DEFAULT_BOLSONARO_PHOTO)}
                    className="text-[10px] text-blue-400 hover:text-white flex items-center gap-1 font-mono"
                  >
                    <RefreshCw className="w-3 h-3" /> Usar Foto Oficial
                  </button>
                </div>

                <input
                  type="text"
                  value={photoB}
                  onChange={(e) => setPhotoB(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  placeholder="https://link-direto-da-imagem.jpg"
                />

                <div className="flex items-center gap-3 pt-1">
                  <img
                    src={photoB}
                    alt="Preview Bolsonaro"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_BOLSONARO_PHOTO;
                    }}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white"
                  />
                  <div className="text-[11px] font-mono">
                    <span className="text-slate-400 block">Pré-visualização</span>
                    <span className="text-emerald-400 text-[10px]">✓ Foto Carregada</span>
                  </div>
                </div>
              </div>

            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-gradient-to-r from-red-600 to-blue-600 hover:from-red-500 hover:to-blue-500 text-white font-black text-sm uppercase shadow-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.01]"
            >
              <Save className="w-5 h-5" /> SALVAR FOTOS AGORA
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
