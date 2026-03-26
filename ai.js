function isMarketOpen(){
  const now=new Date(),day=now.getUTCDay(),h=now.getUTCHours(),m=now.getUTCMinutes(),t=h*60+m;
  if(day===6)return false;
  if(day===0&&t<21*60)return false;
  if(day===5&&t>=21*60)return false;
  return true;
}
function getMarketClosedMessage(){
  const now=new Date(),day=now.getUTCDay();
  const next=new Date(now);
  const d=(7-day)%7||7;
  next.setUTCDate(next.getUTCDate()+(day===0?0:d));
  next.setUTCHours(21,0,0,0);
  if(day===0&&now.getUTCHours()<21)next.setUTCDate(now.getUTCDate());
  const diff=next-now,hh=Math.floor(diff/3600000),mm=Math.floor((diff%3600000)/60000);
  return 'Market closed for weekend. Opens in '+hh+'h '+mm+'m (Sunday 9PM UTC)';
}
function getSession(){
  const h=new Date().getUTCHours();
  if(h>=22||h<7)return{name:'SYDNEY SESSION',color:'var(--gold)',quality:'LOW'};
  if(h>=7&&h<12)return{name:'LONDON SESSION',color:'var(--green)',quality:'OPTIMAL'};
  if(h>=12&&h<17)return{name:'NEW YORK SESSION',color:'var(--blue)',quality:'GOOD'};
  return{name:'TOKYO SESSION',color:'var(--gold)',quality:'MODERATE'};
}
function updateSessionBadge(){
  const el=document.getElementById('sessionBadge');
  const s=getSession();
  if(!isMarketOpen()){
    if(el){el.textContent='MARKET CLOSED';el.style.color='var(--red)';}
    const c=document.getElementById('scalpCondition');
    if(c){c.textContent='CLOSED';c.style.color='var(--red)';}
    return;
  }
  if(el){el.textContent=s.name;el.style.color=s.color;}
  const c=document.getElementById('scalpCondition');
  if(c)c.textContent=s.quality;
}
const NEWS_EVENTS=[{name:'USD CPI',utcH:13,utcM:30},{name:'EUR ECB',utcH:14,utcM:0},{name:'GBP GDP',utcH:9,utcM:0},{name:'USD NFP',utcH:13,utcM:30},{name:'FOMC',utcH:19,utcM:0},{name:'JPY BOJ',utcH:3,utcM:0}];
function updateNewsCountdown(){
  const cdEl=document.getElementById('newsCountdown'),nameEl=document.getElementById('newsEventName');
  if(!cdEl||!nameEl)return;
  const now=Date.now();let best=null,minDiff=Infinity;
  NEWS_EVENTS.forEach(ev=>{
    const d=new Date();d.setUTCHours(ev.utcH,ev.utcM,0,0);
    if(d<=now)d.setUTCDate(d.getUTCDate()+1);
    const diff=d-now;if(diff<minDiff){minDiff=diff;best={...ev,ms:diff};}
  });
  if(best){
    const h=Math.floor(best.ms/3600000),m=Math.floor((best.ms%3600000)/60000);
    cdEl.textContent=h+'h '+m+'m';
    nameEl.textContent=best.name+' — avoid 5min before';
  }
}
async function buildPriceContext(){
  if(typeof PRICES==='undefined')return'prices loading...';
  let candles={};
  try{
    const res=await fetch('/api/candles');
    candles=await res.json();
    console.log('[Candles] Loaded for',Object.keys(candles).length,'pairs');
  }catch(e){console.warn('[Candles] Failed:',e.message);}

  // Fetch Alpha Vantage sentiment + spread data
  let avData={};
  try{
    const avRes=await fetch('/api/sentiment');
    avData=await avRes.json();
    console.log('[AV] Sentiment and spread data loaded');
  }catch(e){console.warn('[AV] Failed:',e.message);}
  const pairs=[
    {sym:'EURUSD',label:'EUR/USD',price:PRICES.EURUSD},
    {sym:'GBPUSD',label:'GBP/USD',price:PRICES.GBPUSD},
    {sym:'USDJPY',label:'USD/JPY',price:PRICES.USDJPY},
    {sym:'AUDUSD',label:'AUD/USD',price:PRICES.AUDUSD},
    {sym:'USDCAD',label:'USD/CAD',price:PRICES.USDCAD},
    {sym:'XAUUSD',label:'XAU/USD Gold',price:PRICES.XAUUSD},
    {sym:'XAGUSD',label:'XAG/USD Silver',price:PRICES.XAGUSD},
    {sym:'EURGBP',label:'EUR/GBP',price:PRICES.EURGBP},
    {sym:'BTCUSD',label:'BTC/USD Bitcoin',price:PRICES.BTCUSD},
    {sym:'ETHUSD',label:'ETH/USD Ethereum',price:PRICES.ETHUSD},
  ];
  // Build sentiment summary
  const goldSentiment = avData.sentiment?.gold?.slice(0,3).map(n=>n.sentiment+' ('+n.score.toFixed(2)+')').join(', ') || 'No data';
  const forexSentiment = avData.sentiment?.forex?.slice(0,3).map(n=>n.sentiment+' ('+n.score.toFixed(2)+')').join(', ') || 'No data';
  const eurusdSpread = avData.quotes?.EURUSD?.spread || 'unknown';
  const goldSpread = avData.quotes?.XAUUSD?.spread || 'unknown';

  const sentimentContext = '\nMARKET SENTIMENT (Alpha Vantage News):'
    +'\n  Gold/XAU News Sentiment: '+goldSentiment
    +'\n  Forex News Sentiment: '+forexSentiment
    +'\n  EUR/USD Current Spread: '+eurusdSpread+' (trade only if spread < 0.0003)'
    +'\n  Gold Current Spread: $'+goldSpread+' (trade only if spread < 1.0)';

  return pairs.map(p=>{
    const c=candles[p.sym];
    if(!c)return p.label+': '+p.price+' (no candle data)';
    return p.label+': '+p.price+'\n'
      +'  EMA9='+c.ema9+' EMA21='+c.ema21+' -> '+c.emaCross+'\n'
      +'  RSI='+c.rsi+' ('+c.rsiZone+')\n'
      +'  MACD='+c.macd+' ('+c.macdBias+')\n'
      +'  BB: Upper='+c.bbUpper+' Lower='+c.bbLower+' Position='+c.bbPosition+'\n'
      +'  ATR='+c.atr+'\n'
      +'  SwingHigh='+c.swingHigh+' SwingLow='+c.swingLow+'\n'
      +'  SuggestedSL_BUY='+c.suggestedSL_BUY+' SL_SELL='+c.suggestedSL_SELL+'\n'
      +'  SuggestedTP_BUY='+c.suggestedTP_BUY+' TP_SELL='+c.suggestedTP_SELL+'\n'
      +'  LastCandle: O='+c.lastCandle.open+' H='+c.lastCandle.high+' L='+c.lastCandle.low+' C='+c.lastCandle.close+'\n'
      +'  Pattern: '+(c.isBullEngulfing?'BULL_ENGULF':c.isBearEngulfing?'BEAR_ENGULF':'none')+'\n'
      +'  Confluence: '+c.confluence+' BIAS='+c.overallBias;
  }).join('\n\n') + sentimentContext;
}
let aiRunning=false,lastAIRun=0,totalSignals=0;
async function generateAISignals(forced=false){
  const now=Date.now();
  if(aiRunning)return;
  if(!forced&&now-lastAIRun<15*60*1000)return;
  aiRunning=true;lastAIRun=now;
  const btn=document.getElementById('generateBtn');
  const output=document.getElementById('aiOutput');
  const aiText=document.getElementById('aiText');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Analyzing Markets...';}
  if(output)output.style.display='block';
  if(aiText)aiText.innerHTML='<span style="color:var(--text2);font-size:11px">Loading real candle data and calculating indicators...</span>';
  if(!isMarketOpen()){
    const msg=getMarketClosedMessage();
    if(aiText)aiText.innerHTML='<div style="text-align:center;padding:20px"><div style="font-size:32px">🔴</div><div style="color:var(--red);font-family:var(--mono);font-size:12px;font-weight:700;margin:8px 0">MARKET CLOSED</div><div style="color:var(--text2);font-size:11px">'+msg+'</div></div>';
    if(btn){btn.disabled=false;btn.innerHTML='✦ Generate AI Signals';}
    aiRunning=false;return;
  }
  const session=getSession();
  const prices=await buildPriceContext();
  const prompt=`You are an elite professional forex scalping analyst with access to REAL M15 candle data.

LIVE PRICES + REAL M15 CANDLE ANALYSIS:
${prices}

ACTIVE SESSION: ${session.name} (${session.quality})

ASSET TYPES AND SL RULES:
- Forex pairs: SL minimum 20 pips
- Gold (XAUUSD): SL minimum $15
- Silver (XAGUSD): SL minimum $0.40
- Bitcoin (BTCUSD): SL minimum $200, TP minimum $400 (crypto is volatile!)
- Ethereum (ETHUSD): SL minimum $30, TP minimum $60
- Crypto trades 24/7 — always active regardless of session
- For crypto: wider SL is better — BTC can wick $100+ in minutes

SIGNAL RULES:
1. Generate signal if AT LEAST 3 of 5 indicators align (not all 5)
2. For Gold and Silver — generate if 2 of 5 align (metals trend strongly)
3. USE the SuggestedSL and SuggestedTP values provided — ATR-based from real swing levels
4. Minimum RR 1:1.5 (not 1:2 — be more flexible)
5. Quality score 65+ to generate (not 75+)
6. During news events — INCREASE signal priority, news creates strong moves
7. If RSI is extreme (>70 or <30) — still generate if EMA and MACD confirm
8. NEUTRAL bias can still generate if 2+ other indicators confirm direction
9. For crypto (BTC/ETH) — generate if trend and momentum align, crypto moves fast

Respond ONLY with valid JSON:
{
  "signals": [
    {
      "pair": "XAU/USD",
      "sym": "XAUUSD",
      "dir": "buy",
      "tf": "M15",
      "entry": 4435.50,
      "tp": 4452.00,
      "sl": 4422.00,
      "quality_score": 82,
      "rr": "1:1.8",
      "reason": "EMA9 above EMA21, Gold bullish momentum, ATR-based SL beyond swing low at 4422",
      "indicators": ["EMA Cross","ATR SL","Swing Low"],
      "duration": "20-40 min",
      "session_bias": "Gold bullish"
    },
    {
      "pair": "EUR/USD",
      "sym": "EURUSD",
      "dir": "buy",
      "tf": "M15",
      "entry": 1.15573,
      "tp": 1.15789,
      "sl": 1.15242,
      "quality_score": 78,
      "rr": "1:1.8",
      "reason": "EMA9 above EMA21, RSI 54 rising, ATR-based SL beyond swing low",
      "indicators": ["EMA Cross","RSI 54","ATR SL"],
      "duration": "20-35 min",
      "session_bias": "London bullish"
    }
  ],
  "verdict": "STRONG",
  "summary": "Clear setup on EUR/USD with full confluence.",
  "avoid": "Pairs with mixed confluence",
  "market_condition": "TRENDING"
}

If truly NO signals (all indicators completely against each other):
{"signals":[],"verdict":"NO SIGNAL","summary":"Waiting for better setup.","avoid":"All pairs","market_condition":"CHOPPY"}

Remember: It is BETTER to generate a moderate signal than to say NO SIGNAL when there is clear directional movement on any pair especially Gold and Silver.`;

  try{
    const res=await fetch('/api/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'You are a professional forex scalping AI. Always respond with valid JSON only, no markdown.'},{role:'user',content:prompt}]})});
    const data=await res.json();
    if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
    const raw=data.choices?.[0]?.message?.content||'';
    const json=raw.replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(json);
    if(parsed.verdict==='NO SIGNAL'||!parsed.signals||parsed.signals.length===0){
      if(aiText)aiText.innerHTML='<div style="text-align:center;padding:20px"><div style="font-size:32px">⏳</div><div style="font-family:var(--mono);font-size:13px;color:var(--gold);font-weight:700;margin:8px 0">NO STRONG SIGNALS</div><div style="font-size:12px;color:var(--text2);line-height:1.7">'+(parsed.summary||'Market conditions not ideal.')+'</div><div style="font-size:11px;color:var(--red);margin-top:8px">Avoid: '+(parsed.avoid||'All pairs')+'</div></div>';
      const vEl=document.getElementById('aiVerdict');
      if(vEl){vEl.textContent='NO SIGNAL';vEl.className='intel-val red';}
      if(btn){btn.disabled=false;btn.innerHTML='✦ Generate AI Signals';}
      aiRunning=false;return;
    }
    renderAISignals(parsed);
    if(typeof window.buildSignalList!=='undefined')window.buildSignalList(parsed.signals);
    const validSignals=parsed.signals.filter(s=>s.tp&&s.sl&&s.entry&&parseFloat(s.tp)!==parseFloat(s.entry)&&(s.quality_score||0)>=65);
    if(typeof alertNewSignals!=='undefined')alertNewSignals(validSignals);
    if(parsed.signals){
      parsed.signals.forEach(s=>{
        fetch('/api/performance/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)}).catch(()=>{});
      });
    }
    totalSignals+=parsed.signals.length;
    const sc=document.getElementById('signalCount');if(sc)sc.textContent=totalSignals;
    const vEl=document.getElementById('aiVerdict');
    if(vEl&&parsed.verdict){const cols={POOR:'red',MODERATE:'gold-text',STRONG:'blue',EXCELLENT:'green'};vEl.textContent=parsed.verdict;vEl.className='intel-val '+(cols[parsed.verdict]||'blue');}
    if(aiText)aiText.innerHTML='<strong style="color:var(--gold)">'+parsed.verdict+'</strong> — '+parsed.summary+'<br><span style="color:var(--red);font-size:10px">Avoid: '+parsed.avoid+'</span><br><span style="color:var(--text3);font-size:9px;font-family:var(--mono)">Based on real M15 candle data · '+new Date().toUTCString()+'</span>';
    console.log('[AI]',parsed.signals.length,'signals generated. Verdict:',parsed.verdict);
  }catch(e){
    console.error('[AI] Failed:',e.message);
    if(aiText)aiText.innerHTML='<span style="color:var(--red)">AI Error: '+e.message+'</span>';
  }
  if(btn){btn.disabled=false;btn.innerHTML='✦ Generate AI Signals';}
  aiRunning=false;
}
function calcPips(entry,level,sym){
  const e=parseFloat(entry),l=parseFloat(level);
  if(sym==='USDJPY')return Math.abs((l-e)*100).toFixed(1);
  if(sym==='XAUUSD')return '$'+Math.abs(l-e).toFixed(2);
  if(sym==='XAGUSD')return '$'+Math.abs(l-e).toFixed(3);
  return Math.abs((l-e)*10000).toFixed(1);
}
function getScoreColor(score){return score>=85?'var(--green)':score>=75?'var(--gold)':'var(--red)';}
function getScoreLabel(score){return score>=90?'EXCELLENT':score>=80?'STRONG':score>=75?'GOOD':'WEAK';}
function renderAISignals(parsed){
  const grid=document.getElementById('signalsGrid');
  if(!grid||!parsed?.signals?.length)return;
  grid.innerHTML=parsed.signals.map((s,i)=>{
    const dec=s.sym==='USDJPY'?3:s.sym==='XAUUSD'?2:s.sym==='XAGUSD'?3:5;
    const entry=parseFloat(s.entry).toFixed(dec);
    const tp=parseFloat(s.tp).toFixed(dec);
    const sl=parseFloat(s.sl).toFixed(dec);
    const tpPips=calcPips(entry,tp,s.sym);
    const slPips=calcPips(entry,sl,s.sym);
    const score=s.quality_score||s.confidence||80;
    const scoreColor=getScoreColor(score);
    const scoreLabel=getScoreLabel(score);
    const isMetal=s.sym==='XAUUSD'||s.sym==='XAGUSD';
    return '<div class="sig-list-item enhanced" onclick="setActiveSignal('+JSON.stringify(s).replace(/"/g,'&quot;')+')" style="cursor:pointer;padding:14px;animation-delay:'+i*.1+'s">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
        +'<div style="display:flex;align-items:center;gap:8px">'
          +'<span class="sli-pair" style="font-size:15px">'+(s.pair||s.sym)+'</span>'
          +'<span class="dir-pill-sm '+s.dir+'">'+s.dir.toUpperCase()+'</span>'
          +'<span style="font-family:var(--mono);font-size:9px;color:var(--text2)">'+s.tf+'</span>'
        +'</div>'
        +'<div style="text-align:right">'
          +'<div style="font-family:var(--mono);font-size:10px;color:'+scoreColor+';font-weight:700">'+scoreLabel+'</div>'
          +'<div style="font-family:var(--mono);font-size:9px;color:var(--text3)">'+score+'/100</div>'
        +'</div>'
      +'</div>'
      +'<div style="height:3px;background:var(--bg4);border-radius:2px;margin-bottom:10px;overflow:hidden">'
        +'<div style="height:100%;width:'+score+'%;background:'+scoreColor+';border-radius:2px"></div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px">'
        +'<div style="background:rgba(255,255,255,0.04);border-radius:5px;padding:7px;text-align:center">'
          +'<div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:3px">ENTRY</div>'
          +'<div style="font-family:var(--mono);font-size:12px;color:#fff;font-weight:700">'+entry+'</div>'
        +'</div>'
        +'<div style="background:rgba(0,230,118,0.08);border:1px solid rgba(0,230,118,0.15);border-radius:5px;padding:7px;text-align:center">'
          +'<div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:3px">TAKE PROFIT</div>'
          +'<div style="font-family:var(--mono);font-size:12px;color:var(--green);font-weight:700">'+tp+'</div>'
          +'<div style="font-family:var(--mono);font-size:9px;color:var(--green);opacity:.7">+'+tpPips+(isMetal?'':' pips')+'</div>'
        +'</div>'
        +'<div style="background:rgba(255,61,90,0.08);border:1px solid rgba(255,61,90,0.15);border-radius:5px;padding:7px;text-align:center">'
          +'<div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:3px">STOP LOSS</div>'
          +'<div style="font-family:var(--mono);font-size:12px;color:var(--red);font-weight:700">'+sl+'</div>'
          +'<div style="font-family:var(--mono);font-size:9px;color:var(--red);opacity:.7">-'+slPips+(isMetal?'':' pips')+'</div>'
        +'</div>'
      +'</div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between">'
        +'<div style="font-family:var(--mono);font-size:9px;color:var(--gold)">RR '+s.rr+'</div>'
        +'<div style="font-family:var(--mono);font-size:9px;color:var(--text3)">'+(s.duration||'20-35 min')+'</div>'
        +'<div style="font-family:var(--mono);font-size:9px;color:var(--text2);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(s.reason||'').slice(0,35)+'</div>'
      +'</div>'
    +'</div>';
  }).join('');
}
function generateAIAnalysis(){generateAISignals(true);}
// ── POSITION SIZE CALCULATOR ──────────────────────────────
function calcPosition(){
  const balance=parseFloat(document.getElementById('calcBalance')?.value)||1000;
  const riskPct=parseFloat(document.getElementById('calcRisk')?.value)||1;
  const slPips=parseFloat(document.getElementById('calcSL')?.value)||15;
  const pair=document.getElementById('calcPair')?.value||'forex';
  const riskAmt=balance*(riskPct/100);
  let pipValue,lotSize,units;
  if(pair==='forex'){pipValue=riskAmt/slPips;lotSize=pipValue/10;units=lotSize*100000;}
  else if(pair==='jpy'){pipValue=riskAmt/slPips;lotSize=pipValue/9.09;units=lotSize*100000;}
  else if(pair==='gold'){pipValue=riskAmt/slPips;lotSize=pipValue/100;units=lotSize*100;}
  else if(pair==='btc'){pipValue=riskAmt/slPips;lotSize=pipValue/1;units=lotSize;}
  else if(pair==='eth'){pipValue=riskAmt/slPips;lotSize=pipValue/1;units=lotSize;}
  else{pipValue=riskAmt/slPips;lotSize=pipValue/50;units=lotSize*5000;}
  const rEl=document.getElementById('calcRiskAmt');
  const lEl=document.getElementById('calcLotSize');
  const uEl=document.getElementById('calcUnits');
  const pEl=document.getElementById('calcPipVal');
  const wEl=document.getElementById('calcWarning');
  if(rEl)rEl.textContent='$'+riskAmt.toFixed(2);
  if(lEl)lEl.textContent=Math.max(0.01,lotSize).toFixed(2);
  if(uEl)uEl.textContent=Math.round(units).toLocaleString();
  if(pEl)pEl.textContent='$'+pipValue.toFixed(2);
  if(wEl){
    if(riskPct>3){wEl.textContent='High risk! Never risk more than 2% per trade';wEl.className='calc-warning show danger';}
    else if(riskPct<=1){wEl.textContent='Good risk management — safe position size';wEl.className='calc-warning show safe';}
    else{wEl.textContent='Moderate risk — stay disciplined';wEl.className='calc-warning show';wEl.style.cssText='display:block;background:rgba(255,187,0,0.08);border:1px solid rgba(255,187,0,0.2);color:var(--gold);';}
  }
}
// ── SESSION ALERTS ────────────────────────────────────────
let londonNotified=false,nyNotified=false,notifDate='';
function checkSessionAlerts(){
  const now=new Date(),today=now.toDateString(),h=now.getUTCHours(),m=now.getUTCMinutes(),day=now.getUTCDay();
  if(notifDate!==today){notifDate=today;londonNotified=false;nyNotified=false;}
  if(day===0||day===6)return;
  if(h===7&&m<30&&!londonNotified){
    londonNotified=true;
    showSessionBanner('london','LONDON SESSION OPEN — Best scalping conditions! High liquidity active');
    playSessionAlert();
    sendSessionTelegram('LONDON SESSION NOW OPEN - Best scalping conditions! High liquidity, tight spreads. Check Axion Signals now.');
  }
  if(h===13&&m<30&&!nyNotified){
    nyNotified=true;
    showSessionBanner('newyork','NEW YORK SESSION OPEN — London/NY overlap active! Strongest signals of the day');
    playSessionAlert();
    sendSessionTelegram('NEW YORK SESSION NOW OPEN - London/NY overlap active! Strongest signals of the day. Check Axion Signals now.');
  }
}
function showSessionBanner(type,text){
  const b=document.getElementById('sessionBanner'),t=document.getElementById('sessionBannerText');
  if(!b||!t)return;
  t.textContent=text;b.className='session-banner '+type+' show';
  setTimeout(()=>b.classList.remove('show'),30000);
}
function playSessionAlert(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1047].forEach((freq,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=freq;osc.type='sine';
      gain.gain.setValueAtTime(0.3,ctx.currentTime+i*0.15);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.15+0.2);
      osc.start(ctx.currentTime+i*0.15);osc.stop(ctx.currentTime+i*0.15+0.2);
    });
  }catch(e){}
}
function sendSessionTelegram(msg){
  fetch('/api/telegram',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({_customMsg:msg,pair:'SESSION',sym:'SESSION',dir:'buy',tf:'--',entry:'--',tp:'--',sl:'--',confidence:100,rr:'--',reason:msg,duration:'--'})}).catch(()=>{});
}
function initAI(){
  updateSessionBadge();
  updateNewsCountdown();
  setInterval(()=>{updateSessionBadge();updateNewsCountdown();},60000);
  setTimeout(()=>generateAISignals(true),3000);
  setInterval(()=>{if(isMarketOpen()){generateAISignals(false);}},15*60*1000);
  setInterval(checkSessionAlerts,60000);
  setTimeout(checkSessionAlerts,2000);
  calcPosition();
}
document.addEventListener('DOMContentLoaded',initAI);
