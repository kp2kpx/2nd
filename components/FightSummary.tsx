"use client";

import { useMemo } from "react";
import type { FightResult } from "@/lib/fight-engine";
import type { GladiatorStats } from "@/lib/contract";

// ─── Taunt pool ───────────────────────────────────────────────────────────────

const STATIC_TAUNTS = [
  "Skill issue.",
  "Try again, little fighter.",
  "He's already forgotten your name.",
  "That wasn't a fight. That was a warm-up.",
  "Come back when you know how to build a fighter.",
  "You lost. Let that sink in.",
  "Your gladaitor fought bravely. Not well, but bravely.",
  "The arena floor has been cleaned. Your dignity cannot be recovered.",
  "Even your own gladaitor is embarrassed right now.",
  "That wasn't a defeat. That was a tutorial.",
  "The crowd isn't booing. They're just... quiet.",
  "He barely used his sword.",
  "The pit has seen better warriors. Much better.",
  "You came. You fought. You lost. The usual.",
  "Next time try using your brain, not just your hope.",
  "You were so close to being mediocre.",
  "This defeat has been archived for training purposes.",
  "Your strategy was bold. Boldly wrong.",
  "Not all warriors are meant for the pit.",
  "You built a fighter. You should have built a better one.",
  "History will not remember this fight.",
  "Somewhere, a better gladaitor is laughing.",
  "The pit giveth. The pit taketh. Today it taketh everything.",
  "The defeat was swift. The shame will not be.",
  "Come back stronger. Smarter. Just come back different.",
  "The crowd went home early.",
  "This is why we train.",
  "The pit doesn't care about your feelings.",
  "Loss recorded. Pride deleted.",
  "Did you even have a plan?",
  "The sword was not the problem. The strategy was.",
  "Some gladaitors are born for greatness. Keep trying.",
  "Your confidence was your greatest weapon. It failed you too.",
  "Even the janitor in the pit felt bad for you.",
  "The arena gods reviewed your performance. They're concerned.",
  "This is not the ending you imagined.",
  "The pit does not give refunds on dignity.",
  "You didn't lose. You won at losing.",
  "That was less of a fight and more of an appointment.",
  "The entrance was dramatic. The exit was not.",
  "Not your day. Maybe not your game.",
  "Better luck next build.",
  "The pit has a long memory. Unfortunately.",
  "The gods of the arena are not pleased.",
  "Somewhere your gladaitor is writing an apology letter.",
  "The scoreboard doesn't lie. Unfortunately.",
  "You lasted the whole fight. Just not well enough.",
  "The sand remembers every defeat. This one will haunt it.",
  "You had one job.",
  "Respect the pit. The pit clearly does not respect you.",
  "Defeated. Again. The pit is patient.",
  "The arena has no participation trophies.",
];

const BOT_ONLY_TAUNTS = [
  "Aitor says thanks for the easy win.",
  "You lost to a BOT. Let that sink in.",
  "Aitor is already asleep. That's how easy you were.",
  "Aitor sends his regards. And his pity.",
  "Aitor fought with one hand behind his back. Probably.",
  "Aitor has a new favorite punching bag.",
  "You should see what Medium Aitor does to fighters like you.",
  "Aitor yawned mid-fight. Witnesses confirm.",
  "Aitor fights in his sleep better than you fight awake.",
  "Aitor is already preparing for his next victim.",
  "Aitor dedicates this win to your overconfidence.",
  "Aitor has a 100% win rate against you. Statistically speaking.",
  "You showed heart. Aitor showed skill.",
  "Aitor didn't even remember your name by round 3.",
];

