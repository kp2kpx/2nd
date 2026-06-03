"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { FightResult, RoundLog } from "@/lib/fight-engine";
import { useFightAudio } from "@/lib/useAudio";

// ─── Sprite-based character avatar ──────────────────────────────────────────
// Uses 4 transparent PNGs per color variant (red/blue).
// Pose swaps are driven by the fight engine's round data.
// Idle: subtle breathing scaleY loop
// Attack: swap to attack.png + translateX lunge
// Hit: swap to hit.png + knockback + impact glow
// Death: swap to death.png + drop + fade

type Pose = "idle" | "attack" | "hit" | "death";
type CharColor = "red" | "blue";

// Legacy SVG character designs — kept for fallback/variant display elsewhere
// 10 unique stylized vector characters, 80×96 viewBox.
// All characters face RIGHT by default. P2 gets scaleX(-1) via CSS.

// 0 — MAXIMUS: Roman sword & shield (crimson/gold)
function CharMaximus() {
  return (
    <>
      <path d="M28 3 Q40 -1 52 3 Q47 11 40 9 Q33 11 28 3Z" fill="#dc2626" />
      <ellipse cx="40" cy="17" rx="14" ry="13" fill="#d97706" />
      <rect x="30" y="15" width="20" height="9" rx="2" fill="#1c1917" />
      <rect x="32" y="18" width="5" height="2" rx="1" fill="#fbbf24" />
      <rect x="43" y="18" width="5" height="2" rx="1" fill="#fbbf24" />
      <rect x="37" y="29" width="6" height="5" rx="1" fill="#b45309" />
      <ellipse cx="14" cy="52" rx="10" ry="14" fill="#b8860b" stroke="#8b6914" strokeWidth="1" />
      <ellipse cx="14" cy="52" rx="7" ry="10" fill="#8b1a1a" />
      <circle cx="14" cy="52" r="2.5" fill="#d97706" />
      <path d="M22 34 L58 34 L60 65 L20 65Z" fill="#dc2626" />
      <path d="M22 34 L58 34 L56 47 L24 47Z" fill="#b91c1c" />
      <rect x="11" y="36" width="14" height="7" rx="3.5" fill="#dc2626" />
      <rect x="55" y="34" width="14" height="7" rx="3.5" fill="#dc2626" />
      <rect x="67" y="19" width="3" height="36" rx="1.5" fill="#d1d5db" />
      <rect x="62" y="31" width="12" height="3" rx="1" fill="#d97706" />
      <rect x="68" y="15" width="2" height="8" rx="1" fill="#f3f4f6" />
      <rect x="22" y="62" width="36" height="5" rx="1" fill="#b8860b" />
      <rect x="24" y="65" width="12" height="22" rx="2" fill="#991b1b" />
      <rect x="44" y="65" width="12" height="22" rx="2" fill="#991b1b" />
      <rect x="22" y="81" width="16" height="7" rx="2" fill="#78350f" />
      <rect x="42" y="81" width="16" height="7" rx="2" fill="#78350f" />
    </>
  );
}

// 1 — SPARTAX: Greek spear warrior (royal blue/silver)
function CharSpartax() {
  return (
    <>
      <polygon points="40,1 48,8 40,12 32,8" fill="#94a3b8" />
      <ellipse cx="40" cy="18" rx="13" ry="13" fill="#2563eb" />
      <path d="M27 15 Q40 10 53 15 L53 24 Q40 20 27 24Z" fill="#1d4ed8" />
      <rect x="33" y="17" width="14" height="7" rx="2" fill="#0f172a" />
      <rect x="35" y="20" width="4" height="2" rx="1" fill="#bfdbfe" />
      <rect x="41" y="20" width="4" height="2" rx="1" fill="#bfdbfe" />
      <rect x="37" y="30" width="6" height="4" rx="1" fill="#1e40af" />
      <path d="M24 34 L56 34 L58 65 L22 65Z" fill="#2563eb" />
      <rect x="24" y="34" width="32" height="10" fill="#1d4ed8" />
      <ellipse cx="16" cy="50" rx="9" ry="12" fill="#94a3b8" stroke="#64748b" strokeWidth="1" />
      <circle cx="16" cy="50" r="3" fill="#2563eb" />
      <rect x="12" y="36" width="13" height="6" rx="3" fill="#2563eb" />
      <rect x="55" y="33" width="13" height="6" rx="3" fill="#2563eb" />
      <rect x="65" y="1" width="3" height="56" rx="1.5" fill="#94a3b8" />
      <polygon points="65,1 68,1 66.5,-6" fill="#e2e8f0" />
      <rect x="22" y="63" width="36" height="4" rx="1" fill="#1e40af" />
      <rect x="25" y="66" width="11" height="22" rx="2" fill="#1e3a8a" />
      <rect x="44" y="66" width="11" height="22" rx="2" fill="#1e3a8a" />
      <rect x="23" y="81" width="15" height="7" rx="2" fill="#0f172a" />
      <rect x="42" y="81" width="15" height="7" rx="2" fill="#0f172a" />
    </>
  );
}

// 2 — GRUK: Axe berserker (iron/dark brown)
function CharGruk() {
  return (
    <>
      <path d="M30 8 Q33 3 36 6 Q38 1 40 4 Q42 1 44 6 Q47 3 50 8 Q45 12 40 10 Q35 12 30 8Z" fill="#6b7280" />
      <ellipse cx="40" cy="19" rx="15" ry="13" fill="#44403c" />
      <rect x="31" y="17" width="18" height="8" rx="1" fill="#1c1917" />
      <rect x="33" y="20" width="4" height="3" rx="1" fill="#ef4444" />
      <rect x="43" y="20" width="4" height="3" rx="1" fill="#ef4444" />
      <path d="M28 16 L32 17 L30 22 L28 16Z" fill="#6b7280" />
      <path d="M52 16 L48 17 L50 22 L52 16Z" fill="#6b7280" />
      <rect x="36" y="31" width="8" height="5" rx="1" fill="#292524" />
      <path d="M18 35 L62 35 L65 66 L15 66Z" fill="#292524" />
      <path d="M18 35 L62 35 L60 50 L20 50Z" fill="#1c1917" />
      <rect x="12" y="36" width="16" height="8" rx="4" fill="#44403c" />
      <rect x="52" y="34" width="16" height="8" rx="4" fill="#44403c" />
      <rect x="66" y="20" width="4" height="48" rx="2" fill="#78350f" />
      <path d="M62 18 Q66 10 74 14 Q74 28 66 28 Z" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.5" />
      <path d="M62 34 Q66 42 74 38 Q74 24 66 24 Z" fill="#9ca3af" stroke="#6b7280" strokeWidth="0.5" />
      <rect x="15" y="64" width="50" height="5" rx="1" fill="#78350f" />
      <rect x="22" y="67" width="14" height="22" rx="2" fill="#292524" />
      <rect x="44" y="67" width="14" height="22" rx="2" fill="#292524" />
      <rect x="20" y="82" width="18" height="7" rx="2" fill="#1c1917" />
      <rect x="42" y="82" width="18" height="7" rx="2" fill="#1c1917" />
    </>
  );
}

