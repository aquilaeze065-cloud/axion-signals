/* ============================================
   CHART.JS
   - TradingView Advanced Chart (full)
   - Mini charts for all pairs
   - Pair & timeframe switching
============================================ */

// ─── STATE ─────────────────────────────────
let currentSymbol = 'FX:EURUSD';
let currentTF     = '15';
let tvWidget      = null;

// ─── PAIR MAP ──────────────────────────────
// Maps display name → TradingView symbol
const TV_SYMBOLS = {
  'EURUSD': 'FX:EURUSD',
  'GBPUSD': 'FX:GBPUSD',
  'USDJPY': 'FX:USDJPY',
  'AUDUSD': 'FX:AUDUSD',
  'USDCAD': 'FX:USDCAD',
  'EURGBP': 'FX:EURGBP',
  'XAUUSD': 'TVC:GOLD',
  'XAGUSD': 'TVC:SILVER',
};

// Mini chart pairs
const MINI_PAIRS = [
  { key: 'EURUSD',  label: 'EUR/USD',  symbol: 'FX:EURUSD' },
  { key: 'GBPUSD',  label: 'GBP/USD',  symbol: 'FX:GBPUSD' },
  { key: 'USDJPY',  label: 'USD/JPY',  symbol: 'FX:USDJPY' },
  { key: 'AUDUSD',  label: 'AUD/USD',  symbol: 'FX:AUDUSD' },
  { key: 'USDCAD',  label: 'USD/CAD',  symbol: 'FX:USDCAD' },
  { key: 'EURGBP',  label: 'EUR/GBP',  symbol: 'FX:EURGBP' },
  { key: 'XAUUSD',  label: 'XAU/USD',  symbol: 'TVC:GOLD',   isMetal: true },
  { key: 'XAGUSD',  label: 'XAG/USD',  symbol: 'TVC:SILVER', isMetal: true },
];

// ─── LOAD FULL TRADINGVIEW CHART ───────────
function loadChart(pair, btn) {
  // Update active button
  if (btn) {
    document.querySelectorAll('.chart-pair-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  const symbol = TV_SYMBOLS[pair] || `FX:${pair}`;
  currentSymbol = symbol;

  renderTVChart(symbol, currentTF);
}

function setChartTF(tf, btn) {
  // Update active button
  if (btn) {
    document.querySelectorAll('.chart-tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  currentTF = tf;
  renderTVChart(currentSymbol, tf);
}

function renderTVChart(symbol, tf) {
  const container = document.getElementById('tvAdvancedChart');
  if (!container) return;

  // Clear previous widget
  container.innerHTML = '';

  // Check if TradingView library loaded
  if (typeof TradingView === 'undefined') {
    container.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100%;
        color:var(--text3);font-family:var(--font-mono);font-size:12px;flex-direction:column;gap:8px;">
        <span>📡</span>
        <span>TradingView chart loading...</span>
        <span style="font-size:10px">Make sure you have internet access</span>
      </div>`;
    return;
  }

  new TradingView.widget({
    container_id:   'tvAdvancedChart',
    symbol:         symbol,
    interval:       tf,
    timezone:       'Etc/UTC',
    theme:          'dark',
    style:          '1',           // 1 = candlestick
    locale:         'en',
    toolbar_bg:     '#080d1a',
    enable_publishing: false,
    hide_top_toolbar:  false,
    hide_legend:       false,
    save_image:        false,
    withdateranges:    true,
    allow_symbol_change: true,
    studies: [
      'RSI@tv-basicstudies',
      'MACD@tv-basicstudies',
      'MAExp@tv-basicstudies',    // EMA
      'BB@tv-basicstudies',       // Bollinger Bands
      'VWAP@tv-basicstudies',
    ],
    overrides: {
      'mainSeriesProperties.candleStyle.upColor':          '#00ff88',
      'mainSeriesProperties.candleStyle.downColor':        '#ff3355',
      'mainSeriesProperties.candleStyle.borderUpColor':    '#00ff88',
      'mainSeriesProperties.candleStyle.borderDownColor':  '#ff3355',
      'mainSeriesProperties.candleStyle.wickUpColor':      '#00cc6a',
      'mainSeriesProperties.candleStyle.wickDownColor':    '#cc1133',
      'paneProperties.background':                         '#050810',
      'paneProperties.backgroundGradientStartColor':       '#050810',
      'paneProperties.backgroundGradientEndColor':         '#080d1a',
      'paneProperties.vertGridProperties.color':           '#1a2540',
      'paneProperties.horzGridProperties.color':           '#1a2540',
      'scalesProperties.textColor':                        '#506080',
    },
    width:  '100%',
    height: 520,
  });
}

// ─── MINI CHARTS ───────────────────────────
function buildMiniCharts() {
  const grid = document.getElementById('miniChartsGrid');
  if (!grid) return;

  // Build containers first
  grid.innerHTML = MINI_PAIRS.map(p => `
    <div class="mini-chart-card">
      <div class="mini-chart-label">
        ${p.label}
        <span>${p.isMetal ? '⬡ METAL' : 'FOREX'}</span>
      </div>
      <div id="mini-${p.key}" style="height:180px;"></div>
    </div>
  `).join('');

  // Render each mini TradingView widget
  if (typeof TradingView === 'undefined') return;

  MINI_PAIRS.forEach(p => {
    new TradingView.MiniWidget({
      container_id: `mini-${p.key}`,
      symbol:       p.symbol,
      interval:     '15',
      theme:        'dark',
      locale:       'en',
      autosize:     true,
      hide_volume:  true,
    });
  });
}

// ─── ECONOMIC CALENDAR WIDGET ──────────────
function buildCalendarWidget() {
  const el = document.getElementById('calendarWidget');
  if (!el) return;

  // Use TradingView Economic Calendar widget
  el.innerHTML = `
    <iframe
      src="https://sslefx.com/economic-calendar-widget/"
      style="width:100%;height:600px;border:none;background:#050810;"
      title="Economic Calendar">
    </iframe>
  `;

  // Fallback: Investing.com calendar if above fails
  // Uncomment below to use instead:
  /*
  el.innerHTML = `
    <iframe
      src="https://sslecal2.investing.com?columns=exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous&features=datepicker,timezone&countries=25,32,6,37,72,22,17,39,14,10,35&calType=week&timeZone=15&lang=1"
      style="width:100%;height:600px;border:none;"
      title="Economic Calendar">
    </iframe>`;
  */
}

// ─── INIT ──────────────────────────────────
function initCharts() {
  // Wait for TradingView script to load
  const waitForTV = setInterval(() => {
    if (typeof TradingView !== 'undefined') {
      clearInterval(waitForTV);
      // Only load if chart tab is visible
      const chartTab = document.getElementById('tab-chart');
      if (chartTab && chartTab.classList.contains('active')) {
        renderTVChart(currentSymbol, currentTF);
        buildMiniCharts();
      }
      buildCalendarWidget();
    }
  }, 500);

  // Timeout after 10s
  setTimeout(() => clearInterval(waitForTV), 10000);
}

document.addEventListener('DOMContentLoaded', initCharts);