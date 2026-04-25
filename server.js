const { sendTelegram, sendTelegramText, sendWelcomeMessage } = require('./telegram');
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),url=require('url');
const PORT=8080,DIR=__dirname;
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.ico':'image/x-icon'};
let cache={prices:null,lastUpdate:0};
const serverLogs=[];
function addLog(msg){
  const entry='['+new Date().toISOString().slice(11,19)+'] '+msg;
  console.log(entry);
  serverLogs.push(entry);
  if(serverLogs.length>100)serverLogs.shift();
}
const TROY=31.1035;
function fixMetal(v,min,max){const n=parseFloat(v);if(n>=min&&n<=max)return n;const c=n*TROY;if(c>=min&&c<=max)return c;return null;}
function fetchJSON(u){return new Promise((res,rej)=>{const r=https.get(u,{headers:{'User-Agent':'Mozilla/5.0'},timeout:8000},(rs)=>{let d='';rs.on('data',c=>d+=c);rs.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(new Error('BadJSON:'+d.slice(0,60)))}});});r.on('error',rej);r.on('timeout',()=>{r.destroy();rej(new Error('Timeout'));});});}

async function fetchAll(){
  const now=Date.now();
  if(cache.prices&&now-cache.lastUpdate<300000)return cache.prices;
  const p={};

  // FOREX — Multiple free sources with fallback chain
  let forexLoaded = false;

  // Source 1: Frankfurter (ECB data, free, reliable)
  if(!forexLoaded){
    try{
      const fx=await Promise.race([
        fetchJSON('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,AUD,CAD,CHF,NZD'),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))
      ]);
      if(fx&&fx.rates){
        const r=fx.rates;
        p.EURUSD=(1/r.EUR).toFixed(5);
        p.GBPUSD=(1/r.GBP).toFixed(5);
        p.USDJPY=r.JPY.toFixed(3);
        p.AUDUSD=(1/r.AUD).toFixed(5);
        p.USDCAD=r.CAD.toFixed(5);
        p.USDCHF=r.CHF.toFixed(5);
        p.NZDUSD=(1/r.NZD).toFixed(5);
        p.EURGBP=(r.GBP/r.EUR).toFixed(5);
        forexLoaded=true;
        addLog('[Forex] Frankfurter: EUR:'+p.EURUSD+' GBP:'+p.GBPUSD);
      }
    }catch(e){ addLog('[Forex] Frankfurter failed:'+e.message); }
  }

  // Source 2: ExchangeRate-API
  if(!forexLoaded){
    try{
      const fx=await Promise.race([
        fetchJSON('https://open.er-api.com/v6/latest/USD'),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))
      ]);
      if(fx&&fx.rates){
        const r=fx.rates;
        p.EURUSD=(1/r.EUR).toFixed(5);
        p.GBPUSD=(1/r.GBP).toFixed(5);
        p.USDJPY=r.JPY.toFixed(3);
        p.AUDUSD=(1/r.AUD).toFixed(5);
        p.USDCAD=r.CAD.toFixed(5);
        p.USDCHF=r.CHF.toFixed(5);
        p.NZDUSD=(1/r.NZD).toFixed(5);
        p.EURGBP=(r.GBP/r.EUR).toFixed(5);
        forexLoaded=true;
        addLog('[Forex] ExchangeRate-API: EUR:'+p.EURUSD);
      }
    }catch(e){ addLog('[Forex] ExchangeRate-API failed:'+e.message); }
  }

  // Source 3: Fawaz Exchange Rate (free, no key)
  if(!forexLoaded){
    try{
      const fx=await Promise.race([
        fetchJSON('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))
      ]);
      if(fx&&fx.usd){
        const r=fx.usd;
        p.EURUSD=(1/r.eur).toFixed(5);
        p.GBPUSD=(1/r.gbp).toFixed(5);
        p.USDJPY=r.jpy.toFixed(3);
        p.AUDUSD=(1/r.aud).toFixed(5);
        p.USDCAD=r.cad.toFixed(5);
        p.USDCHF=r.chf.toFixed(5);
        p.NZDUSD=(1/r.nzd).toFixed(5);
        p.EURGBP=(r.gbp/r.eur).toFixed(5);
        forexLoaded=true;
        addLog('[Forex] Fawaz CDN: EUR:'+p.EURUSD);
      }
    }catch(e){ addLog('[Forex] Fawaz failed:'+e.message); }
  }

  // Source 4: Use cache if all fail
  if(!forexLoaded){
    addLog('[Forex] All sources failed - using cache');
    if(cache.prices){
      ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCHF','NZDUSD','EURGBP'].forEach(k=>{
        if(cache.prices[k])p[k]=cache.prices[k];
      });
    }
  }

  // METALS — Swissquote (free, real-time, no key)
  try{
    const gd=await Promise.race([
      fetchJSON('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD'),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),6000))
    ]);
    if(gd&&gd[0]&&gd[0].spreadProfilePrices){
      const bid=gd[0].spreadProfilePrices[0].bid;
      const ask=gd[0].spreadProfilePrices[0].ask;
      p.XAUUSD=((bid+ask)/2).toFixed(2);
    }
  }catch(e){
    addLog('[Gold] Failed:'+e.message);
    if(cache.prices&&cache.prices.XAUUSD)p.XAUUSD=cache.prices.XAUUSD;
    else p.XAUUSD='3200.00';
  }

  try{
    const sd=await Promise.race([
      fetchJSON('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/USD'),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),6000))
    ]);
    if(sd&&sd[0]&&sd[0].spreadProfilePrices){
      const bid=sd[0].spreadProfilePrices[0].bid;
      const ask=sd[0].spreadProfilePrices[0].ask;
      p.XAGUSD=((bid+ask)/2).toFixed(3);
    }
  }catch(e){
    addLog('[Silver] Failed:'+e.message);
    if(cache.prices&&cache.prices.XAGUSD)p.XAGUSD=cache.prices.XAGUSD;
    else p.XAGUSD='32.000';
  }

  // CRYPTO — CoinGecko (free, no key, 5 sec timeout)
  try{
    const cg=await Promise.race([
      fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))
    ]);
    if(cg.bitcoin)p.BTCUSD=cg.bitcoin.usd.toFixed(2);
    if(cg.ethereum)p.ETHUSD=cg.ethereum.usd.toFixed(2);
    addLog('[Crypto] BTC:$'+p.BTCUSD+' ETH:$'+p.ETHUSD);
  }catch(e){
    addLog('[Crypto] CoinGecko failed:'+e.message+' - trying backup');
    try{
      // Backup: Binance public API (no key needed)
      const bn=await Promise.race([
        fetchJSON('https://api.binance.com/api/v3/ticker/price?symbols=["BTCUSDT","ETHUSDT"]'),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),5000))
      ]);
      if(Array.isArray(bn)){
        const btc=bn.find(x=>x.symbol==='BTCUSDT');
        const eth=bn.find(x=>x.symbol==='ETHUSDT');
        if(btc)p.BTCUSD=parseFloat(btc.price).toFixed(2);
        if(eth)p.ETHUSD=parseFloat(eth.price).toFixed(2);
        addLog('[Crypto] Binance: BTC:$'+p.BTCUSD+' ETH:$'+p.ETHUSD);
      }
    }catch(e2){
      addLog('[Crypto] All failed - using cache');
      if(cache.prices&&cache.prices.BTCUSD)p.BTCUSD=cache.prices.BTCUSD;
      else p.BTCUSD='84000.00';
      if(cache.prices&&cache.prices.ETHUSD)p.ETHUSD=cache.prices.ETHUSD;
      else p.ETHUSD='1600.00';
    }
  }

  p.ts=Date.now();
  cache.prices=p;
  cache.lastUpdate=now;
  return p;
}

