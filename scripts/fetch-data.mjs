/**
 * Fetches stablecoin circulating supply on Base for the last 365 days
 * from DefiLlama and writes public/stablecoins.json.
 *
 * Run: node scripts/fetch-data.mjs
 *
 * Strategy:
 *   1. GET /stablecoins → list all coins with Base chain + current supply
 *   2. For each coin, GET /stablecoincharts/Base?stablecoin={id} → daily series
 *      (this endpoint returns [{date, totalCirculatingUSD:{peggedUSD:n}}])
 *      Fallback: GET /stablecoin/{id} → chainBalances.Base.tokens[]
 *      with exhaustive field extraction across all known shapes.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH   = join(__dirname, '..', 'public', 'stablecoins.json')
const DEBUG_PATH = join(__dirname, '..', 'public', 'debug-raw-token.json')

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
  USDP:       '#22B070',
  FDUSD:      '#1890FF',
  DEFAULT:    '#888888',
}

function brandColor(symbol, name) {
  return BRAND_COLORS[symbol] ?? BRAND_COLORS[name] ?? BRAND_COLORS.DEFAULT
}

/**
 * Try to extract a USD numeric supply from any token/point shape DefiLlama uses.
 * Returns the first positive number found across all known field paths.
 */
function extractSupply(t) {
  if (!t || typeof t !== 'object') return 0

  const tryNum = (v) => (typeof v === 'number' && v > 0 ? v : null)
  const tryObj = (v) => {
    if (!v || typeof v !== 'object') return null
    // Check .peggedUSD first, then any numeric value
    if (tryNum(v.peggedUSD)) return v.peggedUSD
    const nums = Object.values(v).filter((x) => typeof x === 'number' && x > 0)
    return nums.length ? nums.reduce((a, b) => a + b, 0) : null
  }

  return (
    // /stablecoincharts shape: {totalCirculatingUSD: {peggedUSD}}
    tryObj(t.totalCirculatingUSD) ??
    // /stablecoin/{id} shape A: {circulatingSupply: {peggedUSD}}
    tryObj(t.circulatingSupply) ??
    // shape B: {circulating: {peggedUSD}}
    tryObj(t.circulating) ??
    // shape C: direct top-level number fields
    tryNum(t.peggedUSD) ??
    tryNum(t.totalCirculating) ??
    tryNum(t.amount) ??
    tryNum(t.supply) ??
    tryNum(t.balance) ??
    // shape D: {minted - unreleased}
    (() => {
      const m = tryObj(t.minted) ?? tryNum(t.minted) ?? 0
      const u = tryObj(t.unreleased) ?? tryNum(t.unreleased) ?? 0
      return m > 0 ? m - u : null
    })() ??
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

async function fetchSeriesForCoin(coin) {
  // Method 1: /stablecoincharts/Base?stablecoin={id}
  // Returns: [{date, totalCirculatingUSD:{peggedUSD}}]
  try {
    const url = `https://stablecoins.llama.fi/stablecoincharts/Base?stablecoin=${coin.id}`
    const raw = await fetchJSON(url)
    if (Array.isArray(raw) && raw.length > 0) {
      // Log raw shape once per run
      if (!fetchSeriesForCoin._logged) {
        fetchSeriesForCoin._logged = true
        console.log(`  [debug:charts] point[0]: ${JSON.stringify(raw[0])}`)
        console.log(`  [debug:charts] point[1]: ${JSON.stringify(raw[1])}`)
        mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
        writeFileSync(DEBUG_PATH, JSON.stringify({ method: 'charts', raw0: raw[0], raw1: raw[1] }, null, 2))
      }
      const series = raw
        .filter((p) => p.date >= cutoff)
        .map((p) => ({ date: p.date, supply: extractSupply(p) }))
        .sort((a, b) => a.date - b.date)
      if (series.length > 0 && series.some((p) => p.supply > 0)) return series
      console.log(`    /stablecoincharts gave ${series.length} points but all zero — trying fallback`)
    }
  } catch (err) {
    console.log(`    /stablecoincharts failed: ${err.message}`)
  }

  // Method 2: /stablecoin/{id} → chainBalances.Base.tokens
  const detail = await fetchJSON(`https://stablecoins.llama.fi/stablecoin/${coin.id}`)
  if (!fetchSeriesForCoin._loggedDetail) {
    fetchSeriesForCoin._loggedDetail = true
    const cbKeys = Object.keys(detail.chainBalances ?? {})
    console.log(`  [debug:detail] chainBalances keys (first 8): ${cbKeys.slice(0, 8).join(', ')}`)
    const baseData = detail.chainBalances?.Base ?? detail.chainBalances?.base
    const toks = baseData?.tokens ?? []
    if (toks.length > 0) {
      console.log(`  [debug:detail] token[0]: ${JSON.stringify(toks[0])}`)
      mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
      writeFileSync(DEBUG_PATH, JSON.stringify({
        method: 'detail', cbKeys, token0: toks[0], token1: toks[1],
      }, null, 2))
    }
  }
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

  const baseCoins = list.peggedAssets.filter(
    (a) => a.chains?.includes('Base') && (a.chainCirculating?.Base?.current?.peggedUSD ?? 0) > 0
  )
  console.log(`Found ${baseCoins.length} stablecoins on Base: ${baseCoins.map((c) => c.symbol).join(', ')}`)

  const results = []

  for (const coin of baseCoins) {
    console.log(`  Fetching history for ${coin.symbol} (id=${coin.id})…`)
    try {
      const series = await fetchSeriesForCoin(coin)
      if (series.length === 0) {
        console.log(`    No Base series, skipping`)
        continue
      }
      const nonZero = series.filter((p) => p.supply > 0).length
      const latest = series[series.length - 1]
      const supplyStr = latest.supply >= 1e9
        ? `$${(latest.supply / 1e9).toFixed(3)}B`
        : `$${(latest.supply / 1e6).toFixed(1)}M`
      console.log(`    ${series.length} points, ${nonZero} non-zero, latest: ${supplyStr}`)

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

  results.sort((a, b) => b.currentSupply - a.currentSupply)

  mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2))

  console.log(`\nWrote ${results.length} stablecoins to ${OUT_PATH}`)
  console.log('\nFinal-frame verification (compare with defillama.com/stablecoins/Base):')
  for (const c of results) {
    const latest = c.series[c.series.length - 1]
    const supplyStr = latest.supply >= 1e9
      ? `$${(latest.supply / 1e9).toFixed(3)}B`
      : `$${(latest.supply / 1e6).toFixed(1)}M`
    console.log(`  ${c.symbol.padEnd(8)} ${supplyStr.padStart(12)}   (${new Date(latest.date * 1000).toISOString().slice(0, 10)})`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
