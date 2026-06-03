// TypeScript port of PitArena._simulateFight
// Branch: gameplay-changes
// Mechanic: ATB (Active Time Battle) accumulator-based speed system.
//   - Replaces the old "faster goes first + double-attack at gap≥3" model.
//   - Each tick: faster gladiator accumulates (10 + diff) points, slower accumulates 10.
//   - Attack fires when accumulator ≥ 10 (subtract 10 after each attack).
//   - This naturally gives the faster gladiator (diff×10%) more attacks over time.
//   - Stats expected in range 0–10 per stat; enforcement is a UI concern.
//
// ATB math verification:
//   SPD 6 vs 4 (diff=2): rates 12:10  → 20% more attacks for faster ✓
//   SPD 9 vs 5 (diff=4): rates 14:10  → 40% more attacks for faster ✓
//   SPD 5 vs 5 (diff=0): rates 10:10  → equal attacks ✓
//   SPD 10 vs 1 (diff=9): rates 19:10 → 90% more attacks for faster ✓
//
// LCK mechanic: shared crit pool system (replaces floor(LCK/2)*10% flat chance)
//   - At fight start, roll pool = 0.30–0.499 (varies per fight = randomness twist)
//   - Each fighter's crit chance = (own.luck / (own.luck + opponent.luck)) × pool
//   - Same LCK = same crit chance (fair split). Higher LCK = proportionally larger share.
//   - Every LCK point matters. No floor waste.
//
// Pool derivation:
//   seed = nextSeed(initial_seed)
//   pool = 0.30 + (seed % 200) / 1000   → gives 0.300 to 0.499

export interface GladiatorStats {
  strength: number;
  speed: number;
  defense: number;
  intel: number;
  luck: number;
}

export interface RoundLog {
  // "round" is kept for backward compat with FightReplay (which groups by entry.round).
  // In the ATB model this is a monotonically incrementing attack-event counter (tick index).
  // Each entry in the log represents one attack event.
  round: number;
  // Which gladiator attacked
  attacker: "p1" | "p2";
  damage: number;
  isCrit: boolean;
  hp1After: number;
  hp2After: number;
  // Replay compat fields
  attackedFirst: boolean;
  // isDoubleAttack: always false in ATB model. Kept in type for compat with
  // FightReplay and FightSummary which read this field.
  isDoubleAttack: boolean;
  speedGap: number;
  // Combo mechanic fields (tagged by post-processing + 4× injection in fight loop)
  // isCombo: true if this hit belongs to a 2/3/4× burst (consecutive same-attacker run)
  // comboStep: 0 = isolated hit; 1 = first hit of combo; 2/3/4 = continuation hit
  isCombo: boolean;
  comboStep: number;
}

export interface FightResult {
  winner: "p1" | "p2" | "draw";
  rounds: number;
  hp1Final: number;
  hp2Final: number;
  log: RoundLog[];
  // Summary stats for post-fight display
  totalDamageByP1: number;
  totalDamageByP2: number;
  critsP1: number;
  critsP2: number;
}

const STARTING_HP = 100;

// Safety backstop: prevents infinite loops. With 25-stat gladiators minimum damage
// is 1 per attack, so fights always end before this in practice.
// 2000 ticks is generous — a typical fight with equal SPD and 1 dmg/attack ends in
// ~100 attacks (100 HP / 1 dmg each, alternating = 200 attacks max total).
const MAX_TICKS = 2000;

// Simple deterministic hash-like mixer using xorshift — good enough for client-side sim
function nextSeed(seed: number): number {
  seed ^= seed << 13;
  seed ^= seed >> 7;
  seed ^= seed << 17;
  return seed >>> 0;
}

function calcDamage(
  attacker: GladiatorStats,
  defender: GladiatorStats,
  seed: number,
  critPool: number
): { damage: number; isCrit: boolean; nextSeedVal: number } {
  const nextSeedVal = nextSeed(seed);

  // Effective DEF = max(0, defender.DEF - attacker.INT)
  const effectiveDef = Math.max(0, defender.defense - attacker.intel);

  // Damage = max(1, STR - effectiveDef)
  const base = Math.max(1, attacker.strength - effectiveDef);

  // Shared crit pool system:
  //   critChance = (own.luck / (own.luck + opponent.luck)) × pool
  //   Guard: if both LCK are 0 (shouldn't happen with min-1 stat) → pool/2 each
  const lckSum = attacker.luck + defender.luck;
  const critChance = lckSum === 0 ? critPool / 2 : (attacker.luck / lckSum) * critPool;
  const roll = nextSeedVal % 1000 / 1000; // 0.000 to 0.999
  const isCrit = roll < critChance;
  const damage = isCrit ? base * 2 : base;

  return { damage, isCrit, nextSeedVal };
}