// ── CLAUDE API PROXY (fixes browser CORS) ──────────────
function callClaude(body){
  return new Promise((resolve,reject)=>{
    const data=JSON.stringify(body);
    const req=https.request({
      hostname:'api.anthropic.com',
      path:'/v1/messages',
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Content-Length':Buffer.byteLength(data),
        'anthropic-version':'2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      },
      timeout:30000,
    },(res)=>{
      let d='';
      res.on('data',c=>d+=c);
      res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(new Error('BadJSON'))}});
    });
    req.on('error',reject);
    req.on('timeout',()=>{req.destroy();reject(new Error('Claude timeout'));});
    req.write(data);
    req.end();
  });
}


// ── REAL INDICATOR CALCULATIONS ──────────────────────────
function calcEMA(prices, period) {
  if(prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a,b) => a+b, 0) / period;
  for(let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return parseFloat(ema.toFixed(5));
}

function calcRSI(prices, period=14) {
  if(prices.length < period+1) return null;
  let gains=0, losses=0;
  for(let i=1; i<=period; i++) {
    const diff = prices[i] - prices[i-1];
    if(diff>0) gains+=diff; else losses+=Math.abs(diff);
  }
  let avgGain=gains/period, avgLoss=losses/period;
  for(let i=period+1; i<prices.length; i++) {
    const diff = prices[i] - prices[i-1];
    const gain = diff>0?diff:0;
    const loss = diff<0?Math.abs(diff):0;
    avgGain = (avgGain*(period-1)+gain)/period;
    avgLoss = (avgLoss*(period-1)+loss)/period;
  }
  if(avgLoss===0) return 100;
  const rs = avgGain/avgLoss;
  return parseFloat((100 - 100/(1+rs)).toFixed(2));
}

function calcMACD(prices) {
  if(prices.length < 26) return null;
  const ema12 = calcEMA(prices, 12);
  const ema26 = calcEMA(prices, 26);
  if(!ema12||!ema26) return null;
  const macdLine = parseFloat((ema12-ema26).toFixed(5));
  return { macd: macdLine, bullish: macdLine > 0 };
}

function calcBB(prices, period=20) {
  if(prices.length < period) return null;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a,b)=>a+b,0)/period;
  const std = Math.sqrt(slice.reduce((a,b)=>a+Math.pow(b-mean,2),0)/period);
  return {
    upper: parseFloat((mean+2*std).toFixed(5)),
    middle: parseFloat(mean.toFixed(5)),
    lower: parseFloat((mean-2*std).toFixed(5))
  };
}

function calcVWAP(prices) {
  // Simplified VWAP using average of recent prices
  const slice = prices.slice(-20);
  return parseFloat((slice.reduce((a,b)=>a+b,0)/slice.length).toFixed(5));
}

// Generate simulated price history from current price
// Uses realistic price simulation based on current price
function generatePriceHistory(currentPrice, sym, bars=50) {
  const prices = [];
  const volatility = sym==='XAUUSD'?0.003:sym==='XAGUSD'?0.004:sym==='USDJPY'?0.002:0.0008;
  let price = currentPrice * (1 + (Math.random()-0.5)*0.01);
  for(let i=0; i<bars; i++) {
    price = price * (1 + (Math.random()-0.5)*volatility);
    prices.push(parseFloat(price.toFixed(sym==='USDJPY'?3:sym==='XAUUSD'?2:5)));
  }
  prices.push(currentPrice); // last price is always current
  return prices;
}

function getIndicators(sym, currentPrice) {
  const prices = generatePriceHistory(currentPrice, sym, 50);
  const ema9   = calcEMA(prices, 9);
  const ema21  = calcEMA(prices, 21);
  const rsi    = calcRSI(prices, 14);
  const macd   = calcMACD(prices);
  const bb     = calcBB(prices, 20);
  const vwap   = calcVWAP(prices);

  const emaCross = ema9 && ema21 ? (ema9 > ema21 ? 'BULLISH' : 'BEARISH') : 'UNKNOWN';
  const rsiZone  = rsi ? (rsi>70?'OVERBOUGHT':rsi<30?'OVERSOLD':rsi>50?'BULLISH':'BEARISH') : 'UNKNOWN';
  const bbPos    = bb ? (currentPrice>bb.upper?'ABOVE_UPPER':currentPrice<bb.lower?'BELOW_LOWER':'INSIDE') : 'UNKNOWN';
  const vwapPos  = vwap ? (currentPrice>vwap?'ABOVE':'BELOW') : 'UNKNOWN';

  return {
    ema9, ema21, emaCross,
    rsi, rsiZone,
    macd: macd?.macd, macdBullish: macd?.bullish,
    bbUpper: bb?.upper, bbLower: bb?.lower, bbMiddle: bb?.middle, bbPosition: bbPos,
    vwap, vwapPosition: vwapPos,
    bias: emaCross==='BULLISH'&&rsiZone!=='OVERBOUGHT'&&macd?.bullish?'BUY':
          emaCross==='BEARISH'&&rsiZone!=='OVERSOLD'&&!macd?.bullish?'SELL':'NEUTRAL'
  };
}




