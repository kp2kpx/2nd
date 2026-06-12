"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

/**
 * Global navbar — logo top-left (links home), right slot for page-specific controls.
 *
 * Navigation uses Next.js router.push("/") which works correctly both in browser
 * and inside the Farcaster Mini App (MiniKit wraps the app in an iframe but the
 * Next.js router still controls intra-app routing).
 *
 * Logo uses mix-blend-mode: multiply to dissolve the white PNG background into
 * the warm parchment theme without needing a separate transparent asset.
 */
export default function Navbar({ children, showBack }: { children?: React.ReactNode; showBack?: boolean; showProfile?: boolean }) {
  const router = useRouter();

  return (
    <header
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: "#c4a882" }}
    >
      {showBack && (
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          style={{ background: "none", border: "none", padding: 0, marginRight: 12, cursor: "pointer", color: "#6b4c2a", fontSize: "1.25rem", lineHeight: 1, flexShrink: 0 }}
        >
          {String.fromCharCode(8592)}
        </button>
      )}
      <button
        onClick={() => router.push("/")}
        aria-label="Go to home"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <Image
          src="/logo.png"
          alt="GLADAITORS"
          width={40}
          height={40}
          style={{
            height: "36px",
            width: "auto",
            // Dissolves white PNG background into the warm parchment without
            // needing a separate transparent version of the asset.
            mixBlendMode: "multiply",
          }}
          priority
        />
      </button>

      {children && (
        <div className="flex items-center gap-3">{children}</div>
      )}
    </header>
  );
}
