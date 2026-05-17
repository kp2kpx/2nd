/**
 * Fetches stablecoin circulating supply on Base for the last 365 days
 * from DefiLlama and writes public/stablecoins.json.
 *
 * Run: node scripts/fetch-data.mjs
 *
 * DefiLlama API response shapes used here:
 *
 * GET https://stablecoins.llama.fi/stablecoins
 * {
 *   peggedAssets: [{
 *     id: string,
 *     name: string,
 *     symbol: string,
 *     chainCirculating: { Base?: { current: { peggedUSD: number } } },
 *     chains: string[]
 *   }]
 * }
 *
 * GET https://stablecoins.llama.fi/stablecoin/{id}
 * {
 *   id: string,
 *   name: string,
 *   symbol: string,
 *   chainBalances: {
 *     Base?: {
 *       tokens: [{ date: number, circulatingSupply: { peggedUSD: number } }]
 *     }
 *   }
 * }
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'public', 'stablecoins.json')

const BRAND_COLORS = {
  USDC:    '#2775CA',
  'USD Coin': '#2775CA',
  USDbC:   '#2775CA',
  USDT:    '#26A17B',
  Tether:  '#26A17B',
  DAI:     '#F5AC37',
  MakerDAO:'#F5AC37',
  EURC:    '#1A73E8',
  FRAX:    '#000000',
  LUSD:    '#745DDF',
  DOLA:    '#E91E8C',
  crvUSD:  '#E64B40',
  PYUSD:   '#0070BA',
  USDP:    '#22B070',
  FDUSD:   '#1890FF',
  USDS:    '#7B61FF',
  DEFAULT: '#888888',
}

function brandColor(symbol, name) {
  return BRAND_COLORS[symbol] ?? BRAND_COLORS[name] ?? BRAND_COLORS.DEFAULT
}

const cutoff = Math.floor(Date.now() / 1000) - 365 * 86400

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'stablecoin-viz/1.0' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

async function main() {
  console.log('Fetching stablecoin list…')
  const list = await fetchJSON('https://stablecoins.llama.fi/stablecoins')

  const baseCoins = list.peggedAssets.filter(
    (a) => a.chains?.includes('Base') && a.chainCirculating?.Base?.current?.peggedUSD > 0
  )
  console.log(`Found ${baseCoins.length} stablecoins on Base: ${baseCoins.map(c => c.symbol).join(', ')}`)

  const results = []

  for (const coin of baseCoins) {
    console.log(`  Fetching history for ${coin.symbol} (id=${coin.id})…`)
    try {
      const detail = await fetchJSON(`https://stablecoins.llama.fi/stablecoin/${coin.id}`)
      const tokens = detail.chainBalances?.Base?.tokens ?? []
      const series = tokens
        .filter((t) => t.date >= cutoff)
        .map((t) => ({ date: t.date, supply: t.circulatingSupply?.peggedUSD ?? 0 }))
        .sort((a, b) => a.date - b.date)

      if (series.length === 0) {
        console.log(`    No Base data for ${coin.symbol}, skipping`)
        continue
      }

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
    // be polite to the API
    await new Promise((r) => setTimeout(r, 200))
  }

  // Sort descending by current supply so the biggest coins are most prominent
  results.sort((a, b) => b.currentSupply - a.currentSupply)

  mkdirSync(join(__dirname, '..', 'public'), { recursive: true })
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2))
  console.log(`\nWrote ${results.length} stablecoins to ${OUT_PATH}`)
  console.log('\nLatest supplies:')
  for (const c of results) {
    const latest = c.series[c.series.length - 1]
    console.log(`  ${c.symbol.padEnd(8)} $${(latest?.supply / 1e9).toFixed(3)}B  (${new Date(latest?.date * 1000).toISOString().slice(0, 10)})`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
