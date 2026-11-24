# Heads-Up Markets

Glanceable crypto companion for Even Realities G2 smart glasses — built for the
**Even Realities "Heads Up" Hackathon** (DoraHacks), **Crypto & DeFi track**,
solo entry by Roby (@robyrusmana). Build week 23–29 Nov 2026.

One thing on screen, few words, one action. The glasses show live crypto
prices, live Polymarket odds, and price alerts — all on a 576×288 monochrome
green canvas.

## What it does (3 screens, swipe to change, tap for the one action)

| Screen | Shows | Tap does |
|---|---|---|
| 1. Prices | BTC / ETH / SOL live price + 24h change (Hyperliquid, public API, no key) | Cycle the featured coin |
| 2. Markets | Top 3 Polymarket markets by 24h volume, live YES/NO odds | Place a **10-credit PAPER bet on YES** of market #1 |
| 3. Alerts | Price alert for the featured coin | Cycle: +5% → −5% → off |

Double-tap anywhere exits (system confirmation dialog, as required).

**Paper money only.** You start with 100 paper credits. Bets are
mark-to-market against live YES prices and are never settled as real wins.
No login, no wallet, no custody, no real money, no financial advice.
Alerts are checked by polling while the app is open — the SDK cannot show
anything when the app is closed, and this app does not claim otherwise.

## How it works

```
G2 glasses (576x288 text container, SDK bridge)
   ↕ Even Hub SDK (@evenrealities/even_hub_sdk 0.0.10)
Phone WebView (Vite app: index.html + src/main.ts + src/logic.ts)
   ↕ fetch, whitelisted in app.json
Local proxy (server.js, zero deps) ──► Hyperliquid public API (info: metaAndAssetCtxs)
                                    └─► Polymarket Gamma public API
```

The WebView never calls Hyperliquid or Polymarket directly: the proxy adds the
CORS headers the WebView needs, and `app.json` whitelists only the proxy
origin (`http://localhost:3000`). No API keys exist anywhere in this repo.

## Run it

Prerequisites: Node.js 22.13+ (tested on 24.22.1).

```bash
npm install

# Terminal 1 — proxy (Hyperliquid + Polymarket, adds CORS headers)
npm run proxy        # http://localhost:3000, /api/prices, /api/markets, /health

# Terminal 2 — Vite dev server
npm run dev          # http://localhost:5173

# Terminal 3 — G2 simulator (needs libwebkit2gtk-4.1 on Linux)
npm run simulate     # evenhub-simulator http://localhost:5173
```

Real glasses: `npx evenhub qr --url http://<your-LAN-IP>:5173`, scan with the
Even Realities app (Developer Mode on).

## Tests

```bash
npm test             # node --test, pure logic (formatting, parsing, paper bets, alerts)
npm run build        # tsc --noEmit && vite build
npm run pack         # build + evenhub pack app.json dist -> heads-up-markets.ehpk
```

## What existed before 23 Nov 2026

**Nothing.** This app was built fresh during the hackathon build week.
The only pre-existing code is the official Even Hub `minimal` template
scaffold (Vite config, `index.html` shell, `app.json` shape, SDK hello-world
`main.ts`) — every line of app logic (`src/logic.ts`, `src/main.ts`,
`server.js`, screens, paper betting, alerts) was written for this entry,
23–25 Nov 2026. Open-source libraries used: `@evenrealities/even_hub_sdk`,
Vite, TypeScript. Public APIs used: Hyperliquid, Polymarket Gamma (both
keyless, read-only). Hyperliquid is on the hackathon's official Crypto &
DeFi track list; the price source was switched from CoinGecko to Hyperliquid
on 25 Nov 2026 after the official DoraHacks page was re-checked, because
CoinGecko is not on that list.

## Files

| File | Purpose |
|---|---|
| `index.html` | WebView host + companion view |
| `src/main.ts` | SDK bridge: container, events, polling, persistence |
| `src/logic.ts` | Pure logic: formatting, parsing, paper bets, alerts, screens |
| `src/style.css` | Companion-view styles (glasses UI is the SDK text container) |
| `server.js` | Zero-dep proxy: Hyperliquid + Polymarket, adds CORS, serves `dist/` |
| `app.json` | Even Hub manifest; network whitelist = proxy origin only |
| `tests/logic.test.js` | Unit tests for `src/logic.ts` |
| `SUBMISSION_NOTES.md` | Track, judging-criteria mapping, money-safety statement |
| `LICENSE` | Apache-2.0 |

## License

Apache-2.0 — see `LICENSE`.