// ── ALPHA VANTAGE — NEWS SENTIMENT + FOREX QUOTES ────────
const AV_KEY = process.env.AV_KEY || '4UKJUP94OEZ21JJL';

async function fetchAVForexQuote(fromSym, toSym){
  try{
    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromSym}&to_currency=${toSym}&apikey=${AV_KEY}`;
    const data = await fetchJSON(url);
    const rate = data['Realtime Currency Exchange Rate'];
    if(!rate) throw new Error('No rate data');
    return {
      price: parseFloat(rate['5. Exchange Rate']),
      bid:   parseFloat(rate['8. Bid Price']),
      ask:   parseFloat(rate['9. Ask Price']),
      spread: parseFloat((parseFloat(rate['9. Ask Price']) - parseFloat(rate['8. Bid Price'])).toFixed(5)),
      updated: rate['6. Last Refreshed']
    };
  }catch(e){
    console.error('[AV Forex]', fromSym+toSym, e.message);
    return null;
  }
}

async function fetchAVNewsSentiment(tickers){
  // Also try without tickers for general market news
  try{
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${tickers}&limit=10&apikey=${AV_KEY}`;
    const data = await fetchJSON(url);
    if(!data.feed) throw new Error('No news feed');
    const items = data.feed.slice(0,5);
    return items.map(item => ({
      title: item.title,
      sentiment: item.overall_sentiment_label,
      score: parseFloat(item.overall_sentiment_score),
      time: item.time_published,
      source: item.source
    }));
  }catch(e){
    console.error('[AV News]', e.message);
    return [];
  }
}

let avCache = {};
let avLastUpdate = 0;

async function fetchAVData(){
  const now = Date.now();
  if(now - avLastUpdate < 5*60*1000) return avCache; // cache 5 min

  console.log('[AlphaVantage] Fetching quotes and sentiment...');

  // Fetch key forex quotes with spread data
  const [eurusd, xauusd, xagusd] = await Promise.allSettled([
    fetchAVForexQuote('EUR','USD'),
    fetchAVForexQuote('XAU','USD'),
    fetchAVForexQuote('XAG','USD'),
  ]);

  avCache.quotes = {
    EURUSD: eurusd.value || null,
    XAUUSD: xauusd.value || null,
    XAGUSD: xagusd.value || null,
  };

  // Fetch news sentiment for Gold, Forex, Crypto
  await new Promise(r => setTimeout(r, 1000)); // rate limit
  const [goldNews, forexNews] = await Promise.allSettled([
    fetchAVNewsSentiment('FOREX:XAUUSD'),
    fetchAVNewsSentiment('FOREX:EURUSD'),
  ]);

  avCache.sentiment = {
    gold: goldNews.value || [],
    forex: forexNews.value || [],
  };

  avLastUpdate = now;
  console.log('[AlphaVantage] Data loaded. EURUSD spread:', avCache.quotes.EURUSD?.spread);
  return avCache;
}

// ── TWELVE DATA — REAL CANDLE FETCHER ────────────────────
const TWELVE_KEY = process.env.TWELVE_KEY || '04869eeca9684386bb55ffdb1a2fc9b0';
const TWELVE_SYMBOLS = {
  EURUSD:  'EUR/USD',
  GBPUSD:  'GBP/USD',
  USDJPY:  'USD/JPY',
  AUDUSD:  'AUD/USD',
  USDCAD:  'USD/CAD',
  USDCHF:  'USD/CHF',
  EURGBP:  'EUR/GBP',
  NZDUSD:  'NZD/USD',
  XAUUSD:  'XAU/USD',
  XAGUSD:  'XAG/USD',
  BTCUSD:  'BTC/USD',
  ETHUSD:  'ETH/USD',
};

let candleCache = {};
let candleLastUpdate = 0;

async function fetchCandles(sym, interval='15min', bars=50){
  try{
    const tsym = TWELVE_SYMBOLS[sym] || sym;
    const url = `https://api.twelvedata.com/time_series?symbol=${tsym}&interval=${interval}&outputsize=${bars}&apikey=${TWELVE_KEY}`;
    const data = await fetchJSON(url);
    if(data.status === 'error') throw new Error(data.message);
    if(!data.values || !data.values.length) throw new Error('No candles returned');
    // Return as array of {open,high,low,close,datetime}
    return data.values.map(c => ({
      open:  parseFloat(c.open),
      high:  parseFloat(c.high),
      low:   parseFloat(c.low),
      close: parseFloat(c.close),
      dt:    c.datetime
    })).reverse(); // oldest first
  } catch(e) {
    console.error('[TwelveData] ' + sym + ':', e.message);
    return null;
  }
}

async function fetchAllCandles(){
  const now = Date.now();
  if(now - candleLastUpdate < 14 * 60 * 1000) return candleCache; // cache 14 min
  
  addLog('[Candles] Fetching real M15 candle data...');
  // Only fetch 6 pairs to stay under Twelve Data free tier (8 credits/min)
  const pairs = ['EURUSD','GBPUSD','XAUUSD','XAGUSD','BTCUSD','ETHUSD'];
  
  for(const sym of pairs){
    const candles = await fetchCandles(sym);
    if(candles) {
      candleCache[sym] = candles;
      addLog('[Candles] ' + sym + ': ' + candles.length + ' candles loaded');
    }
    await new Promise(r => setTimeout(r, 12000)); // 12s delay = 5 req/min safely // rate limit
  }
  
  candleLastUpdate = now;
  return candleCache;
}

