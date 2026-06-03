"use client";

// ─── Training Ground — gameplay sandbox ──────────────────────────────────────
// No auth, no wallet, no KV, no API calls. Pure client-side fight simulation.
// Used to test gameplay changes (e.g. ATB speed mechanic) before merging to main.
//
// Route: /training  (access directly — no nav link in production)
// Branch: gameplay-changes

import { useState, useMemo } from "react";
import FightReplay from "@/components/FightReplay";
import FightSummary from "@/components/FightSummary";
import MatchupAnalysis from "./MatchupAnalysis";
import FightLog from "./FightLog";
import { simulateFight, FightResult } from "@/lib/fight-engine";
import {
  GladiatorStats,
  STAT_LABELS,
  TOTAL_POINTS,
  MAX_STAT,
  MIN_STAT,
} from "@/lib/contract";

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_STATS: GladiatorStats = {
  strength: 5,
  speed: 5,
  defense: 5,
  intel: 5,
  luck: 5,
};

const STAT_ICONS: Record<keyof GladiatorStats, string> = {
  strength: "STR",
  speed: "SPD",
  defense: "DEF",
  intel: "INT",
  luck: "LCK",
};

const STAT_FULL: Record<keyof GladiatorStats, string> = {
  strength: "Strength",
  speed: "Speed",
  defense: "Defense",
  intel: "Intel",
  luck: "Luck",
};

type Step = "configure" | "replay" | "result";

// ── Inline stat allocator — mirrors StatAllocator but stripped of extra chrome ──

function MiniAllocator({
  stats,
  onChange,
  accentColor,
}: {
  stats: GladiatorStats;
  onChange: (s: GladiatorStats) => void;
  accentColor: string;
}) {
  const used = Object.values(stats).reduce((a, b) => a + b, 0);
  const remaining = TOTAL_POINTS - used;

  function adjust(stat: keyof GladiatorStats, delta: number) {
    const next = stats[stat] + delta;
    if (next < MIN_STAT || next > MAX_STAT) return;
    if (delta > 0 && remaining <= 0) return;
    onChange({ ...stats, [stat]: next });
  }

  return (
    <div className="space-y-0.5">
      {/* Points counter */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs uppercase tracking-widest" style={{ color: "#6b4c2a" }}>
          Points
        </span>
        <span
          className="text-sm font-bold tabular-nums"
          style={{ color: remaining === 0 ? "#22c55e" : "#d97706" }}
        >
          {used}/{TOTAL_POINTS}
        </span>
      </div>

      {STAT_LABELS.map((stat) => {
        const val = stats[stat];
        const pct = (val / MAX_STAT) * 100;
        const canInc = remaining > 0 && val < MAX_STAT;
        const canDec = val > MIN_STAT;

        return (
          <div key={stat} className="flex items-center gap-2 py-1.5">
            {/* Label */}
            <div
              className="w-8 text-xs font-bold uppercase tracking-widest shrink-0"
              style={{ color: accentColor, fontSize: "0.6rem" }}
            >
              {STAT_ICONS[stat]}
            </div>

            {/* Decrement */}
            <button
              className="stat-btn"
              onClick={() => adjust(stat, -1)}
              disabled={!canDec}
              aria-label={`Decrease ${STAT_FULL[stat]}`}
            >
              -
            </button>

            {/* Value */}
            <span className="w-5 text-center font-bold tabular-nums text-white text-sm">
              {val}
            </span>

            {/* Increment */}
            <button
              className="stat-btn"
              onClick={() => adjust(stat, 1)}
              disabled={!canInc}
              aria-label={`Increase ${STAT_FULL[stat]}`}
            >
              +
            </button>

            {/* Bar */}
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2218" }}>
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{ width: `${pct}%`, background: accentColor }}
              />
            </div>
          </div>
        );
      })}

      {/* Reset */}
      <div className="pt-1 text-center">
        <button
          className="text-xs hover:underline focus:outline-none"
          style={{ color: "#4b3a28" }}
          onClick={() => onChange({ ...DEFAULT_STATS })}
        >
          reset
        </button>
      </div>
    </div>
  );
}

