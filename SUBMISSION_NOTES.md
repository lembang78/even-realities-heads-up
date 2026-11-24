# Heads-Up Markets — submission notes (Even Realities "Heads Up" Hackathon)

- **Track:** Crypto & DeFi
- **Entrant:** Roby, solo (@robyrusmana)
- **Apps used from the track list:** CoinGecko (prices), Polymarket (odds).
  No other track app is used. Hyperliquid, Kalshi, Gram Wallet, Trust Wallet
  are not touched.
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

1. **Prices** — BTC/ETH/SOL live price + 24h change (CoinGecko public API).
2. **Markets** — top 3 Polymarket markets by 24h volume with live YES/NO
   odds; tap places a 10-credit **paper** bet on YES of market #1.
3. **Alerts** — tap arms a +5% / −5% price alert on the featured coin;
   the app polls while open and shows TRIGGERED when crossed.

## Read + write (25% of the score)

- **Read:** live prices and live Polymarket odds, refreshed every 30 s.
- **Write:** the paper bet (deducts 10 credits, persists in localStorage,
  mark-to-market against live YES prices) and the price alert (persists,
  checked on every poll). Both are real state changes the user makes with
  one tap — no typing, no phone.

## Money safety (10% of the score + hard rule)

- Paper credits only (start: 100). No real money, no wallet connection,
  no custody, no on-chain transaction, no financial advice anywhere in the
  app or README. Bets are explicitly labelled "PAPER ONLY" on screen.
- Data is read-only from public APIs (CoinGecko, Polymarket Gamma), both
  keyless. No API keys or secrets exist in the repo.
- Alerts are polling-based while the app is open. The app never claims
  background alerts — the SDK cannot display anything when the app is
  closed.
- External calls go through the app's own proxy (`server.js`), which adds
  CORS headers; `app.json` whitelists only the proxy origin. Google
  sign-in is not used (it does not work in the WebView) — there is no
  sign-in at all.

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