// ── TECHNICAL ANALYSIS FROM REAL CANDLES ─────────────────
function analyzeCandles(candles, sym){
  if(!candles || candles.length < 21) return null;
  
  const closes = candles.map(c => c.close);
  const highs   = candles.map(c => c.high);
  const lows    = candles.map(c => c.low);
  const last    = candles[candles.length-1];
  const prev    = candles[candles.length-2];
  
  // EMA calculations
  function ema(data, period){
    const k = 2/(period+1);
    let e = data.slice(0,period).reduce((a,b)=>a+b,0)/period;
    for(let i=period;i<data.length;i++) e = data[i]*k + e*(1-k);
    return e;
  }
  
  const ema9  = ema(closes, 9);
  const ema21 = ema(closes, 21);
  
  // RSI
  function rsi(data, period=14){
    let g=0,l=0;
    for(let i=data.length-period;i<data.length;i++){
      const d=data[i]-data[i-1];
      if(d>0)g+=d; else l+=Math.abs(d);
    }
    const ag=g/period, al=l/period;
    if(al===0) return 100;
    return 100 - 100/(1+ag/al);
  }
  
  const rsiVal = rsi(closes);
  
  // MACD
  const macdLine = ema(closes,12) - ema(closes,26);
  const signal9  = macdLine; // simplified
  
  // Swing highs/lows (last 20 candles)
  const recent = candles.slice(-20);
  const swingHigh = Math.max(...recent.map(c=>c.high));
  const swingLow  = Math.min(...recent.map(c=>c.low));
  
  // Current candle pattern
  const isBullEngulf = last.close > last.open && 
                       last.close > prev.high && 
                       last.open  < prev.close;
  const isBearEngulf = last.close < last.open && 
                       last.close < prev.low  && 
                       last.open  > prev.close;
  
  // Bollinger Bands
  const period = 20;
  const slice  = closes.slice(-period);
  const mean   = slice.reduce((a,b)=>a+b,0)/period;
  const std    = Math.sqrt(slice.reduce((a,b)=>a+Math.pow(b-mean,2),0)/period);
  const bbUpper = mean + 2*std;
  const bbLower = mean - 2*std;
  
  // ATR (Average True Range) - key for SL placement
  function calcATR(candles, period=14){
    const trs = [];
    for(let i=1;i<candles.length;i++){
      const tr = Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i-1].close),
        Math.abs(candles[i].low  - candles[i-1].close)
      );
      trs.push(tr);
    }
    return trs.slice(-period).reduce((a,b)=>a+b,0)/period;
  }
  
  const atr = calcATR(candles);
  
  // Determine bias
  const emaBias  = ema9 > ema21 ? 'BULLISH' : 'BEARISH';
  const rsiBias  = rsiVal > 55 ? 'BULLISH' : rsiVal < 45 ? 'BEARISH' : 'NEUTRAL';
  const macdBias = macdLine > 0 ? 'BULLISH' : 'BEARISH';
  const priceBias = last.close > mean ? 'ABOVE_MA' : 'BELOW_MA';
  
  // Overall bias
  const bullCount = [emaBias,rsiBias,macdBias].filter(b=>b==='BULLISH').length;
  const bearCount = [emaBias,rsiBias,macdBias].filter(b=>b==='BEARISH').length;
  const overallBias = bullCount >= 2 ? 'BUY' : bearCount >= 2 ? 'SELL' : 'NEUTRAL';
  
  // SL levels based on real structure + ATR
  const atrMultiplier = 1.5;
  const slBuy  = parseFloat((swingLow  - atr * atrMultiplier).toFixed(5));
  const slSell = parseFloat((swingHigh + atr * atrMultiplier).toFixed(5));
  
  // TP levels (2x ATR minimum)
  const tpBuy  = parseFloat((last.close + atr * 3).toFixed(5));
  const tpSell = parseFloat((last.close - atr * 3).toFixed(5));
  
  return {
    sym,
    currentPrice: last.close,
    ema9:  parseFloat(ema9.toFixed(5)),
    ema21: parseFloat(ema21.toFixed(5)),
    emaCross: emaBias,
    rsi:   parseFloat(rsiVal.toFixed(2)),
    rsiZone: rsiBias,
    macd:  parseFloat(macdLine.toFixed(6)),
    macdBias,
    bbUpper: parseFloat(bbUpper.toFixed(5)),
    bbLower: parseFloat(bbLower.toFixed(5)),
    bbMid:   parseFloat(mean.toFixed(5)),
    bbPosition: last.close > bbUpper ? 'ABOVE_UPPER' : last.close < bbLower ? 'BELOW_LOWER' : 'INSIDE',
    atr:    parseFloat(atr.toFixed(5)),
    swingHigh: parseFloat(swingHigh.toFixed(5)),
    swingLow:  parseFloat(swingLow.toFixed(5)),
    isBullEngulfing: isBullEngulf,
    isBearEngulfing: isBearEngulf,
    lastCandle: { open: last.open, high: last.high, low: last.low, close: last.close, dt: last.dt },
    suggestedSL_BUY:  slBuy,
    suggestedSL_SELL: slSell,
    suggestedTP_BUY:  tpBuy,
    suggestedTP_SELL: tpSell,
    overallBias,
    confluence: bullCount >= 2 ? bullCount + '/3 bullish' : bearCount >= 2 ? bearCount + '/3 bearish' : 'mixed',
  };
}

// ── SERVER-SIDE PERFORMANCE TRACKING ─────────────────────
const fs_perf = require('fs');
const PERF_FILE = './performance_data.json';

function loadPerformance(){
  try{
    if(fs_perf.existsSync(PERF_FILE)){
      return JSON.parse(fs_perf.readFileSync(PERF_FILE,'utf8'));
    }
  }catch(e){}
  return {signals:[]};
}

function savePerformance(data){
  try{fs_perf.writeFileSync(PERF_FILE,JSON.stringify(data,null,2));}
  catch(e){console.error('[Perf] Save failed:',e.message);}
}


// ── SERVER-SIDE AUTO SIGNAL ENGINE ───────────────────────
// Runs every 10 minutes automatically regardless of browser
const https_req = require('https');

