import { insforgeServer } from "@/lib/insforge-server";
import { NextRequest } from "next/server";

// POST /api/rooms/events — publish a game event (stored in DB for polling)
export async function POST(request: Request) {
  const { room_code, event, payload } = await request.json();

  if (!room_code || !event) {
    return Response.json({ error: "Missing room_code or event" }, { status: 400 });
  }

  try {
    // For score_update and game_complete, update the room's player_scores field
    if (event === "score_update" || event === "game_complete") {
      // Fetch current room to get existing player_scores
      const { data: rooms } = await insforgeServer.database
        .from("quiz_rooms")
        .select("*")
        .eq("room_code", room_code);

      if (!rooms || rooms.length === 0) {
        return Response.json({ error: "Room not found" }, { status: 404 });
      }

      const room = rooms[0];
      const existingScores = (typeof room.player_scores === "string"
        ? JSON.parse(room.player_scores)
        : room.player_scores) || {};

      // Update this player's score data
      const userId = payload.userId as string;
      existingScores[userId] = {
        score: event === "game_complete" ? payload.finalScore : payload.score,
        currentIndex: payload.currentIndex || 0,
        finished: event === "game_complete",
      };

      const updates: Record<string, unknown> = { player_scores: existingScores };

      // If game_start, also update status
      if (event === "game_start") {
        updates.status = "playing";
      }

      await insforgeServer.database
        .from("quiz_rooms")
        .update(updates)
        .eq("room_code", room_code);
    }

    if (event === "game_start") {
      await insforgeServer.database
        .from("quiz_rooms")
        .update({ status: "playing" })
        .eq("room_code", room_code);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Event publish error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to publish event" },
      { status: 500 }
    );
  }
}

// GET /api/rooms/events?code=ABC123 — poll for game state
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return Response.json({ error: "Room code is required" }, { status: 400 });
  }

  try {
    const { data, error } = await insforgeServer.database
      .from("quiz_rooms")
      .select("*")
      .eq("room_code", code);

    if (error || !data || data.length === 0) {
      return Response.json({ error: "Room not found" }, { status: 404 });
    }

    const room = data[0];
    const playerScores = (typeof room.player_scores === "string"
      ? JSON.parse(room.player_scores)
      : room.player_scores) || {};

    return Response.json({
      status: room.status,
      guest_id: room.guest_id,
      guest_name: room.guest_name,
      player_scores: playerScores,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
