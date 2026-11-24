// Heads-Up Markets — pure logic, no SDK / DOM imports.
// Shared by src/main.ts (glasses) and tests/logic.test.js.
// All money here is PAPER credits. No real money, no wallet, no custody.

export type CoinId = 'bitcoin' | 'ethereum' | 'solana'

export const COINS: { id: CoinId; symbol: string; name: string }[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
]

export interface PriceRow {
  id: CoinId
  symbol: string
  usd: number
  change24h: number // percent, e.g. -2.2
}

export interface MarketRow {
  id: string
  question: string
  yesPrice: number // 0..1
  noPrice: number
  volume24h: number
}

export interface PaperBet {
  marketId: string
  question: string
  yesPrice: number // entry YES price 0..1
  amount: number // credits staked
  ts: number
}

export interface PaperWallet {
  credits: number
  bets: PaperBet[]
}

export type AlertDirection = 'up' | 'down'
export interface PriceAlert {
  coin: CoinId
  direction: AlertDirection
  target: number
  base: number // price when the alert was set
  state: 'armed' | 'triggered'
}

export type Screen = 'prices' | 'markets' | 'alerts'
export const SCREENS: Screen[] = ['prices', 'markets', 'alerts']
export const PAPER_START_CREDITS = 100
export const PAPER_BET_SIZE = 10
export const ALERT_PCT = 5

// ---------- formatting (ASCII only: the G2 green canvas has no ▲▼ glyphs) ----------

export function fmtUsd(v: number): string {
  if (!Number.isFinite(v)) return '--'
  const s = v >= 1000
    ? v.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return '$' + s
}

export function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return '--'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

