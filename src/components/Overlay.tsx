import { useMemo } from 'react'
import { StablecoinData } from '../types'
import { supplyAtFrame } from './Bar'

interface OverlayProps {
  coins: StablecoinData[]
  dates: number[]
  frame: number
  playing: boolean
  totalFrames: number
  onTogglePlay: () => void
  onSlider: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function fmtSupply(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(3)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export default function Overlay({ coins, dates, frame, playing, totalFrames, onTogglePlay, onSlider }: OverlayProps) {
  const date = useMemo(() => {
    const ts = dates[Math.min(frame, dates.length - 1)]
    return ts ? fmtDate(ts) : '—'
  }, [dates, frame])

  const supplies = useMemo(
    () => coins.map((c) => ({ coin: c, supply: supplyAtFrame(c, frame) })),
    [coins, frame]
  )

  return (
    <>
      {/* Top-left: current date */}
      <div style={{
        position: 'fixed', top: 20, left: 24, zIndex: 100,
        background: 'rgba(5,5,20,0.78)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
        padding: '10px 16px',
      }}>
        <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
          Date
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#eee', letterSpacing: '0.01em' }}>
          {date}
        </div>
      </div>

      {/* Top-right: per-token supply */}
      <div style={{
        position: 'fixed', top: 20, right: 24, zIndex: 100,
        background: 'rgba(5,5,20,0.78)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
        padding: '12px 16px', minWidth: 200,
      }}>
        <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Circulating on Base
        </div>
        {supplies.map(({ coin, supply }) => (
          <div key={coin.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, marginBottom: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 9, height: 9, borderRadius: 2, background: coin.color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#ddd' }}>{coin.symbol}</span>
            </div>
            <span style={{ fontSize: 12, color: '#999', fontVariantNumeric: 'tabular-nums' }}>
              {fmtSupply(supply)}
            </span>
          </div>
        ))}
      </div>

      {/* Title */}
      <div style={{
        position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, textAlign: 'center', pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Stablecoin Supply · Base Network
        </span>
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, display: 'flex', alignItems: 'center', gap: 14,
        background: 'rgba(5,5,20,0.82)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        padding: '11px 20px', minWidth: 380,
      }}>
        <button
          onClick={onTogglePlay}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            color: '#fff', borderRadius: 7, padding: '5px 14px',
            cursor: 'pointer', fontSize: 14, fontWeight: 600, flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={frame}
          onChange={onSlider}
          style={{ flex: 1, accentColor: '#4488ff', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12, color: '#555', flexShrink: 0, fontVariantNumeric: 'tabular-nums', minWidth: 52 }}>
          {frame + 1} / {totalFrames}
        </span>
      </div>

      {!playing && (
        <div style={{
          position: 'fixed', bottom: 76, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, fontSize: 11, color: '#444', pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          Drag to orbit · Scroll to zoom
        </div>
      )}
    </>
  )
}