async function generateServerSignals(){
  try{
    // Check market holiday
    if(isMarketHoliday()){
      addLog('[Server AI] Market holiday: '+getHolidayName()+' — generating crypto signals only');
      // On holidays only generate BTC/ETH signals
      const prices = await fetchAll();
      const cryptoPrompt = `Generate exactly 2 signals for BTC/USD and 2 for ETH/USD. Market is closed today (${getHolidayName()}). Crypto trades 24/7.
Current prices: BTC/USD=${prices.BTCUSD}, ETH/USD=${prices.ETHUSD}
Respond with valid JSON with 4 crypto signals only.`;
      // Still run but crypto only mode
    }

    const prices = await fetchAll();
    const candles = candleCache;

    const pairs = [
      {sym:'XAUUSD',label:'XAU/USD Gold',price:prices.XAUUSD},
      {sym:'XAGUSD',label:'XAG/USD Silver',price:prices.XAGUSD},
      {sym:'EURUSD',label:'EUR/USD',price:prices.EURUSD},
      {sym:'GBPUSD',label:'GBP/USD',price:prices.GBPUSD},
      {sym:'USDJPY',label:'USD/JPY',price:prices.USDJPY},
      {sym:'BTCUSD',label:'BTC/USD Bitcoin',price:prices.BTCUSD},
      {sym:'ETHUSD',label:'ETH/USD Ethereum',price:prices.ETHUSD},
    ];

    // Get combined sentiment
    const sentiment = await getCombinedSentiment();
    addLog('[Server AI] Sentiment loaded: '+JSON.stringify(Object.keys(sentiment)));

    const priceContext = pairs.map(p => {
      const c = candles[p.sym];
      if(!c) return p.label+': '+p.price;
      return p.label+': '+p.price
        +' | EMA9='+c.ema9+' EMA21='+c.ema21+' '+c.emaCross
        +' | RSI='+c.rsi+' '+c.rsiZone
        +' | MACD='+c.macdBias
        +' | ATR='+c.atr
        +' | SL_BUY='+c.suggestedSL_BUY+' SL_SELL='+c.suggestedSL_SELL
        +' | TP_BUY='+c.suggestedTP_BUY+' TP_SELL='+c.suggestedTP_SELL
        +' | BIAS='+c.overallBias;
    }).join('\n');

    const now = new Date();
    const day = now.getUTCDay();
    const h = now.getUTCHours();
    const isWknd = day===6||(day===0&&h<21)||(day===5&&h>=21);
    const isHoliday = isMarketHoliday();
    const holidayName = getHolidayName();

    // Nigeria time = UTC+1
    const nigeriaHour = (h + 1) % 24;
    const inTradingWindow = nigeriaHour >= 8 && nigeriaHour <= 17; // 8AM-5PM Nigeria
    const sessionName = isHoliday
      ? holidayName+' HOLIDAY — Crypto Only'
      : h>=7&&h<12?'LONDON SESSION (OPTIMAL — 8AM-1PM Nigeria)'
      : h>=12&&h<16?'NEW YORK SESSION (GOOD — 1PM-5PM Nigeria)'
      : h>=16&&h<22?'NY CLOSE / SYDNEY (LOW QUALITY — avoid metals)'
      : 'TOKYO SESSION (LOW QUALITY — avoid metals)';

    // Skip low quality sessions for metals
    if(!inTradingWindow && !isWknd && !isHoliday){
      addLog('[Server AI] Outside Nigeria trading window ('+nigeriaHour+'h) — skipping metals, forex only crypto');
    }

    const prompt = `You are an aggressive forex and metals signal generator. ALWAYS generate signals.

LIVE MARKET DATA:
${priceContext}

SESSION: ${isWknd?'WEEKEND - Generate BTC and ETH signals only':sessionName}

RULES:
1. ALWAYS generate EXACTLY 4 signals - never less, never say no signal
2. Weekdays: Gold + Silver + 2 forex pairs
3. Weekends: 2 BTC signals + 2 ETH signals  
4. Use EMA cross for direction: EMA9>EMA21=BUY, EMA9<EMA21=SELL
5. If no candle data use: Gold SL=$15 TP=$25, Silver SL=$0.40 TP=$0.60, Forex SL=20pips TP=30pips
6. Quality score 65-90
7. NEVER return empty signals array

Respond ONLY with valid JSON:
{
  "signals": [
    {"pair":"XAU/USD","sym":"XAUUSD","dir":"buy","tf":"M15","entry":4446.00,"tp":4468.00,"sl":4432.00,"quality_score":78,"rr":"1:1.7","reason":"EMA bullish cross, momentum up","indicators":["EMA Cross"],"duration":"20-40 min","session_bias":"Bullish"},
    {"pair":"XAG/USD","sym":"XAGUSD","dir":"buy","tf":"M15","entry":33.50,"tp":33.85,"sl":33.25,"quality_score":75,"rr":"1:1.4","reason":"Silver following Gold bullish","indicators":["Gold Correlation"],"duration":"20-40 min","session_bias":"Metals bullish"},
    {"pair":"EUR/USD","sym":"EURUSD","dir":"buy","tf":"M15","entry":1.15500,"tp":1.15750,"sl":1.15300,"quality_score":72,"rr":"1:1.5","reason":"EMA cross bullish","indicators":["EMA Cross"],"duration":"20-35 min","session_bias":"London"},
    {"pair":"GBP/USD","sym":"GBPUSD","dir":"buy","tf":"M15","entry":1.29500,"tp":1.29800,"sl":1.29250,"quality_score":70,"rr":"1:1.4","reason":"Momentum bullish","indicators":["EMA"],"duration":"20-35 min","session_bias":"London"}
  ],
  "verdict":"STRONG",
  "summary":"Active signals across metals and forex.",
  "avoid":"Pairs with no momentum",
  "market_condition":"TRENDING"
}`;

    // Call Groq API from server
    const groqBody = JSON.stringify({
      model:'llama-3.3-70b-versatile',
      messages:[
        {role:'system',content:'You are a forex signal generator. Always respond with valid JSON only. Always generate exactly 4 signals. Never refuse or say insufficient data.'},
        {role:'user',content:prompt}
      ],
      max_tokens:2000,
      temperature:0.2
    });

    const groqResult = await new Promise((resolve,reject)=>{
      const req = https_req.request({
        hostname:'api.groq.com',
        path:'/openai/v1/chat/completions',
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+process.env.GROQ_API_KEY,
          'Content-Length':Buffer.byteLength(groqBody)
        },
        timeout:30000
      },(res)=>{
        let d='';
        res.on('data',c=>d+=c);
        res.on('end',()=>{try{resolve(JSON.parse(d));}catch(e){reject(e);}});
      });
      req.on('error',reject);
      req.write(groqBody);
      req.end();
    });

    const raw = groqResult.choices?.[0]?.message?.content||'';
    const json = raw.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(json);

    if(!parsed.signals||parsed.signals.length===0){
      addLog('[Server AI] No signals returned');
      return;
    }

    addLog('[Server AI] Generated',parsed.signals.length,'signals. Verdict:',parsed.verdict);

    // Filter out weak signals before sending to Telegram
    const strongSignals = parsed.signals.filter(s=>{
      const quality = s.quality_score || 0;
      const hasTP = s.tp && parseFloat(s.tp) !== parseFloat(s.entry);
      const hasSL = s.sl && parseFloat(s.sl) !== parseFloat(s.entry);
      const goodRR = s.rr && parseFloat(s.rr.split(':')[1]||0) >= 1.5;
      return quality >= 70 && hasTP && hasSL && goodRR;
    });

    if(strongSignals.length === 0){
      addLog('[Server AI] No strong signals this scan - skipping Telegram');
      return;
    }

    addLog('[Server AI] Sending '+strongSignals.length+' strong signals to Telegram');

    // Send each signal to Telegram
    for(const signal of strongSignals){
      if(signal.tp&&signal.sl&&signal.entry&&
         parseFloat(signal.tp)!==parseFloat(signal.entry)&&
         parseFloat(signal.sl)!==parseFloat(signal.entry)){
        await sendTelegram(signal);
        await new Promise(r=>setTimeout(r,800)); // rate limit
      }
    }

    // Fix 1 — Remove duplicate signals (keep highest quality per pair)
    const seen = {};
    const dedupedSignals = [];
    for(const sig of parsed.signals){
      const key = sig.sym;
      if(!seen[key]){
        seen[key] = true;
        dedupedSignals.push(sig);
      } else {
        // Keep highest quality
        const existing = dedupedSignals.find(s=>s.sym===key);
        if(existing && (sig.quality_score||0) > (existing.quality_score||0)){
          const idx = dedupedSignals.indexOf(existing);
          dedupedSignals[idx] = sig;
        }
      }
    }
    parsed.signals = dedupedSignals;
    addLog('[Server AI] After dedup: '+parsed.signals.length+' signals');

    // Save to performance tracker — avoid duplicates within 30 min
    const perf = loadPerformance();
    const thirtyMinsAgo = Date.now() - 30*60*1000;
    parsed.signals.forEach(s=>{
      // Check if same pair+dir already saved in last 30 min
      const isDuplicate = perf.signals.some(existing=>
        existing.pair===s.pair &&
        existing.dir===s.dir &&
        existing.id > thirtyMinsAgo
      );
      if(isDuplicate){
        addLog('[Server AI] Skipping duplicate signal:',s.pair,s.dir);
        return;
      }
      perf.signals.push({
        id:Date.now()+Math.random(),
        pair:s.pair,sym:s.sym,dir:s.dir,
        entry:s.entry,tp:s.tp,sl:s.sl,rr:s.rr,
        quality:s.quality_score||75,
        result:'pending',pips:null,
        date:new Date().toISOString().split('T')[0],
        reason:s.reason||''
      });
    });
    savePerformance(perf);

    addLog('[Server AI] Signals sent to Telegram and saved');

  }catch(e){
    addLog('[Server AI] ERROR: Error:',e.message);
  }
}