// ── Character preview panel ───────────────────────────────────────────────────

function GladPanel({
  label,
  color,
  stats,
  onChange,
}: {
  label: string;
  color: "red" | "blue";
  stats: GladiatorStats;
  onChange: (s: GladiatorStats) => void;
}) {
  const accentColor = color === "red" ? "#dc2626" : "#3b82f6";
  const bgColor = color === "red" ? "#200a0a" : "#0a1020";
  const borderColor = color === "red" ? "#7f1d1d" : "#1e3a5f";

  return (
    <div
      className="flex-1 rounded-lg p-4"
      style={{ background: bgColor, border: `1px solid ${borderColor}` }}
    >
      {/* Header with sprite */}
      <div className="flex flex-col items-center mb-4">
        {/* Sprite image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/characters/${color}/idle.png`}
          alt={`${color} gladaitor`}
          style={{
            height: "80px",
            width: "auto",
            imageRendering: "auto",
            transform: color === "blue" ? "scaleX(-1)" : undefined,
          }}
        />
        <span
          className="text-xs font-bold uppercase tracking-widest mt-2"
          style={{ color: accentColor }}
        >
          {label}
        </span>
      </div>

      {/* Stat allocator */}
      <MiniAllocator stats={stats} onChange={onChange} accentColor={accentColor} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TrainingPage() {
  const [step, setStep] = useState<Step>("configure");
  const [stats1, setStats1] = useState<GladiatorStats>({ ...DEFAULT_STATS });
  const [stats2, setStats2] = useState<GladiatorStats>({ ...DEFAULT_STATS });
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  // Track which step of result display we're on
  const [showSummary, setShowSummary] = useState(false);

  const used1 = Object.values(stats1).reduce((a, b) => a + b, 0);
  const used2 = Object.values(stats2).reduce((a, b) => a + b, 0);
  const bothReady = used1 === TOTAL_POINTS && used2 === TOTAL_POINTS;

  // Live preview: auto-simulate whenever both sides have exactly 25 pts.
  // useMemo keeps it pure — no side effects, no setState, just recomputes inline.
  const previewResult = useMemo<FightResult | null>(() => {
    if (!bothReady) return null;
    return simulateFight(stats1, stats2);
  }, [stats1, stats2, bothReady]);

  function startFight() {
    if (!bothReady) return;
    const result = simulateFight(stats1, stats2);
    setFightResult(result);
    setShowSummary(false);
    setStep("replay");
  }

  function handleReplayDone() {
    // After replay completes → show result screen (winner banner + FightSummary + FightLog).
    setStep("result");
  }

  function handleReplayPlayAgain() {
    // "Fight Again" from replay overlay → back to configure
    resetToConfig();
  }

  function resetToConfig() {
    setFightResult(null);
    setShowSummary(false);
    setStep("configure");
  }

  return (
    <div
      className="arena-bg min-h-screen flex flex-col"
      style={{ color: "#1a1208" }}
    >
      {/* Header bar */}
      <div
        className="w-full text-center py-3 border-b"
        style={{ borderColor: "#2a2218", background: "#120f0a" }}
      >
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#6b4c2a" }}
        >
          TRAINING GROUND
        </span>
        <span
          className="ml-3 text-xs rounded px-2 py-0.5"
          style={{ background: "#1a1208", color: "#d97706", border: "1px solid #3a2a10" }}
        >
          gameplay-changes branch
        </span>
      </div>

      <div className="flex-1 w-full max-w-lg mx-auto px-3 py-4">

        {/* ── Configure step ─────────────────────────────────────────────── */}
        {step === "configure" && (
          <>
            {/* ATB mechanic note */}
            <div
              className="rounded p-3 mb-4 text-xs"
              style={{ background: "#15120a", border: "1px solid #2a2010", color: "#8b6c3a" }}
            >
              <span className="font-bold text-amber-500">ATB Speed:</span>{" "}
              Faster gladaitor fires {" "}
              <span className="font-bold text-white">(SPD diff × 10%)</span>{" "}
              more attacks. SPD 8 vs 4 = 40% more attacks for the faster one.
            </div>

            {/* Two columns: red left, blue right */}
            <div className="flex gap-3 mb-4">
              <GladPanel
                label="RED"
                color="red"
                stats={stats1}
                onChange={setStats1}
              />
              <GladPanel
                label="BLUE"
                color="blue"
                stats={stats2}
                onChange={setStats2}
              />
            </div>

            {/* Live matchup analysis — updates as sliders move */}
            <MatchupAnalysis stats1={stats1} stats2={stats2} />

            {/* Live fight preview — auto-simulates whenever both sides are at 25 pts */}
            {bothReady && previewResult ? (
              <div className="mb-4">
                <div
                  className="flex items-center justify-between mb-2 px-1"
                >
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: "#b8860b" }}
                  >
                    Simulated Fight Preview
                  </span>
                  <span className="text-xs" style={{ color: "#4b3a28" }}>
                    updates as you adjust stats
                  </span>
                </div>
                <FightLog result={previewResult} />
              </div>
            ) : (
              <div
                className="rounded-lg p-3 mb-4 text-center text-xs"
                style={{ background: "#15120a", border: "1px solid #2a2010", color: "#4b3a28" }}
              >
                Allocate all 25 points to preview fight
              </div>
            )}

            {/* Status / FIGHT button */}
            <div className="flex flex-col items-center gap-2">
              {/* Readiness indicators */}
              <div className="flex gap-6 text-xs mb-1">
                <span style={{ color: used1 === TOTAL_POINTS ? "#22c55e" : "#6b7280" }}>
                  RED: {used1}/{TOTAL_POINTS} {used1 === TOTAL_POINTS ? "READY" : "pts"}
                </span>
                <span style={{ color: used2 === TOTAL_POINTS ? "#22c55e" : "#6b7280" }}>
                  BLUE: {used2}/{TOTAL_POINTS} {used2 === TOTAL_POINTS ? "READY" : "pts"}
                </span>
              </div>

              <button
                className="btn-primary w-full"
                disabled={!bothReady}
                onClick={startFight}
                style={{ fontSize: "1rem", letterSpacing: "0.15em", padding: "0.85rem" }}
              >
                FIGHT
              </button>

              {!bothReady && (
                <p className="text-xs text-center" style={{ color: "#4b3a28" }}>
                  Allocate all 25 points for each gladaitor to unlock
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Replay step ────────────────────────────────────────────────── */}
        {step === "replay" && fightResult && (
          <div className="w-full max-w-sm mx-auto">
            <FightReplay
              result={fightResult}
              p1Label="RED"
              p2Label="BLUE"
              viewerRole="spectator"
              onDone={handleReplayDone}
              onPlayAgain={handleReplayPlayAgain}
            />
          </div>
        )}

        {/* ── Result step ────────────────────────────────────────────────── */}
        {step === "result" && fightResult && (
          <>
            {/* HOME button — top of result page, resets to configure */}
            <div className="mb-3">
              <button
                className="btn-secondary w-full"
                onClick={resetToConfig}
                style={{ fontSize: "0.8rem", letterSpacing: "0.12em", padding: "0.6rem" }}
              >
                ← HOME
              </button>
            </div>

            <FightSummary
              result={fightResult}
              p1Label="RED"
              p2Label="BLUE"
              p1Stats={stats1}
              p2Stats={stats2}
              isP1Winner={fightResult.winner === "p1"}
              viewerRole="spectator"
              opponentName="BLUE"
              onPlayAgain={resetToConfig}
            />

            {/* Fight log — full chronological attack event breakdown */}
            <div className="mt-4">
              <FightLog result={fightResult} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