// 3 — SHADE: Dual-dagger assassin (dark/teal)
function CharShade() {
  return (
    <>
      <path d="M26 8 Q40 4 54 8 Q50 18 40 16 Q30 18 26 8Z" fill="#134e4a" />
      <ellipse cx="40" cy="19" rx="13" ry="12" fill="#1c1917" />
      <rect x="30" y="15" width="20" height="10" rx="3" fill="#0f172a" />
      <ellipse cx="36" cy="20" rx="3" ry="2" fill="#2dd4bf" opacity="0.9" />
      <ellipse cx="44" cy="20" rx="3" ry="2" fill="#2dd4bf" opacity="0.9" />
      <rect x="37" y="30" width="6" height="5" rx="1" fill="#134e4a" />
      <path d="M22 35 L58 35 L60 66 L20 66Z" fill="#1c1917" />
      <path d="M22 35 L58 35 L56 49 L24 49Z" fill="#0f172a" />
      <path d="M30 50 L34 54 L30 58 L26 54Z" fill="#2dd4bf" opacity="0.5" />
      <path d="M50 50 L54 54 L50 58 L46 54Z" fill="#2dd4bf" opacity="0.5" />
      <rect x="10" y="36" width="14" height="7" rx="3.5" fill="#1c1917" />
      <rect x="56" y="36" width="14" height="7" rx="3.5" fill="#1c1917" />
      <rect x="6" y="40" width="2" height="20" rx="1" fill="#9ca3af" style={{transform:"rotate(-20deg)", transformOrigin:"8px 40px"}} />
      <rect x="72" y="40" width="2" height="20" rx="1" fill="#9ca3af" style={{transform:"rotate(20deg)", transformOrigin:"73px 40px"}} />
      <rect x="5" y="38" width="5" height="3" rx="1" fill="#2dd4bf" />
      <rect x="70" y="38" width="5" height="3" rx="1" fill="#2dd4bf" />
      <rect x="20" y="64" width="40" height="5" rx="1" fill="#134e4a" />
      <rect x="25" y="67" width="11" height="22" rx="2" fill="#1c1917" />
      <rect x="44" y="67" width="11" height="22" rx="2" fill="#1c1917" />
      <rect x="23" y="82" width="15" height="7" rx="2" fill="#0f172a" />
      <rect x="42" y="82" width="15" height="7" rx="2" fill="#0f172a" />
    </>
  );
}

// 4 — PYROS: Fire staff mage (orange/black)
function CharPyros() {
  return (
    <>
      <path d="M36 0 L44 0 L46 8 L40 6 L34 8Z" fill="#ea580c" />
      <polygon points="32,8 40,2 48,8 44,16 36,16" fill="#1c1917" />
      <ellipse cx="40" cy="19" rx="12" ry="12" fill="#292524" />
      <ellipse cx="40" cy="20" rx="9" ry="9" fill="#44403c" />
      <rect x="34" y="17" width="12" height="7" rx="2" fill="#1c1917" />
      <ellipse cx="36" cy="21" rx="2.5" ry="2" fill="#f97316" />
      <ellipse cx="44" cy="21" rx="2.5" ry="2" fill="#f97316" />
      <rect x="37" y="30" width="6" height="5" rx="1" fill="#292524" />
      <path d="M24 35 L56 35 L58 67 L22 67Z" fill="#292524" />
      <path d="M24 35 L56 35 L54 50 L26 50Z" fill="#1c1917" />
      <path d="M28 50 Q30 44 32 50 Q34 44 36 50 Q38 44 40 50" stroke="#ea580c" strokeWidth="2" fill="none" />
      <rect x="12" y="36" width="14" height="7" rx="3.5" fill="#292524" />
      <rect x="54" y="36" width="14" height="7" rx="3.5" fill="#292524" />
      <rect x="67" y="10" width="3" height="60" rx="1.5" fill="#78350f" />
      <ellipse cx="68" cy="8" rx="7" ry="7" fill="#ea580c" opacity="0.9" />
      <ellipse cx="68" cy="8" rx="4" ry="4" fill="#fef08a" />
      <path d="M63 4 Q68 -2 73 4 Q68 2 63 4Z" fill="#f97316" />
      <path d="M64 12 Q68 18 72 12 Q68 14 64 12Z" fill="#f97316" />
      <rect x="22" y="65" width="36" height="5" rx="1" fill="#1c1917" />
      <rect x="25" y="68" width="11" height="22" rx="2" fill="#292524" />
      <rect x="44" y="68" width="11" height="22" rx="2" fill="#292524" />
      <rect x="23" y="83" width="15" height="7" rx="2" fill="#1c1917" />
      <rect x="42" y="83" width="15" height="7" rx="2" fill="#1c1917" />
    </>
  );
}

// 5 — KIRA: Ice warrior (white/cyan)
function CharKira() {
  return (
    <>
      <polygon points="40,1 44,7 48,4 46,10 52,10 47,14 50,20 40,15 30,20 33,14 28,10 34,10 32,4 36,7" fill="#67e8f9" />
      <ellipse cx="40" cy="19" rx="13" ry="13" fill="#e0f2fe" />
      <path d="M27 16 Q40 12 53 16 L53 25 Q40 21 27 25Z" fill="#bae6fd" />
      <rect x="33" y="17" width="14" height="7" rx="2" fill="#0e7490" />
      <rect x="35" y="20" width="4" height="2" rx="1" fill="#e0f2fe" />
      <rect x="41" y="20" width="4" height="2" rx="1" fill="#e0f2fe" />
      <rect x="37" y="30" width="6" height="5" rx="1" fill="#bae6fd" />
      <path d="M22 35 L58 35 L60 66 L20 66Z" fill="#e0f2fe" />
      <path d="M22 35 L58 35 L56 48 L24 48Z" fill="#bae6fd" />
      <path d="M30 48 L34 56 L30 64 L26 56Z" fill="#67e8f9" opacity="0.6" />
      <path d="M50 48 L54 56 L50 64 L46 56Z" fill="#67e8f9" opacity="0.6" />
      <rect x="10" y="36" width="14" height="7" rx="3.5" fill="#bae6fd" />
      <rect x="56" y="36" width="14" height="7" rx="3.5" fill="#bae6fd" />
      <rect x="67" y="16" width="3" height="50" rx="1.5" fill="#e0f2fe" />
      <polygon points="68,10 72,16 68,22 64,16" fill="#67e8f9" />
      <rect x="63" y="30" width="10" height="2.5" rx="1" fill="#67e8f9" />
      <rect x="63" y="40" width="10" height="2.5" rx="1" fill="#67e8f9" />
      <rect x="22" y="64" width="36" height="5" rx="1" fill="#0e7490" />
      <rect x="25" y="67" width="11" height="22" rx="2" fill="#bae6fd" />
      <rect x="44" y="67" width="11" height="22" rx="2" fill="#bae6fd" />
      <rect x="23" y="82" width="15" height="7" rx="2" fill="#0e7490" />
      <rect x="42" y="82" width="15" height="7" rx="2" fill="#0e7490" />
    </>
  );
}

// 6 — NYX: Shadow scythe (deep purple)
function CharNyx() {
  return (
    <>
      <path d="M26 10 Q40 4 54 10 Q52 20 40 18 Q28 20 26 10Z" fill="#3b0764" />
      <ellipse cx="40" cy="20" rx="14" ry="13" fill="#1e1b4b" />
      <rect x="30" y="16" width="20" height="11" rx="3" fill="#0f0a1e" />
      <ellipse cx="36" cy="22" rx="3.5" ry="2.5" fill="#a78bfa" />
      <ellipse cx="44" cy="22" rx="3.5" ry="2.5" fill="#a78bfa" />
      <rect x="37" y="32" width="6" height="5" rx="1" fill="#2e1065" />
      <path d="M20 36 L60 36 L62 68 L18 68Z" fill="#1e1b4b" />
      <path d="M20 36 L60 36 L58 52 L22 52Z" fill="#0f0a1e" />
      <path d="M20 55 Q30 62 40 56 Q50 62 60 55" stroke="#7c3aed" strokeWidth="2" fill="none" />
      <rect x="10" y="37" width="14" height="7" rx="3.5" fill="#2e1065" />
      <rect x="56" y="37" width="14" height="7" rx="3.5" fill="#2e1065" />
      <rect x="66" y="14" width="3" height="58" rx="1.5" fill="#4c1d95" />
      <path d="M56 12 Q66 2 75 10 Q72 22 66 22 Q64 16 56 12Z" fill="#7c3aed" />
      <path d="M57 13 Q66 5 73 12 Q70 20 66 20 Q64 15 57 13Z" fill="#a78bfa" />
      <rect x="18" y="66" width="44" height="5" rx="1" fill="#2e1065" />
      <rect x="23" y="69" width="12" height="22" rx="2" fill="#1e1b4b" />
      <rect x="45" y="69" width="12" height="22" rx="2" fill="#1e1b4b" />
      <rect x="21" y="84" width="16" height="7" rx="2" fill="#0f0a1e" />
      <rect x="43" y="84" width="16" height="7" rx="2" fill="#0f0a1e" />
    </>
  );
}