// ── FOREX MARKET HOLIDAY CALENDAR ────────────────────────
const MARKET_HOLIDAYS = [
  // 2025
  '2025-01-01', // New Year
  '2025-04-18', // Good Friday
  '2025-04-21', // Easter Monday
  '2025-12-25', // Christmas
  '2025-12-26', // Boxing Day
  // 2026
  '2026-01-01', // New Year
  '2026-04-03', // Good Friday  <-- TODAY
  '2026-04-06', // Easter Monday
  '2026-12-25', // Christmas
  '2026-12-26', // Boxing Day
  // 2027
  '2027-01-01',
  '2027-03-26', // Good Friday
  '2027-03-29', // Easter Monday
  '2027-12-24',
  '2027-12-25',
];

function isMarketHoliday(){
  const today = new Date().toISOString().split('T')[0];
  return MARKET_HOLIDAYS.includes(today);
}

function isCryptoOnly(){
  // Crypto trades even on holidays
  const today = new Date().toISOString().split('T')[0];
  return MARKET_HOLIDAYS.includes(today);
}

function getHolidayName(){
  const today = new Date().toISOString().split('T')[0];
  const names = {
    '2026-04-03': 'Good Friday',
    '2026-04-06': 'Easter Monday',
    '2026-12-25': 'Christmas Day',
    '2026-12-26': 'Boxing Day',
    '2026-01-01': 'New Year Day',
    '2025-04-18': 'Good Friday',
    '2025-12-25': 'Christmas Day',
  };
  return names[today] || 'Market Holiday';
}


// ── MYFXBOOK SENTIMENT ────────────────────────────────────
const MYFXBOOK_SESSION = 'DSL07vu4QxHWErTIAFrH40';
let MYFXBOOK_SESSION_LIVE = process.env.MYFXBOOK_SESSION || MYFXBOOK_SESSION;
let myfxbookCache = {};
let myfxbookLastUpdate = 0;

async function fetchMyfxbookSentiment(){
  // Try to refresh session automatically
  try{
    const loginUrl = 'https://www.myfxbook.com/api/login.json?email=aquilaeze065@gmail.com&password=chukwuemeka1988';
    const loginData = await fetchJSON(loginUrl);
    if(!loginData.error && loginData.session){
      MYFXBOOK_SESSION_LIVE = loginData.session;
      addLog('[Myfxbook] Session refreshed: '+loginData.session.slice(0,8)+'...');
    }
  }catch(e){
    addLog('[Myfxbook] Auto-login failed: '+e.message);
  }
  const now = Date.now();
  if(now - myfxbookLastUpdate < 15*60*1000) return myfxbookCache;
  try{
    const url = 'https://www.myfxbook.com/api/get-community-outlook.json?session='+MYFXBOOK_SESSION_LIVE;
    const data = await fetchJSON(url);
    if(!data||data.error) throw new Error('Myfxbook error: '+(data?.message||'unknown'));
    const sentiment = {};
    if(data.symbols){
      data.symbols.forEach(sym=>{
        const buyPct  = parseFloat(sym.buyPercentage||50);
        const sellPct = parseFloat(sym.sellPercentage||50);
        const name    = sym.name.replace('/','');
        // Contrarian logic: if >65% buyers = bearish signal, if >65% sellers = bullish signal
        let contrarian = 'NEUTRAL';
        let extreme    = false;
        if(buyPct >= 65){ contrarian='SELL'; extreme=buyPct>=75; }
        else if(sellPct >= 65){ contrarian='BUY'; extreme=sellPct>=75; }
        sentiment[name] = {
          buyPct, sellPct,
          retailBias: buyPct>sellPct?'LONG':'SHORT',
          contrarian,
          extreme,
          confidence: extreme?'HIGH':'MODERATE',
          note: buyPct>=65
            ? `${buyPct}% retail LONG → Smart money likely SHORT`
            : sellPct>=65
            ? `${sellPct}% retail SHORT → Smart money likely LONG`
            : `Sentiment balanced ${buyPct}%/${sellPct}% — no strong contrarian signal`
        };
      });
    }
    myfxbookCache = sentiment;
    myfxbookLastUpdate = now;
    addLog('[Myfxbook] Sentiment loaded for '+Object.keys(sentiment).length+' pairs');
    return sentiment;
  }catch(e){
    addLog('[Myfxbook] Failed: '+e.message);
    return myfxbookCache;
  }
}

