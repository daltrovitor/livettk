import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import { PrismaClient } from "@prisma/client";
import { WebcastPushConnection } from "tiktok-live-connector";
import cors from "cors";

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let activeMatch = null;
let giftRules = [];
let tiktokConnection = null;
let tiktokConnectedUser = "";
let isConnectingTikTok = false;

// Initialize Default Data
async function initializeData() {
  try {
    let match = await prisma.match.findFirst();
    if (!match) {
      match = await prisma.match.create({
        data: {
          title: "BATALHA POPULAR",
          teamAName: "Lula",
          teamAPhoto: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=400&fit=crop",
          teamAColor: "#dc2626",
          teamAScore: 751,
          teamBName: "Bolsonaro",
          teamBPhoto: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=400&fit=crop",
          teamBColor: "#2563eb",
          teamBScore: 1070,
          status: "VOTING",
          multiplier: 1,
          ruleTeamA: "13",
          ruleTeamB: "22",
          currentLeader: "B"
        }
      });
    }
    activeMatch = match;

    const defaultGifts = [
      { giftId: "football", giftName: "Bola", pointValue: 1, icon: "⚽", targetTeam: "A" },
      { giftId: "panda", giftName: "Panda", pointValue: 10, icon: "🐼", targetTeam: "A" },
      { giftId: "heart", giftName: "Coração", pointValue: 20, icon: "❤️", targetTeam: "A" },
      { giftId: "rose", giftName: "Rosa", pointValue: 1, icon: "🌹", targetTeam: "B" },
      { giftId: "fire", giftName: "Fogo", pointValue: 10, icon: "🔥", targetTeam: "B" },
      { giftId: "gamepad", giftName: "Controle", pointValue: 20, icon: "🎮", targetTeam: "B" }
    ];

    for (const g of defaultGifts) {
      const existing = await prisma.giftRule.findUnique({ where: { giftId: g.giftId } });
      if (!existing) {
        await prisma.giftRule.create({ data: g });
      }
    }

    giftRules = await prisma.giftRule.findMany();
  } catch (err) {
    if (!activeMatch) {
      activeMatch = {
        id: "1",
        title: "BATALHA POPULAR",
        teamAName: "Lula",
        teamAPhoto: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=400&fit=crop",
        teamAColor: "#dc2626",
        teamAScore: 751,
        teamBName: "Bolsonaro",
        teamBPhoto: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=400&fit=crop",
        teamBColor: "#2563eb",
        teamBScore: 1070,
        status: "VOTING",
        multiplier: 1,
        ruleTeamA: "13",
        ruleTeamB: "22",
        currentLeader: "B"
      };
      giftRules = [
        { id: "1", giftId: "football", giftName: "Bola", pointValue: 1, icon: "⚽", targetTeam: "A" },
        { id: "2", giftId: "panda", giftName: "Panda", pointValue: 10, icon: "🐼", targetTeam: "A" },
        { id: "3", giftId: "heart", giftName: "Coração", pointValue: 20, icon: "❤️", targetTeam: "A" },
        { id: "4", giftId: "rose", giftName: "Rosa", pointValue: 1, icon: "🌹", targetTeam: "B" },
        { id: "5", giftId: "fire", giftName: "Fogo", pointValue: 10, icon: "🔥", targetTeam: "B" },
        { id: "6", giftId: "gamepad", giftName: "Controle", pointValue: 20, icon: "🎮", targetTeam: "B" }
      ];
    }
  }
}

// Score updates
async function updateScoresAndLeader(deltaA, deltaB, username, type, payload) {
  if (!activeMatch || activeMatch.status !== "VOTING") return;

  const oldLeader = activeMatch.currentLeader;
  const newScoreA = Math.max(0, activeMatch.teamAScore + deltaA);
  const newScoreB = Math.max(0, activeMatch.teamBScore + deltaB);

  let newLeader = "TIE";
  if (newScoreA > newScoreB) newLeader = "A";
  else if (newScoreB > newScoreA) newLeader = "B";

  activeMatch.teamAScore = newScoreA;
  activeMatch.teamBScore = newScoreB;
  activeMatch.currentLeader = newLeader;

  try {
    const updatedMatch = await prisma.match.update({
      where: { id: activeMatch.id },
      data: {
        teamAScore: newScoreA,
        teamBScore: newScoreB,
        currentLeader: newLeader
      }
    });
    activeMatch = updatedMatch;
  } catch (e) {}

  const totalAdded = deltaA + deltaB;
  if (totalAdded !== 0 && username) {
    const teamAssigned = deltaA > 0 && deltaB === 0 ? "A" : deltaB > 0 && deltaA === 0 ? "B" : "BOTH";
    try {
      await prisma.voteLog.create({
        data: {
          matchId: activeMatch.id,
          username,
          type,
          payload: payload || "",
          points: Math.abs(totalAdded),
          team: teamAssigned
        }
      });
      if (type === "GIFT") {
        await prisma.donor.upsert({
          where: { username },
          update: {
            totalPoints: { increment: Math.abs(totalAdded) },
            totalGifts: { increment: 1 }
          },
          create: {
            username,
            totalPoints: Math.abs(totalAdded),
            totalGifts: 1
          }
        });
      }
    } catch (e) {}
  }

  if (oldLeader !== newLeader && newLeader !== "TIE") {
    const leaderName = newLeader === "A" ? activeMatch.teamAName : activeMatch.teamBName;
    const leaderColor = newLeader === "A" ? activeMatch.teamAColor : activeMatch.teamBColor;
    io.emit("leaderChanged", { newLeader, leaderName, leaderColor });
  }

  io.emit("matchStateUpdated", activeMatch);
}

