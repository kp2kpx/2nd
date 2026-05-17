/**
 * Fetches top-5 stablecoin circulating supply on Base for the last 365 days
 * from DefiLlama and writes public/stablecoins.json.
 *
 * Run: node scripts/fetch-data.mjs
 *
 * API:
 *  GET /stablecoins        → ranked list with current chainCirculating
 *  GET /stablecoin/{id}    → chainBalances.base.tokens [{date, circulatingSupply:{peggedUSD}}]
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'public', 'stablecoins.json')

const TOP_N = 5

const BRAND_COLORS = {
  USDC:       '#2775CA',
  'USD Coin': '#2775CA',
  USDbC:      '#2775CA',
  USDT:       '#26A17B',
  Tether:     '#26A17B',
  DAI:        '#F5AC37',
  USDS:       '#7B61FF',
  EURC:       '#1A73E8',
  FRAX:       '#1A1A2E',
  LUSD:       '#745DDF',
  DOLA:       '#E91E8C',
  crvUSD:     '#E64B40',
  PYUSD:      '#0070BA',
  rwaUSDi:    '#D4A843',
  cgUSD:      '#3ECFCF',
  satUSD:     '#FF6B35',
  DEFAULT:    '#888888',
}

function brandColor(symbol, name) {
  return BRAND_COLORS[symbol] ?? BRAND_COLORS[name] ?? BRAND_COLORS.DEFAULT
}

/**
 * Extract USD supply from any known DefiLlama token/point shape.
 */
function extractSupply(t) {
  if (!t || typeof t !== 'object') return 0
  const tryNum = (v) => (typeof v === 'number' && v > 0 ? v : null)
  const tryObj = (v) => {
    if (!v || typeof v !== 'object') return null
    if (tryNum(v.peggedUSD)) return v.peggedUSD
    const nums = Object.values(v).filter((x) => typeof x === 'number' && x > 0)
    return nums.length ? nums.reduce((a, b) => a + b, 0) : null
  }
  return (
    tryObj(t.totalCirculatingUSD) ??
    tryObj(t.circulatingSupply) ??
    tryObj(t.circulating) ??
    tryNum(t.peggedUSD) ??
    tryNum(t.totalCirculating) ??
    tryNum(t.amount) ??
    tryNum(t.supply) ??
    tryNum(t.balance) ??
    0
  )
}

const cutoff = Math.floor(Date.now() / 1000) - 365 * 86400

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'stablecoin-viz/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function fetchSeries(coin) {
  // Primary: per-coin per-chain chart
  try {
    const raw = await fetchJSON(
      `https://stablecoins.llama.fi/stablecoincharts/Base?stablecoin=${coin.id}`
    )
    if (Array.isArray(raw) && raw.length > 0) {
      const series = raw
        .filter((p) => p.date >= cutoff)
        .map((p) => ({ date: p.date, supply: extractSupply(p) }))
        .sort((a, b) => a.date - b.date)
      if (series.some((p) => p.supply > 0)) return series
    }
  } catch (_) {}

  // Fallback: detail endpoint — chain key is lowercase 'base'
  const detail = await fetchJSON(`https://stablecoins.llama.fi/stablecoin/${coin.id}`)
  const baseData = detail.chainBalances?.Base ?? detail.chainBalances?.base
  const tokens = baseData?.tokens ?? []
  return tokens
    .filter((t) => t.date >= cutoff)
    .map((t) => ({ date: t.date, supply: extractSupply(t) }))
    .sort((a, b) => a.date - b.date)
}

async function main() {
  console.log('Fetching stablecoin list…')
  const list = await fetchJSON('https://stablecoins.llama.fi/stablecoins')

  // Sort all Base coins by current supply descending, take top N
  const baseCoins = list.peggedAssets
    .filter((a) => a.chains?.includes('Base') && (a.chainCirculating?.Base?.current?.peggedUSD ?? 0) > 0)
    .sort((a, b) =>
      (b.chainCirculating?.Base?.current?.peggedUSD ?? 0) -
      (a.chainCirculating?.Base?.current?.peggedUSD ?? 0)
    )
    .slice(0, TOP_N)

  console.log(`Top ${TOP_N} stablecoins on Base: ${baseCoins.map((c) => c.symbol).join(', ')}`)

  const results = []
  for (const coin of baseCoins) {
    console.log(`  Fetching history for ${coin.symbol} (id=${coin.id})…`)
    try {
      const series = await fetchSeries(coin)
      if (!series.length) { console.log('    no data, skipping'); continue }
      const latest = series[series.length - 1]
      const s = latest.supply
      console.log(`    ${series.length} points, latest: ${s >= 1e9 ? '$'+(s/1e9).toFixed(3)+'B' : '$'+(s/1e6).toFixed(1)+'M'}`)
      results.push({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        color: brandColor(coin.symbol, coin.name),
        currentSupply: coin.chainCirculating?.Base?.current?.peggedUSD ?? 0,
        series,
      })
    } catch (err) {
      console.error(`    Error: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 150))
  }

  mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2))

  console.log(`\nWrote ${results.length} coins to ${OUT_PATH}`)
  console.log('\nFinal-frame verification (compare with defillama.com/stablecoins/Base):')
  for (const c of results) {
    const last = c.series[c.series.length - 1]
    const s = last.supply
    const fmt = s >= 1e9 ? '$'+(s/1e9).toFixed(3)+'B' : '$'+(s/1e6).toFixed(1)+'M'
    console.log(`  ${c.symbol.padEnd(10)} ${fmt.padStart(12)}   (${new Date(last.date*1000).toISOString().slice(0,10)})`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
