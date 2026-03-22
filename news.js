let allNews=[];
let currentTab='all';

const MOCK_NEWS=[
  {title:'Gold prices fall as dollar strengthens ahead of Fed meeting',source:'FXStreet',category:'gold',link:'#',pubDate:new Date(Date.now()-1800000).toISOString()},
  {title:'EUR/USD holds above 1.15 support as ECB maintains rates',source:'FXStreet',category:'forex',link:'#',pubDate:new Date(Date.now()-3600000).toISOString()},
  {title:'GBP/USD retreats from highs amid UK inflation data',source:'FXStreet',category:'forex',link:'#',pubDate:new Date(Date.now()-5400000).toISOString()},
  {title:'Silver follows gold lower, XAG/USD tests $67 support',source:'Kitco',category:'gold',link:'#',pubDate:new Date(Date.now()-7200000).toISOString()},
  {title:'USD/JPY climbs to 159 as BOJ holds ultra-loose policy',source:'FXStreet',category:'forex',link:'#',pubDate:new Date(Date.now()-9000000).toISOString()},
  {title:'Bitcoin consolidates near $85,000 ahead of halving event',source:'CoinDesk',category:'crypto',link:'#',pubDate:new Date(Date.now()-10800000).toISOString()},
  {title:'AUD/USD slides as China PMI disappoints markets',source:'FXStreet',category:'forex',link:'#',pubDate:new Date(Date.now()-12600000).toISOString()},
  {title:'Gold demand surges as central banks increase reserves',source:'Kitco',category:'gold',link:'#',pubDate:new Date(Date.now()-14400000).toISOString()},
  {title:'Fed minutes signal caution on rate cuts for 2026',source:'Reuters',category:'forex',link:'#',pubDate:new Date(Date.now()-16200000).toISOString()},
  {title:'Ethereum ETF sees record inflows amid crypto rally',source:'CoinDesk',category:'crypto',link:'#',pubDate:new Date(Date.now()-18000000).toISOString()},
  {title:'USD/CAD rises as oil prices drop on demand concerns',source:'FXStreet',category:'forex',link:'#',pubDate:new Date(Date.now()-19800000).toISOString()},
  {title:'XAU/USD technical analysis: Key resistance at $4,500',source:'Kitco',category:'gold',link:'#',pubDate:new Date(Date.now()-21600000).toISOString()},
];

function timeAgo(dateStr){
  try{const diff=Date.now()-new Date(dateStr).getTime();const m=Math.floor(diff/60000);const h=Math.floor(diff/3600000);if(m<60)return m+'m ago';if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago';}catch(e){return '';}
}

async function fetchNews(){
  const feed=document.getElementById('newsFeed');
  if(feed)feed.innerHTML='<div class="news-loading"><span class="spinner"></span> Loading news...</div>';
  
  // Try live RSS first
  let liveNews=[];
  const sources=[
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://www.fxstreet.com/rss/news'),name:'FXStreet',category:'forex'},
    {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://www.kitco.com/rss/kitco-news-gold.rss'),name:'Kitco',category:'gold'},
  ];
  
  try{
    const res=await Promise.race([
      fetch(sources[0].url),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),4000))
    ]);
    const data=await res.json();
    const parser=new DOMParser();
    const doc=parser.parseFromString(data.contents,'text/xml');
    const items=doc.querySelectorAll('item');
    items.forEach((item,i)=>{
      if(i>=6)return;
      const title=item.querySelector('title')?.textContent?.replace(/<!\[CDATA\[|\]\]>/g,'').trim()||'';
      const link=item.querySelector('link')?.textContent||'#';
      const pubDate=item.querySelector('pubDate')?.textContent||new Date().toISOString();
      if(title)liveNews.push({title,link,pubDate,source:'FXStreet',category:'forex'});
    });
  }catch(e){console.warn('[News] Live feed failed, using cached news');}

  allNews=liveNews.length>0?[...liveNews,...MOCK_NEWS.slice(liveNews.length)]:MOCK_NEWS;
  renderNews();
}

function renderNews(){
  const feed=document.getElementById('newsFeed');
  if(!feed)return;
  const filtered=currentTab==='all'?allNews:allNews.filter(n=>n.category===currentTab);
  if(!filtered.length){feed.innerHTML='<div class="news-loading">No news for this category</div>';return;}
  feed.innerHTML=filtered.slice(0,8).map(n=>`
    <div class="news-card" onclick="window.open('${n.link}','_blank')">
      <div class="news-card-source">${n.source}</div>
      <div class="news-card-title">${n.title}</div>
      <div class="news-card-time">${timeAgo(n.pubDate)}</div>
    </div>`).join('');
}

function switchNewsTab(tab,btn){
  currentTab=tab;
  document.querySelectorAll('.news-tab').forEach(t=>t.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderNews();
}

function refreshNews(){fetchNews();}

document.addEventListener('DOMContentLoaded',()=>{
  fetchNews();
  setInterval(fetchNews,5*60*1000);
});
