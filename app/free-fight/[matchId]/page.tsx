"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StatAllocator from "@/components/StatAllocator";
import FightReplay from "@/components/FightReplay";
import FightSummary from "@/components/FightSummary";
import { simulateFight, FightResult } from "@/lib/fight-engine";
import type { GladiatorStats } from "@/lib/contract";
import { TOTAL_POINTS } from "@/lib/contract";
import type { FreeMatch } from "@/lib/kv";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";
import { resolveUsername } from "@/lib/resolveUsername";

const DEFAULT_STATS: GladiatorStats = {
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

type ViewState =
  | "loading"        // fetching match from KV
  | "connecting"     // match loaded, waiting for wallet address to resolve
  | "configure"      // p2 slot open — let the user build their gladiator
  | "joining"        // join API call in-flight
  | "waiting_p2"     // p1 waiting for opponent
  | "replay"
  | "result"
  | "error";

export default function FreeFightRoom({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const router = useRouter();
  const { address, fid, isAuthed, isMiniAppReady } = useFarcasterAuth();

  // Unified player identifier: wallet address if connected, fid: prefix otherwise
  const playerId = address ?? (fid ? `fid:${fid}` : null);

  const [view, setView] = useState<ViewState>("loading");
  const [match, setMatch] = useState<FreeMatch | null>(null);
  // Ref mirrors match state so interval callbacks (stale closures) can always
  // access the most-recently-loaded match data.
  const matchRef = useRef<FreeMatch | null>(null);
  // Separate ref that captures stats1 from the very first successful load and
  // is NEVER overwritten. This is the fix for the creator stuck on
  // "WAITING FOR OPPONENT": loadMatch() is called on every poll tick and
  // overwrites matchRef.current — so using matchRef as the stats1 fallback
  // doesn't help if the first polled "ready" record also lacks stats1 (KV lag).
  // stats1Ref holds the original creator stats regardless of poll results.
  const stats1Ref = useRef<FreeMatch["stats1"] | null>(null);
  const [myRole, setMyRole] = useState<"p1" | "p2" | "spectator">("spectator");
  const [stats, setStats] = useState<GladiatorStats>(DEFAULT_STATS);
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const [sharedPoints, setSharedPoints] = useState(false);
  const [opponentUsername, setOpponentUsername] = useState<string | null>(null);
  const [p1Label, setP1Label] = useState<string>("Player 1");
  const [p2Label, setP2Label] = useState<string>("Player 2");

  const statsValid =
    Object.values(stats).reduce((a, b) => a + b, 0) === TOTAL_POINTS;

  const loadMatch = useCallback(async () => {
    const res = await fetch(`/api/free-match/${matchId}`);
    if (!res.ok) {
      setView("error");
      return null;
    }
    const m: FreeMatch = await res.json();
    setMatch(m);
    matchRef.current = m;
    // Capture stats1 the first time we see it — never overwrite so the creator's
    // original stats survive across multiple poll iterations.
    if (m.stats1 && !stats1Ref.current) {
      stats1Ref.current = m.stats1;
    }
    return m;
  }, [matchId]);

  // ── Effect 1: Load the match immediately on mount — no auth gate ────────────
  // We don't need to know who the viewer is to fetch match data. Auth resolves
  // in parallel via Effect 2 below.
  useEffect(() => {
    loadMatch().then((m) => {
      if (!m) return; // error state already set inside loadMatch
      // Match loaded but we don't know the viewer's address yet.
      // Transition to "connecting" so Effect 2 can determine the role once
      // address resolves. If address is already available (fast auth), Effect 2
      // will run immediately after this render and set the real view.
      setView("connecting");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]); // intentionally only on matchId — we want a single load on mount

  // ── Effect 2: Determine role and view once BOTH match AND address are known ─
  // Runs whenever match or address changes. Safe to run multiple times — it's
  // idempotent as long as we're still in the "connecting" state (i.e. haven't
  // yet transitioned to a real view). Once we leave "connecting", we don't
  // re-run role detection so we don't clobber the join/replay flow.
  useEffect(() => {
    if (!match) return;           // match not loaded yet
    if (view !== "connecting") return; // already resolved role, don't overwrite

    // If MiniKit hasn't fired ready yet, neither address nor fid may be known yet.
    // Stay in "connecting" until we have at least one identifier (address or fid).
    // Once isMiniAppReady is true (or we're not in a mini app), whatever we have is final.
    if (playerId === null && !isMiniAppReady) return; // still loading auth

    resolveRoleAndView(match, playerId?.toLowerCase() ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, address, fid, isMiniAppReady, view]);

  async function resolveRoleAndView(m: FreeMatch, me: string | null) {
    if (me && m.player1 === me) {
      setMyRole("p1");
      if (m.state === "waiting") {
        setView("waiting_p2");
      } else if (m.state === "ready") {
        runFight(m);
      } else {
        await resolveLabels(m);
        setView("result");
      }
    } else if (me && m.player2 === me) {
      setMyRole("p2");
      if (m.state === "ready") runFight(m);
      else {
        await resolveLabels(m);
        setView("result");
      }
    } else if (!m.player2) {
      // p2 slot is open — invite the viewer to join
      setMyRole("spectator");
      setView("configure");
    } else {
      // Both slots filled, viewer is a spectator
      setMyRole("spectator");
      if (m.state === "ready") runFight(m);
      else {
        await resolveLabels(m);
        setView("result");
      }
    }
  }

  // Resolve display labels for both players — used when going straight to the
  // result view (match already resolved on page load) without running through runFight.
  async function resolveLabels(m: FreeMatch) {
    const [l1, l2] = await Promise.all([
      resolveUsername(m.player1, m.player1Fid ?? undefined),
      resolveUsername(m.player2 ?? "???", m.player2Fid ?? undefined),
    ]);
    setP1Label(l1);
    setP2Label(l2);
    // Set opponentUsername so FightSummary taunts have a name to work with
    setOpponentUsername(null); // will be derived from label in result render
  }

  // ── Poll while waiting for player2 ──────────────────────────────────────────
  // Root cause of the original bug: the join route writes stats2 + state:"ready"
  // in one KV set. If Vercel KV read-after-write hits a lagging replica, the
  // polled "ready" record may be missing stats1 (written by an earlier PATCH).
  //
  // Fix: stats1Ref captures stats1 from the very first load and is never
  // overwritten. loadMatch() overwrites matchRef.current on every call, so
  // matchRef is NOT a reliable fallback — by the time the opponent joins and the
  // poll fires, matchRef.current holds the most recent poll result which may also
  // lack stats1 if the replica is lagging. stats1Ref survives all polls.
  useEffect(() => {
    if (view !== "waiting_p2") return;
    const interval = setInterval(async () => {
      const m = await loadMatch();
      if (!m || m.state !== "ready") return; // still waiting — keep polling

      // Use stats1Ref as the authoritative fallback for the creator's stats.
      // stats1Ref is set once (on the first load that contains stats1) and
      // never overwritten, so it survives across all subsequent poll iterations.
      const stats1 = m.stats1 ?? stats1Ref.current;
      if (!stats1 || !m.stats2) {
        // Stats not yet propagated — keep polling, do NOT clear interval yet
        return;
      }

      // Both stats confirmed present — stop polling and run the fight
      clearInterval(interval);
      runFight({ ...m, stats1 });
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function runFight(m: FreeMatch) {
    if (!m.stats1 || !m.stats2) return;
    const result = simulateFight(m.stats1, m.stats2);
    setFightResult(result);

    // Resolve both player labels before showing the replay screen so names
    // are present from the first frame — no flash of raw FIDs/addresses.
    const [resolvedP1, resolvedP2] = await Promise.all([
      resolveUsername(m.player1, m.player1Fid ?? undefined),
      resolveUsername(m.player2 ?? "???", m.player2Fid ?? undefined),
    ]);
    setP1Label(resolvedP1);
    setP2Label(resolvedP2);

    // Derive opponent label for taunts — viewer's opponent is the other player.
    const myAddr = playerId?.toLowerCase() ?? "";
    const iAmP1 = m.player1 === myAddr;
    const opponentLabel = iAmP1 ? resolvedP2 : resolvedP1;
    setOpponentUsername(opponentLabel);

    const isDraw = result.winner === "draw";
    const winner = isDraw ? null : result.winner === "p1" ? m.player1 : m.player2!;
    const loser = isDraw ? null : result.winner === "p1" ? m.player2! : m.player1;
    const winnerFid = isDraw ? null : result.winner === "p1" ? m.player1Fid : m.player2Fid;

    // Persist winner to KV so profile history can show WIN/LOSS instead of PENDING.
    // For draws: no winner/loser recorded; resolve API handles null gracefully.
    // Fire-and-forget; idempotent if both players trigger runFight simultaneously.
    fetch("/api/free-match/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, winnerAddress: winner, winnerFid, isDraw }),
    }).catch(() => {});

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: winner, action: "free_fight_completed", matchId }),
    }).catch(() => {});

    fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: loser, action: "free_fight_completed", matchId }),
    }).catch(() => {});

    // Transition to replay — must come AFTER all setState calls and BEFORE
    // fire-and-forget fetches so the view doesn't stay stuck on joining/waiting.
    setView("replay");
  }

  async function handleJoin() {
    // Auth is required to join — wallet or FID both accepted for free fights.
    if (!playerId || !isAuthed || !statsValid) return;
    setView("joining");

    const res = await fetch("/api/free-match/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, wallet: playerId, fid, stats }),
    });

    if (!res.ok) {
      setView("error");
      return;
    }

    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: playerId, action: "free_fight_joined" }),
    }).catch(() => {});

    const freshM = await loadMatch();
    // KV may return stale data without stats1 if the creator's PATCH hasn't
    // propagated yet. Fall back to the stats1 we already have in component
    // state (loaded at mount) so the fight always starts.
    const stats1 = freshM?.stats1 ?? match?.stats1;
    if (stats1) {
      runFight({ ...(freshM ?? match!), stats1, stats2: stats });
    } else {
      setView("error");
    }
  }

  async function handleShare() {
    if (!playerId || sharedPoints || !fightResult || !match) return;

    const winner = fightResult.winner === "draw" ? null : fightResult.winner === "p1" ? match.player1 : match.player2;
    const myWinner = winner != null && playerId?.toLowerCase() === winner?.toLowerCase();
    const shareText = encodeURIComponent(
      `My gladaitor just ${myWinner ? "WON" : "fought hard"} in GLADAITOR (FREE FIGHT) ⚔️ — gladaitors.vercel.app`
    );
    window.open(
      `https://farcaster.xyz/~/compose?text=${shareText}`,
      "_blank",
      "noopener,noreferrer"
    );

    await fetch("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: playerId, action: "share_fight_result", matchId }),
    }).catch(() => {});

    setSharedPoints(true);
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────

  if (view === "loading") {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading fight...</p>
      </div>
    );
  }

  // Match is loaded but player identity (address or FID) hasn't resolved yet.
  // This is a transient state — typically resolves in <1s inside Farcaster.
  if (view === "connecting") {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="arena-bg min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">Fight not found or expired.</p>
        <button className="btn-secondary" onClick={() => router.push("/")}>
          Back to Home
        </button>
      </div>
    );
  }

  if (view === "configure") {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-green-900 text-green-400 text-xs font-bold uppercase tracking-widest px-2 py-1 rounded">
              FREE FIGHT
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-widest mb-2">
            Build Your Gladaitor
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            You are joining fight {matchId} — configure your gladaitor and enter the pit.
          </p>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-5">
            <StatAllocator stats={stats} onChange={setStats} disabled={false} />
          </div>
          <button
            className="btn-primary w-full text-base py-4"
            onClick={handleJoin}
            disabled={!isAuthed || !playerId || !statsValid}
          >
            Enter the Pit (FREE)
          </button>
          {!statsValid && (
            <p className="text-xs text-red-400 text-center mt-2">
              Allocate all {TOTAL_POINTS} stat points first.
            </p>
          )}
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "joining") {
    return (
      <div className="arena-bg min-h-screen flex items-center justify-center">
        <p className="text-amber-400 animate-pulse">Entering the pit...</p>
      </div>
    );
  }

  if (view === "waiting_p2") {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://gladaitors.vercel.app";
    const fightUrl = `${origin}/free-fight/${matchId}`;
    const farcasterComposeUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(
      "Come fight me in GLADAITOR! ⚔️ Configure your gladaitor and challenge me (FREE)"
    )}&embeds[]=${encodeURIComponent(fightUrl)}`;

    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-16 text-center">
          <div className="text-3xl font-bold mb-2" style={{ color: "#b8860b" }}>
            WAITING FOR OPPONENT
          </div>
          <p className="text-sm mb-6" style={{ color: "#8b6a40" }}>
            Share this fight — opens in Farcaster as a Mini App.
          </p>
          <div
            className="rounded-lg px-4 py-3 mb-5 font-mono text-sm break-all"
            style={{ background: "#e0d4bc", border: "1px solid #c4a882", color: "#4a3010" }}
          >
            {fightUrl}
          </div>
          <div className="space-y-3 mb-4">
            <button
              className="btn-primary w-full"
              onClick={() => window.open(farcasterComposeUrl, "_blank", "noopener,noreferrer")}
            >
              Share on Farcaster
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => navigator.clipboard.writeText(fightUrl).catch(() => {})}
            >
              Copy Link
            </button>
          </div>
          <p className="text-xs animate-pulse" style={{ color: "#9a7a50" }}>Checking for opponent...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "replay" && fightResult && match) {
    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">
            <FightReplay
              result={fightResult}
              p1Label={p1Label}
              p2Label={p2Label}
              viewerRole={myRole}
              onDone={() => setView("result")}
              onPlayAgain={() => router.push("/free-fight")}
              onHome={() => router.push("/")}
            />
          </div>
        </main>
      </div>
    );
  }

  if (view === "result" && fightResult && match) {
    const p1Stats = match.stats1!;
    const p2Stats = match.stats2!;
    const isP1Winner = fightResult.winner === "p1";
    const myAddress = playerId?.toLowerCase() ?? "";
    const iAmP1 = match.player1 === myAddress;
    const iAmP2 = match.player2 === myAddress;
    const viewerRole = iAmP1 ? "p1" : iAmP2 ? "p2" : "spectator";

    // Derive opponent name for taunts.
    // opponentUsername is set during runFight. When the page lands directly on
    // the result state (already-resolved match), fall back to the resolved label.
    const opponentLabelFromResolved = iAmP1 ? p2Label : p1Label;
    const resolvedOpponentName =
      viewerRole === "spectator"
        ? "your opponent"
        : opponentUsername ?? opponentLabelFromResolved ?? "your opponent";

    return (
      <div className="arena-bg min-h-screen flex flex-col">
        <Header router={router} />
        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
          <FightSummary
            result={fightResult}
            p1Label={p1Label}
            p2Label={p2Label}
            p1Stats={p1Stats}
            p2Stats={p2Stats}
            isP1Winner={isP1Winner}
            viewerRole={viewerRole}
            opponentName={resolvedOpponentName}
            onShare={handleShare}
            shareLabel={sharedPoints ? "Shared!" : "Share Your Battle"}
            sharedAlready={sharedPoints}
            onHome={() => router.push("/")}
          />
          <div className="mt-2 text-xs text-gray-600 text-center">FREE FIGHT — no USDC at stake</div>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}

function Header({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Navbar><WalletButton /></Navbar>
  );
}
