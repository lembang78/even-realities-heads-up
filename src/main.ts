// Heads-Up Markets — Even G2 app entry point.
// One full-screen text container (576x288) on the glasses; the DOM below is
// only the phone-side companion view. All market data comes from the local
// proxy (server.js) — the app never calls Hyperliquid / Polymarket directly,
// never holds API keys, and never touches real money (paper credits only).
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  TextContainerUpgrade,
  CreateStartUpPageContainer,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import {
  COINS,
  parseHyperliquidPrices,
  parseMarkets,
  nextScreen,
  prevScreen,
  newWallet,
  placePaperBet,
  cycleAlert,
  checkAlert,
  renderPrices,
  renderMarkets,
  renderAlerts,
  type CoinId,
  type PriceRow,
  type MarketRow,
  type PaperWallet,
  type PriceAlert,
  type Screen,
} from './logic'
import './style.css'

const PROXY = 'http://localhost:3000'
const POLL_MS = 30_000
const WALLET_KEY = 'hum.paper-wallet'
const ALERT_KEY = 'hum.price-alert'

function loadWallet(): PaperWallet {
  try {
    const raw = localStorage.getItem(WALLET_KEY)
    if (raw) {
      const w = JSON.parse(raw) as PaperWallet
      if (typeof w.credits === 'number' && Array.isArray(w.bets)) return w
    }
  } catch { /* corrupted storage -> fresh wallet */ }
  return newWallet()
}
function saveWallet(w: PaperWallet): void {
  try { localStorage.setItem(WALLET_KEY, JSON.stringify(w)) } catch { /* storage unavailable */ }
}
function loadAlert(): PriceAlert | null {
  try {
    const raw = localStorage.getItem(ALERT_KEY)
    return raw ? (JSON.parse(raw) as PriceAlert) : null
  } catch { return null }
}
function saveAlert(a: PriceAlert | null): void {
  try {
    if (a) localStorage.setItem(ALERT_KEY, JSON.stringify(a))
    else localStorage.removeItem(ALERT_KEY)
  } catch { /* storage unavailable */ }
}

const bridge = await waitForEvenAppBridge()

let screen: Screen = 'prices'
let featured: CoinId = 'bitcoin'
let prices: PriceRow[] = []
let markets: MarketRow[] = []
let wallet = loadWallet()
let alert = loadAlert()
let lastBet: string | null = null
let updatedAt: number | null = null

function render(): string {
  if (screen === 'prices') return renderPrices(prices, featured, updatedAt)
  if (screen === 'markets') return renderMarkets(markets, wallet, updatedAt, lastBet)
  return renderAlerts(alert, featured, prices, updatedAt)
}

async function refresh(): Promise<void> {
  try {
    const [pRes, mRes] = await Promise.all([
      fetch(`${PROXY}/api/prices`),
      fetch(`${PROXY}/api/markets`),
    ])
    if (pRes.ok) prices = parseHyperliquidPrices(await pRes.json())
    if (mRes.ok) markets = parseMarkets(await mRes.json())
    updatedAt = Date.now()
    // Alerts are checked on every poll, only while the app is open.
    if (alert) {
      const row = prices.find((p) => p.id === alert!.coin)
      if (row) {
        const next = checkAlert(alert, row.usd)
        if (next !== alert) { alert = next; saveAlert(alert) }
      }
    }
  } catch {
    // Offline: keep the last good data on screen; the proxy is local so a
    // failure here usually means the dev server is not running.
  }
  await push()
}

async function push(): Promise<void> {
  try {
    bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: 1,
      containerName: 'main',
      content: render(),
    }))
  } catch { /* bridge closed */ }
}

/** The one tap action per screen: prices cycles featured coin, markets places
 *  a 10-credit PAPER bet on YES of market #1, alerts cycles +5% / -5% / off. */
function onTap(): void {
  if (screen === 'prices') {
    const i = COINS.findIndex((c) => c.id === featured)
    featured = COINS[(i + 1) % COINS.length].id
  } else if (screen === 'markets') {
    const top = markets[0]
    if (!top) { lastBet = 'No markets loaded yet.'; void push(); return }
    const next = placePaperBet(wallet, top)
    if (!next) { lastBet = 'Out of paper credits (0 left).'; void push(); return }
    wallet = next
    saveWallet(wallet)
    lastBet = `Bet 10 cr YES on #1 @ ${Math.round(top.yesPrice * 100)}%.`
  } else {
    const row = prices.find((p) => p.id === featured)
    if (!row) { lastBet = null; void push(); return }
    alert = cycleAlert(alert, featured, row.usd)
    saveAlert(alert)
  }
  void push()
}

const mainText = new TextContainerProperty({
  xPosition: 0,
  yPosition: 0,
  width: 576,
  height: 288,
  borderWidth: 0,
  borderColor: 5,
  paddingLength: 4,
  containerID: 1,
  containerName: 'main',
  content: 'Heads-Up Markets\nLoading prices...',
  isEventCapture: 1,
})

const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [mainText] }),
)
if (result !== 0) console.error('createStartUpPageContainer failed:', result)

// Event routing (per the official template): taps + double-tap + lifecycle
// arrive in sysEvent, scroll/swipe gestures in textEvent. Double-tap must
// always exit (mode 1 shows the system confirmation dialog).
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

const unsubscribe = bridge.onEvenHubEvent((event) => {
  const sysType = eventTypeOf(event.sysEvent)
  const textType = eventTypeOf(event.textEvent)

  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)
    return
  }
  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    onTap()
    return
  }
  // Swipe up = next screen, swipe down = previous screen.
  if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
    screen = nextScreen(screen)
    void push()
    return
  }
  if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    screen = prevScreen(screen)
    void push()
    return
  }
  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    unsubscribe()
  }
})

void refresh()
setInterval(() => { void refresh() }, POLL_MS)
