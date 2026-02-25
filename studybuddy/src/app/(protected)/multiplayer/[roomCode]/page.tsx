"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { Button, Spinner, Card, CardBody } from "@heroui/react";
import { useAuth } from "@/hooks/useAuth";
import { QUIZ_CONFIG } from "@/lib/constants";
import QuizCard from "@/components/QuizCard";
import QuizProgress from "@/components/QuizProgress";
import MultiplayerScoreboard from "@/components/MultiplayerScoreboard";
import type { QuizRoom, QuizQuestion, PlayerScore } from "@/types";

type GamePhase = "waiting" | "countdown" | "playing" | "finished";

export default function MultiplayerBattlePage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = use(params);
  const { user } = useAuth();

  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [phase, setPhase] = useState<GamePhase>("waiting");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [myFinished, setMyFinished] = useState(false);

  const [players, setPlayers] = useState<PlayerScore[]>([]);

  const isHost = room?.host_id === user?.id;

  // Fetch room data initially and set up questions
  useEffect(() => {
    let stopped = false;

    const fetchRoom = async () => {
      try {
        const res = await fetch(`/api/rooms?code=${roomCode}`);
        const { data } = await res.json();

        if (stopped) return;
        if (data && data.length > 0) {
          const roomData = data[0] as QuizRoom;
          setRoom(roomData);
          if (roomData.questions) {
            setQuestions(
              typeof roomData.questions === "string"
                ? JSON.parse(roomData.questions)
                : roomData.questions
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch room:", err);
      }
    };

    fetchRoom();
    return () => { stopped = true; };
  }, [roomCode]);

  // Poll for game state changes (opponent joining, game start, score updates)
  useEffect(() => {
    if (!user) return;

    const pollState = async () => {
      try {
        const res = await fetch(`/api/rooms/events?code=${roomCode}`);
        if (!res.ok) return;
        const data = await res.json();

        // Detect game start
        if (data.status === "playing" && phase === "waiting") {
          setPhase("playing");
        }

        // Detect opponent joined
        if (data.guest_id && room && !room.guest_id) {
          setRoom((prev) =>
            prev ? { ...prev, guest_id: data.guest_id, guest_name: data.guest_name } : prev
          );
        }

        // Update opponent scores from DB
        const remoteScores = data.player_scores || {};
        setPlayers((prev) => {
          if (prev.length === 0) return prev;
          return prev.map((p) => {
            const remote = remoteScores[p.userId];
            if (remote && p.userId !== user.id) {
              return {
                ...p,
                score: remote.score ?? p.score,
                currentIndex: remote.currentIndex ?? p.currentIndex,
                finished: remote.finished ?? p.finished,
              };
            }
            return p;
          });
        });
      } catch {
        // silent
      }
    };

    const interval = setInterval(pollState, 1500);
    return () => clearInterval(interval);
  }, [roomCode, phase, room, user]);

  // Initialize player scores — only once when room first loads with both players
  const playersInitialized = useRef(false);
  useEffect(() => {
    if (!room || !user || playersInitialized.current) return;

    const initialPlayers: PlayerScore[] = [
      {
        userId: room.host_id,
        userName: room.host_name,
        score: 0,
        currentIndex: 0,
        finished: false,
      },
    ];

    if (room.guest_id && room.guest_name) {
      initialPlayers.push({
        userId: room.guest_id,
        userName: room.guest_name,
        score: 0,
        currentIndex: 0,
        finished: false,
      });
      playersInitialized.current = true;
    }

    setPlayers(initialPlayers);
  }, [room, user]);

  const handleStartGame = async () => {
    await fetch("/api/rooms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_code: roomCode, status: "playing" }),
    });
    setPhase("playing");
  };

  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (!user) return;
      const isCorrect = answerIndex === questions[currentIndex]?.correctAnswer;
      const newScore = isCorrect ? scoreRef.current + 1 : scoreRef.current;
      scoreRef.current = newScore;
      setScore(newScore);

      // Update own score in players list
      setPlayers((prev) =>
        prev.map((p) =>
          p.userId === user.id
            ? { ...p, score: newScore, currentIndex: currentIndex + 1 }
            : p
        )
      );

      // Push score to DB for opponent to poll
      fetch("/api/rooms/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_code: roomCode,
          event: "score_update",
          payload: {
            userId: user.id,
            score: newScore,
            currentIndex: currentIndex + 1,
          },
        }),
      });
    },
    [user, questions, currentIndex, roomCode]
  );

  const handleNext = useCallback(async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      const finalScore = scoreRef.current;
      setMyFinished(true);
      setPhase("finished");

      // Update own finished status in players list
      if (user) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.userId === user.id
              ? { ...p, score: finalScore, finished: true }
              : p
          )
        );

        // Push completion to DB
        fetch("/api/rooms/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            room_code: roomCode,
            event: "game_complete",
            payload: { userId: user.id, finalScore },
          }),
        });

        // Save score to leaderboard
        await fetch("/api/quiz/save-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            user_name: user.name || user.email,
            topic: room?.topic || "unknown",
            score: finalScore,
            total: QUIZ_CONFIG.questionsPerQuiz,
          }),
        });
      }
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, questions.length, user, room, roomCode]);

  if (!room || !user) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" label="Loading room..." />
      </div>
    );
  }

  // Waiting phase
  if (phase === "waiting") {
    const hasGuest = !!room.guest_id || players.length > 1;

    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <h2 className="text-2xl font-bold">
          Room: {roomCode}
        </h2>
        <p className="text-default-500">Topic: {room.topic}</p>

        <Card>
          <CardBody className="p-6 space-y-4">
            <p className="font-medium">
              Host: {room.host_name}
            </p>
            {hasGuest ? (
              <p className="text-success font-medium">
                Guest: {room.guest_name || players[1]?.userName}
              </p>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Spinner size="sm" />
                <p className="text-default-500">Waiting for opponent...</p>
              </div>
            )}

            {isHost && hasGuest && (
              <Button
                color="primary"
                size="lg"
                onPress={handleStartGame}
                isDisabled={!questions.length}
              >
                Start Game
              </Button>
            )}

            {!isHost && (
              <p className="text-default-400 text-sm">
                Waiting for host to start the game...
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  // Finished phase
  if (phase === "finished") {
    const allFinished = players.every((p) => p.finished);
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <h2 className="text-2xl font-bold">
          {myFinished ? "You finished!" : "Game Over!"}
        </h2>

        {allFinished ? (
          <Card>
            <CardBody className="p-6 space-y-4">
              <p className="text-3xl font-bold text-primary">
                {winner.userName} wins!
              </p>
              {sortedPlayers.map((p, i) => (
                <div key={p.userId} className="flex justify-between">
                  <span>
                    {i === 0 ? "🏆" : "🥈"} {p.userName}
                  </span>
                  <span className="font-mono">
                    {p.score}/{questions.length}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-default-500">
              Your score: {score}/{questions.length}
            </p>
            <div className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              <p className="text-default-400">Waiting for opponent to finish...</p>
            </div>
          </div>
        )}

        <MultiplayerScoreboard
          players={players}
          totalQuestions={questions.length}
        />
      </div>
    );
  }

  // Playing phase
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-3 space-y-6">
        <QuizProgress current={currentIndex} total={questions.length} />
        <QuizCard
          question={currentQuestion}
          onAnswer={handleAnswer}
          onNext={handleNext}
          isLast={currentIndex === questions.length - 1}
        />
      </div>
      <div className="md:col-span-1">
        <MultiplayerScoreboard
          players={players}
          totalQuestions={questions.length}
        />
      </div>
    </div>
  );
}
