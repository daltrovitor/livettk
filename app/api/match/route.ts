import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMatchStore, getGiftRulesStore, updateMatchStore } from "@/lib/match-store";

const DEFAULT_LULA_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg/400px-Lula_-_foto_oficial_05_jan_2023_%28cropped%29.jpg";
const DEFAULT_BOLSONARO_PHOTO = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jair_Bolsonaro_in_2023.jpg/400px-Jair_Bolsonaro_in_2023.jpg";

const sanitizePhoto = (url: string | undefined, defaultPhoto: string) => {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return defaultPhoto;
  if (url.includes("poder360.com.br") || url.includes("x.com") || url.includes("twitter.com") || url.includes("/noticias/") || url.includes("/justica/")) {
    return defaultPhoto;
  }
  return url;
};

export async function GET() {
  const currentMemoryMatch = getMatchStore();
  const currentMemoryRules = getGiftRulesStore();

  try {
    const { data: match, error } = await supabase
      .from("matches")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    const { data: giftRules } = await supabase
      .from("gift_rules")
      .select("*")
      .order("point_value", { ascending: true });

    if (!error && match) {
      const sanitizedMatch = {
        id: match.id || currentMemoryMatch.id,
        title: match.title || currentMemoryMatch.title,
        teamAName: match.team_a_name || match.teamAName || currentMemoryMatch.teamAName,
        teamAPhoto: sanitizePhoto(match.team_a_photo || match.teamAPhoto, DEFAULT_LULA_PHOTO),
        teamAColor: match.team_a_color || match.teamAColor || currentMemoryMatch.teamAColor,
        teamAScore: match.team_a_score ?? match.teamAScore ?? currentMemoryMatch.teamAScore,
        teamBName: match.team_b_name || match.teamBName || currentMemoryMatch.teamBName,
        teamBPhoto: sanitizePhoto(match.team_b_photo || match.teamBPhoto, DEFAULT_BOLSONARO_PHOTO),
        teamBColor: match.team_b_color || match.teamBColor || currentMemoryMatch.teamBColor,
        teamBScore: match.team_b_score ?? match.teamBScore ?? currentMemoryMatch.teamBScore,
        status: match.status || currentMemoryMatch.status,
        multiplier: match.multiplier || currentMemoryMatch.multiplier,
        ruleTeamA: match.rule_team_a || match.ruleTeamA || currentMemoryMatch.ruleTeamA,
        ruleTeamB: match.rule_team_b || match.ruleTeamB || currentMemoryMatch.ruleTeamB,
        currentLeader: match.current_leader || match.currentLeader || currentMemoryMatch.currentLeader
      };

      updateMatchStore(sanitizedMatch);

      return NextResponse.json({
        match: sanitizedMatch,
        giftRules: giftRules && giftRules.length > 0 ? giftRules : currentMemoryRules
      });
    }
  } catch (err: any) {
    // Supabase query error, fallback to shared memory store
  }

  return NextResponse.json({
    match: currentMemoryMatch,
    giftRules: currentMemoryRules
  });
}