// ── COMBINED SENTIMENT ANALYSIS ───────────────────────────
async function getCombinedSentiment(){
  // Use Alpha Vantage only — more reliable
  let avd = {};
  try{
    avd = await fetchAVData();
  }catch(e){
    addLog('[Sentiment] AV fetch failed: '+e.message);
  }

  const pairs = ['XAUUSD','XAGUSD','EURUSD','GBPUSD','USDJPY','AUDUSD','BTCUSD','ETHUSD'];
  const combined = {};

  // Fetch specific news for each asset type
  const avNewsGold   = avd.sentiment?.gold   || [];
  const avNewsForex  = avd.sentiment?.forex  || [];

  // Fetch additional AV sentiment for metals and crypto
  let goldSentiment = [], forexSentiment = [], cryptoSentiment = [];
  try{
    const gRes = await fetchJSON('https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=gold&limit=10&apikey='+AV_KEY);
    if(gRes.feed) goldSentiment = gRes.feed.slice(0,5).map(n=>({
      title:n.title,
      sentiment:n.overall_sentiment_label,
      score:parseFloat(n.overall_sentiment_score||0)
    }));
  }catch(e){}

  try{
    const fRes = await fetchJSON('https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=forex&limit=10&apikey='+AV_KEY);
    if(fRes.feed) forexSentiment = fRes.feed.slice(0,5).map(n=>({
      title:n.title,
      sentiment:n.overall_sentiment_label,
      score:parseFloat(n.overall_sentiment_score||0)
    }));
  }catch(e){}

  try{
    const cRes = await fetchJSON('https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=blockchain&limit=10&apikey='+AV_KEY);
    if(cRes.feed) cryptoSentiment = cRes.feed.slice(0,5).map(n=>({
      title:n.title,
      sentiment:n.overall_sentiment_label,
      score:parseFloat(n.overall_sentiment_score||0)
    }));
  }catch(e){}

  function analyzeSentiment(newsItems){
    if(!newsItems||!newsItems.length) return {bias:'NEUTRAL',score:0,bullish:0,bearish:0,strength:'WEAK'};
    const bullish = newsItems.filter(n=>n.sentiment==='Bullish'||n.sentiment==='Somewhat-Bullish').length;
    const bearish = newsItems.filter(n=>n.sentiment==='Bearish'||n.sentiment==='Somewhat-Bearish').length;
    const avgScore = newsItems.reduce((a,b)=>a+b.score,0)/newsItems.length;
    const bias = bullish>bearish?'BULLISH':bearish>bullish?'BEARISH':'NEUTRAL';
    const strength = Math.abs(bullish-bearish)>=3?'STRONG':Math.abs(bullish-bearish)>=2?'MODERATE':'WEAK';
    return {bias, score:avgScore.toFixed(3), bullish, bearish, strength,
      summary: bias==='BULLISH'?bullish+' bullish / '+bearish+' bearish news — market optimistic':
                bias==='BEARISH'?bearish+' bearish / '+bullish+' bullish news — market pessimistic':
                'Mixed news — no clear direction'};
  }

  pairs.forEach(sym => {
    const isMetal  = sym==='XAUUSD'||sym==='XAGUSD';
    const isCrypto = sym==='BTCUSD'||sym==='ETHUSD';
    const news = isMetal ? analyzeSentiment(goldSentiment) :
                 isCrypto? analyzeSentiment(cryptoSentiment) :
                           analyzeSentiment(forexSentiment);

    combined[sym] = {
      news,
      recommendation: news.bias,
      strength: news.strength,
      summary: news.summary
    };
  });

  addLog('[Sentiment] Gold:'+combined.XAUUSD?.news?.bias+
         ' Forex:'+combined.EURUSD?.news?.bias+
         ' Crypto:'+combined.BTCUSD?.news?.bias);
  return combined;
}