// 7 — URSA: Beast warrior bear skull (forest green/brown)
function CharUrsa() {
  return (
    <>
      <path d="M28 12 Q32 4 40 6 Q48 4 52 12 Q48 18 40 16 Q32 18 28 12Z" fill="#d1d5db" />
      <ellipse cx="31" cy="10" rx="5" ry="4" fill="#d1d5db" />
      <ellipse cx="49" cy="10" rx="5" ry="4" fill="#d1d5db" />
      <ellipse cx="40" cy="17" rx="14" ry="13" fill="#d1d5db" />
      <ellipse cx="40" cy="18" rx="11" ry="10" fill="#f3f4f6" />
      <rect x="31" y="16" width="18" height="8" rx="2" fill="#0f172a" />
      <ellipse cx="35" cy="20" rx="3" ry="2.5" fill="#166534" />
      <ellipse cx="45" cy="20" rx="3" ry="2.5" fill="#166534" />
      <rect x="37" y="30" width="6" height="5" rx="1" fill="#166534" />
      <path d="M20 35 L60 35 L62 67 L18 67Z" fill="#166534" />
      <path d="M20 35 L60 35 L58 48 L22 48Z" fill="#15803d" />
      <path d="M22 50 Q30 56 38 52 Q46 56 54 52 Q58 58 54 64 Q46 60 38 64 Q30 60 22 64 Q18 58 22 50Z" fill="#78350f" />
      <rect x="8" y="36" width="16" height="9" rx="4.5" fill="#166534" />
      <rect x="56" y="36" width="16" height="9" rx="4.5" fill="#166534" />
      <path d="M6 40 Q2 38 4 44 Q6 46 10 44Z" fill="#d1d5db" />
      <path d="M8 44 Q4 42 6 48 Q8 50 12 48Z" fill="#d1d5db" />
      <path d="M74 40 Q78 38 76 44 Q74 46 70 44Z" fill="#d1d5db" />
      <path d="M72 44 Q76 42 74 48 Q72 50 68 48Z" fill="#d1d5db" />
      <rect x="18" y="65" width="44" height="5" rx="1" fill="#78350f" />
      <rect x="23" y="68" width="12" height="22" rx="2" fill="#14532d" />
      <rect x="45" y="68" width="12" height="22" rx="2" fill="#14532d" />
      <rect x="21" y="83" width="16" height="7" rx="2" fill="#78350f" />
      <rect x="43" y="83" width="16" height="7" rx="2" fill="#78350f" />
    </>
  );
}

// 8 — SOLARIS: Holy paladin (white/bright gold)
function CharSolaris() {
  return (
    <>
      <ellipse cx="40" cy="10" rx="18" ry="5" fill="#fbbf24" opacity="0.5" />
      <ellipse cx="40" cy="10" rx="12" ry="3" fill="#fde68a" opacity="0.8" />
      <path d="M28 16 Q32 8 40 10 Q48 8 52 16 Q48 20 40 18 Q32 20 28 16Z" fill="#fbbf24" />
      <ellipse cx="40" cy="20" rx="13" ry="13" fill="#f5f5f4" />
      <path d="M27 17 Q40 13 53 17 L53 26 Q40 22 27 26Z" fill="#fbbf24" />
      <rect x="33" y="18" width="14" height="7" rx="2" fill="#1c1917" />
      <rect x="35" y="21" width="4" height="2" rx="1" fill="#fde68a" />
      <rect x="41" y="21" width="4" height="2" rx="1" fill="#fde68a" />
      <rect x="37" y="31" width="6" height="5" rx="1" fill="#d97706" />
      <path d="M22 36 L58 36 L60 66 L20 66Z" fill="#f5f5f4" />
      <path d="M22 36 L58 36 L56 50 L24 50Z" fill="#fbbf24" />
      <path d="M38 50 L42 50 L44 66 L36 66Z" fill="#d97706" />
      <rect x="10" y="37" width="14" height="7" rx="3.5" fill="#f5f5f4" />
      <rect x="56" y="37" width="14" height="7" rx="3.5" fill="#f5f5f4" />
      <rect x="67" y="12" width="3" height="46" rx="1.5" fill="#f5f5f4" />
      <polygon points="68,6 72,14 68,18 64,14" fill="#fde68a" />
      <circle cx="68" cy="12" r="4" fill="#fbbf24" opacity="0.6" />
      <rect x="62" y="32" width="12" height="3" rx="1" fill="#fbbf24" />
      <rect x="22" y="64" width="36" height="5" rx="1" fill="#d97706" />
      <rect x="25" y="67" width="11" height="22" rx="2" fill="#e7e5e4" />
      <rect x="44" y="67" width="11" height="22" rx="2" fill="#e7e5e4" />
      <rect x="23" y="82" width="15" height="7" rx="2" fill="#d97706" />
      <rect x="42" y="82" width="15" height="7" rx="2" fill="#d97706" />
    </>
  );
}

// 9 — VEX: Chaos knight skull (black/blood red)
function CharVex() {
  return (
    <>
      <path d="M30 12 Q33 5 40 7 Q47 5 50 12 L50 16 Q45 14 40 15 Q35 14 30 16Z" fill="#1c1917" />
      <path d="M30 7 Q28 3 32 5Z" fill="#6b7280" />
      <path d="M50 7 Q52 3 48 5Z" fill="#6b7280" />
      <path d="M36 4 Q35 0 38 2Z" fill="#6b7280" />
      <path d="M44 4 Q45 0 42 2Z" fill="#6b7280" />
      <ellipse cx="40" cy="19" rx="13" ry="13" fill="#1c1917" />
      <ellipse cx="40" cy="20" rx="10" ry="10" fill="#0c0a09" />
      <rect x="32" y="17" width="16" height="9" rx="2" fill="#1c1917" />
      <ellipse cx="35" cy="21" rx="3.5" ry="3" fill="#dc2626" opacity="0.8" />
      <ellipse cx="45" cy="21" rx="3.5" ry="3" fill="#dc2626" opacity="0.8" />
      <path d="M34 26 L36 24 L38 26 L40 24 L42 26 L44 24 L46 26" stroke="#6b7280" strokeWidth="1" fill="none" />
      <rect x="37" y="31" width="6" height="5" rx="1" fill="#1c1917" />
      <path d="M18 36 L62 36 L64 68 L16 68Z" fill="#1c1917" />
      <path d="M18 36 L62 36 L60 50 L20 50Z" fill="#0c0a09" />
      <path d="M22 42 L58 42 M24 46 L56 46" stroke="#dc2626" strokeWidth="1" opacity="0.5" />
      <rect x="10" y="37" width="14" height="8" rx="4" fill="#1c1917" />
      <rect x="56" y="37" width="14" height="8" rx="4" fill="#1c1917" />
      <rect x="66" y="16" width="4" height="52" rx="2" fill="#292524" />
      <path d="M65 10 L72 6 L78 12 L72 24 L65 20Z" fill="#1c1917" stroke="#dc2626" strokeWidth="0.5" />
      <path d="M66 11 L71 8 L76 13 L71 22 L66 19Z" fill="#292524" />
      <rect x="16" y="66" width="48" height="5" rx="1" fill="#1c1917" />
      <rect x="22" y="69" width="13" height="22" rx="2" fill="#1c1917" />
      <rect x="45" y="69" width="13" height="22" rx="2" fill="#1c1917" />
      <path d="M22 72 L26 72 L26 80 L22 80Z" fill="#dc2626" opacity="0.4" />
      <path d="M54 72 L58 72 L58 80 L54 80Z" fill="#dc2626" opacity="0.4" />
      <rect x="20" y="84" width="17" height="7" rx="2" fill="#0c0a09" />
      <rect x="43" y="84" width="17" height="7" rx="2" fill="#0c0a09" />
    </>
  );
}

function CharacterVariant({ variant }: { variant: number }) {
  const chars = [
    <CharMaximus />, <CharSpartax />, <CharGruk />, <CharShade />, <CharPyros />,
    <CharKira />, <CharNyx />, <CharUrsa />, <CharSolaris />, <CharVex />,
  ];
  return <>{chars[variant % 10]}</>;
}

// ─── SpriteAvatar: image-based gladiator with pose-swap animations ───────────

