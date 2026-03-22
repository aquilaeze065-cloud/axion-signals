/* ================================
   STEP 3: SIGNAL DATA & CARDS
   ForexAI Pro — signals.js
================================ */


// ================================
// PART 1: LIVE PRICE DATA
// All pairs including Gold & Silver
// ================================
const PAIRS = [
  { pair: 'EUR/USD', price: '1.08742', up: true  },
  { pair: 'GBP/USD', price: '1.26581', up: true  },
  { pair: 'USD/JPY', price: '149.832', up: false },
  { pair: 'AUD/USD', price: '0.65124', up: true  },
  { pair: 'USD/CAD', price: '1.35618', up: false },
  { pair: 'USD/CHF', price: '0.89341', up: false },
  { pair: 'NZD/USD', price: '0.60892', up: true  },
  { pair: 'EUR/GBP', price: '0.85912', up: false },
  { pair: 'XAU/USD', price: '2318.45', up: true,  isMetal: true },
  { pair: 'XAG/USD', price: '27.384',  up: true,  isMetal: true },
];


// ================================
// PART 2: SIGNAL DATA
// All 8 scalp signals M15 / M30
// ================================
const SIGNALS = [
  {
    pair:       'EUR/USD',
    direction:  'buy',
    tf:         'M15',
    entry:      '1.08720',
    tp:         '1.08820',
    sl:         '1.08660',
    ai:         91,
    rr:         '1:1.7',
    indicators: ['EMA9', 'EMA21', 'RSI', 'MACD'],
    time:       '09:14 GMT',
    duration:   '15–25 min',
  },
  {
    pair:       'GBP/USD',
    direction:  'buy',
    tf:         'M30',
    entry:      '1.26540',
    tp:         '1.26680',
    sl:         '1.26460',
    ai:         88,
    rr:         '1:1.8',
    indicators: ['MACD', 'VWAP', 'BB'],
    time:       '08:52 GMT',
    duration:   '20–30 min',
  },
  {
    pair:       'USD/JPY',
    direction:  'sell',
    tf:         'M15',
    entry:      '149.950',
    tp:         '149.820',
    sl:         '150.030',
    ai:         85,
    rr:         '1:1.6',
    indicators: ['RSI', 'EMA', 'MACD'],
    time:       '07:30 GMT',
    duration:   '15–20 min',
  },
  {
    pair:       'AUD/USD',
    direction:  'buy',
    tf:         'M30',
    entry:      '0.65090',
    tp:         '0.65190',
    sl:         '0.65030',
    ai:         86,
    rr:         '1:1.7',
    indicators: ['EMA', 'RSI', 'BB'],
    time:       '08:10 GMT',
    duration:   '20–30 min',
  },
  {
    pair:       'USD/CAD',
    direction:  'sell',
    tf:         'M15',
    entry:      '1.35700',
    tp:         '1.35580',
    sl:         '1.35770',
    ai:         89,
    rr:         '1:1.7',
    indicators: ['MACD', 'EMA21', 'RSI'],
    time:       '07:55 GMT',
    duration:   '15–25 min',
  },
  {
    pair:       'EUR/GBP',
    direction:  'sell',
    tf:         'M30',
    entry:      '0.85950',
    tp:         '0.85840',
    sl:         '0.86010',
    ai:         83,
    rr:         '1:1.8',
    indicators: ['RSI', 'MACD', 'BB'],
    time:       '09:02 GMT',
    duration:   '20–30 min',
  },
  {
    pair:       'XAU/USD',
    direction:  'buy',
    tf:         'M15',
    entry:      '2312.00',
    tp:         '2318.50',
    sl:         '2308.00',
    ai:         92,
    rr:         '1:1.6',
    indicators: ['EMA9', 'EMA21', 'RSI', 'VWAP'],
    time:       '08:00 GMT',
    duration:   '15–20 min',
    isMetal:    true,
  },
  {
    pair:       'XAG/USD',
    direction:  'buy',
    tf:         'M30',
    entry:      '27.150',
    tp:         '27.310',
    sl:         '27.060',
    ai:         87,
    rr:         '1:1.8',
    indicators: ['RSI', 'VWAP', 'EMA21', 'BB'],
    time:       '08:35 GMT',
    duration:   '20–30 min',
    isMetal:    true,
  },
];


// ================================
// PART 3: BUILD TICKER BAR
// Duplicates items for seamless loop
// ================================
function buildTicker() {
  const track = document.querySelector('.ticker-track');
  if (!track) return;

  // Duplicate PAIRS for seamless infinite scroll
  const allItems = [...PAIRS, ...PAIRS];

  track.innerHTML = allItems.map(p => `
    <span style="color: ${p.up ? '#00ff88' : '#ff3355'}">
      ${p.pair} &nbsp; ${p.price} &nbsp; ${p.up ? '▲' : '▼'}
    </span>
  `).join('');
}


