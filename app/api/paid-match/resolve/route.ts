import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { activeChain, chainRpcUrl, activePitArenaAddress } from "@/lib/chain";
import { getPaidMatchStats, setPaidMatchStats } from "@/lib/kv";
import { simulateFight } from "@/lib/fight-engine";
import type { GladiatorStats } from "@/lib/fight-engine";

// POST /api/paid-match/resolve
// Server-side fight resolution for paid matches.
// Triggered by the joiner's client after joinMatch confirms and stats are saved.
// Flow:
//   1. Load both players' stats from KV
//   2. Run the fight engine (same logic as free fights — client-side sim is cosmetic only)
//   3. Call resolveByHouse(matchId, winner) on-chain via house wallet
//   4. Update KV with winner
//
// Idempotent: safe to call multiple times — if already resolved, returns cached result.

const HOUSE_PRIVATE_KEY = process.env.HOUSE_PRIVATE_KEY as `0x${string}`;

const RESOLVE_ABI = parseAbi([
  "function resolveByHouse(uint256 matchId, address winner) external",
  "function resolveDrawByHouse(uint256 matchId) external",
  "function getMatch(uint256 matchId) external view returns (address player1, address player2, uint256 betAmount, uint8 state, address winner, bool gladiator1Submitted, bool gladiator2Submitted)",
]);

// MatchState enum values mirror the contract
const MATCH_STATE_WAITING_FOR_GLADIATORS = 1;
const MATCH_STATE_FIGHTING = 2;
const MATCH_STATE_RESOLVED = 3;

const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(chainRpcUrl),
});

export async function POST(req: NextRequest) {
  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    if (!HOUSE_PRIVATE_KEY) {
      return NextResponse.json({ error: "House key not configured" }, { status: 500 });
    }

    // Load KV stats
    const kvData = await getPaidMatchStats(String(matchId));
    if (!kvData) {
      return NextResponse.json({ error: "No stats found for this match" }, { status: 404 });
    }

    // If already resolved, return cached winner
    if (kvData.winner) {
      return NextResponse.json({ ok: true, winner: kvData.winner, cached: true });
    }

    if (!kvData.stats1 || !kvData.stats2) {
      return NextResponse.json({
        error: "Both players must submit stats before resolving",
        hasStats1: !!kvData.stats1,
        hasStats2: !!kvData.stats2,
      }, { status: 400 });
    }

    if (!kvData.player1 || !kvData.player2) {
      return NextResponse.json({ error: "Missing player addresses in KV" }, { status: 400 });
    }

    // Check on-chain state — must be WaitingForGladiators or Fighting, not already Resolved
    const onChainMatch = await publicClient.readContract({
      address: activePitArenaAddress,
      abi: RESOLVE_ABI,
      functionName: "getMatch",
      args: [BigInt(matchId)],
    });

    const onChainState = onChainMatch[3]; // uint8 state
    const onChainWinner = onChainMatch[4]; // address winner

    if (onChainState === MATCH_STATE_RESOLVED) {
      // Already resolved on-chain (e.g. by a concurrent request). Update KV and return.
      const winnerAddr = onChainWinner.toLowerCase();
      await setPaidMatchStats({ ...kvData, winner: winnerAddr, resolvedAt: Date.now() });
      return NextResponse.json({ ok: true, winner: winnerAddr, cached: true });
    }

    if (
      onChainState !== MATCH_STATE_WAITING_FOR_GLADIATORS &&
      onChainState !== MATCH_STATE_FIGHTING
    ) {
      return NextResponse.json({
        error: `Match not in resolvable state (state=${onChainState})`,
      }, { status: 400 });
    }

    // Run server-side fight engine
    const s1: GladiatorStats = kvData.stats1;
    const s2: GladiatorStats = kvData.stats2;
    const result = simulateFight(s1, s2);

    const isDraw = result.winner === "draw";
    const winnerAddr = isDraw
      ? "draw"
      : result.winner === "p1"
        ? kvData.player1.toLowerCase()
        : kvData.player2.toLowerCase();

    // Call resolveByHouse or resolveDrawByHouse on-chain
    const account = privateKeyToAccount(HOUSE_PRIVATE_KEY);
    const walletClient = createWalletClient({
      account,
      chain: activeChain,
      transport: http(chainRpcUrl),
    });

    let txHash: `0x${string}`;
    if (isDraw) {
      txHash = await walletClient.writeContract({
        address: activePitArenaAddress,
        abi: RESOLVE_ABI,
        functionName: "resolveDrawByHouse",
        args: [BigInt(matchId)],
      });
    } else {
      txHash = await walletClient.writeContract({
        address: activePitArenaAddress,
        abi: RESOLVE_ABI,
        functionName: "resolveByHouse",
        args: [BigInt(matchId), winnerAddr as `0x${string}`],
      });
    }

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 60_000,
    });

    if (receipt.status !== "success") {
      return NextResponse.json({ error: "resolve tx reverted" }, { status: 500 });
    }

    // Persist winner to KV ("draw" stored as the winner string)
    await setPaidMatchStats({
      ...kvData,
      winner: winnerAddr,
      resolvedAt: Date.now(),
    });

    return NextResponse.json({ ok: true, winner: winnerAddr, isDraw, txHash });
  } catch (err) {
    console.error("[/api/paid-match/resolve]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