function SpriteAvatar({
  type,
  color,
  pose,
  dim,
  shake,
  flash,
  critGlow,
  attackLunge,
  hitKnockback,
}: {
  type: "p1" | "p2";
  color: CharColor;
  pose: Pose;
  dim?: boolean;
  shake?: boolean;
  flash?: boolean;
  critGlow?: boolean;
  // Lunge offset in px: positive = toward opponent (P1 lunges right, P2 lunges left)
  attackLunge?: number;
  hitKnockback?: number;
}) {
  const isP2 = type === "p2";

  // The character images are 848×1216. We display them at a fixed height
  // and let width scale proportionally. Height ~110px for arena floor fit.
  const H = 110;

  const src = `/characters/${color}/${pose}.png`;

  // Build transform: mirror P2, add lunge/knockback offset
  const lungeOffset = attackLunge ?? 0;
  const knockOffset = hitKnockback ?? 0;
  const translateX = isP2
    ? -(lungeOffset + knockOffset)
    : (lungeOffset + knockOffset);

  let transform = `scaleX(${isP2 ? -1 : 1})`;
  if (translateX !== 0) {
    // Apply translateX BEFORE scaleX so direction is correct
    transform = `translateX(${isP2 ? -translateX : translateX}px) scaleX(${isP2 ? -1 : 1})`;
  }

  // Filter: flash (hit flash), attack brightness on attack pose
  let filterVal: string | undefined;
  if (flash) {
    filterVal = "brightness(3) saturate(0.2) sepia(1) hue-rotate(-10deg)";
  } else if (pose === "attack") {
    // Sword arm brightness pulse — drawn on top of the image itself
    filterVal = "brightness(1.35) drop-shadow(0 0 8px rgba(100,200,255,0.7))";
  } else if (pose === "death") {
    filterVal = "brightness(0.7)";
  }

  // Impact glow: radial glow at sword arm when taking a hit
  const showImpactGlow = pose === "hit" && flash;

  // Breathing and death animations must live on an INNER div, not the outer div.
  // The outer div holds transform (scaleX mirror + lunge) and transition.
  // If the animation and the mirror transform share the same element, CSS keyframes
  // overwrite the inline transform:scaleX(-1) during each frame, un-mirroring P2.
  const innerAnimStyle: React.CSSProperties = (() => {
    if (shake) return { animation: "gladShake 150ms ease-in-out" };
    if (critGlow) return { animation: "gladCritGlow 200ms ease-out" };
    if (pose === "death") return { animation: "gladDeath 600ms ease-out forwards" };
    if (pose === "idle") return { animation: "gladBreath 1.5s ease-in-out infinite" };
    return {};
  })();

  return (
    <div
      style={{
        display: "inline-block",
        position: "relative",
        // Center-align for the arena floor
        verticalAlign: "bottom",
        // Outer div owns: mirror transform + lunge/knockback movement + transition.
        // Animations are on the inner div so they don't clobber scaleX(-1) for P2.
        transform,
        transformOrigin: "bottom center",
        transition: "transform 80ms ease-out",
      }}
    >
      {/* Inner div owns: breathing/death/shake/critGlow animations + opacity + filter */}
      <div
        style={{
          opacity: (!pose.startsWith("death") && dim) ? 0.35 : 1,
          filter: filterVal,
          transition: flash ? "filter 0ms" : "filter 200ms ease-out",
          ...innerAnimStyle,
        }}
      >
        <Image
          src={src}
          alt={`${color} gladaitor ${pose}`}
          width={Math.round(H * (848 / 1216))}
          height={H}
          style={{
            display: "block",
            imageRendering: "auto",
          }}
          priority
          unoptimized
        />
        {/* Impact glow ring on hit */}
        {showImpactGlow && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "radial-gradient(circle at center, rgba(255,100,100,0.35) 0%, transparent 70%)",
              pointerEvents: "none",
              animation: "gladImpactGlow 300ms ease-out forwards",
            }}
          />
        )}
        {critGlow && (
          <div
            style={{
              position: "absolute",
              top: "-22px",
              left: "50%",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontSize: "10px",
              fontWeight: 900,
              color: "#fbbf24",
              textShadow: "0 0 8px rgba(251,191,36,0.9)",
              letterSpacing: "0.05em",
              pointerEvents: "none",
              animation: "gladCritLabel 200ms ease-out forwards",
            }}
          >
            CRITICAL!
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Legacy SVG GladiatorAvatar — kept for any code that still calls it ──────
// (Currently unused in FightReplay but other components may reference it)
function GladiatorAvatar({
  type,
  variant = 0,
  dim,
  fallen,
  shake,
  flash,
  critGlow,
}: {
  type: "p1" | "p2";
  variant?: number;
  dim?: boolean;
  fallen?: boolean;
  shake?: boolean;
  flash?: boolean;
  critGlow?: boolean;
}) {
  const isP2 = type === "p2";

  const shakeStyle: React.CSSProperties = shake
    ? { animation: "gladShake 150ms ease-in-out" }
    : {};

  const critGlowStyle: React.CSSProperties = critGlow
    ? { animation: "gladCritGlow 200ms ease-out" }
    : {};

  const fallenStyle: React.CSSProperties = fallen
    ? { animation: `${isP2 ? "gladFallRight" : "gladFallLeft"} 700ms ease-out forwards` }
    : {};

  return (
    <div
      style={{
        display: "inline-block",
        position: "relative",
        filter: flash
          ? "brightness(3) saturate(0.2) sepia(1) hue-rotate(-10deg)"
          : undefined,
        transition: flash ? "filter 0ms" : "filter 200ms ease-out",
        opacity: (!fallen && dim) ? 0.35 : 1,
        ...shakeStyle,
        ...critGlowStyle,
        ...fallenStyle,
      }}
    >
      <svg
        width={80}
        height={96}
        viewBox="0 0 80 96"
        style={{
          display: "block",
          transform: isP2 ? "scaleX(-1)" : undefined,
        }}
      >
        <CharacterVariant variant={variant} />
      </svg>
      {critGlow && (
        <div
          style={{
            position: "absolute",
            top: "-22px",
            left: "50%",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            fontSize: "10px",
            fontWeight: 900,
            color: "#fbbf24",
            textShadow: "0 0 8px rgba(251,191,36,0.9)",
            letterSpacing: "0.05em",
            pointerEvents: "none",
            animation: "gladCritLabel 200ms ease-out forwards",
          }}
        >
          CRITICAL!
        </div>
      )}
    </div>
  );
}

// ─── HP Bar ────────────────────────────────────────────────────────────────

function hpColor(pct: number): string {
  if (pct > 60) return "#22c55e"; // green
  if (pct > 30) return "#eab308"; // yellow
  return "#ef4444";               // red
}

function HpBar({
  hp,
  maxHp = 100,
  label,
  align,
  flash,
}: {
  hp: number;
  maxHp?: number;
  label: string;
  align: "left" | "right";
  flash?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = hpColor(pct);

  return (
    <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"} w-full`}>
      <span className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">
        {label}
      </span>
      <div
        className="w-full h-4 rounded overflow-hidden border"
        style={{
          backgroundColor: flash ? "#ffffff" : "#1f2937",
          borderColor: flash ? "#ef4444" : "#374151",
          transition: flash ? "background-color 0ms, border-color 0ms" : "background-color 200ms ease-out, border-color 200ms ease-out",
        }}
      >
        <div
          className="h-full rounded"
          style={{
            width: `${pct}%`,
            backgroundColor: flash ? "#ef4444" : color,
            transition: flash
              ? "width 400ms ease, background-color 0ms"
              : "width 400ms ease, background-color 200ms ease-out",
            float: align === "right" ? "right" : "left",
          }}
        />
      </div>
      <span
        className="text-base font-bold tabular-nums mt-1"
        style={{ color: flash ? "#ef4444" : color, transition: "color 200ms ease-out" }}
      >
        {Math.max(0, hp)} HP
      </span>
    </div>
  );
}

// ─── Damage number — appears statically below the HP bar, then fades out ──
// No movement — appear on hit, hold for ~560ms (70% of 800ms), then fade to 0.
// Uses absolute positioning so it doesn't affect layout.
// Parent container must be position:relative.

function FloatingDamage({
  damage,
  isCrit,
  hitLabel,
  visible,
}: {
  damage: number;
  isCrit: boolean;
  hitLabel?: string; // "HIT 1" | "HIT 2" | undefined
  visible: boolean;
}) {
  return (
    <div
      className="pointer-events-none flex justify-center items-start"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // Anchor just below the HP bar — no movement, just appear then fade
        top: "100%",
        marginTop: "4px",
        // Static appear + fade: opacity 1 (hold 560ms) → 0
        animation: visible ? "gladDmgFloat 800ms ease-out forwards" : "none",
        opacity: visible ? undefined : 0,
        zIndex: 20,
      }}
    >
      <div className="flex flex-col items-center">
        {hitLabel && (
          <span className="text-xs font-bold text-gray-400 tracking-widest">{hitLabel}</span>
        )}
        <span
          className={`font-black tabular-nums drop-shadow-lg ${
            isCrit ? "text-amber-400 text-2xl" : "text-white text-lg"
          }`}
        >
          -{damage}
          {isCrit && (
            <span className="ml-1 text-base">CRIT!</span>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Flying projectile — travels from attacker avatar to defender avatar ────
// Rendered inside a position:relative container that spans the full avatar row.
// attacker="p1" → travels left→right; attacker="p2" → travels right→left.
// Normal hit: sword ⚔️, 400ms. Crit: lightning ⚡, bigger, 250ms with trail.
// The `id` prop forces a re-mount on each new hit so the animation re-triggers.

function FlyingProjectile({
  attacker,
  isCrit,
}: {
  attacker: "p1" | "p2";
  isCrit: boolean;
}) {
  const goingRight = attacker === "p1";
  // Crit is slow and cinematic — 800ms. Normal hit is snappy — 400ms.
  const duration = isCrit ? 800 : 400;
  // Always use the sword for both hit types (crit gets visual treatment via trail/sparkle)
  const emoji = "⚔️";
  const size = isCrit ? "1.4rem" : "1.1rem";

  const animName = goingRight ? "gladProjRight" : "gladProjLeft";

  // Travel distance: attacker avatar center → defender avatar center.
  // Container max-w-sm (≤384px), px-4 padding, avatars 64px wide → ~270px.
  const travelPx = 270;

  if (!isCrit) {
    // Normal hit: plain sword, fast, no trail
    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: goingRight ? "48px" : undefined,
          right: goingRight ? undefined : "48px",
          fontSize: size,
          lineHeight: 1,
          pointerEvents: "none",
          zIndex: 25,
          animation: `${animName} ${duration}ms ease-in forwards`,
          ["--proj-travel" as string]: `${travelPx}px`,
        }}
      >
        {emoji}
      </div>
    );
  }

  // ── CRIT projectile: slow-motion, trail + starburst ──────────────────────
  // Wrapper moves the whole assembly (sword + trail + sparkle) together.
  // Trail: long thin rectangle behind the sword, white→transparent gradient.
  // Sparkle: 4-pointed starburst at the sword tip (two thin bars rotated 45deg).
  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        // Offset so the sword tip is at the leading edge
        left: goingRight ? "48px" : undefined,
        right: goingRight ? undefined : "48px",
        pointerEvents: "none",
        zIndex: 25,
        // gladProjRight/Left keyframes animate translateY(-50%) + translateX(travel)
        animation: `${animName} ${duration}ms cubic-bezier(0.2, 0, 0.4, 1) forwards`,
        ["--proj-travel" as string]: `${travelPx}px`,
        display: "flex",
        alignItems: "center",
      }}
    >
      {/* Light beam trail — long rectangle behind the sword, fades to transparent */}
      {/* Positioned to extend backward from the sword (opposite direction of travel) */}
      <div
        style={{
          position: "absolute",
          // Trail extends behind the sword: goingRight → extends left; goingLeft → extends right
          right: goingRight ? "100%" : undefined,
          left: goingRight ? undefined : "100%",
          top: "50%",
          transform: "translateY(-50%)",
          width: "80px",
          height: "6px",
          borderRadius: "3px",
          // Gradient from white (near sword) to transparent (trailing edge)
          background: goingRight
            ? "linear-gradient(to left, rgba(255,255,255,0.9), rgba(255,255,220,0.5), transparent)"
            : "linear-gradient(to right, rgba(255,255,255,0.9), rgba(255,255,220,0.5), transparent)",
          // Soft glow on the trail
          boxShadow: "0 0 8px 2px rgba(255, 255, 200, 0.6)",
          pointerEvents: "none",
        }}
      />

      {/* The sword emoji — center of the assembly */}
      <div
        style={{
          fontSize: size,
          lineHeight: 1,
          position: "relative",
          zIndex: 2,
          filter: "drop-shadow(0 0 8px rgba(255,255,200,0.95)) drop-shadow(0 0 3px rgba(255,255,255,1))",
        }}
      >
        {emoji}
      </div>

      {/* Starburst sparkle at the leading tip — 4-pointed star, slowly spins during flight */}
      {/* Positioned just ahead of the sword in the direction of travel */}
      <div
        style={{
          position: "absolute",
          left: goingRight ? "calc(100% + 2px)" : undefined,
          right: goingRight ? undefined : "calc(100% + 2px)",
          // Vertical center via margin offset (avoids transform conflict with spin animation)
          top: "50%",
          marginTop: "-9px",
          width: "18px",
          height: "18px",
          pointerEvents: "none",
          zIndex: 3,
          // Spinning wrapper — all bars spin as a unit
          animation: "gladStarburstSpin 800ms linear forwards",
        }}
      >
        {/* Bar 1 — 0deg (horizontal) */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "16px",
          height: "3px",
          background: "white",
          borderRadius: "2px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          boxShadow: "0 0 5px 2px rgba(255,255,200,0.9)",
        }} />
        {/* Bar 2 — 45deg */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "16px",
          height: "3px",
          background: "white",
          borderRadius: "2px",
          transform: "translate(-50%, -50%) rotate(45deg)",
          boxShadow: "0 0 5px 2px rgba(255,255,200,0.9)",
        }} />
        {/* Bar 3 — 90deg (vertical) */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "16px",
          height: "3px",
          background: "white",
          borderRadius: "2px",
          transform: "translate(-50%, -50%) rotate(90deg)",
          boxShadow: "0 0 5px 2px rgba(255,255,200,0.9)",
        }} />
        {/* Bar 4 — 135deg */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "16px",
          height: "3px",
          background: "rgba(255,255,220,0.85)",
          borderRadius: "2px",
          transform: "translate(-50%, -50%) rotate(135deg)",
          boxShadow: "0 0 5px 2px rgba(255,255,200,0.7)",
        }} />
      </div>
    </div>
  );
}