export function fmtTime(ts: number): string {
  const d = new Date(ts)
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

export function trunc(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

// ---------- API response parsing ----------

/**
 * Hyperliquid `metaAndAssetCtxs` shape: [meta, ctxs] where
 * meta.universe[i].name is the coin symbol (BTC/ETH/SOL) and ctxs[i] holds
 * markPx (current mark price) and prevDayPx (mark price 24h ago).
 * 24h change is computed from those two: (markPx - prevDayPx) / prevDayPx.
 * Hyperliquid is on the official Crypto & DeFi track list; the proxy
 * relays this response verbatim, so the app parses the raw shape here.
 */
export function parseHyperliquidPrices(json: unknown): PriceRow[] {
  if (!Array.isArray(json) || json.length < 2) return []
  const [meta, ctxs] = json as [Record<string, unknown>, unknown[]]
  const universe = (meta as Record<string, unknown>)?.universe
  if (!Array.isArray(universe) || !Array.isArray(ctxs)) return []
  const out: PriceRow[] = []
  for (const c of COINS) {
    const idx = universe.findIndex(
      (a) => (a as Record<string, unknown>)?.name === c.symbol,
    )
    if (idx < 0) continue
    const ctx = ctxs[idx] as Record<string, unknown> | undefined
    if (!ctx) continue
    const usd = Number(ctx.markPx)
    const prev = Number(ctx.prevDayPx)
    if (!Number.isFinite(usd) || usd <= 0) continue
    const change24h = Number.isFinite(prev) && prev > 0 ? ((usd - prev) / prev) * 100 : 0
    out.push({ id: c.id, symbol: c.symbol, usd, change24h })
  }
  return out
}

/** Polymarket Gamma /markets shape: array of markets with outcomePrices "[\"0.42\",\"0.58\"]" */
export function parseMarkets(json: unknown, limit = 3): MarketRow[] {
  if (!Array.isArray(json)) return []
  const all = json
    .map((m) => {
      let prices: number[] = []
      try {
        prices = JSON.parse(String((m as Record<string, unknown>).outcomePrices ?? '[]'))
      } catch {
        prices = []
      }
      return {
        id: String((m as Record<string, unknown>).id ?? ''),
        question: String((m as Record<string, unknown>).question ?? ''),
        yesPrice: Number(prices[0]),
        noPrice: Number(prices[1]),
        volume24h: Number((m as Record<string, unknown>).volume24hr ?? 0),
      }
    })
    .filter((m) => m.id && m.question && Number.isFinite(m.yesPrice) && m.yesPrice > 0 && m.yesPrice < 1)
    .sort((a, b) => b.volume24h - a.volume24h)
  // Prefer contested markets (5–95% YES): a 99.9% market makes a dull demo
  // and a silly paper bet. Fill up from near-certain ones only if needed.
  const contested = all.filter((m) => m.yesPrice >= 0.05 && m.yesPrice <= 0.95)
  const picked = [...contested]
  for (const m of all) {
    if (picked.length >= limit) break
    if (!picked.includes(m)) picked.push(m)
  }
  return picked.slice(0, limit)
}

// ---------- navigation ----------

export function nextScreen(s: Screen): Screen {
  return SCREENS[(SCREENS.indexOf(s) + 1) % SCREENS.length]
}
export function prevScreen(s: Screen): Screen {
  return SCREENS[(SCREENS.indexOf(s) + SCREENS.length - 1) % SCREENS.length]
}

// ---------- paper betting (mark-to-market, never resolves as "won") ----------

export function newWallet(): PaperWallet {
  return { credits: PAPER_START_CREDITS, bets: [] }
}

/** Place a PAPER_BET_SIZE paper bet on YES. Returns null if not enough credits. */
export function placePaperBet(wallet: PaperWallet, market: MarketRow, now = Date.now()): PaperWallet | null {
  if (wallet.credits < PAPER_BET_SIZE) return null
  return {
    credits: wallet.credits - PAPER_BET_SIZE,
    bets: [
      ...wallet.bets,
      { marketId: market.id, question: market.question, yesPrice: market.yesPrice, amount: PAPER_BET_SIZE, ts: now },
    ],
  }
}

/** Current mark-to-market value of open paper bets, using live YES prices. */
export function openBetsValue(wallet: PaperWallet, markets: MarketRow[]): number {
  let total = 0
  for (const b of wallet.bets) {
    const live = markets.find((m) => m.id === b.marketId)
    if (!live || b.yesPrice <= 0) continue
    total += (b.amount / b.yesPrice) * live.yesPrice
  }
  return total
}

// ---------- price alerts (checked only while the app is open) ----------

export function alertTarget(base: number, direction: AlertDirection): number {
  return direction === 'up' ? base * (1 + ALERT_PCT / 100) : base * (1 - ALERT_PCT / 100)
}

/** Tap cycles: no alert -> +5% -> -5% -> no alert. */
export function cycleAlert(current: PriceAlert | null, coin: CoinId, base: number): PriceAlert | null {
  if (!current) return { coin, direction: 'up', target: alertTarget(base, 'up'), base, state: 'armed' }
  if (current.direction === 'up') return { coin, direction: 'down', target: alertTarget(base, 'down'), base, state: 'armed' }
  return null
}

/** Returns the alert with updated state after a price poll. */
export function checkAlert(alert: PriceAlert | null, price: number): PriceAlert | null {
  if (!alert || alert.state !== 'armed') return alert
  const crossed = alert.direction === 'up' ? price >= alert.target : price <= alert.target
  return crossed ? { ...alert, state: 'triggered' } : alert
}

// ---------- 576x288 screen text (short lines, one glance) ----------

export function renderPrices(prices: PriceRow[], featured: CoinId, updatedAt: number | null): string {
  const lines = ['PRICES  1/3   swipe: screen, tap: coin']
  if (prices.length === 0) {
    lines.push('', 'Loading prices...', 'Hyperliquid via local proxy.')
  } else {
    for (const p of prices) {
      const mark = p.id === featured ? '>' : ' '
      lines.push(`${mark} ${p.symbol} ${fmtUsd(p.usd)}  ${fmtPct(p.change24h)}`)
    }
    lines.push(`Featured: ${featured.toUpperCase()} — set alert on screen 3`)
  }
  if (updatedAt) lines.push(`Updated ${fmtTime(updatedAt)}`)
  return lines.join('\n')
}

export function renderMarkets(
  markets: MarketRow[],
  wallet: PaperWallet,
  updatedAt: number | null,
  lastBet: string | null,
): string {
  const lines = ['MARKETS  2/3   tap: bet 10 cr YES on #1']
  if (markets.length === 0) {
    lines.push('', 'Loading markets...', 'Polymarket via local proxy.')
  } else {
    markets.forEach((m, i) => {
      lines.push(`${i + 1}. ${trunc(m.question, 34)}`)
      lines.push(`   YES ${Math.round(m.yesPrice * 100)}%   NO ${Math.round(m.noPrice * 100)}%`)
    })
    lines.push(`Paper: ${wallet.credits} cr   Bets: ${wallet.bets.length} (${fmtUsd(openBetsValue(wallet, markets))} value)`)
  }
  if (lastBet) lines.push(lastBet)
  lines.push('PAPER ONLY — no real money, no wallet.')
  // The 576x288 canvas fits ~10 lines; the bet confirmation replaces the
  // timestamp line instead of pushing it off-screen.
  if (updatedAt && !lastBet) lines.push(`Updated ${fmtTime(updatedAt)}`)
  return lines.join('\n')
}

export function renderAlerts(
  alert: PriceAlert | null,
  featured: CoinId,
  prices: PriceRow[],
  updatedAt: number | null,
): string {
  const lines = ['ALERTS  3/3   tap: +5% / -5% / off']
  const price = prices.find((p) => p.id === featured)
  if (!alert) {
    lines.push(`No alert set.`, `Tap to arm ${featured.toUpperCase()} +${ALERT_PCT}%`, price ? `Now: ${fmtUsd(price.usd)}` : '')
  } else {
    const dir = alert.direction === 'up' ? `+${ALERT_PCT}%` : `-${ALERT_PCT}%`
    lines.push(
      `${alert.coin.toUpperCase()} ${dir} @ ${fmtUsd(alert.target)}`,
      alert.state === 'triggered' ? '*** TRIGGERED ***' : 'ARMED — checking while app is open',
      price ? `Now: ${fmtUsd(price.usd)}` : '',
    )
  }
  lines.push('Alerts only work while this app is open.')
  if (updatedAt) lines.push(`Updated ${fmtTime(updatedAt)}`)
  return lines.join('\n')
}
