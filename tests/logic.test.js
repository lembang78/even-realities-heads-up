// Heads-Up Markets — logic tests. Run: npm test  (node --test tests/)
// Pure functions from src/logic.ts; no SDK, DOM, or network needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fmtUsd, fmtPct, trunc, parsePrices, parseMarkets,
  nextScreen, prevScreen, newWallet, placePaperBet, openBetsValue,
  alertTarget, cycleAlert, checkAlert,
  renderPrices, renderMarkets, renderAlerts,
} from '../src/logic.ts'

test('fmtUsd: big values no decimals, small values 2dp', () => {
  assert.equal(fmtUsd(59930), '$59,930')
  assert.equal(fmtUsd(69.49), '$69.49')
  assert.equal(fmtUsd(NaN), '--')
})

test('fmtPct signs positive values', () => {
  assert.equal(fmtPct(-2.22), '-2.2%')
  assert.equal(fmtPct(3), '+3.0%')
})

test('parsePrices reads the CoinGecko shape', () => {
  const rows = parsePrices({
    bitcoin: { usd: 59930, usd_24h_change: -2.22 },
    ethereum: { usd: 1681.89, usd_24h_change: -3.16 },
    solana: { usd: 69.49, usd_24h_change: -5.22 },
  })
  assert.equal(rows.length, 3)
  assert.equal(rows[0].symbol, 'BTC')
  assert.equal(rows[2].usd, 69.49)
  assert.deepEqual(parsePrices(null), [])
  assert.deepEqual(parsePrices({ bitcoin: { usd: 'nope' } }), [])
})

test('parseMarkets reads the Polymarket Gamma shape, sorts by volume, caps at 3', () => {
  const mk = (id, q, yes, vol) => ({
    id, question: q, outcomePrices: JSON.stringify([String(yes), String(1 - yes)]), volume24hr: vol,
  })
  const rows = parseMarkets([
    mk('a', 'Low vol?', 0.5, 10),
    mk('b', 'High vol?', 0.42, 9000),
    mk('c', 'Mid vol?', 0.9, 100),
    mk('d', 'Bad odds?', 1.5, 99999),
    mk('e', 'No prices', 0.5, 5),
  ])
  // 'd' is dropped (YES price outside 0..1); 'e' has no outcomePrices -> dropped
  assert.deepEqual(rows.map((r) => r.id), ['b', 'c', 'a'])
  assert.equal(rows[0].yesPrice, 0.42)
})

test('parseMarkets prefers contested markets over near-certain ones', () => {
  const mk = (id, q, yes, vol) => ({
    id, question: q, outcomePrices: JSON.stringify([String(yes), String(1 - yes)]), volume24hr: vol,
  })
  const rows = parseMarkets([
    mk('sure', 'Near-certain?', 0.9995, 9000),
    mk('live', 'Contested?', 0.42, 100),
    mk('dead', 'Also certain?', 0.001, 8000),
  ])
  assert.equal(rows[0].id, 'live')
  assert.equal(rows.length, 3) // fills up from near-certain ones when needed
})

test('screen navigation wraps around', () => {
  assert.equal(nextScreen('alerts'), 'prices')
  assert.equal(prevScreen('prices'), 'alerts')
  assert.equal(nextScreen('prices'), 'markets')
})

test('paper bet deducts 10 credits, refuses when broke, marks to market', () => {
  const market = { id: 'm1', question: 'Q?', yesPrice: 0.5, noPrice: 0.5, volume24h: 1 }
  let w = newWallet()
  assert.equal(w.credits, 100)
  const w2 = placePaperBet(w, market)
  assert.ok(w2)
  assert.equal(w2.credits, 90)
  assert.equal(w2.bets.length, 1)
  // YES price doubled to 1.0 (cap: parseMarkets excludes 1.0, but value math still holds)
  assert.equal(openBetsValue(w2, [{ ...market, yesPrice: 1 }]), 20)
  // Broke wallet cannot bet.
  const broke = { credits: 5, bets: [] }
  assert.equal(placePaperBet(broke, market), null)
})

test('alert cycle is off -> +5% -> -5% -> off; crossing triggers', () => {
  const base = 60000
  const a1 = cycleAlert(null, 'bitcoin', base)
  assert.ok(a1)
  assert.equal(a1.direction, 'up')
  assert.equal(a1.target, alertTarget(base, 'up'))
  assert.equal(a1.target, 63000)
  const a2 = cycleAlert(a1, 'bitcoin', base)
  assert.equal(a2.direction, 'down')
  assert.equal(a2.target, 57000)
  assert.equal(cycleAlert(a2, 'bitcoin', base), null)
  // Crossing check: armed +5% triggers at/above target, not below.
  assert.equal(checkAlert(a1, 62999).state, 'armed')
  assert.equal(checkAlert(a1, 63000).state, 'triggered')
  assert.equal(checkAlert(a1, 60000).state, 'armed')
})

test('screens render short ASCII lines that fit 576x288', () => {
  const prices = [
    { id: 'bitcoin', symbol: 'BTC', usd: 59930, change24h: -2.2 },
    { id: 'ethereum', symbol: 'ETH', usd: 1681.89, change24h: -3.16 },
    { id: 'solana', symbol: 'SOL', usd: 69.49, change24h: -5.22 },
  ]
  const text = renderPrices(prices, 'bitcoin', Date.now())
  assert.match(text, /BTC \$59,930/)
  assert.match(text, /SOL \$69\.49/)
  for (const line of text.split('\n')) assert.ok(line.length <= 45, `line too long: ${line}`)
  const markets = renderMarkets(
    [{ id: 'm1', question: 'Will BTC hit $70k by Dec 31, 2026?', yesPrice: 0.42, noPrice: 0.58, volume24h: 100 }],
    newWallet(), Date.now(), null,
  )
  assert.match(markets, /YES 42%/)
  assert.match(markets, /PAPER ONLY/)
  const alerts = renderAlerts(null, 'bitcoin', prices, Date.now())
  assert.match(alerts, /No alert set/)
  assert.match(alerts, /while this app is open/)
  assert.ok(!/[▲▼]/.test(text + markets + alerts), 'no glyphs the green canvas may lack')
})

test('trunc shortens long market questions', () => {
  assert.equal(trunc('short', 10), 'short')
  assert.equal(trunc('a very long market question here', 10).length, 10)
})