function getStatTaunt(
  stats: GladiatorStats,
  fightData: { opponentHp: number; playerDmg: number; opponentDmg: number; playerCrits: number; opponentCrits: number; rounds: number },
  opponentName: string
): string {
  const { strength: str, speed: spd, defense: def, intel: int, luck: lck } = stats;
  const { opponentHp, playerDmg, opponentDmg, playerCrits, opponentCrits, rounds } = fightData;
  const highest = Math.max(str, spd, def, int, lck);

  const taunts = [
    `${str} Strength and you still lost? Embarrassing.`,
    `You put ${lck} in Luck. The universe disagreed.`,
    `${def} Defense and you still got destroyed.`,
    `Speed ${spd}. Not fast enough.`,
    `${int} Intelligence. Clearly not enough to win.`,
    `${str} Strength, ${def} Defense. ${opponentName} wasn't impressed.`,
    `Spread across 5 stats, mastered none. Classic.`,
    `You distributed 25 points. ${opponentName} distributed them better.`,
    `Strength ${str}, Intelligence ${int}. Neither saved you.`,
    `${lck} Luck. The arena laughed.`,
    `That build had potential. In a different arena. Against a weaker opponent.`,
    `${spd} Speed and you still couldn't outpace the inevitable.`,
    `${int} Intelligence. Think harder next time.`,
    `${def} Defense felt more like ${Math.max(1, def - 3)}.`,
    `${opponentName} had ${opponentHp} HP left. They weren't even trying.`,
    `${opponentHp} HP remaining on ${opponentName}. So close. Not close enough.`,
    `You dealt ${playerDmg} damage. ${opponentName} dealt ${opponentDmg}. Do the math.`,
    `${opponentDmg - playerDmg} more damage taken than dealt. That's the margin.`,
    `${opponentName} took ${playerDmg} damage and still won. Thanks for the workout.`,
    playerCrits === 0 ? "Zero critical hits. The dice hated you today." : `Only ${playerCrits} critical hit${playerCrits > 1 ? "s" : ""}. Not enough.`,
    `${opponentName} landed ${opponentCrits} critical hit${opponentCrits !== 1 ? "s" : ""}. Luck is a cruel mistress.`,
    `Survived all ${rounds} rounds and still lost. That's a special kind of hurt.`,
    `${rounds} rounds of fighting. ${rounds} rounds of losing.`,
    opponentHp > 50 ? `${opponentName} had ${opponentHp} HP left. Barely trying.` : `${opponentName} had ${opponentHp} HP left. Almost. Almost.`,
    `You hit ${playerDmg} total damage. ${opponentName} wasn't worried.`,
    `${spd} Speed, moved first, still lost. Impressive failure.`,
    `${str} Strength should hit harder than that. Reconsider your build.`,
    `${lck} Luck and ${opponentCrits} critical hits against you. The odds were never yours.`,
    `You put ${lck} in Luck and got ${playerCrits} critical hit${playerCrits === 1 ? "" : "s"}. Sounds about right.`,
    `${def} Defense, ${opponentDmg} damage taken. The math was never on your side.`,
    `${int} Intelligence and you still walked into that. Think about it.`,
    `Strength ${str} vs ${opponentName}'s build. And yet here we are.`,
    `Your highest stat was ${highest}. ${opponentName}'s was enough.`,
    rounds < 5 ? "Didn't even make it to round 5. Ouch." : `Made it to round ${rounds}. Just not round ${rounds + 1}.`,
    `${str} attack power. ${opponentDmg} damage received. The pit is merciless.`,
  ];

  return taunts[Math.floor(Math.random() * taunts.length)];
}

function getTaunt(
  stats: GladiatorStats,
  fightData: { opponentHp: number; playerDmg: number; opponentDmg: number; playerCrits: number; opponentCrits: number; rounds: number },
  opponentName: string
): string {
  const staticPool = opponentName === "Aitor"
    ? [...STATIC_TAUNTS, ...BOT_ONLY_TAUNTS]
    : STATIC_TAUNTS;

  if (Math.random() < 0.65) {
    return staticPool[Math.floor(Math.random() * staticPool.length)];
  }
  return getStatTaunt(stats, fightData, opponentName);
}

