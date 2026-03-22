/* ============================================
   NEWS.JS
   - Yahoo Finance RSS feed (via CORS proxy)
   - Investing.com news headlines
   - ForexFactory economic calendar events
   - Sidebar news feed rendering
============================================ */

// ─── CONFIG ────────────────────────────────
// CORS proxy to bypass browser restrictions on RSS feeds
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

const NEWS_SOURCES = {
  forex: [
    {
      name: 'Yahoo Finance',
      url: 'https://finance.yahoo.com/rss/headline?s=EURUSD=X,GBPUSD=X,USDJPY=X',
      label: 'YAHOO'
    },
    {
      name: 'Investing.com Forex',
      url: 'https://www.investing.com/rss/news_301.rss',
      label: 'INVESTING'
    },
    {
      name: 'FXStreet',
      url: 'https://www.fxstreet.com/rss/news',
      label: 'FXSTREET'
    }
  ],
  gold: [
    {
      name: 'Yahoo Finance Gold',
      url: 'https://finance.yahoo.com/rss/headline?s=GC=F',
      label: 'YAHOO'
    },
    {
      name: 'Kitco News',
      url: 'https://www.kitco.com/rss/news.xml',
      label: 'KITCO'
    }
  ],
  crypto: [
    {
      name: 'Yahoo Finance Crypto',
      url: 'https://finance.yahoo.com/rss/headline?s=BTC-USD,ETH-USD',
      label: 'YAHOO'
    }
  ]
};

// ─── NEWS STORE ────────────────────────────
let allNews    = [];
let activeTab  = 'all';

// ─── FETCH RSS FEED ────────────────────────
async function fetchRSS(sourceUrl) {
  try {
    const url = CORS_PROXY + encodeURIComponent(sourceUrl);
    const res = await fetch(url, { timeout: 8000 });
    const data = await res.json();
    const xml  = new DOMParser().parseFromString(data.contents, 'text/xml');
    const items = Array.from(xml.querySelectorAll('item'));

    return items.slice(0, 8).map(item => ({
      title:   item.querySelector('title')?.textContent?.trim() || '',
      link:    item.querySelector('link')?.textContent?.trim() || '#',
      pubDate: item.querySelector('pubDate')?.textContent?.trim() || '',
      desc:    item.querySelector('description')?.textContent?.replace(/<[^>]*>/g,'').trim().slice(0, 120) || ''
    })).filter(i => i.title.length > 5);

  } catch (err) {
    console.warn('[News] Failed to fetch:', sourceUrl, err.message);
    return [];
  }
}

// ─── FETCH ALL NEWS ─────────────────────────
async function fetchAllNews() {
  showNewsLoading();
  allNews = [];

  const categories = ['forex', 'gold', 'crypto'];

  for (const cat of categories) {
    for (const source of NEWS_SOURCES[cat]) {
      const items = await fetchRSS(source.url);
      items.forEach(item => {
        allNews.push({
          ...item,
          category: cat,
          source:   source.label,
          impact:   guessImpact(item.title)
        });
      });
    }
  }

  // Sort by newest first
  allNews.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  if (allNews.length === 0) {
    // Load fallback static headlines if all feeds fail
    allNews = getFallbackNews();
  }

  renderNews(activeTab);
}

// ─── GUESS IMPACT LEVEL ────────────────────
function guessImpact(title) {
  const t = title.toLowerCase();
  const high = ['fed','cpi','nfp','inflation','rate decision','ecb','boe','gdp','fomc','powell','lagarde','recession','crisis'];
  const med  = ['pmi','unemployment','retail','manufacturing','jobless','trade','deficit','surplus'];
  if (high.some(w => t.includes(w))) return 'high';
  if (med.some(w => t.includes(w)))  return 'medium';
  return 'low';
}

// ─── FORMAT TIME AGO ───────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return 'Just now';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (mins < 2)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours/24)}d ago`;
}

// ─── RENDER NEWS ───────────────────────────
function renderNews(tab = 'all') {
  activeTab = tab;
  const feed = document.getElementById('newsFeed');
  if (!feed) return;

  const filtered = tab === 'all'
    ? allNews
    : allNews.filter(n => n.category === tab);

  if (filtered.length === 0) {
    feed.innerHTML = `<div class="news-loading">No ${tab} news available right now.</div>`;
    return;
  }

  feed.innerHTML = filtered.slice(0, 20).map(n => `
    <a class="news-item" href="${n.link}" target="_blank" rel="noopener noreferrer">
      <div class="news-source">
        ${n.source}
        <span class="news-impact impact-${n.impact}">${n.impact.toUpperCase()}</span>
      </div>
      <div class="news-title">${n.title}</div>
      <div class="news-meta">
        <span>${n.desc ? n.desc.slice(0, 80) + '...' : ''}</span>
        <span>${timeAgo(n.pubDate)}</span>
      </div>
    </a>
  `).join('');
}

function showNewsLoading() {
  const feed = document.getElementById('newsFeed');
  if (feed) feed.innerHTML = `<div class="news-loading"><span class="spinner"></span> Loading live news...</div>`;
}

