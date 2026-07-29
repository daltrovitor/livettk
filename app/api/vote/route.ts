import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, points = 1, username = "Anônimo", type = "COMMENT", payload = "" } = body;

    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .limit(1)
      .single();

    if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

    const deltaA = team === "A" ? points : 0;
    const deltaB = team === "B" ? points : 0;

    const newScoreA = Math.max(0, (match.team_a_score || match.teamAScore || 0) + deltaA);
    const newScoreB = Math.max(0, (match.team_b_score || match.teamBScore || 0) + deltaB);
    const newLeader = newScoreA > newScoreB ? "A" : newScoreB > newScoreA ? "B" : "TIE";

    const { data: updatedMatch } = await supabase
      .from("matches")
      .update({
        team_a_score: newScoreA,
        team_b_score: newScoreB,
        current_leader: newLeader
      })
      .eq("id", match.id)
      .select()
      .single();

    await supabase.from("vote_logs").insert({
      match_id: match.id,
      username,
      type,
      payload,
      points,
      team
    });

    return NextResponse.json({ success: true, match: updatedMatch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to vote" }, { status: 500 });
  }
}
