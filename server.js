const { sendTelegram, sendTelegramText, sendWelcomeMessage } = require('./telegram');
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),url=require('url');
const PORT=8080,DIR=__dirname;
const MIME={'.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.ico':'image/x-icon'};
let cache={prices:null,lastUpdate:0};
const TROY=31.1035;
function fixMetal(v,min,max){const n=parseFloat(v);if(n>=min&&n<=max)return n;const c=n*TROY;if(c>=min&&c<=max)return c;return null;}
function fetchJSON(u){return new Promise((res,rej)=>{const r=https.get(u,{headers:{'User-Agent':'Mozilla/5.0'},timeout:8000},(rs)=>{let d='';rs.on('data',c=>d+=c);rs.on('end',()=>{try{res(JSON.parse(d))}catch(e){rej(new Error('BadJSON:'+d.slice(0,60)))}});});r.on('error',rej);r.on('timeout',()=>{r.destroy();rej(new Error('Timeout'));});});}

async function fetchAll(){
  const now=Date.now();
  if(cache.prices&&now-cache.lastUpdate<15000)return cache.prices;
  const p={};
  try{const d=await fetchJSON('https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,AUD,CAD,CHF,NZD');const r=d.rates;p.EURUSD=(1/r.EUR).toFixed(5);p.GBPUSD=(1/r.GBP).toFixed(5);p.USDJPY=r.JPY.toFixed(3);p.AUDUSD=(1/r.AUD).toFixed(5);p.USDCAD=r.CAD.toFixed(5);p.USDCHF=r.CHF.toFixed(5);p.NZDUSD=(1/r.NZD).toFixed(5);p.EURGBP=(r.GBP/r.EUR).toFixed(5);console.log('[Forex] EUR:'+p.EURUSD+' GBP:'+p.GBPUSD+' JPY:'+p.USDJPY);}catch(e){console.error('[Forex]',e.message);if(cache.prices)['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD','USDCHF','NZDUSD','EURGBP'].forEach(k=>{if(cache.prices[k])p[k]=cache.prices[k];});}
  try{
    const gd=await fetchJSON('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD');
    if(gd&&gd[0]&&gd[0].spreadProfilePrices){
      const bid=gd[0].spreadProfilePrices[0].bid;
      const ask=gd[0].spreadProfilePrices[0].ask;
      p.XAUUSD=((bid+ask)/2).toFixed(2);
      console.log('[Gold RT] $'+p.XAUUSD);
    }else throw new Error('no price');
  }catch(e){
    console.error('[Gold RT failed]',e.message);
    p.XAUUSD=cache.prices?.XAUUSD||'4497.00';
    console.log('[Gold] using cached $'+p.XAUUSD);
  }
  try{
    const sd=await fetchJSON('https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAG/USD');
    if(sd&&sd[0]&&sd[0].spreadProfilePrices){
      const bid=sd[0].spreadProfilePrices[0].bid;
      const ask=sd[0].spreadProfilePrices[0].ask;
      p.XAGUSD=((bid+ask)/2).toFixed(3);
      console.log('[Silver RT] $'+p.XAGUSD);
    }else throw new Error('no price');
  }catch(e){
    p.XAGUSD=cache.prices?.XAGUSD||(parseFloat(p.XAUUSD||'4497')/66).toFixed(3);
    console.log('[Silver] fallback $'+p.XAGUSD);
  }
  p.ts=now;cache.prices=p;cache.lastUpdate=now;
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



// ── TWELVE DATA — REAL CANDLE FETCHER ────────────────────
const TWELVE_KEY = '04869eeca9684386bb55ffdb1a2fc9b0';
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
  
  console.log('[Candles] Fetching real M15 candle data...');
  const pairs = ['EURUSD','GBPUSD','USDJPY','XAUUSD','XAGUSD','AUDUSD'];
  
  for(const sym of pairs){
    const candles = await fetchCandles(sym);
    if(candles) {
      candleCache[sym] = candles;
      console.log('[Candles] ' + sym + ': ' + candles.length + ' candles loaded');
    }
    await new Promise(r => setTimeout(r, 500)); // rate limit
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
  console.log('  Prices test  →  http://localhost:'+PORT+'/api/test');
  console.log('  Claude proxy →  http://localhost:'+PORT+'/api/claude\n');
  await fetchAll();
  setInterval(fetchAll,15000);
});
