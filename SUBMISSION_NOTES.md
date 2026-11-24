# Heads-Up Markets — submission notes (Even Realities "Heads Up" Hackathon)

- **Track:** Crypto & DeFi (official DoraHacks page:
  https://dorahacks.io/hackathon/even-realities/detail, re-checked 25 Nov 2026)
- **Entrant:** Roby, solo (@robyrusmana)
- **Apps used from the track list:** Hyperliquid (prices), Polymarket (odds).
  No other track app is used. Gram Wallet, Trust Wallet are not touched.
  CoinGecko is NOT on the official track list, so it is not used anywhere
  in this app — prices were switched from CoinGecko to Hyperliquid on
  25 Nov 2026 for exactly that reason.
- **Prizes (official page):** $10,000 USDT total — Grand Prize $2,000,
  1st place in each track $1,250, 2nd place in each track $375,
  Best Telegram integration $1,000, Community Partner Award up to $500.
  Cash paid in USDT within 7 days of Demo Day (3 Dec 2026).
- **Judging (official page):** Usefulness on G2 25%, Read and write 20%,
  Technical execution 20%, UX for display and voice 15%,
  Business potential and safety 20%.
- **Repo:** public GitHub repo (this one). README explains setup.
- **Demo video:** under 3 minutes, recorded in the Even Hub simulator
  (no G2 hardware available to the entrant).

## The problem

Checking a price or a prediction-market odd means pulling out a phone,
unlocking it, opening an app, and reading a dense screen. On G2 glasses the
answer should be one glance: one number, one action.

## How it works

Three screens on the 576×288 monochrome canvas, swipe to move, one tap for
the screen's single action:

1. **Prices** — BTC/ETH/SOL live price + 24h change (Hyperliquid public API).
2. **Markets** — top 3 Polymarket markets by 24h volume with live YES/NO
   odds; tap places a 10-credit **paper** bet on YES of market #1.
3. **Alerts** — tap arms a +5% / −5% price alert on the featured coin;
   the app polls while open and shows TRIGGERED when crossed.

## Read + write (20% of the score)

- **Read:** live prices and live Polymarket odds, refreshed every 30 s.
- **Write:** the paper bet (deducts 10 credits, persists in localStorage,
  mark-to-market against live YES prices) and the price alert (persists,
  checked on every poll). Both are real state changes the user makes with
  one tap — no typing, no phone.

## Money safety (part of Business potential and safety, 20% of the score, plus a hard rule)

- Paper credits only (start: 100). No real money, no wallet connection,
  no custody, no on-chain transaction, no financial advice anywhere in the
  app or README. Bets are explicitly labelled "PAPER ONLY" on screen.
- Data is read-only from public APIs (Hyperliquid, Polymarket Gamma), both
  keyless. No API keys or secrets exist in the repo.
- Alerts are polling-based while the app is open. The app never claims
  background alerts — the SDK cannot display anything when the app is
  closed.
- External calls go through the app's own proxy (`server.js`), which adds
  CORS headers; `app.json` whitelists only the proxy origin. Google
  sign-in is not used (it does not work in the WebView) — there is no
  sign-in at all.

## Feature requests for the APIs used (submitted with the entry)

Honest requests, all for APIs this app actually uses:

1. **Hyperliquid — a lightweight mark-price endpoint.** `metaAndAssetCtxs`
   returns all ~235 perps on every call; a glanceable glasses app polling
   every 30 s only needs mark price + prev-day price for 3 coins. A
   `?coins=BTC,ETH,SOL` filter (or a per-coin endpoint) would cut the
   payload by ~98%.
2. **Hyperliquid — push / websocket for mark-price moves.** Polling misses
   fast moves and drains battery; a server-sent stream of mark-price
   changes for a subscribed coin list would let a glasses app update the
   moment a price crosses an alert level.
3. **Hyperliquid — clearer errors on the candle endpoint.** During
   development a 1d-candle request was rejected with only "Failed to
   deserialize the JSON body into the target type"; a message naming the
   offending field would have saved a debugging round.
4. **Polymarket Gamma — a "contested" filter and 24h price change.**
   Sorting by volume returns many near-certain (99.9%) markets that make
   dull glanceable cards; a `min/max YES price` filter and a 24h YES-price
   change field would let clients show only live, moving markets.
5. **Polymarket Gamma — short YES-price history per market.** A 24h
   series of YES prices (even 12 points) would let a 576×288 screen show
   a trend arrow/sparkline instead of a single static odd.

## What existed before 23 Nov 2026

Nothing of this app. Built fresh in the build week from the official Even
Hub `minimal` template scaffold; all app logic is new. See README.

## Known limits of this V1

- Simulator only — no G2 hardware was available, so on-glasses tap/swipe
  feel is verified in the simulator, not on device.
- The proxy runs on localhost (`http://localhost:3000`) for the demo; for a
  store build it must be deployed to an HTTPS origin and that origin put in
  the `app.json` network whitelist (documented in README).
- Paper bets are mark-to-market only; Polymarket outcomes are not resolved
  in-app (they resolve on Polymarket's own schedule).
- Alerts need the app open; no background/push alerts.
