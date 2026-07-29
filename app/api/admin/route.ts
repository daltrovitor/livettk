import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getMatchStore, updateMatchStore, updateGiftRuleInStore } from "@/lib/match-store";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, team, amount, scoreA, scoreB, multiplier, status, matchInfo, giftRule } = body;

    let currentMatch = getMatchStore();

    // Try fetching existing DB match to keep fields synced
    try {
      const { data: dbMatch } = await supabase.from("matches").select("*").limit(1).single();
      if (dbMatch) {
        currentMatch = {
          ...currentMatch,
          teamAScore: dbMatch.team_a_score ?? currentMatch.teamAScore,
          teamBScore: dbMatch.team_b_score ?? currentMatch.teamBScore,
          currentLeader: dbMatch.current_leader ?? currentMatch.currentLeader
        };
      }
    } catch (e) {}

    let patch: any = {};

    if (action === "addVotes") {
      const deltaA = team === "A" ? amount : 0;
      const deltaB = team === "B" ? amount : 0;
      const currentA = currentMatch.teamAScore || 0;
      const currentB = currentMatch.teamBScore || 0;
      const newA = Math.max(0, currentA + deltaA);
      const newB = Math.max(0, currentB + deltaB);
      const newLeader = newA > newB ? "A" : newB > newA ? "B" : "TIE";

      patch = {
        teamAScore: newA,
        teamBScore: newB,
        currentLeader: newLeader
      };

      try {
        await supabase.from("vote_logs").insert({
          username: "Administrador",
          type: "ADMIN",
          payload: `${amount > 0 ? "+" : ""}${amount} votos`,
          points: Math.abs(amount),
          team: team || "A"
        });
      } catch (e) {}
    } else if (action === "setScore") {
      const newA = Math.max(0, scoreA ?? 0);
      const newB = Math.max(0, scoreB ?? 0);
      const newLeader = newA > newB ? "A" : newB > newA ? "B" : "TIE";

      patch = {
        teamAScore: newA,
        teamBScore: newB,
        currentLeader: newLeader
      };
    } else if (action === "reset") {
      patch = {
        teamAScore: 0,
        teamBScore: 0,
        currentLeader: "TIE"
      };
      try {
        await supabase.from("vote_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (e) {}
    } else if (action === "setMultiplier") {
      patch = { multiplier: multiplier || 1 };
    } else if (action === "setStatus") {
      patch = { status: status || "VOTING" };
    } else if (action === "updateMatchInfo") {
      patch = {
        title: matchInfo.title || currentMatch.title,
        teamAName: matchInfo.teamAName || currentMatch.teamAName,
        teamAPhoto: matchInfo.teamAPhoto || currentMatch.teamAPhoto,
        ruleTeamA: matchInfo.ruleTeamA || currentMatch.ruleTeamA,
        teamBName: matchInfo.teamBName || currentMatch.teamBName,
        teamBPhoto: matchInfo.teamBPhoto || currentMatch.teamBPhoto,
        ruleTeamB: matchInfo.ruleTeamB || currentMatch.ruleTeamB
      };
    } else if (action === "updateGiftRule") {
      if (giftRule) {
        updateGiftRuleInStore(giftRule);
        try {
          await supabase.from("gift_rules").upsert({
            id: giftRule.id,
            gift_id: giftRule.giftId || giftRule.id,
            gift_name: giftRule.giftName,
            point_value: giftRule.pointValue,
            icon: giftRule.icon,
            target_team: giftRule.targetTeam
          });
        } catch (e) {}
      }
      return NextResponse.json({ success: true });
    }

    // Update shared memory store
    const updatedMatch = updateMatchStore(patch);

    // Sync to Supabase table
    try {
      const dbPayload = {
        id: updatedMatch.id,
        title: updatedMatch.title,
        team_a_name: updatedMatch.teamAName,
        team_a_photo: updatedMatch.teamAPhoto,
        team_a_score: updatedMatch.teamAScore,
        team_b_name: updatedMatch.teamBName,
        team_b_photo: updatedMatch.teamBPhoto,
        team_b_score: updatedMatch.teamBScore,
        status: updatedMatch.status,
        multiplier: updatedMatch.multiplier,
        rule_team_a: updatedMatch.ruleTeamA,
        rule_team_b: updatedMatch.ruleTeamB,
        current_leader: updatedMatch.currentLeader,
        updated_at: new Date().toISOString()
      };

      await supabase.from("matches").upsert(dbPayload);
    } catch (e) {}

    return NextResponse.json({ success: true, match: updatedMatch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Admin action failed" }, { status: 500 });
  }
}