// ─── Combo flash label ────────────────────────────────────────────────────────
// Shown briefly above the attacker's side on the first hit of a combo burst.
// multiplier: 2, 3, or 4. Fades in/out over ~400ms total.
// key prop must change on each new combo to re-trigger the animation.

function ComboLabel({
  multiplier,
  side,
}: {
  multiplier: 2 | 3 | 4;
  side: "left" | "right";
}) {
  return (
    <div
      style={{
        position: "absolute",
        // Float above the attacker's sprite area. left side = p1, right side = p2.
        [side === "left" ? "left" : "right"]: "8px",
        top: "0px",
        zIndex: 30,
        pointerEvents: "none",
        // Amber gold to match the parchment palette
        color: "#d4a853",
        fontSize: "1.1rem",
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        textShadow: "0 0 10px rgba(212,168,83,0.85), 0 0 3px rgba(0,0,0,0.9)",
        whiteSpace: "nowrap",
        animation: "gladComboFlash 400ms ease-out forwards",
      }}
    >
      {multiplier}×
    </div>
  );
}

// ─── Attack announcement banner ───────────────────────────────────────────────

function AttackAnnounce({
  text,
  color,
  visible,
}: {
  text: string;
  color: "gold" | "red";
  visible: boolean;
}) {
  return (
    <div
      className="text-center font-black uppercase tracking-widest text-sm h-6 flex items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transition: visible ? "opacity 100ms ease-in" : "opacity 300ms ease-out",
        color: color === "gold" ? "#fbbf24" : "#f87171",
        textShadow:
          color === "gold"
            ? "0 0 12px rgba(251,191,36,0.7)"
            : "0 0 12px rgba(248,113,113,0.7)",
        letterSpacing: "0.1em",
      }}
    >
      {text}
    </div>
  );
}