// ─── NEWS TAB SWITCHER ─────────────────────
function switchNewsTab(tab, btn) {
  document.querySelectorAll('.news-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderNews(tab);
}

// ─── REFRESH ───────────────────────────────
function refreshNews() {
  fetchAllNews();
}

// ─── FOREX FACTORY CALENDAR (via proxy) ────
const CALENDAR_EVENTS = [
  { time: '08:30', name: 'GBP Retail Sales',   currency: 'GBP', impact: 'high'   },
  { time: '10:00', name: 'EUR ZEW Sentiment',  currency: 'EUR', impact: 'medium' },
  { time: '13:30', name: 'USD CPI m/m',         currency: 'USD', impact: 'high'   },
  { time: '14:00', name: 'USD Fed Powell Speech',currency: 'USD', impact: 'high'   },
  { time: '15:00', name: 'USD ISM Services',    currency: 'USD', impact: 'medium' },
  { time: '18:00', name: 'USD FOMC Minutes',    currency: 'USD', impact: 'high'   },
];

async function fetchForexFactory() {
  // Try to get live calendar from ForexFactory via proxy
  try {
    const url = CORS_PROXY + encodeURIComponent('https://nfs.faireconomy.media/ff_calendar_thisweek.json');
    const res  = await fetch(url);
    const data = await res.json();
    const contents = JSON.parse(data.contents);

    const today = new Date().toISOString().split('T')[0];
    const todayEvents = contents
      .filter(ev => ev.date && ev.date.startsWith(today) && ev.impact === 'High')
      .slice(0, 8)
      .map(ev => ({
        time:     ev.time || '--:--',
        name:     ev.title || 'Event',
        currency: ev.country || '---',
        impact:   ev.impact === 'High' ? 'high' : ev.impact === 'Medium' ? 'medium' : 'low'
      }));

    renderCalendarMini(todayEvents.length > 0 ? todayEvents : CALENDAR_EVENTS);
    updateUpcomingEvents(todayEvents);

  } catch (err) {
    console.warn('[Calendar] Using static data:', err.message);
    renderCalendarMini(CALENDAR_EVENTS);
  }
}

function renderCalendarMini(events) {
  const el = document.getElementById('calendarMini');
  if (!el) return;

  el.innerHTML = events.map(ev => `
    <div class="cal-event ${ev.impact}">
      <span class="cal-time">${ev.time}</span>
      <span class="cal-name">${ev.name}</span>
      <span class="cal-curr">${ev.currency}</span>
    </div>
  `).join('');
}

function updateUpcomingEvents(events) {
  // Push dynamic events into the AI countdown system
  if (events.length === 0) return;
  // Update global upcomingEvents in ai.js if available
  if (typeof upcomingEvents !== 'undefined') {
    events.forEach(ev => {
      const exists = upcomingEvents.find(e => e.name === ev.name);
      if (!exists) {
        upcomingEvents.push({ name: ev.name, time: ev.time + ' UTC', impact: ev.impact.toUpperCase() });
      }
    });
  }
}

// ─── FALLBACK STATIC NEWS ─────────────────
function getFallbackNews() {
  return [
    { title: 'Dollar weakens as Fed signals potential rate pause in Q2', source: 'REUTERS', category: 'forex', impact: 'high',   link: '#', pubDate: new Date().toISOString(), desc: 'The US dollar fell against major peers after Fed officials signalled a cautious approach.' },
    { title: 'Gold surges past $2,320 on safe-haven demand amid Middle East tensions', source: 'KITCO',   category: 'gold',  impact: 'high',   link: '#', pubDate: new Date().toISOString(), desc: 'Gold prices climbed sharply as geopolitical tensions boosted demand for safe-haven assets.' },
    { title: 'EUR/USD breaks above 1.0880 on strong Eurozone PMI data', source: 'FXSTREET', category: 'forex', impact: 'medium', link: '#', pubDate: new Date().toISOString(), desc: 'The euro gained ground after better-than-expected manufacturing PMI data from Germany.' },
    { title: 'GBP/USD holds gains ahead of BOE interest rate decision', source: 'YAHOO',    category: 'forex', impact: 'high',   link: '#', pubDate: new Date().toISOString(), desc: 'Sterling remained firm as markets anticipated the Bank of England rate announcement.' },
    { title: 'Silver extends rally, targets $27.50 resistance level', source: 'KITCO',      category: 'gold',  impact: 'medium', link: '#', pubDate: new Date().toISOString(), desc: 'Silver prices continue their bullish run driven by industrial demand and inflation hedging.' },
    { title: 'USD/JPY retreats from 150.00 as BOJ intervention fears grow', source: 'YAHOO', category: 'forex', impact: 'high',   link: '#', pubDate: new Date().toISOString(), desc: 'The yen strengthened as traders grew wary of potential Bank of Japan intervention.' },
    { title: 'US CPI data in focus — key risk event for forex traders today', source: 'INVESTING', category: 'forex', impact: 'high', link: '#', pubDate: new Date().toISOString(), desc: 'All eyes on US inflation figures due at 13:30 UTC that could move major pairs significantly.' },
    { title: 'Bitcoin tops $72,000 as institutional inflows accelerate', source: 'YAHOO',   category: 'crypto',impact: 'medium', link: '#', pubDate: new Date().toISOString(), desc: 'BTC reached a new milestone driven by ETF inflows and macro risk-on sentiment.' },
  ];
}

// ─── INIT ──────────────────────────────────
function initNews() {
  fetchAllNews();
  fetchForexFactory();

  // Refresh news every 5 minutes
  setInterval(fetchAllNews, 300000);

  // Refresh calendar every 10 minutes
  setInterval(fetchForexFactory, 600000);
}

document.addEventListener('DOMContentLoaded', initNews);