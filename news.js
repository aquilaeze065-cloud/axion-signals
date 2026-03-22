const NEWS_SOURCES = [
  {name:'FXStreet',url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://www.fxstreet.com/rss/news'),category:'forex'},
  {name:'Investing.com',url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://www.investing.com/rss/news_25.rss'),category:'forex'},
  {name:'Kitco',url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://www.kitco.com/rss/kitco-news-gold.rss'),category:'gold'},
  {name:'CoinDesk',url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://www.coindesk.com/arc/outboundfeeds/rss/'),category:'crypto'},
];

let allNews = [];
let currentTab = 'all';

function parseRSS(xml, source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const items = doc.querySelectorAll('item');
  const news = [];
  items.forEach((item, i) => {
    if (i >= 4) return;
    const title = item.querySelector('title')?.textContent || '';
    const link = item.querySelector('link')?.textContent || '#';
    const pubDate = item.querySelector('pubDate')?.textContent || '';
    if (title) {
      news.push({
        title: title.replace('<![CDATA[','').replace(']]>','').trim(),
        link, pubDate, source: source.name, category: source.category
      });
    }
  });
  return news;
}

function timeAgo(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    if (m < 60) return m + 'm ago';
    if (h < 24) return h + 'h ago';
    return Math.floor(h/24) + 'd ago';
  } catch(e) { return ''; }
}

function renderNews() {
  const feed = document.getElementById('newsFeed');
  if (!feed) return;
  const filtered = currentTab === 'all' ? allNews : allNews.filter(n => n.category === currentTab);
  if (!filtered.length) {
    feed.innerHTML = '<div class="news-loading">No news available · Check connection</div>';
    return;
  }
  feed.innerHTML = filtered.slice(0, 8).map(n => `
    <div class="news-card" onclick="window.open('${n.link}','_blank')">
      <div class="news-card-source">${n.source}</div>
      <div class="news-card-title">${n.title}</div>
      <div class="news-card-time">${timeAgo(n.pubDate)}</div>
    </div>
  `).join('');
}

async function fetchNews() {
  const feed = document.getElementById('newsFeed');
  if (feed) feed.innerHTML = '<div class="news-loading"><span class="spinner"></span> Loading news...</div>';
  allNews = [];
  const promises = NEWS_SOURCES.map(async (source) => {
    try {
      const res = await fetch(source.url);
      const data = await res.json();
      const items = parseRSS(data.contents, source);
      allNews = [...allNews, ...items];
    } catch(e) {
      console.warn('[News] Failed:', source.name, e.message);
    }
  });
  await Promise.allSettled(promises);
  allNews.sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));
  renderNews();
}

function switchNewsTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNews();
}

function refreshNews() { fetchNews(); }

// Init
document.addEventListener('DOMContentLoaded', () => {
  fetchNews();
  setInterval(fetchNews, 5 * 60 * 1000);
});
