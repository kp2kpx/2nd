"use client";

// ─── Fight Log ────────────────────────────────────────────────────────────────
// Chronological attack event log, shown after fight resolves.
// Each row = one attack event from result.log.

import { FightResult, RoundLog } from "@/lib/fight-engine";

interface Props {
  result: FightResult;
}

// ── HP bar ────────────────────────────────────────────────────────────────────

function HpBar({ hp, color }: { hp: number; color: "red" | "blue" }) {
  const pct = Math.max(0, Math.min(100, hp));
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="w-10 h-1.5 rounded-full overflow-hidden shrink-0"
        style={{ background: "#1c1608" }}
      >
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${pct}%`,
            // Slightly desaturated red/blue to match parchment palette
            background: color === "red" ? "#c47070" : "#6090c8",
          }}
        />
      </div>
      <span
        className="tabular-nums text-xs"
        style={{
          color: hp === 0 ? "#e8a0a0" : hp < 25 ? "#d4a853" : "#9a9080",
          minWidth: "1.8rem",
        }}
      >
        {hp}
      </span>
    </div>
  );
}

// ── Summary row ───────────────────────────────────────────────────────────────

function SummaryBar({ result }: { result: FightResult }) {
  const totalHitsRed = result.log.filter((e) => e.attacker === "p1").length;
  const totalHitsBlue = result.log.filter((e) => e.attacker === "p2").length;

  return (
    <div
      className="rounded-lg p-3 mb-3"
      style={{
        background: "#16120d",
        border: "1px solid #2a2010",
      }}
    >
      <div className="grid grid-cols-3 gap-2 text-xs">
        {/* Labels */}
        <div />
        <div
          className="text-center font-bold uppercase tracking-wide text-xs"
          style={{ color: "#e8a0a0" }}
        >
          RED
        </div>
        <div
          className="text-center font-bold uppercase tracking-wide text-xs"
          style={{ color: "#90b8e8" }}
        >
          BLUE
        </div>

        {/* Total hits */}
        <div style={{ color: "#9a9080" }}>Total hits</div>
        <div
          className="text-center font-bold tabular-nums"
          style={{ color: "#e8dcc8" }}
        >
          {totalHitsRed}
        </div>
        <div
          className="text-center font-bold tabular-nums"
          style={{ color: "#e8dcc8" }}
        >
          {totalHitsBlue}
        </div>

        {/* Total damage */}
        <div style={{ color: "#9a9080" }}>Total damage</div>
        <div
          className="text-center font-bold tabular-nums"
          style={{ color: "#e8dcc8" }}
        >
          {result.totalDamageByP1}
        </div>
        <div
          className="text-center font-bold tabular-nums"
          style={{ color: "#e8dcc8" }}
        >
          {result.totalDamageByP2}
        </div>

        {/* Crits */}
        <div style={{ color: "#9a9080" }}>Crits</div>
        <div
          className="text-center font-bold tabular-nums"
          style={{ color: "#d4a853" }}
        >
          {result.critsP1}
        </div>
        <div
          className="text-center font-bold tabular-nums"
          style={{ color: "#d4a853" }}
        >
          {result.critsP2}
        </div>

        {/* Fight length */}
        <div style={{ color: "#9a9080" }}>Attack events</div>
        <div
          className="col-span-2 text-center font-bold tabular-nums"
          style={{ color: "#e8dcc8" }}
        >
          {result.log.length}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FightLog({ result }: Props) {
  // Find the fatal blow index (last event where a gladaitor's HP hits 0)
  const fatalIndex = result.log.reduce((idx, entry, i) => {
    if (entry.hp1After === 0 || entry.hp2After === 0) return i;
    return idx;
  }, -1);

  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: "#1a1510",
        border: "1px solid #2a2010",
      }}
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#d4a853" }}
        >
          FIGHT LOG
        </span>
        <span className="text-xs" style={{ color: "#9a9080" }}>
          {result.log.length} attack events
        </span>
      </div>

      {/* Summary stats */}
      <SummaryBar result={result} />

      {/* Scrollable event table */}
      <div
        className="overflow-y-auto overflow-x-auto rounded fight-log-scroll"
        style={{ maxHeight: "320px" }}
      >
        <table
          className="w-full border-collapse"
          style={{ tableLayout: "fixed", minWidth: "360px" }}
        >
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>
          <thead
            className="sticky top-0"
            style={{ background: "#1a1510", zIndex: 1 }}
          >
            <tr style={{ borderBottom: "1px solid #2a2010" }}>
              <th
                className="text-left px-1.5 py-1.5 text-xs uppercase tracking-widest"
                style={{ color: "#9a9080" }}
              >
                #
              </th>
              <th
                className="text-left px-1.5 py-1.5 text-xs uppercase tracking-widest"
                style={{ color: "#9a9080" }}
              >
                By
              </th>
              <th
                className="text-center px-1.5 py-1.5 text-xs uppercase tracking-widest"
                style={{ color: "#9a9080" }}
              >
                Dmg
              </th>
              <th
                className="text-center px-1.5 py-1.5 text-xs uppercase tracking-widest"
                style={{ color: "#e8a0a0" }}
              >
                RED HP
              </th>
              <th
                className="text-center px-1.5 py-1.5 text-xs uppercase tracking-widest"
                style={{ color: "#90b8e8" }}
              >
                BLU HP
              </th>
            </tr>
          </thead>
          <tbody>
            {result.log.map((entry: RoundLog, i: number) => {
              const isRed = entry.attacker === "p1";
              const isFatal = i === fatalIndex;

              const rowBg = isFatal
                ? "rgba(212,168,83,0.15)"
                : i % 2 === 0
                ? "transparent"
                : "rgba(255,255,255,0.03)";

              return (
                <tr
                  key={i}
                  style={{
                    background: rowBg,
                    borderBottom: isFatal
                      ? "1px solid rgba(212,168,83,0.3)"
                      : "1px solid rgba(255,255,255,0.03)",
                  }}
                >
                  {/* Event # */}
                  <td
                    className="px-1.5 py-1 text-xs tabular-nums"
                    style={{ color: "#9a9080" }}
                  >
                    {i + 1}
                  </td>

                  {/* Attacker */}
                  <td
                    className="px-1.5 py-1 text-xs font-bold uppercase"
                    style={{ color: isRed ? "#e8a0a0" : "#90b8e8" }}
                  >
                    {isRed ? "RED" : "BLUE"}
                  </td>

                  {/* Damage */}
                  <td className="px-1.5 py-1 text-center">
                    {entry.isCrit ? (
                      <span
                        className="text-xs font-bold"
                        style={{ color: "#d4a853" }}
                        title="Critical hit"
                      >
                        {entry.damage} &#9889; CRIT
                      </span>
                    ) : (
                      <span
                        className="text-xs font-bold tabular-nums"
                        style={{ color: "#e8dcc8" }}
                      >
                        {entry.damage}
                      </span>
                    )}
                  </td>

                  {/* RED HP bar */}
                  <td className="px-1.5 py-1">
                    <div className="flex justify-center">
                      <HpBar hp={entry.hp1After} color="red" />
                    </div>
                  </td>

                  {/* BLUE HP bar */}
                  <td className="px-1.5 py-1">
                    <div className="flex justify-center">
                      <HpBar hp={entry.hp2After} color="blue" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Fatal blow callout */}
      {fatalIndex >= 0 && (
        <div
          className="mt-2 pt-2 text-center text-xs font-bold uppercase tracking-widest"
          style={{
            borderTop: "1px solid #2a2010",
            color: "#d4a853",
          }}
        >
          &#9876; Fatal blow on event #{fatalIndex + 1} &#9876;
        </div>
      )}
    </div>
  );
}
