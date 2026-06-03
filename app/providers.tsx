"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi-config";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { AudioProvider } from "@/lib/useAudio";

// Pages that should never start background music.
// The root AudioProvider skips its document-level unlock listener on these routes.
const NO_MUSIC_ROUTES = ["/training"];

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const pathname = usePathname();
  const disableMusic = NO_MUSIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* MiniKitProvider handles Farcaster context injection.
            autoConnect is disabled — we handle wallet connect ourselves in
            useFarcasterAuth, which gates on MiniKit context resolving rather
            than sdk.isInMiniApp() (which has a 1s timeout that fires too early
            on farcaster.xyz web, causing the built-in AutoConnect to skip). */}
        <MiniKitProvider enabled={true} autoConnect={false}>
          {/* AudioProvider wraps the entire app so any component can access
              shared audio state (mute toggle, sfx) without prop-drilling.
              disableMusic suppresses background music on sandbox/non-game routes. */}
          <AudioProvider config={{ disableMusic }}>
            {children}
          </AudioProvider>
        </MiniKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