export function simulateFight(
  g1: GladiatorStats,
  g2: GladiatorStats
): FightResult {
  let hp1 = STARTING_HP;
  let hp2 = STARTING_HP;
  const log: RoundLog[] = [];

  let seed = (Math.random() * 0xffffffff) >>> 0;

  // Derive crit pool from first seed tick: 0.300 to 0.499
  // This is the total crit intensity shared across both fighters for this fight.
  seed = nextSeed(seed);
  const critPool = 0.30 + (seed % 200) / 1000;

  let totalDamageByP1 = 0;
  let totalDamageByP2 = 0;
  let critsP1 = 0;
  let critsP2 = 0;

  // ── ATB accumulator setup ─────────────────────────────────────────────────
  // diff = absolute speed difference. Faster gladiator gets rate (10 + diff),
  // slower gets rate 10. When tied: both get rate 10 (same frequency).
  const speedGap = Math.abs(g1.speed - g2.speed);
  const g1Faster = g1.speed >= g2.speed; // tiebreak: g1 acts first when equal

  const rate1 = g1Faster ? 10 + speedGap : 10;
  const rate2 = g1Faster ? 10 : 10 + speedGap;

  // Starting accumulators: pre-load so the faster gladiator fires first on tick 1.
  // Both start at their rate value — this means on tick 1, both can potentially
  // reach the threshold at the same time. Tiebreak: higher SPD acts first;
  // equal SPD → g1 acts first (consistent initiator tiebreak).
  let acc1 = rate1;
  let acc2 = rate2;

  let attackEventIndex = 0; // monotonically incrementing log entry counter
  let ticks = 0;

  // Combo tracking: counts consecutive hits from the same attacker.
  // Reset to 0 whenever the attacker changes. Used to:
  //   1. Gate the 4× crit-extend bonus (max chain = 4)
  //   2. Provide comboStep values during log generation (easier than pure post-process)
  // We still do a post-process pass after the loop to set isCombo/comboStep correctly
  // on all entries, because the in-loop tracking only knows the running count, not the
  // final run length needed to decide if a "run of 2" is a combo vs an isolated pair.
  let comboChainAttacker: "p1" | "p2" | null = null;
  let comboChainLength = 0;

  // Fight runs until one (or both) gladiators reach 0 HP.
  // MAX_TICKS is a safety backstop only.
  while (hp1 > 0 && hp2 > 0 && ticks < MAX_TICKS) {
    ticks++;

    // Accumulate action points this tick
    acc1 += rate1;
    acc2 += rate2;

    // Resolve attacks: when acc ≥ 10, that gladiator fires.
    // If both reach threshold on the same tick, higher SPD acts first.
    // Tied SPD → g1 acts first (g1Faster = true in that case).
    // We may have multiple attacks per tick if accumulators stack up
    // (this won't happen with the initial setup but is correct in general).

    // Build the attack queue for this tick.
    // Type is mutable — 4× bonus hits get spliced in after their trigger.
    type AttackEvent = { who: "p1" | "p2" };
    const queue: AttackEvent[] = [];

    // Drain acc1
    while (acc1 >= 10) {
      acc1 -= 10;
      queue.push({ who: "p1" });
    }

    // Drain acc2
    while (acc2 >= 10) {
      acc2 -= 10;
      queue.push({ who: "p2" });
    }

    // Sort: higher-speed attacker first; g1Faster handles ties
    // With the ATB rates we set, in steady state only one gladiator fires per tick
    // unless there's an exact ratio alignment. Sorting ensures correct ordering.
    queue.sort((a, b) => {
      if (a.who === b.who) return 0;
      const speedA = a.who === "p1" ? g1.speed : g2.speed;
      const speedB = b.who === "p1" ? g1.speed : g2.speed;
      if (speedA !== speedB) return speedB - speedA; // higher SPD first
      return a.who === "p1" ? -1 : 1; // g1 wins tiebreak
    });

    // Execute attacks in order, stopping if someone dies mid-tick.
    // i is a regular index so we can splice bonus hits into the queue.
    let i = 0;
    while (i < queue.length) {
      if (hp1 <= 0 || hp2 <= 0) break;

      const event = queue[i];
      i++;

      attackEventIndex++;

      // Update in-loop combo chain counter
      if (comboChainAttacker === event.who) {
        comboChainLength++;
      } else {
        comboChainAttacker = event.who;
        comboChainLength = 1;
      }

      if (event.who === "p1") {
        const r = calcDamage(g1, g2, seed, critPool);
        seed = r.nextSeedVal;
        hp2 -= r.damage;
        totalDamageByP1 += r.damage;
        if (r.isCrit) critsP1++;

        log.push({
          round: attackEventIndex,
          attacker: "p1",
          damage: r.damage,
          isCrit: r.isCrit,
          hp1After: Math.max(hp1, 0),
          hp2After: Math.max(hp2, 0),
          attackedFirst: true,
          isDoubleAttack: false,
          speedGap,
          // Placeholder values — overwritten by post-processing pass below
          isCombo: false,
          comboStep: 0,
        });

        // 4× crit-extend: consecutive crit + speedGap≥5 + chain<4 + 40% roll
        // Only inject if the target is still alive (hp2 > 0)
        if (
          r.isCrit &&
          comboChainLength >= 2 && // must already be in a combo (≥2 consecutive)
          comboChainLength < 4 &&  // cap at 4×
          speedGap >= 5 &&
          hp2 > 0
        ) {
          seed = nextSeed(seed);
          const roll40 = (seed % 1000) / 1000;
          if (roll40 < 0.40) {
            // Inject bonus p1 attack immediately after current position
            queue.splice(i, 0, { who: "p1" });
          }
        }
      } else {
        const r = calcDamage(g2, g1, seed, critPool);
        seed = r.nextSeedVal;
        hp1 -= r.damage;
        totalDamageByP2 += r.damage;
        if (r.isCrit) critsP2++;

        log.push({
          round: attackEventIndex,
          attacker: "p2",
          damage: r.damage,
          isCrit: r.isCrit,
          hp1After: Math.max(hp1, 0),
          hp2After: Math.max(hp2, 0),
          attackedFirst: true,
          isDoubleAttack: false,
          speedGap,
          // Placeholder values — overwritten by post-processing pass below
          isCombo: false,
          comboStep: 0,
        });

        // 4× crit-extend: same logic for p2
        if (
          r.isCrit &&
          comboChainLength >= 2 &&
          comboChainLength < 4 &&
          speedGap >= 5 &&
          hp1 > 0
        ) {
          seed = nextSeed(seed);
          const roll40 = (seed % 1000) / 1000;
          if (roll40 < 0.40) {
            queue.splice(i, 0, { who: "p2" });
          }
        }
      }
    }
  }

  // ── Post-process: tag isCombo / comboStep ────────────────────────────────
  // Scan for runs of consecutive same-attacker entries.
  // A run of length ≥ 2 is a combo: every entry in the run gets isCombo=true
  // and comboStep = 1, 2, 3, ... (1-based position within the run).
  // Single isolated hits remain isCombo=false, comboStep=0.
  {
    let idx = 0;
    while (idx < log.length) {
      // Find the end of the current run
      let runEnd = idx + 1;
      while (runEnd < log.length && log[runEnd].attacker === log[idx].attacker) {
        runEnd++;
      }
      const runLength = runEnd - idx;
      if (runLength >= 2) {
        for (let k = idx; k < runEnd; k++) {
          log[k].isCombo = true;
          log[k].comboStep = k - idx + 1; // 1-based
        }
      }
      // Single hits keep the placeholder isCombo=false, comboStep=0
      idx = runEnd;
    }
  }

  // Determine winner.
  // Both can reach 0 in the same tick (queue drains both) = simultaneous kill = draw.
  // Single-side 0 = that side lost.
  let winner: "p1" | "p2" | "draw";

  if (hp1 <= 0 && hp2 <= 0) {
    winner = "draw";
  } else if (hp2 <= 0) {
    winner = "p1";
  } else {
    // hp1 <= 0, hp2 > 0
    winner = "p2";
  }

  return {
    winner,
    rounds: attackEventIndex, // total attack events — used by FightReplay for "X rounds"
    hp1Final: Math.max(hp1, 0),
    hp2Final: Math.max(hp2, 0),
    log,
    totalDamageByP1,
    totalDamageByP2,
    critsP1,
    critsP2,
  };
}
