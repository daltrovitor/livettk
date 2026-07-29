export interface MatchDataStore {
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

export interface GiftRuleItemStore {
  id: string;
  giftId: string;
  giftName: string;
  pointValue: number;
  icon: string;
  targetTeam: "A" | "B" | "BOTH";
}

const DEFAULT_LULA_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg/400px-Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg";
const DEFAULT_BOLSONARO_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jair_Bolsonaro_in_2023.jpg/400px-Jair_Bolsonaro_in_2023.jpg";

const initialMatch: MatchDataStore = {
  id: "00000000-0000-0000-0000-000000000001",
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
};

const initialGiftRules: GiftRuleItemStore[] = [
  { id: "1", giftId: "football", giftName: "Bola", pointValue: 1, icon: "⚽", targetTeam: "A" },
  { id: "2", giftId: "panda", giftName: "Panda", pointValue: 10, icon: "🐼", targetTeam: "A" },
  { id: "3", giftId: "heart", giftName: "Coração", pointValue: 20, icon: "❤️", targetTeam: "A" },
  { id: "4", giftId: "rose", giftName: "Rosa", pointValue: 1, icon: "🌹", targetTeam: "B" },
  { id: "5", giftId: "fire", giftName: "Fogo", pointValue: 10, icon: "🔥", targetTeam: "B" },
  { id: "6", giftId: "gamepad", giftName: "Controle", pointValue: 20, icon: "🎮", targetTeam: "B" }
];

declare global {
  var __matchStore: MatchDataStore | undefined;
  var __giftRulesStore: GiftRuleItemStore[] | undefined;
}

if (!globalThis.__matchStore) {
  globalThis.__matchStore = initialMatch;
}

if (!globalThis.__giftRulesStore) {
  globalThis.__giftRulesStore = initialGiftRules;
}

export function getMatchStore(): MatchDataStore {
  return globalThis.__matchStore!;
}

export function updateMatchStore(partialData: Partial<MatchDataStore>): MatchDataStore {
  globalThis.__matchStore = {
    ...globalThis.__matchStore!,
    ...partialData
  };
  return globalThis.__matchStore;
}

export function getGiftRulesStore(): GiftRuleItemStore[] {
  return globalThis.__giftRulesStore!;
}

export function updateGiftRuleInStore(rule: GiftRuleItemStore): GiftRuleItemStore[] {
  const rules = globalThis.__giftRulesStore || [];
  const idx = rules.findIndex(r => r.id === rule.id || r.giftId === rule.giftId);
  if (idx >= 0) {
    rules[idx] = { ...rules[idx], ...rule };
  } else {
    rules.push(rule);
  }
  globalThis.__giftRulesStore = rules;
  return rules;
}
