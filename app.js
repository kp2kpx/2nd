const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets';
const YAHOO_QUOTE_API = 'https://query1.finance.yahoo.com/v7/finance/quote';
const REFRESH_MS = 30_000;

const WATCHLIST = [
  {
    name: 'Bitcoin Daily',
    slug: 'bitcoin-above-90000-on-march-24',
    quoteSymbol: 'BTC-USD',
    targetHint: '$90,000'
  },
  {
    name: 'Ethereum Daily',
    slug: 'ethereum-above-5000-on-march-24',
    quoteSymbol: 'ETH-USD',
    targetHint: '$5,000'
  },
  {
    name: 'S&P 500 Daily',
    slug: 'sp500-up-on-march-24',
    quoteSymbol: '^GSPC',
    targetHint: 'Up vs previous close'
  },
  {
    name: 'Nasdaq Daily',
    slug: 'nasdaq-up-on-march-24',
    quoteSymbol: '^IXIC',
    targetHint: 'Up vs previous close'
  }
];

const marketContainer = document.querySelector('#markets');
const template = document.querySelector('#market-card-template');
const lastRefreshEl = document.querySelector('#last-refresh');
const statusEl = document.querySelector('#status-message');

const countdownTargets = new Map();

function formatIstDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Kolkata'
  }).format(date);
}

function parseOdds(market) {
  const outcomePrices = Array.isArray(market.outcomePrices)
    ? market.outcomePrices
    : typeof market.outcomePrices === 'string'
      ? JSON.parse(market.outcomePrices)
      : [];

  const yes = Number(outcomePrices[0]);
  const no = Number(outcomePrices[1]);

  return {
    yes: Number.isFinite(yes) ? `${(yes * 100).toFixed(1)}%` : '--',
    no: Number.isFinite(no) ? `${(no * 100).toFixed(1)}%` : '--'
  };
}

function inferTargetPrice(market, fallback) {
  if (market?.strikePrice) return String(market.strikePrice);
  const source = `${market?.question || ''} ${market?.description || ''}`;
  const match = source.match(/\$\s?([\d,]+(?:\.\d+)?)/);
  return match ? `$${match[1]}` : fallback;
}

async function fetchPolymarketBySlug(slug) {
  const res = await fetch(`${POLYMARKET_API}?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`Market lookup failed (${res.status})`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function fetchLivePrices(symbols) {
  const url = `${YAHOO_QUOTE_API}?symbols=${encodeURIComponent(symbols.join(','))}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Quote lookup failed (${res.status})`);
  }
  const data = await res.json();
  const bySymbol = new Map();
  for (const quote of data?.quoteResponse?.result || []) {
    bySymbol.set(quote.symbol, quote.regularMarketPrice);
  }
  return bySymbol;
}

function renderCards(cards) {
  marketContainer.innerHTML = '';

  for (const cardData of cards) {
    const card = template.content.cloneNode(true);
    card.querySelector('.market-title').textContent = cardData.name;
    card.querySelector('.market-question').textContent = cardData.question;
    card.querySelector('.target-price').textContent = cardData.targetPrice;
    card.querySelector('.live-price').textContent = cardData.livePrice;
    card.querySelector('.yes-odds').textContent = cardData.yesOdds;
    card.querySelector('.no-odds').textContent = cardData.noOdds;
    card.querySelector('.close-time').textContent = cardData.closeIst;

    const countdownEl = card.querySelector('.countdown');
    countdownEl.dataset.slug = cardData.slug;
    countdownTargets.set(cardData.slug, {
      endTime: cardData.endTime,
      element: countdownEl
    });

    marketContainer.append(card);
  }
}

function updateCountdowns() {
  const now = Date.now();

  for (const { endTime, element } of countdownTargets.values()) {
    if (!endTime) {
      element.textContent = '--';
      continue;
    }

    const ms = new Date(endTime).getTime() - now;
    if (ms <= 0) {
      element.textContent = 'Closed';
      continue;
    }

    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    element.textContent = `${h}h ${m}m ${s}s`;
  }
}

async function refresh() {
  statusEl.textContent = 'Refreshing...';

  try {
    const marketResults = await Promise.all(
      WATCHLIST.map(async (item) => {
        const market = await fetchPolymarketBySlug(item.slug);
        return { item, market };
      })
    );

    const symbols = WATCHLIST.map((w) => w.quoteSymbol);
    let livePrices = new Map();
    try {
      livePrices = await fetchLivePrices(symbols);
    } catch (priceError) {
      console.warn('Live quote API failed:', priceError);
    }

    const cards = marketResults.map(({ item, market }) => {
      const odds = parseOdds(market || {});
      const live = livePrices.get(item.quoteSymbol);

      return {
        slug: item.slug,
        name: item.name,
        question: market?.question || `Market not found for slug: ${item.slug}`,
        targetPrice: inferTargetPrice(market, item.targetHint),
        livePrice: Number.isFinite(live) ? live.toLocaleString('en-IN') : '--',
        yesOdds: odds.yes,
        noOdds: odds.no,
        closeIst: formatIstDate(market?.endDate || market?.end_date_iso),
        endTime: market?.endDate || market?.end_date_iso || null
      };
    });

    renderCards(cards);
    updateCountdowns();

    const now = new Date();
    lastRefreshEl.textContent = `Last refresh: ${now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
    statusEl.textContent = `Auto-refresh every ${Math.floor(REFRESH_MS / 1000)} seconds.`;
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Unable to load one or more markets (${error.message}). Check slug list in app.js.`;
  }
}

setInterval(updateCountdowns, 1_000);
setInterval(refresh, REFRESH_MS);
refresh();