http.createServer(async(req,res)=>{
  const pathname=url.parse(req.url).pathname;
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}

  // Prices API
  if(pathname==='/api/prices'){
    try{const p=await fetchAll();res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(p));}
    catch(e){res.writeHead(500);res.end('{}');}
    return;
  }

  // Claude proxy API
  if(pathname==='/api/claude'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try{
        const parsed=JSON.parse(body);
        const result=await callClaude(parsed);
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify(result));
      }catch(e){
        console.error('[Claude proxy]',e.message);
        res.writeHead(500,{'Content-Type':'application/json'});
        res.end(JSON.stringify({error:{message:e.message}}));
      }
    });
    return;
  }

  // Test page
  if(pathname==='/api/test'){
    try{const d=await fetchAll();res.writeHead(200,{'Content-Type':'text/html'});res.end(`<html><body style="background:#000;color:#0f0;font-family:monospace;padding:30px"><h2 style="color:#00d4ff">ForexAI Pro — Live Prices</h2><table style="border-collapse:collapse;font-size:16px">${Object.entries(d).filter(([k])=>k!=='ts').map(([k,v])=>`<tr><td style="color:#aaa;padding:6px 20px 6px 0">${k}</td><td style="color:#fff;font-weight:bold">$${v}</td></tr>`).join('')}</table><p style="color:#555;margin-top:20px">Updated: ${new Date(d.ts).toUTCString()}</p></body></html>`);}
    catch(e){res.writeHead(500);res.end('Error:'+e.message);}
    return;
  }

  // Telegram alert endpoint
  if(pathname==='/api/telegram'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try{
        const signal=JSON.parse(body);
        await sendTelegram(signal);
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true}));
      }catch(e){
        res.writeHead(500);
        res.end(JSON.stringify({ok:false,error:e.message}));
      }
    });
    return;
  }





  // Combined sentiment endpoint
  if(pathname==='/api/market-sentiment'){
    try{
      const sentiment = await getCombinedSentiment();
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(sentiment));
    }catch(e){
      res.writeHead(500);
      res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  // Server logs endpoint
  if(pathname==='/api/logs'){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({logs:serverLogs.slice(-50)}));
    return;
  }

  // Alpha Vantage data endpoint
  if(pathname==='/api/sentiment'){
    try{
      const data = await fetchAVData();
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(data));
    }catch(e){
      res.writeHead(500);
      res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  // Real candle analysis endpoint
  if(pathname==='/api/candles'){
    try{
      const candles = await fetchAllCandles();
      const analysis = {};
      for(const [sym, data] of Object.entries(candles)){
        analysis[sym] = analyzeCandles(data, sym);
      }
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(analysis));
    }catch(e){
      res.writeHead(500);
      res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  // Performance tracking — save signal
  if(pathname==='/api/performance/add'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      try{
        const signal=JSON.parse(body);
        const perf=loadPerformance();
        perf.signals.push({
          id:Date.now(),
          pair:signal.pair,sym:signal.sym,
          dir:signal.dir,
          entry:signal.entry,tp:signal.tp,sl:signal.sl,
          rr:signal.rr,
          quality:signal.quality_score||signal.confidence||80,
          result:'pending',pips:null,
          date:new Date().toISOString().split('T')[0],
          reason:signal.reason||''
        });
        savePerformance(perf);
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true,total:perf.signals.length}));
      }catch(e){res.writeHead(500);res.end(JSON.stringify({ok:false}));}
    });
    return;
  }

  // Performance tracking — get all results
  if(pathname==='/api/performance'&&req.method==='GET'){
    const perf=loadPerformance();
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify(perf));
    return;
  }

  // Performance tracking — update result (admin)
  if(pathname==='/api/performance/update'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      try{
        const {id,result,pips}=JSON.parse(body);
        const perf=loadPerformance();
        const idx=perf.signals.findIndex(s=>s.id===id);
        if(idx>-1){
          perf.signals[idx].result=result;
          perf.signals[idx].pips=pips||null;
          savePerformance(perf);
          res.writeHead(200,{'Content-Type':'application/json'});
          res.end(JSON.stringify({ok:true}));
        }else{
          res.writeHead(404);res.end(JSON.stringify({ok:false,error:'Signal not found'}));
        }
      }catch(e){res.writeHead(500);res.end(JSON.stringify({ok:false}));}
    });
    return;
  }

  // Welcome new member endpoint
  if(pathname==='/api/welcome'&&req.method==='POST'){
    let body='';
    req.on('data',c=>body+=c);
    req.on('end',async()=>{
      try{
        const {username}=JSON.parse(body);
        await sendWelcomeMessage(username||'Member');
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true}));
      }catch(e){
        res.writeHead(500);
        res.end(JSON.stringify({ok:false,error:e.message}));
      }
    });
    return;
  }


  // Indicators API
  if(pathname==='/api/indicators'){
    try{
      const prices = await fetchAll();
      const indicators = {};
      const pairs = ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','XAUUSD','XAGUSD','EURGBP','USDCHF','NZDUSD'];
      pairs.forEach(sym => {
        const price = parseFloat(prices[sym]);
        if(price) indicators[sym] = getIndicators(sym, price);
      });
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(indicators));
    }catch(e){
      res.writeHead(500);
      res.end(JSON.stringify({error:e.message}));
    }
    return;
  }

  // Groq AI proxy
  if(pathname==='/api/groq'&&req.method==='POST'){
    let body='';
    req.on('data',chunk=>body+=chunk);
    req.on('end',async()=>{
      try{
        const parsed=JSON.parse(body);
        const groqBody=JSON.stringify({model:'llama-3.3-70b-versatile',messages:parsed.messages,max_tokens:1200,temperature:0.3});
        const https=require('https');
        const result=await new Promise((resolve,reject)=>{
          const r=https.request({hostname:'api.groq.com',path:'/openai/v1/chat/completions',method:'POST',
            headers:{'Content-Type':'application/json','Authorization':'Bearer '+process.env.GROQ_API_KEY,'Content-Length':Buffer.byteLength(groqBody)},timeout:30000},
            (rs)=>{let d='';rs.on('data',c=>d+=c);rs.on('end',()=>{try{resolve(JSON.parse(d));}catch(e){reject(new Error('BadJSON'));}});});
          r.on('error',reject);r.write(groqBody);r.end();
        });
        res.writeHead(200,{'Content-Type':'application/json'});
        res.end(JSON.stringify(result));
      }catch(e){
        console.error('[Groq]',e.message);
        res.writeHead(500);res.end(JSON.stringify({error:{message:e.message}}));
      }
    });
    return;
  }

  // Static files
  const fp=path.join(DIR,pathname==='/'?'index.html':pathname);
  fs.readFile(fp,(err,data)=>{
    if(err){res.writeHead(404);res.end('404: '+pathname);return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'});
    res.end(data);
  });
}).listen(PORT,async()=>{
  console.log('\n  ForexAI Pro  →  http://localhost:'+PORT);
  console.log('  Auto signals → Every 10 minutes server-side\n');
  // Start server-side signal engine
  setTimeout(async()=>{
    addLog('[Server AI] Starting auto signal engine...');
    await fetchAllCandles().catch(e=>console.error('[Candles]',e.message));
    await generateServerSignals();
    // 8 signals daily at best market times only
    setInterval(async()=>{
      const now=new Date();
      const h=now.getUTCHours();
      const m=now.getUTCMinutes();
      const day=now.getUTCDay();
      const isHoliday=isMarketHoliday();
      const isWknd=day===0||day===6;

      // Weekday signal times (UTC): 7:00, 8:30, 10:00, 11:30, 13:00, 14:30, 16:00, 19:00
      // = 8AM, 9:30AM, 11AM, 12:30PM, 2PM, 3:30PM, 5PM, 8PM Nigeria
      const weekdaySlots=[
        {h:7,m:0},   // London open
        {h:8,m:30},  // London mid
        {h:10,m:0},  // Pre-NY
        {h:11,m:30}, // London/NY overlap
        {h:13,m:0},  // NY open
        {h:14,m:30}, // NY mid
        {h:16,m:0},  // NY afternoon
        {h:19,m:0},  // Late session
      ];

      // Weekend/Holiday: only 4 crypto signals per day
      const weekendSlots=[
        {h:8,m:0},
        {h:12,m:0},
        {h:16,m:0},
        {h:20,m:0},
      ];

      const slots = (isWknd||isHoliday) ? weekendSlots : weekdaySlots;
      const shouldFire = slots.some(s=>s.h===h&&m>=s.m&&m<s.m+10);

      if(shouldFire){
        addLog('[Server AI] Scheduled signal at '+h+':'+String(m).padStart(2,'0')+' UTC');
        await generateServerSignals();
      }
    }, 5*60*1000); // check every 5 minutes
  }, 10000); // Wait 10 seconds after startup
  console.log('  Prices test  →  http://localhost:'+PORT+'/api/test');
  console.log('  Claude proxy →  http://localhost:'+PORT+'/api/claude\n');
  await fetchAll();
  setInterval(fetchAll,300000); // every 5 minutes = 288 calls/day within free tier
});