// Process comment input
function processComment(text) {
  if (!activeMatch || activeMatch.status !== "VOTING") return null;
  const clean = text.toLowerCase().trim();
  const keywordsA = activeMatch.ruleTeamA.toLowerCase().split(",").map(k => k.trim()).filter(Boolean);
  const keywordsB = activeMatch.ruleTeamB.toLowerCase().split(",").map(k => k.trim()).filter(Boolean);

  const isA = keywordsA.some(kw => clean.includes(kw));
  const isB = keywordsB.some(kw => clean.includes(kw));

  if (isA && !isB) return "A";
  if (isB && !isA) return "B";
  return null;
}

// TikTok Live Connector Engine
function setupTikTokConnector(username) {
  if (tiktokConnection) {
    try {
      tiktokConnection.disconnect();
    } catch (e) {}
    tiktokConnection = null;
  }

  const cleanUsername = username.replace(/^@/, "").trim();
  tiktokConnectedUser = cleanUsername;
  isConnectingTikTok = true;
  io.emit("tiktokStatus", { status: "connecting", username: cleanUsername });

  tiktokConnection = new WebcastPushConnection(cleanUsername, {
    processInitialData: true,
    enableExtendedGiftInfo: true
  });

  tiktokConnection.connect()
    .then(state => {
      isConnectingTikTok = false;
      io.emit("tiktokStatus", { status: "connected", username: cleanUsername, roomDetails: state });
      console.log(`Connected to TikTok Live @${cleanUsername}`);
    })
    .catch(err => {
      isConnectingTikTok = false;
      io.emit("tiktokStatus", { status: "error", username: cleanUsername, message: err.message || "Falha ao conectar na live" });
      console.error("TikTok connection error:", err);
    });

  // Chat event
  tiktokConnection.on("chat", data => {
    const comment = data.comment;
    const user = data.nickname || data.uniqueId;
    const team = processComment(comment);
    if (team) {
      const points = 1 * (activeMatch?.multiplier || 1);
      updateScoresAndLeader(team === "A" ? points : 0, team === "B" ? points : 0, user, "COMMENT", comment);
      io.emit("voteEffect", { username: user, team, points, type: "COMMENT", text: comment });
    }
  });

  // Gift event
  tiktokConnection.on("gift", data => {
    if (data.giftType === 1 && data.repeatEnd === false) return;

    const rawGiftName = data.giftName || "Gift";
    const giftId = rawGiftName.toLowerCase().replace(/\s+/g, "_");
    
    const rule = giftRules.find(g => g.giftId === giftId || g.giftName.toLowerCase() === rawGiftName.toLowerCase());
    
    const baseValue = rule ? rule.pointValue : 1;
    const totalPoints = baseValue * (data.repeatCount || 1) * (activeMatch?.multiplier || 1);
    const user = data.nickname || data.uniqueId;

    let targetTeam = rule ? rule.targetTeam : "A";

    if (targetTeam === "A") {
      updateScoresAndLeader(totalPoints, 0, user, "GIFT", rawGiftName);
    } else if (targetTeam === "B") {
      updateScoresAndLeader(0, totalPoints, user, "GIFT", rawGiftName);
    } else {
      updateScoresAndLeader(totalPoints, totalPoints, user, "GIFT", rawGiftName);
    }

    io.emit("giftReceived", {
      username: user,
      giftName: rawGiftName,
      icon: rule ? rule.icon : "🎁",
      points: totalPoints,
      team: targetTeam
    });
  });

  // Like event
  tiktokConnection.on("like", data => {
    const user = data.nickname || data.uniqueId;
    const points = Math.min(data.likeCount || 1, 5) * (activeMatch?.multiplier || 1);
    const targetTeam = Math.random() > 0.5 ? "A" : "B";
    updateScoresAndLeader(targetTeam === "A" ? points : 0, targetTeam === "B" ? points : 0, user, "LIKE", `${data.likeCount} Curtidas`);
  });
}