// ─── Derived combat stats from log ────────────────────────────────────────────

function deriveCombatStats(result: FightResult, p1Stats: GladiatorStats, p2Stats: GladiatorStats) {
  const p1Attacks = result.log.filter(e => e.attacker === "p1");
  const p2Attacks = result.log.filter(e => e.attacker === "p2");

  const p1MaxHit = p1Attacks.length ? Math.max(...p1Attacks.map(e => e.damage)) : 0;
  const p2MaxHit = p2Attacks.length ? Math.max(...p2Attacks.map(e => e.damage)) : 0;

  const p1DoubleStrikes = p1Attacks.filter(e => e.isDoubleAttack).length;
  const p2DoubleStrikes = p2Attacks.filter(e => e.isDoubleAttack).length;

  const p1AttackCount = p1Attacks.length;
  const p2AttackCount = p2Attacks.length;

  const p1CritRate = p1AttackCount > 0 ? Math.round((result.critsP1 / p1AttackCount) * 100) : 0;
  const p2CritRate = p2AttackCount > 0 ? Math.round((result.critsP2 / p2AttackCount) * 100) : 0;

  const p1AvgDmg = p1AttackCount > 0 ? Math.round(result.totalDamageByP1 / p1AttackCount) : 0;
  const p2AvgDmg = p2AttackCount > 0 ? Math.round(result.totalDamageByP2 / p2AttackCount) : 0;

  // Effective defense = max(0, DEF - opponent INT) — how much was actually blocked per hit
  const p1EffDef = Math.max(0, p1Stats.defense - p2Stats.intel);
  const p2EffDef = Math.max(0, p2Stats.defense - p1Stats.intel);

  // Damage absorbed = (base hits without def) - actual damage. Approx: effectiveDef * non-crit attacks
  const p1NonCritHits = p1AttackCount - result.critsP1;
  const p2NonCritHits = p2AttackCount - result.critsP2;

  const p2DmgAbsorbed = p2EffDef * p1NonCritHits; // damage P2's defense ate from P1's non-crit hits
  const p1DmgAbsorbed = p1EffDef * p2NonCritHits; // damage P1's defense ate from P2's non-crit hits

  const speedGap = Math.abs(p1Stats.speed - p2Stats.speed);
  const hadDoubleAttack = speedGap >= 3;

  return {
    p1AttackCount, p2AttackCount,
    p1MaxHit, p2MaxHit,
    p1DoubleStrikes, p2DoubleStrikes,
    p1CritRate, p2CritRate,
    p1AvgDmg, p2AvgDmg,
    p1EffDef, p2EffDef,
    p1DmgAbsorbed, p2DmgAbsorbed,
    speedGap,
    hadDoubleAttack,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FightSummaryProps {
  result: FightResult;
  p1Label: string;
  p2Label: string;
  p1Stats: GladiatorStats;
  p2Stats: GladiatorStats;
  isP1Winner: boolean;
  viewerRole?: "p1" | "p2" | "spectator";
  opponentName?: string;
  onShare?: () => void;
  onPlayAgain?: () => void;
  onHome?: () => void;
  shareLabel?: string;
  sharedAlready?: boolean;
  pointsLine?: React.ReactNode;
}

const STAT_FULL: Record<keyof GladiatorStats, string> = {
  strength: "Strength",
  speed: "Speed",
  defense: "Defense",
  intel: "Intelligence",
  luck: "Luck",
};

export default function FightSummary({
  result,
  p1Label,
  p2Label,
  p1Stats,
  p2Stats,
  isP1Winner,
  viewerRole = "spectator",
  opponentName = "your opponent",
  onShare,
  onPlayAgain,
  onHome,
  shareLabel = "Share Your Result",
  sharedAlready = false,
  pointsLine,
}: FightSummaryProps) {
  const viewerWon =
    (viewerRole === "p1" && isP1Winner) ||
    (viewerRole === "p2" && !isP1Winner);
  const viewerLost = viewerRole !== "spectator" && !viewerWon;

  const winnerLabel = isP1Winner ? p1Label : p2Label;
  const loserLabel = isP1Winner ? p2Label : p1Label;

  const loserStats = viewerRole === "p2" ? p2Stats : p1Stats;
  const fightData = viewerRole === "p2"
    ? { opponentHp: result.hp1Final, playerDmg: result.totalDamageByP2, opponentDmg: result.totalDamageByP1, playerCrits: result.critsP2, opponentCrits: result.critsP1, rounds: result.rounds }
    : { opponentHp: result.hp2Final, playerDmg: result.totalDamageByP1, opponentDmg: result.totalDamageByP2, playerCrits: result.critsP1, opponentCrits: result.critsP2, rounds: result.rounds };

  const taunt = useMemo(
    () => (viewerLost ? getTaunt(loserStats, fightData, opponentName) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const combat = useMemo(
    () => deriveCombatStats(result, p1Stats, p2Stats),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="space-y-4">

      {/* ── Outcome banner ───────────────────────────────────────────────────── */}
      <div
        className="border rounded-lg p-5 text-center"
        style={
          viewerWon || (viewerRole === "spectator" && isP1Winner)
            ? { background: "#2d1a04", borderColor: "#b8860b", boxShadow: "0 0 24px rgba(184,134,11,0.3)" }
            : { background: "#1a0a2e", borderColor: "#6d28d9" }
        }
      >
        {/* Narrative outcome line */}
        <div className="text-sm font-bold uppercase tracking-widest mb-1" style={{ color: viewerWon ? "#fbbf24" : "#a78bfa" }}>
          {viewerRole === "spectator"
            ? `${winnerLabel} defeated ${loserLabel}`
            : viewerWon
            ? `You defeated ${opponentName}`
            : `You lost to ${opponentName}`}
        </div>

        {/* Taunt */}
        {viewerLost && taunt && (
          <div className="mt-3 text-xs italic" style={{ color: "#6b7280" }}>
            {taunt}
          </div>
        )}

        {/* Points */}
        {pointsLine && (
          <div className="mt-2 text-xs" style={{ color: "#9ca3af" }}>{pointsLine}</div>
        )}
      </div>

      {/* ── Combat breakdown ─────────────────────────────────────────────────── */}
      <div className="rounded-lg p-4" style={{ background: "#12100e", border: "1px solid #2a2218" }}>
        <p className="text-xs uppercase tracking-widest mb-4 font-bold" style={{ color: "#c8b89a" }}>
          Combat Breakdown
        </p>

        {/* Header row */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
          <div className="font-bold uppercase tracking-widest" style={{ color: isP1Winner ? "#fbbf24" : "#ef4444" }}>{p1Label}</div>
          <div style={{ color: "#9a9080" }}>—</div>
          <div className="font-bold uppercase tracking-widest" style={{ color: !isP1Winner ? "#fbbf24" : "#a78bfa" }}>{p2Label}</div>
        </div>

        {/* Stat rows */}
        {[
          { label: "Total Damage Dealt",    v1: result.totalDamageByP1,   v2: result.totalDamageByP2 },
          { label: "Damage Received",       v1: result.totalDamageByP2,   v2: result.totalDamageByP1 },
          { label: "HP Remaining",          v1: result.hp1Final,           v2: result.hp2Final },
          { label: "Total Attacks",         v1: combat.p1AttackCount,      v2: combat.p2AttackCount },
          { label: "Largest Single Hit",    v1: combat.p1MaxHit,           v2: combat.p2MaxHit },
          { label: "Average Damage / Hit",  v1: combat.p1AvgDmg,           v2: combat.p2AvgDmg },
          { label: "Critical Hits Landed",  v1: result.critsP1,            v2: result.critsP2 },
          { label: "Critical Hit Rate",     v1: `${combat.p1CritRate}%`,   v2: `${combat.p2CritRate}%` },
          { label: "Double Strikes",        v1: combat.p1DoubleStrikes,    v2: combat.p2DoubleStrikes },
          { label: "Defense Absorbed",      v1: `${combat.p1DmgAbsorbed} HP`, v2: `${combat.p2DmgAbsorbed} HP` },
          { label: "Effective Defense",     v1: combat.p1EffDef,           v2: combat.p2EffDef },
        ].map(({ label, v1, v2 }, i) => (
          <div
            key={label}
            className="grid grid-cols-3 gap-2 text-center text-xs py-2"
            style={{ borderTop: i === 0 ? `1px solid #2a2218` : `1px solid #1e1a14` }}
          >
            <div className="tabular-nums font-bold text-white">{v1}</div>
            <div className="text-center" style={{ color: "#9a9080", fontSize: "0.65rem", lineHeight: 1.3 }}>{label}</div>
            <div className="tabular-nums font-bold text-white">{v2}</div>
          </div>
        ))}

        {/* Speed advantage note */}
        {combat.hadDoubleAttack && (
          <div className="mt-3 text-center text-xs" style={{ color: "#9a9080" }}>
            Speed gap of {combat.speedGap} triggered double strikes each round
          </div>
        )}
      </div>

      {/* ── Gladiator stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <GladCard label={p1Label} stats={p1Stats} isWinner={isP1Winner} accentColor="red" />
        <GladCard label={p2Label} stats={p2Stats} isWinner={!isP1Winner} accentColor="purple" />
      </div>

      {/* ── CTAs ─────────────────────────────────────────────────────────────── */}
      {onShare && (
        <button className="btn-secondary w-full text-center block" onClick={onShare}>
          {sharedAlready ? "Shared!" : shareLabel}
        </button>
      )}
      {onPlayAgain && (
        <button className="btn-bot w-full text-center block" onClick={onPlayAgain}>
          Fight Again
        </button>
      )}
      {onHome && (
        <div className="text-center">
          <button
            className="text-xs transition-colors"
            style={{ color: "#6b4c2a" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#8b1a1a")}
            onMouseLeave={e => (e.currentTarget.style.color = "#6b4c2a")}
            onClick={onHome}
          >
            Back to Home
          </button>
        </div>
      )}
    </div>
  );
}

// ─── GladCard — stat comparison card ─────────────────────────────────────────

function GladCard({
  label,
  stats,
  isWinner,
  accentColor,
}: {
  label: string;
  stats: GladiatorStats;
  isWinner: boolean;
  accentColor: "red" | "purple";
}) {
  const barColor = isWinner
    ? "linear-gradient(90deg, #b8860b, #d97706)"
    : accentColor === "purple"
    ? "linear-gradient(90deg, #6d28d9, #a855f7)"
    : "linear-gradient(90deg, #991b1b, #dc2626)";

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "#12100e",
        border: `1px solid ${isWinner ? "#b8860b" : "#2a2218"}`,
        boxShadow: isWinner ? "0 0 16px rgba(184,134,11,0.25)" : "none",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest break-all" style={{ color: "#c8b89a" }}>
          {label}
        </span>
        {isWinner && <span className="text-xs font-bold shrink-0" style={{ color: "#fbbf24" }}>WINNER</span>}
      </div>
      <div className="space-y-2">
        {(Object.keys(stats) as (keyof GladiatorStats)[]).map((stat) => (
          <div key={stat} className="flex items-center gap-1.5">
            <span className="text-xs uppercase w-20 font-bold shrink-0" style={{ color: "#9a9080", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
              {STAT_FULL[stat]}
            </span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#2a2218" }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${(stats[stat] / 10) * 100}%`, background: barColor }}
              />
            </div>
            <span className="text-xs w-4 text-right tabular-nums shrink-0 font-bold text-white">
              {stats[stat]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