// ================================
// PART 4: BUILD ONE SIGNAL CARD
// Takes a signal object, returns HTML
// ================================
function buildCard(signal, index) {
  const isBuy    = signal.direction === 'buy';
  const isMetal  = signal.isMetal || false;

  // Icon color: gold for metals, cyan for forex
  const iconColor = isMetal
    ? 'color:#ffd700; border-color:rgba(255,215,0,0.3); background:rgba(255,215,0,0.05)'
    : '';

  // Metal label badge
  const metalBadge = isMetal
    ? `<span style="
        font-size:9px;
        font-family:'Space Mono',monospace;
        color:#ffd700;
        background:rgba(255,215,0,0.08);
        border:1px solid rgba(255,215,0,0.25);
        border-radius:3px;
        padding:1px 6px;
        margin-left:6px;
        letter-spacing:1px;
      ">${signal.pair === 'XAU/USD' ? '⬡ GOLD' : '◇ SILVER'}</span>`
    : '';

  // Indicator tags HTML
  const tagsHTML = signal.indicators
    .map(ind => `<span class="tag">${ind}</span>`)
    .join('');

  return `
    <div class="signal-card ${signal.direction}"
         style="animation-delay: ${index * 0.08}s">

      <!-- CARD HEADER -->
      <div class="card-header">
        <div class="pair-info">
          <div class="pair-icon" style="${iconColor}">
            ${signal.pair.replace('/', '<br>')}
          </div>
          <div>
            <p class="pair-name">
              ${signal.pair}${metalBadge}
            </p>
            <p class="pair-price">
              ${PAIRS.find(p => p.pair === signal.pair)?.price || ''}
            </p>
          </div>
        </div>
        <div class="card-badge">
          <span class="direction ${signal.direction}">
            ${signal.direction.toUpperCase()}
          </span>
          <span class="timeframe">${signal.tf} · ${signal.time}</span>
        </div>
      </div>

      <!-- CARD BODY: Entry / TP / SL + AI bar -->
      <div class="card-body">
        <div class="levels">
          <div class="level">
            <p class="level-label">Entry</p>
            <p class="level-value entry">${signal.entry}</p>
          </div>
          <div class="level">
            <p class="level-label">Take Profit</p>
            <p class="level-value tp">${signal.tp}</p>
          </div>
          <div class="level">
            <p class="level-label">Stop Loss</p>
            <p class="level-value sl">${signal.sl}</p>
          </div>
        </div>

        <!-- AI Confidence Bar -->
        <div class="ai-confidence">
          <div class="conf-header">
            <span class="conf-label">🤖 AI Confidence</span>
            <span class="conf-score">${signal.ai}%</span>
          </div>
          <div class="conf-bar">
            <div class="conf-fill" style="width: ${signal.ai}%"></div>
          </div>
        </div>
      </div>

      <!-- CARD FOOTER: Tags + RR + Duration -->
      <div class="card-footer">
        <div class="tags">${tagsHTML}</div>
        <div class="card-meta">
          <span class="rr">RR ${signal.rr}</span>
          <span class="duration">⏱ ${signal.duration}</span>
        </div>
      </div>

    </div>
  `;
}


// ================================
// PART 5: RENDER ALL SIGNAL CARDS
// Supports filter: ALL / BUY / SELL
// ================================
function renderSignals(filter = 'ALL') {
  const grid = document.querySelector('.signals-grid');
  if (!grid) return;

  // Filter signals based on button clicked
  const filtered = filter === 'ALL'
    ? SIGNALS
    : SIGNALS.filter(s => s.direction.toUpperCase() === filter);

  // Build and inject all cards
  grid.innerHTML = filtered
    .map((signal, i) => buildCard(signal, i))
    .join('');
}


// ================================
// PART 6: FILTER BUTTONS LOGIC
// Highlights active button
// ================================
function setupFilters() {
  const buttons = document.querySelectorAll('.filters button');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all buttons
      buttons.forEach(b => b.classList.remove('active'));
      // Set clicked button as active
      btn.classList.add('active');
      // Re-render with the selected filter
      renderSignals(btn.textContent.toUpperCase());
    });
  });

  // Set "All" as active by default
  if (buttons.length > 0) {
    buttons[0].classList.add('active');
  }
}


// ================================
// PART 7: LIVE PRICE SIMULATION
// Updates prices every 3 seconds
// ================================
function simulatePrices() {
  PAIRS.forEach(p => {
    const base  = parseFloat(p.price);
    let delta;

    if (p.isMetal) {
      // Gold moves ±$1.50, Silver ±$0.05
      delta = (Math.random() - 0.48) * (p.pair === 'XAU/USD' ? 1.5 : 0.05);
    } else if (p.pair.includes('JPY')) {
      delta = (Math.random() - 0.48) * 0.05;
    } else {
      delta = (Math.random() - 0.48) * 0.0005;
    }

    // Set decimal places based on pair type
    const decimals = p.isMetal
      ? (p.pair === 'XAU/USD' ? 2 : 3)
      : (p.pair.includes('JPY') ? 3 : 5);

    p.price = (base + delta).toFixed(decimals);
    p.up    = delta >= 0;
  });

  // Rebuild ticker with new prices
  buildTicker();
}


// ================================
// PART 8: INITIALISE EVERYTHING
// Runs when the page loads
// ================================
document.addEventListener('DOMContentLoaded', () => {
  buildTicker();           // Build scrolling ticker
  renderSignals('ALL');    // Render all 8 signal cards
  setupFilters();          // Activate filter buttons

  // Update prices every 3 seconds
  setInterval(simulatePrices, 3000);
});

