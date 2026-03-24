# Polymarket Financial Daily Dashboard

A lightweight front-end dashboard that shows a **limited list of daily financial up/down markets** from Polymarket with:

- Closing time in **Indian Standard Time (IST / UTC+05:30)**
- Live countdown timer to close
- Yes/No odds
- Target price
- Live underlying price (via Yahoo Finance quote API)
- Auto refresh every 30 seconds

## Configure your limited markets

Edit `WATCHLIST` in `app.js`:

- `name`: label displayed on the card
- `slug`: Polymarket market slug
- `quoteSymbol`: Yahoo Finance symbol for current price
- `targetHint`: fallback target shown if it cannot be parsed from market question/description

## Run locally

Because this is a static app, you can run with any file server.

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes

- Some APIs may rate-limit or block requests by environment/network.
- If a market slug is unavailable, the card will still render with an error message for that item.
