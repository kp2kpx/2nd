/**
 * Fetches stablecoin circulating supply on Base for the last 365 days
 * from DefiLlama and writes public/stablecoins.json.
 *
 * Run: node scripts/fetch-data.mjs
 *
 * DefiLlama API endpoints used:
 *
 * GET https://stablecoins.llama.fi/stablecoins
 *   → { peggedAssets: [{id, name, symbol, chains, chainCirculating: {Base: {current: {peggedUSD}}}}] }
 *
 * GET https://stablecoins.llama.fi/stablecoin/{id}
 *   → { chainBalances: { Base: { tokens: [{date, circulatingSupply: {peggedUSD}}] } } }
 *
 * Supply extraction tries multiple field paths for robustness.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'public', 'stablecoins.json')

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

/** Extract USD supply from a token object — tries every known DefiLlama field shape. */
function extractSupply(t) {
  // Shape A: { circulatingSupply: { peggedUSD: number } }
  if (t.circulatingSupply != null) {
    if (typeof t.circulatingSupply === 'number') return t.circulatingSupply
    if (typeof t.circulatingSupply?.peggedUSD === 'number') return t.circulatingSupply.peggedUSD
    const vals = Object.values(t.circulatingSupply).filter(v => typeof v === 'number')
    if (vals.length) return vals.reduce((a, b) => a + b, 0)
  }
  // Shape B: { circulating: { peggedUSD: number } }  ← matches /stablecoins list shape
  if (t.circulating != null) {
    if (typeof t.circulating === 'number') return t.circulating
    if (typeof t.circulating?.peggedUSD === 'number') return t.circulating.peggedUSD
    const vals = Object.values(t.circulating).filter(v => typeof v === 'number')
    if (vals.length) return vals.reduce((a, b) => a + b, 0)
  }
  // Shape C: { totalCirculatingUSD: { peggedUSD: number } }
  if (t.totalCirculatingUSD != null) {
    if (typeof t.totalCirculatingUSD === 'number') return t.totalCirculatingUSD
    if (typeof t.totalCirculatingUSD?.peggedUSD === 'number') return t.totalCirculatingUSD.peggedUSD
  }
  // Shape D: direct { peggedUSD: number }
  if (typeof t.peggedUSD === 'number') return t.peggedUSD
  // Shape E: { totalCirculating: number }
  if (typeof t.totalCirculating === 'number') return t.totalCirculating
  return 0
}

const cutoff = Math.floor(Date.now() / 1000) - 365 * 86400

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'stablecoin-viz/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function main() {
  console.log('Fetching stablecoin list…')
  const list = await fetchJSON('https://stablecoins.llama.fi/stablecoins')

  const baseCoins = list.peggedAssets.filter(
    (a) => a.chains?.includes('Base') && (a.chainCirculating?.Base?.current?.peggedUSD ?? 0) > 0
  )
  console.log(`Found ${baseCoins.length} stablecoins on Base: ${baseCoins.map((c) => c.symbol).join(', ')}`)

  const results = []
  let rawLogged = false

  for (const coin of baseCoins) {
    console.log(`  Fetching history for ${coin.symbol} (id=${coin.id})…`)
    try {
      const detail = await fetchJSON(`https://stablecoins.llama.fi/stablecoin/${coin.id}`)

      // Log raw structure once so we can verify field paths in CI
      if (!rawLogged) {
        rawLogged = true
        const cbKeys = Object.keys(detail.chainBalances ?? {})
        console.log(`  [debug] chainBalances keys (first 8): ${cbKeys.slice(0, 8).join(', ')}`)
        // Try both 'Base' and 'base' key
        const baseData = detail.chainBalances?.Base ?? detail.chainBalances?.base
        const rawTokens = baseData?.tokens ?? []
        if (rawTokens.length > 0) {
          console.log(`  [debug] token[0] full: ${JSON.stringify(rawTokens[0])}`)
          console.log(`  [debug] token[1] full: ${JSON.stringify(rawTokens[1])}`)
        } else {
          console.log(`  [debug] Base tokens array empty. Detail top-level keys: ${Object.keys(detail).join(', ')}`)
        }
        // Also write raw debug file for inspection
        writeFileSync(
          join(__dirname, '..', 'public', 'debug-raw-token.json'),
          JSON.stringify({ cbKeys, token0: rawTokens[0], token1: rawTokens[1] }, null, 2)
        )
      }

      const baseChain = detail.chainBalances?.Base ?? detail.chainBalances?.base
      const tokens = baseChain?.tokens ?? []
      const series = tokens
        .filter((t) => t.date >= cutoff)
        .map((t) => ({ date: t.date, supply: extractSupply(t) }))
        .sort((a, b) => a.date - b.date)

      if (series.length === 0) {
        console.log(`    No Base series data for ${coin.symbol}, skipping`)
        continue
      }

      const latestSupply = series[series.length - 1].supply
      console.log(`    ${series.length} data points, latest: $${(latestSupply / 1e6).toFixed(1)}M`)

      results.push({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        color: brandColor(coin.symbol, coin.name),
        currentSupply: coin.chainCirculating?.Base?.current?.peggedUSD ?? 0,
        series,
      })
    } catch (err) {
      console.error(`    Failed to fetch ${coin.symbol}: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  results.sort((a, b) => b.currentSupply - a.currentSupply)

  mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2))

  console.log(`\nWrote ${results.length} stablecoins to ${OUT_PATH}`)
  console.log('\nLatest supplies (final-frame verification):')
  for (const c of results) {
    const latest = c.series[c.series.length - 1]
    const supplyStr = latest.supply >= 1e9
      ? `$${(latest.supply / 1e9).toFixed(3)}B`
      : `$${(latest.supply / 1e6).toFixed(1)}M`
    console.log(`  ${c.symbol.padEnd(8)} ${supplyStr.padStart(12)}   (${new Date(latest.date * 1000).toISOString().slice(0, 10)})`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
