"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatAllocator from "@/components/StatAllocator";
import FightReplay from "@/components/FightReplay";
import FightSummary from "@/components/FightSummary";
import { simulateFight, FightResult } from "@/lib/fight-engine";
import { GladiatorStats, TOTAL_POINTS, STAT_LABELS } from "@/lib/contract";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";
import sdk from "@farcaster/miniapp-sdk";

// Aitor â€” Easy difficulty. 25 pts. STR:6 SPD:5 DEF:5 INT:5 LCK:4
const AITOR_STATS: GladiatorStats = {
  strength: 6,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 4,
};

const DEFAULT_PLAYER_STATS: GladiatorStats = {
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

const FIGHT_TYPE = "aitor";

function lsKey(wallet: string) {
  return `gladaitor_last_stats_${FIGHT_TYPE}_${wallet.toLowerCase()}`;
}

function loadSavedStats(wallet: string): GladiatorStats | null {
  try {
    const raw = localStorage.getItem(lsKey(wallet));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GladiatorStats;
    const keys: (keyof GladiatorStats)[] = ["strength", "speed", "defense", "intel", "luck"];
    if (keys.every((k) => typeof parsed[k] === "number")) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function saveStats(wallet: string, stats: GladiatorStats) {
  try {
    localStorage.setItem(lsKey(wallet), JSON.stringify(stats));
  } catch {
    // ignore
  }
}

type Step = "configure" | "replay" | "result";

export default function FightAitor() {
  const router = useRouter();
  const { address, fid, isAuthed } = useFarcasterAuth();

  // Unified identifier for points tracking: wallet address if connected, fid: prefix otherwise
  const playerId = address ?? (fid ? `fid:${fid}` : null);

  const [step, setStep] = useState<Step>("configure");
  const [playerStats, setPlayerStats] = useState<GladiatorStats>(DEFAULT_PLAYER_STATS);
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const [sharedPoints, setSharedPoints] = useState(false);
  const [pointsAwarded, setPointsAwarded] = useState(false);

  const statsValid =
    Object.values(playerStats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  // Load last-used stats from localStorage when any identifier is available
  useEffect(() => {
    if (!playerId) return;
    const saved = loadSavedStats(playerId);
    if (saved) setPlayerStats(saved);
  }, [playerId]);

  function startFight() {
    if (!statsValid) return;

    // Persist this build so the allocator pre-fills next time
    if (playerId) saveStats(playerId, playerStats);

    // Compute fight eagerly before entering replay
    const result = simulateFight(playerStats, AITOR_STATS);
    setFightResult(result);
    setStep("replay");

    // Award points keyed to playerId (wallet address or fid: string)
    if (playerId && !pointsAwarded) {
      setPointsAwarded(true);
      fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: playerId, action: "bot_fight_completed" }),
      }).catch(() => {});

      if (result.winner === "p1") {
        fetch("/api/points/award", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: playerId, action: "bot_fight_won" }),
        }).catch(() => {});
      }
    }
  }

  async function handleShare() {
    if (sharedPoints || !fightResult) return;
    const playerWon = fightResult.winner === "p1";
    const miniAppUrl = "https://gladaitors.vercel.app";
    const opponentName = "AITOR";
    const shareText = playerWon
      ? `Just defeated ${opponentName} in GLADAITORS ⚔️ ${Math.round(fightResult.totalDamageByP1)} pts — ${miniAppUrl}`
      : `Lost to ${opponentName} in GLADAITORS — rematch incoming ⚔️ ${miniAppUrl}`;

    try {
      await sdk.actions.composeCast({ text: shareText });
    } catch {
      window.open(
        `https://farcaster.xyz/~/compose?text=${encodeURIComponent(shareText)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }

    if (playerId) {
      const playerSlug = playerId.startsWith("fid:")
        ? playerId.slice(4)
        : playerId.slice(2, 10);
      const shareMatchId = `aitor-${playerSlug}-${Date.now()}`;
      await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: playerId,
          action: "share_fight_result",
          matchId: shareMatchId,
        }),
      }).catch(() => {});
      setSharedPoints(true);
    }
  }

  // â”€â”€ CONFIGURE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === "configure") {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Navbar showBack><WalletButton /></Navbar>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          {/* Aitor profile card */}
          <div className="bg-gray-900 border border-purple-800 rounded-lg p-5 mb-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-black tracking-widest text-purple-300 uppercase">
                    AITOR
                  </span>
                  <span className="bg-purple-900 text-purple-300 text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-purple-700">
                    EASY
                  </span>
                </div>
                <p className="text-xs text-gray-500 italic">
                  Forged in the digital arena. Undefeated until you.
                </p>
              </div>
              <div className="text-3xl">ðŸ¤–</div>
            </div>

            <div className="mt-4 space-y-1.5">
              {STAT_LABELS.map((stat) => {
                const val = AITOR_STATS[stat];
                return (
                  <div key={stat} className="flex items-center gap-2">
                    <span className="text-xs text-purple-400 uppercase w-8 font-bold">
                      {stat.slice(0, 3).toUpperCase()}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(val / 10) * 100}%`,
                          background: "linear-gradient(90deg, #6d28d9, #a855f7)",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 w-4 text-right tabular-nums">
                      {val}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-xs text-gray-600 text-right">
              Total: {Object.values(AITOR_STATS).reduce((a, b) => a + b, 0)} pts
            </div>
          </div>

          {/* Player stat allocator */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-5">
            <label className="block text-xs text-gray-400 uppercase tracking-widest mb-4">
              Build Your Gladaitor
            </label>
            <StatAllocator
              stats={playerStats}
              onChange={setPlayerStats}
              disabled={false}
              onReset={() => setPlayerStats(DEFAULT_PLAYER_STATS)}
            />
          </div>

          {!statsValid && (
            <p className="text-xs text-red-400 text-center mb-3">
              Allocate all {TOTAL_POINTS} stat points before continuing.
            </p>
          )}

          <button
            className="btn-bot w-full text-base py-4"
            onClick={startFight}
            disabled={!isAuthed || !statsValid}
          >
            ENTER THE PIT
          </button>

          {!isAuthed && (
            <p className="text-gray-500 text-xs text-center mt-2 animate-pulse">
              Connecting to Farcaster...
            </p>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  // â”€â”€ REPLAY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === "replay" && fightResult) {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Navbar showProfile={false}><WalletButton /></Navbar>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            <FightReplay
              result={fightResult}
              p1Label="YOU"
              p2Label="AITOR"
              viewerRole="p1"
              onDone={() => setStep("result")}
              onPlayAgain={() => {
                setStep("configure");
                setFightResult(null);
              }}
              onHome={() => router.push("/")}
            />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // â”€â”€ RESULT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === "result" && fightResult) {
    const playerWon = fightResult.winner === "p1";

    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Navbar showBack><WalletButton /></Navbar>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <FightSummary
            result={fightResult}
            p1Label="YOU"
            p2Label="AITOR"
            p1Stats={playerStats}
            p2Stats={AITOR_STATS}
            isP1Winner={playerWon}
            viewerRole="p1"
            opponentName="Aitor"
            onShare={handleShare}
            shareLabel={sharedPoints ? "Shared! (+20 pts)" : "Share Your Result (+20 pts)"}
            sharedAlready={sharedPoints}
            onPlayAgain={() => {
              setStep("configure");
              setFightResult(null);
              setPointsAwarded(false);
              setSharedPoints(false);
            }}
            onHome={() => router.push("/")}
            pointsLine={
              <span>
                <span className="text-amber-400 font-bold">
                  +{playerWon ? "30" : "10"} pts
                </span>{" "}
                earned{playerWon ? " (10 complete + 20 win bonus)" : " (fight complete)"}
              </span>
            }
          />
          <div className="mt-2 text-xs text-gray-600 text-center">BOT FIGHT â€” no USDC at stake</div>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}

