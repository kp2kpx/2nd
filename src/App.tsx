import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { StablecoinData, DataPoint } from './types'
import Scene from './components/Scene'
import Overlay from './components/Overlay'

const TOTAL_FRAMES = 365
const PLAYBACK_MS = 30_000

/**
 * Normalise all coins to share the same 365-day date axis.
 * Fills missing dates with the last known value (forward-fill).
 */
function normalise(raw: StablecoinData[]): { coins: StablecoinData[]; dates: number[] } {
  // Build a sorted union of all unique dates, then pick up to 365 most recent
  const allDates = Array.from(
    new Set(raw.flatMap((c) => c.series.map((p) => p.date)))
  ).sort((a, b) => a - b)
  const dates = allDates.slice(-TOTAL_FRAMES)

  const coins = raw.map((coin) => {
    const map = new Map(coin.series.map((p) => [p.date, p.supply]))
    let last = 0
    const series: DataPoint[] = dates.map((d) => {
      if (map.has(d)) last = map.get(d)!
      return { date: d, supply: last }
    })
    return { ...coin, series }
  })

  return { coins, dates }
}

export default function App() {
  const [raw, setRaw] = useState<StablecoinData[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [frame, setFrame] = useState(0)
  const [playing, setPlaying] = useState(true)

  const rafRef = useRef<number>(0)
  const startTimeRef = useRef<number | null>(null)
  const pausedFrameRef = useRef<number>(0)

  useEffect(() => {
    fetch('/stablecoins.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json()
      })
      .then((data: StablecoinData[]) => {
        if (!Array.isArray(data) || data.length === 0)
          throw new Error('stablecoins.json is empty — run: node scripts/fetch-data.mjs')
        setRaw(data)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const { coins, dates } = useMemo(
    () => (raw ? normalise(raw) : { coins: [], dates: [] }),
    [raw]
  )

  const animate = useCallback((ts: number) => {
    if (startTimeRef.current === null) startTimeRef.current = ts
    const elapsed = ts - startTimeRef.current
    const t = Math.min(elapsed / PLAYBACK_MS, 1)
    const nextFrame = Math.min(Math.floor(t * (TOTAL_FRAMES - 1)), TOTAL_FRAMES - 1)
    setFrame(nextFrame)
    if (t < 1) {
      rafRef.current = requestAnimationFrame(animate)
    } else {
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    if (!playing || coins.length === 0) return
    const offset = (pausedFrameRef.current / (TOTAL_FRAMES - 1)) * PLAYBACK_MS
    const startCallback = (ts: number) => {
      startTimeRef.current = ts - offset
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(startCallback)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, coins.length, animate])

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    pausedFrameRef.current = v
    setFrame(v)
    if (playing) setPlaying(false)
  }

  const togglePlay = () => {
    if (!playing) {
      pausedFrameRef.current = frame >= TOTAL_FRAMES - 1 ? 0 : frame
      if (frame >= TOTAL_FRAMES - 1) setFrame(0)
    } else {
      pausedFrameRef.current = frame
    }
    setPlaying((p) => !p)
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', flexDirection: 'column', gap: 16, padding: 32,
        background: '#050510', color: '#ff4444',
      }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>Data fetch error</div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#ff8888' }}>{error}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Run <code style={{ background: '#111', padding: '2px 6px', borderRadius: 4 }}>node scripts/fetch-data.mjs</code> first to generate public/stablecoins.json
        </div>
      </div>
    )
  }

  if (!coins.length) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#050510', color: '#888', fontSize: 14,
      }}>
        Loading stablecoin data…
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Scene coins={coins} frame={frame} playing={playing} />
      <Overlay
        coins={coins}
        dates={dates}
        frame={frame}
        playing={playing}
        totalFrames={TOTAL_FRAMES}
        onTogglePlay={togglePlay}
        onSlider={handleSlider}
      />
    </div>
  )
}
