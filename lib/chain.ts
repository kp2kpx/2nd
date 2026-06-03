// Centralized chain config — flip NEXT_PUBLIC_CHAIN=mainnet to switch networks.
// Default is sepolia (safe for dev/staging). Set to "mainnet" in Vercel env vars
// when going live on Base Mainnet.
//
// When switching to mainnet:
//   1. Add NEXT_PUBLIC_CHAIN=mainnet to Vercel environment variables
//   2. Deploy the mainnet PitArena contract (contracts/src/PitArena.sol — already has mainnet addresses)
//   3. Set NEXT_PUBLIC_PIT_ARENA_ADDRESS=<mainnet address> in Vercel env vars
//   4. Redeploy Vercel

import { baseSepolia, base } from "viem/chains";
import type { Chain } from "viem";

const isMainnet = process.env.NEXT_PUBLIC_CHAIN === "mainnet";

export const activeChain: Chain = isMainnet ? base : baseSepolia;

export const chainRpcUrl: string = isMainnet
  ? "https://mainnet.base.org"
  : "https://sepolia.base.org";

// Contract addresses per network
export const PIT_ARENA_ADDRESS_BY_CHAIN = {
  sepolia: "0x84D781AfAA2a088B2798ACcd9424B8870032B58D" as const, // deployed 2026-06-03 — adds resolveDrawByHouse()
  mainnet: (process.env.NEXT_PUBLIC_PIT_ARENA_ADDRESS ?? "") as `0x${string}`,
} as const;

export const USDC_ADDRESS_BY_CHAIN = {
  sepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const,
  mainnet: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const,
} as const;

export const activePitArenaAddress: `0x${string}` = isMainnet
  ? PIT_ARENA_ADDRESS_BY_CHAIN.mainnet
  : PIT_ARENA_ADDRESS_BY_CHAIN.sepolia;

export const activeUsdcAddress: `0x${string}` = isMainnet
  ? USDC_ADDRESS_BY_CHAIN.mainnet
  : USDC_ADDRESS_BY_CHAIN.sepolia;