// ─── Main FightReplay component ─────────────────────────────────────────────

interface FightReplayProps {
  result: FightResult;
  p1Label?: string;
  p2Label?: string;
  /** Called when user explicitly clicks "View Full Stats" in the overlay */
  onDone?: () => void;
  /** Called when user clicks "Fight Again" in the overlay */
  onPlayAgain?: () => void;
  /** Called when user clicks "Home" in the overlay */
  onHome?: () => void;
  /** Which player is the viewer — drives YOU WIN vs YOU LOSE text */
  viewerRole?: "p1" | "p2" | "spectator";
}

type ReplayPhase =
  | { type: "idle" }
  | { type: "hit"; entry: RoundLog; hp1: number; hp2: number }
  | { type: "done" };

// Quick overlay taunts — punchy, not the full 100-pool (that lives in FightSummary)
const OVERLAY_TAUNTS = [
  "The pit demands a rematch.",
  "Reconsider your build.",
  "Come back stronger.",
  "Even legends lose their first fight.",
  "The crowd is already forgetting.",
  "That won't be the last of you.",
  "The arena has a long memory.",
  "Round 2?",
];

export default function FightReplay({
  result,
  p1Label = "YOU",
  p2Label = "AITOR",
  onDone,
  onPlayAgain,
  onHome,
  viewerRole = "p1",
}: FightReplayProps) {
  // Audio — null-safe; works even if AudioProvider is not mounted
  const audio = useFightAudio();

  const [phase, setPhase] = useState<ReplayPhase>({ type: "idle" });
  const [displayHp1, setDisplayHp1] = useState(100);
  const [displayHp2, setDisplayHp2] = useState(100);
  const [skipped, setSkipped] = useState(false);
  const [finished, setFinished] = useState(false);

  // HP bar flash state (white→red)
  const [flashP1, setFlashP1] = useState(false);
  const [flashP2, setFlashP2] = useState(false);

  // Avatar shake state
  const [shakeP1, setShakeP1] = useState(false);
  const [shakeP2, setShakeP2] = useState(false);

  // Crit glow on attacker
  const [critGlowP1, setCritGlowP1] = useState(false);
  const [critGlowP2, setCritGlowP2] = useState(false);

  // Floating damage numbers — per side (defender's side)
  const [floatP1, setFloatP1] = useState<{ damage: number; isCrit: boolean; hitLabel?: string } | null>(null);
  const [floatVisP1, setFloatVisP1] = useState(false);
  const [floatP2, setFloatP2] = useState<{ damage: number; isCrit: boolean; hitLabel?: string } | null>(null);
  const [floatVisP2, setFloatVisP2] = useState(false);

  // Flying projectile — key changes on each new hit to force re-mount/re-animation
  const [projectile, setProjectile] = useState<{ id: number; attacker: "p1" | "p2"; isCrit: boolean } | null>(null);
  const projectileIdRef = useRef(0);

  // Combo flash label — shown on comboStep===1, key changes per combo to re-trigger animation
  const [comboLabel, setComboLabel] = useState<{ id: number; multiplier: 2 | 3 | 4; side: "left" | "right" } | null>(null);
  const comboLabelIdRef = useRef(0);

  // Attack announcement banner
  const [announceText, setAnnounceText] = useState("");
  const [announceColor, setAnnounceColor] = useState<"gold" | "red">("gold");
  const [announceVisible, setAnnounceVisible] = useState(false);

  // ── Sprite pose state ─────────────────────────────────────────────────────
  // Tracks which image frame each character should show.
  const [poseP1, setPoseP1] = useState<Pose>("idle");
  const [poseP2, setPoseP2] = useState<Pose>("idle");
  // Attack lunge offset (px toward opponent). Positive = toward opponent.
  const [lungeP1, setLungeP1] = useState(0);
  const [lungeP2, setLungeP2] = useState(0);
  // Knockback offset (px away from opponent). Positive = away.
  const [knockP1, setKnockP1] = useState(0);
  const [knockP2, setKnockP2] = useState(0);

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Inject animation keyframes into document.head exactly once.
  // Previously these lived inside the JSX <style> block and were re-injected on
  // every re-render during the fight animation loop, causing layout jank.
  useEffect(() => {
    const STYLE_ID = "gladaitor-keyframes";
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes gladShake {
        0%   { transform: translateX(0); }
        20%  { transform: translateX(-6px); }
        40%  { transform: translateX(6px); }
        60%  { transform: translateX(-5px); }
        80%  { transform: translateX(5px); }
        100% { transform: translateX(0); }
      }
      @keyframes gladDmgFloat {
        0%   { opacity: 1; }
        70%  { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes gladCritGlow {
        0%   { box-shadow: 0 0 0px 0px rgba(255,255,255,0); filter: brightness(1); }
        30%  { box-shadow: 0 0 8px 4px rgba(255,255,255,0.6), 0 0 20px 8px rgba(200,220,255,0.3); filter: brightness(1.4); }
        70%  { box-shadow: 0 0 20px 10px rgba(255,255,255,0.9), 0 0 40px 16px rgba(180,210,255,0.5); filter: brightness(2) saturate(0.5); }
        100% { box-shadow: 0 0 32px 16px rgba(255,255,255,0), 0 0 60px 24px rgba(180,210,255,0); filter: brightness(1); }
      }
      @keyframes gladCritLabel {
        0%   { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.8); }
        30%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1.1); }
        100% { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
      }
      @keyframes gladProjRight {
        0%   { transform: translateY(-50%) translateX(0px); opacity: 1; }
        90%  { opacity: 1; }
        100% { transform: translateY(-50%) translateX(calc(var(--proj-travel, 260px))); opacity: 0; }
      }
      @keyframes gladProjLeft {
        0%   { transform: translateY(-50%) translateX(0px); opacity: 1; }
        90%  { opacity: 1; }
        100% { transform: translateY(-50%) translateX(calc(-1 * var(--proj-travel, 260px))); opacity: 0; }
      }
      @keyframes gladStarburstSpin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes gladFallLeft {
        0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
        15%  { transform: translate(-10px,-8px) rotate(-10deg); opacity: 0.9; }
        55%  { transform: translate(-22px,10px) rotate(-22deg); opacity: 0.55; }
        100% { transform: translate(-30px,20px) rotate(-30deg); opacity: 0.2; }
      }
      @keyframes gladFallRight {
        0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
        15%  { transform: translate(10px,-8px) rotate(10deg); opacity: 0.9; }
        55%  { transform: translate(22px,10px) rotate(22deg); opacity: 0.55; }
        100% { transform: translate(30px,20px) rotate(30deg); opacity: 0.2; }
      }
      @keyframes gladOverlayIn {
        0%   { opacity: 0; transform: scale(0.96); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes gladBreath {
        0%, 100% { transform: scaleY(1) rotate(0deg); }
        25%       { transform: scaleY(1.02) rotate(0.3deg); }
        75%       { transform: scaleY(0.99) rotate(-0.3deg); }
      }
      @keyframes gladDeath {
        0%   { opacity: 1; transform: translateY(0px); filter: brightness(1); }
        30%  { opacity: 0.85; transform: translateY(8px); filter: brightness(0.8); }
        100% { opacity: 0.6; transform: translateY(20px); filter: brightness(0.3); }
      }
      @keyframes gladImpactGlow {
        0%   { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes gladComboFlash {
        0%   { opacity: 0; transform: translateY(8px) scale(0.8); }
        25%  { opacity: 1; transform: translateY(0px) scale(1.15); }
        65%  { opacity: 1; transform: translateY(0px) scale(1); }
        100% { opacity: 0; transform: translateY(-4px) scale(0.95); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  function clearAll() {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }

  function schedule(fn: () => void, delay: number) {
    const id = setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  }

  // ── Pose animation helpers ────────────────────────────────────────────────
  // Called when attacker fires their attack.
  // Attacker: idle → attack (lunge 25px) → idle (after 400ms or crit flight)
  // Defender: idle → hit (knockback 10px) → idle (after 400ms hold)
  // Death: stays in death pose permanently.
  function triggerPoseAttack(attacker: "p1" | "p2", flightMs: number, hp1Next: number, hp2Next: number) {
    const setAttackPose = attacker === "p1" ? setPoseP1 : setPoseP2;
    const setAttackLunge = attacker === "p1" ? setLungeP1 : setLungeP2;
    const setDefendPose = attacker === "p1" ? setPoseP2 : setPoseP1;
    const setDefendKnock = attacker === "p1" ? setKnockP2 : setKnockP1;

    const defenderDiesFromHit = attacker === "p1" ? hp2Next <= 0 : hp1Next <= 0;
    const attackerDiesFromHit = attacker === "p1" ? hp1Next <= 0 : hp2Next <= 0;

    // Attacker lunges forward
    setAttackPose("attack");
    setAttackLunge(25);

    const defenderDelay = flightMs; // when projectile lands

    // Defender hit pose when projectile arrives
    schedule(() => {
      if (defenderDiesFromHit) {
        setDefendPose("death");
      } else {
        setDefendPose("hit");
        setDefendKnock(10);
        // Hold hit pose for 400ms, then return to idle
        schedule(() => {
          setDefendPose("idle");
          setDefendKnock(0);
        }, 400);
      }
    }, defenderDelay);

    // Attacker returns to idle after lunge (slightly after projectile launches)
    const attackerReturnDelay = Math.min(flightMs * 0.6, 300);
    schedule(() => {
      // Only return to idle if attacker isn't also dying (simultaneous death edge case)
      if (!attackerDiesFromHit) {
        setAttackPose("idle");
      } else {
        setAttackPose("death");
      }
      setAttackLunge(0);
    }, attackerReturnDelay);
  }

  // Show floating damage above the DEFENDER's HP bar.
  // Crit glow fires on the ATTACKER avatar before damage lands on defender.
  // attacker === "p1" means p1 glows, p2 shakes/flashes
  // attacker === "p2" means p2 glows, p1 shakes/flashes
  function triggerHit(
    attacker: "p1" | "p2",
    damage: number,
    isCrit: boolean,
    hitLabel: string | undefined,
    hp1Next: number,
    hp2Next: number
  ) {
    // Crit sequence: 200ms charge-up → 800ms slow projectile → impact on defender
    // Normal: 400ms projectile → impact on defender
    const flightMs = isCrit ? 800 : 400;

    if (isCrit) {
      // Step 1: charge-up glow on attacker (fires immediately, lasts 200ms)
      // Crit SFX fires here — the charge-up moment, matching the visual glow
      audio?.playSfx("crit");

      if (attacker === "p1") {
        setCritGlowP1(true);
        schedule(() => setCritGlowP1(false), 200);
      } else {
        setCritGlowP2(true);
        schedule(() => setCritGlowP2(false), 200);
      }
      // Step 2: fire projectile after the 200ms charge-up
      schedule(() => {
        const projId = ++projectileIdRef.current;
        setProjectile({ id: projId, attacker, isCrit });
        // Pose: attacker goes to attack frame at same time as projectile launch
        triggerPoseAttack(attacker, flightMs, hp1Next, hp2Next);
        // Clear projectile after it lands
        schedule(() => setProjectile(null), flightMs + 100);
      }, 200);
    } else {
      // Normal hit: projectile fires immediately
      const projId = ++projectileIdRef.current;
      setProjectile({ id: projId, attacker, isCrit });
      // Pose: attacker goes to attack frame immediately
      triggerPoseAttack(attacker, flightMs, hp1Next, hp2Next);
      schedule(() => setProjectile(null), flightMs + 100);
    }

    // Defender impact lands after charge-up + flight (crit) or just flight (normal)
    const defenderDelay = isCrit ? 200 + flightMs : flightMs;

    if (attacker === "p1") {
      // Defender effects (p2) land when projectile arrives
      schedule(() => {
        // Hit sound fires on defender impact
        audio?.playSfx("hit");

        setFlashP2(true);
        setShakeP2(true);
        setFloatP2({ damage, isCrit, hitLabel });
        setFloatVisP2(true);
        setDisplayHp2(hp2Next);

        // Death sound fires if p2 falls from this hit
        if (hp2Next <= 0) {
          schedule(() => audio?.playSfx("death"), 150);
        }

        // Crit impact lingers longer — 300ms shake vs 150ms normal
        const impactDuration = isCrit ? 300 : 150;
        schedule(() => {
          setFlashP2(false);
          setShakeP2(false);
        }, impactDuration);
        schedule(() => setFloatVisP2(false), 800);
      }, defenderDelay);
    } else {
      // Defender effects (p1) land when projectile arrives
      schedule(() => {
        // Hit sound fires on defender impact
        audio?.playSfx("hit");

        setFlashP1(true);
        setShakeP1(true);
        setFloatP1({ damage, isCrit, hitLabel });
        setFloatVisP1(true);
        setDisplayHp1(hp1Next);

        // Death sound fires if p1 falls from this hit
        if (hp1Next <= 0) {
          schedule(() => audio?.playSfx("death"), 150);
        }

        const impactDuration = isCrit ? 300 : 150;
        schedule(() => {
          setFlashP1(false);
          setShakeP1(false);
        }, impactDuration);
        schedule(() => setFloatVisP1(false), 800);
      }, defenderDelay);
    }
  }

  function showAnnounce(text: string, color: "gold" | "red") {
    setAnnounceText(text);
    setAnnounceColor(color);
    setAnnounceVisible(true);
    // Fade out after 350ms so it's gone before 400ms damage lands
    schedule(() => setAnnounceVisible(false), 350);
  }

  // Unlock audio and start background music on mount.
  // FightReplay only mounts after the user has clicked "ENTER THE PIT",
  // so this is always triggered from a user gesture context — satisfies
  // browser autoplay policy.
  useEffect(() => {
    audio?.unlockAndPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (skipped || result.log.length === 0) return;

    // Timing constants
    // Normal: 400ms announce → 400ms hit → next
    // Crit:   400ms announce → 1300ms hit (200ms charge + 800ms flight + 300ms impact) → next
    // Combo:  70ms between consecutive hits — rapid back-to-back strikes, no announce banner per hit
    const ANNOUNCE_DURATION = 400;
    const HIT_DURATION_NORMAL = 400;
    const HIT_DURATION_CRIT = 1300; // charge(200) + flight(800) + impact(300)
    const COMBO_HIT_GAP = 20;      // delay between hits in a combo burst
    let t = 0;

    // ATB model: each log entry is one attack event (not grouped into rounds).
    // Process entries directly — no round grouping, no inter-round pauses.
    result.log.forEach((entry, hi) => {
      const isComboHit = entry.isCombo;

      if (isComboHit && entry.comboStep > 1) {
        // ── Continuation combo hit ────────────────────────────────────────
        // No announce banner. Ultra-fast gap from previous hit.

        schedule(() => {
          setPhase({ type: "hit", entry, hp1: entry.hp1After, hp2: entry.hp2After });
          triggerHit(
            entry.attacker,
            entry.damage,
            entry.isCrit,
            undefined,
            entry.hp1After,
            entry.hp2After
          );

          // Combo label fires on the hit that EXTENDS the combo (comboStep >= 2).
          const step = entry.comboStep as number;
          const labelId = ++comboLabelIdRef.current;
          const side: "left" | "right" = entry.attacker === "p1" ? "left" : "right";
          setComboLabel({ id: labelId, multiplier: Math.min(step, 4) as 2 | 3 | 4, side });
          schedule(() => setComboLabel(null), 440);
        }, t);

        const hitDuration = entry.isCrit ? HIT_DURATION_CRIT : HIT_DURATION_NORMAL;
        const nextEntry = hi + 1 < result.log.length ? result.log[hi + 1] : null;
        const nextIsCombo = nextEntry?.isCombo && nextEntry.attacker === entry.attacker;
        t += nextIsCombo ? COMBO_HIT_GAP : hitDuration;

      } else {
        // ── Normal hit OR first hit of a combo burst ──────────────────────

        // Attack announcement banner
        schedule(() => {
          const isP1Attacker = entry.attacker === "p1";
          const text = isP1Attacker ? `⚔️ YOU ATTACK` : `🛡️ ${p2Label} ATTACKS`;
          const color: "gold" | "red" = isP1Attacker ? "gold" : "red";
          showAnnounce(text, color);
          setPhase({ type: "hit", entry, hp1: entry.hp1After, hp2: entry.hp2After });
        }, t);

        // Damage lands after announce
        schedule(() => {
          triggerHit(
            entry.attacker,
            entry.damage,
            entry.isCrit,
            undefined,
            entry.hp1After,
            entry.hp2After
          );
        }, t + ANNOUNCE_DURATION);

        const hitDuration = entry.isCrit ? HIT_DURATION_CRIT : HIT_DURATION_NORMAL;
        const nextEntry = hi + 1 < result.log.length ? result.log[hi + 1] : null;
        const nextIsCombo = nextEntry?.isCombo && nextEntry.attacker === entry.attacker;
        if (nextIsCombo) {
          t += ANNOUNCE_DURATION + COMBO_HIT_GAP;
        } else {
          t += ANNOUNCE_DURATION + hitDuration;
        }
      }
    });

    // Done — overlay appears, user clicks through manually
    schedule(() => {
      setFinished(true);
      setPhase({ type: "done" });
      if (result.winner === "p1") {
        audio?.playSfx("victory");
      }
    }, t + 800);

    return clearAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSkip() {
    clearAll();
    setSkipped(true);
    setDisplayHp1(result.hp1Final);
    setDisplayHp2(result.hp2Final);
    setFinished(true);
    setPhase({ type: "done" });
    setAnnounceVisible(false);
    setFlashP1(false);
    setFlashP2(false);
    setCritGlowP1(false);
    setCritGlowP2(false);
    // Set death pose on loser
    if (result.winner === "p1") {
      setPoseP2("death");
    } else {
      setPoseP1("death");
    }
    setLungeP1(0); setLungeP2(0);
    setKnockP1(0); setKnockP2(0);
  }

  const isDraw = result.winner === "draw";
  const p1Won = result.winner === "p1";
  // In a draw, both fighters fall. In a normal fight, only the loser's sprite dims.
  const p1Fell = !p1Won && finished;
  const p2Fell = (p1Won || isDraw) && finished;

  const currentEntry = phase.type === "hit" ? phase.entry : null;

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* Skip button */}
      {!finished && (
        <button
          className="absolute top-2 right-2 z-30 text-xs text-gray-500 hover:text-gray-300 transition-colors border border-gray-700 rounded px-2 py-1"
          onClick={handleSkip}
        >
          SKIP →
        </button>
      )}

      {/* Attack announcement banner */}
      <div className="mb-2" style={{ minHeight: "1.75rem" }}>
        <AttackAnnounce
          text={announceText}
          color={announceColor}
          visible={announceVisible}
        />
      </div>

      {/* HP bars — damage numbers appear below each bar */}
      <div className="flex gap-3 mb-4">
        {/* P1 HP bar with damage number floating above (absolute, no layout shift) */}
        <div className="flex-1" style={{ position: "relative" }}>
          <HpBar hp={displayHp1} label={p1Label} align="left" flash={flashP1} />
          <FloatingDamage
            damage={floatP1?.damage ?? 0}
            isCrit={floatP1?.isCrit ?? false}
            hitLabel={floatP1?.hitLabel}
            visible={floatVisP1}
          />
        </div>
        {/* P2 HP bar with damage number floating above (absolute, no layout shift) */}
        <div className="flex-1" style={{ position: "relative" }}>
          <HpBar hp={displayHp2} label={p2Label} align="right" flash={flashP2} />
          <FloatingDamage
            damage={floatP2?.damage ?? 0}
            isCrit={floatP2?.isCrit ?? false}
            hitLabel={floatP2?.hitLabel}
            visible={floatVisP2}
          />
        </div>
      </div>

      {/* Sprite characters — positioned on arena floor */}
      {/* position:relative so the flying projectile can be absolutely positioned within */}
      <div
        className="flex justify-between items-end px-2 mb-4"
        style={{ position: "relative", height: "130px" }}
      >
        <SpriteAvatar
          type="p1"
          color="red"
          pose={poseP1}
          dim={p1Fell}
          shake={shakeP1}
          flash={flashP1}
          critGlow={critGlowP1}
          attackLunge={lungeP1}
          hitKnockback={knockP1}
        />
        {/* Flying projectile — re-mounts on each new hit via key prop */}
        {projectile && (
          <FlyingProjectile
            key={projectile.id}
            attacker={projectile.attacker}
            isCrit={projectile.isCrit}
          />
        )}
        {/* Combo flash label — re-mounts on each new combo burst via key prop */}
        {comboLabel && (
          <ComboLabel
            key={comboLabel.id}
            multiplier={comboLabel.multiplier}
            side={comboLabel.side}
          />
        )}
        <SpriteAvatar
          type="p2"
          color="blue"
          pose={poseP2}
          dim={p2Fell}
          shake={shakeP2}
          flash={flashP2}
          critGlow={critGlowP2}
          attackLunge={lungeP2}
          hitKnockback={knockP2}
        />
      </div>


      {/* ── Outcome overlay — fades in over the fight pit when animation finishes ── */}
      {finished && (() => {
        const viewerWon =
          !isDraw && (
            (viewerRole === "p1" && p1Won) ||
            (viewerRole === "p2" && !p1Won)
          );
        const viewerLost = !isDraw && viewerRole !== "spectator" && !viewerWon;
        const outcomeText = isDraw
          ? "DRAW"
          : viewerRole === "spectator"
            ? p1Won ? `${p1Label} WINS` : `${p2Label} WINS`
            : viewerWon ? "VICTORY" : "YOU LOSE";
        const overlayTaunt = viewerLost
          ? OVERLAY_TAUNTS[Math.floor(Math.random() * OVERLAY_TAUNTS.length)]
          : null;

        return (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(10, 7, 4, 0.82)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              borderRadius: "8px",
              animation: "gladOverlayIn 600ms ease forwards",
              textAlign: "center",
              padding: "1.5rem",
            }}
          >
            <div
              style={{
                fontSize: "2.5rem",
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: viewerWon ? "#fbbf24" : viewerLost ? "#a78bfa" : "#f5f5f5",
                textShadow: viewerWon
                  ? "0 0 40px rgba(251,191,36,0.8), 0 0 80px rgba(251,191,36,0.3)"
                  : viewerLost
                  ? "0 0 40px rgba(167,139,250,0.8), 0 0 80px rgba(167,139,250,0.3)"
                  : "0 0 30px rgba(255,255,255,0.4)",
                marginBottom: "0.5rem",
              }}
            >
              {outcomeText}
            </div>
            {overlayTaunt && (
              <div style={{ fontSize: "0.85rem", color: "#9ca3af", fontStyle: "italic", maxWidth: "240px", lineHeight: 1.5, marginBottom: "1.75rem" }}>
                {overlayTaunt}
              </div>
            )}
            {viewerWon && (
              <div style={{ fontSize: "0.85rem", color: "#fbbf24", opacity: 0.75, maxWidth: "240px", marginBottom: "1.75rem" }}>
                The crowd roars. The pit has a new champion.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: "220px" }}>
              {onPlayAgain && (
                <button
                  onClick={onPlayAgain}
                  style={{ background: "linear-gradient(135deg, #8b1a1a, #6b1111)", color: "#fef3c7", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.65rem 1.5rem", border: "1px solid #b8860b", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}
                >
                  Fight Again
                </button>
              )}
              {onDone && (
                <button
                  onClick={onDone}
                  style={{ background: "rgba(255,255,255,0.06)", color: "#d1d5db", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", padding: "0.55rem 1.5rem", cursor: "pointer", fontSize: "0.78rem", letterSpacing: "0.05em" }}
                >
                  View Full Stats →
                </button>
              )}
              {onHome && (
                <button
                  onClick={onHome}
                  style={{ background: "transparent", color: "#6b7280", border: "none", padding: "0.35rem", cursor: "pointer", fontSize: "0.75rem" }}
                >
                  Home
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