// Socket handlers
io.on("connection", (socket) => {
  socket.emit("matchStateUpdated", activeMatch);
  socket.emit("giftRulesUpdated", giftRules);
  socket.emit("tiktokStatus", { status: tiktokConnectedUser ? "connected" : "disconnected", username: tiktokConnectedUser });

  socket.on("admin:addVotes", async ({ team, amount }) => {
    const deltaA = team === "A" ? amount : 0;
    const deltaB = team === "B" ? amount : 0;
    await updateScoresAndLeader(deltaA, deltaB, "Administrador", "ADMIN", `${amount > 0 ? '+' : ''}${amount} votos`);
  });

  socket.on("admin:setScore", async ({ scoreA, scoreB }) => {
    const newLeader = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "TIE";
    activeMatch.teamAScore = Math.max(0, scoreA);
    activeMatch.teamBScore = Math.max(0, scoreB);
    activeMatch.currentLeader = newLeader;
    try {
      await prisma.match.update({
        where: { id: activeMatch.id },
        data: { teamAScore: activeMatch.teamAScore, teamBScore: activeMatch.teamBScore, currentLeader: newLeader }
      });
    } catch (e) {}
    io.emit("matchStateUpdated", activeMatch);
  });

  socket.on("admin:reset", async () => {
    activeMatch.teamAScore = 0;
    activeMatch.teamBScore = 0;
    activeMatch.currentLeader = "TIE";
    try {
      await prisma.match.update({
        where: { id: activeMatch.id },
        data: { teamAScore: 0, teamBScore: 0, currentLeader: "TIE" }
      });
      await prisma.voteLog.deleteMany({});
    } catch (e) {}
    io.emit("matchStateUpdated", activeMatch);
  });

  socket.on("admin:setMultiplier", async (multiplier) => {
    activeMatch.multiplier = multiplier;
    try {
      await prisma.match.update({ where: { id: activeMatch.id }, data: { multiplier } });
    } catch (e) {}
    io.emit("matchStateUpdated", activeMatch);
  });

  socket.on("admin:setStatus", async (status) => {
    activeMatch.status = status;
    try {
      await prisma.match.update({ where: { id: activeMatch.id }, data: { status } });
    } catch (e) {}
    io.emit("matchStateUpdated", activeMatch);
  });

  socket.on("admin:updateMatchInfo", async (data) => {
    Object.assign(activeMatch, data);
    try {
      await prisma.match.update({ where: { id: activeMatch.id }, data });
    } catch (e) {}
    io.emit("matchStateUpdated", activeMatch);
  });

  socket.on("admin:updateGiftRule", async ({ id, giftName, pointValue, icon, targetTeam }) => {
    let rule = giftRules.find(g => g.id === id);
    if (rule) {
      if (giftName !== undefined) rule.giftName = giftName;
      if (pointValue !== undefined) rule.pointValue = pointValue;
      if (icon !== undefined) rule.icon = icon;
      if (targetTeam !== undefined) rule.targetTeam = targetTeam;
      try {
        await prisma.giftRule.update({ where: { id }, data: { giftName, pointValue, icon, targetTeam } });
      } catch (e) {}
    }
    io.emit("giftRulesUpdated", giftRules);
  });

  socket.on("admin:simulateEvent", async ({ type, team, username, payload, giftName }) => {
    const user = username || `Simulador_${Math.floor(Math.random() * 900 + 100)}`;
    const mult = activeMatch.multiplier || 1;

    if (type === "COMMENT") {
      const pts = 1 * mult;
      const commentText = payload || (team === "A" ? activeMatch.ruleTeamA.split(",")[0] : activeMatch.ruleTeamB.split(",")[0]);
      await updateScoresAndLeader(team === "A" ? pts : 0, team === "B" ? pts : 0, user, "COMMENT", commentText);
      io.emit("voteEffect", { username: user, team, points: pts, type: "COMMENT", text: commentText });
    } else if (type === "GIFT") {
      const gName = giftName || "Rosa";
      const rule = giftRules.find(g => g.giftName.toLowerCase() === gName.toLowerCase()) || { pointValue: 1, icon: "🎁", targetTeam: team };
      const pts = rule.pointValue * mult;
      const target = rule.targetTeam || team;
      await updateScoresAndLeader(target === "A" ? pts : target === "BOTH" ? pts : 0, target === "B" ? pts : target === "BOTH" ? pts : 0, user, "GIFT", gName);
      io.emit("giftReceived", {
        username: user,
        giftName: gName,
        icon: rule.icon,
        points: pts,
        team: target
      });
    }
  });

  socket.on("admin:connectTikTok", ({ username }) => {
    setupTikTokConnector(username);
  });

  socket.on("admin:disconnectTikTok", () => {
    if (tiktokConnection) {
      try {
        tiktokConnection.disconnect();
      } catch (e) {}
      tiktokConnection = null;
      tiktokConnectedUser = "";
    }
    io.emit("tiktokStatus", { status: "disconnected", username: "" });
  });
});

app.get("/api/state", (req, res) => {
  res.json({ match: activeMatch, giftRules, tiktokUser: tiktokConnectedUser });
});

app.post("/api/vote", async (req, res) => {
  const { team, points, username, type } = req.body;
  if (team && points) {
    await updateScoresAndLeader(team === "A" ? points : 0, team === "B" ? points : 0, username || "API", type || "ADMIN", `${points} Votos`);
    return res.json({ success: true, match: activeMatch });
  }
  res.status(400).json({ error: "Invalid parameters" });
});

const PORT = process.env.PORT || 3000;

nextApp.prepare().then(async () => {
  await initializeData();

  app.all("*", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(PORT, () => {
    console.log(`🚀 TikTok Live & Next.js Unified Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Error starting server:", err);
});
