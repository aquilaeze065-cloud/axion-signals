function getSession(){const h=new Date().getUTCHours();if(h>=22||h<7)return{name:'SYDNEY SESSION',color:'var(--gold)',quality:'LOW'};if(h>=7&&h<12)return{name:'LONDON SESSION',color:'var(--green)',quality:'OPTIMAL'};if(h>=12&&h<17)return{name:'NEW YORK SESSION',color:'var(--blue)',quality:'GOOD'};return{name:'TOKYO SESSION',color:'var(--gold)',quality:'MODERATE'};}
function updateSessionBadge(){
  const el=document.getElementById('sessionBadge');
  const s=getSession();
  if(!isMarketOpen()){
    if(el){el.textContent='MARKET CLOSED';el.style.color='var(--red)';}
    const c=document.getElementById('scalpCondition');
    if(c){c.textContent='CLOSED';c.style.color='var(--red)';}
    const dot=document.querySelector('.meta-dot');
    if(dot){dot.style.background='var(--red)';dot.style.boxShadow='0 0 6px var(--red)';}
    return;
  }
  if(el){el.textContent=s.name;el.style.color=s.color;}
  const c=document.getElementById('scalpCondition');
  if(c){c.textContent=s.quality;}
  const dot=document.querySelector('.meta-dot');
  if(dot){dot.style.background='var(--green)';dot.style.boxShadow='0 0 6px var(--green)';}
}
const NEWS_EVENTS=[{name:'USD CPI',utcH:13,utcM:30},{name:'EUR ECB Speech',utcH:14,utcM:0},{name:'GBP GDP',utcH:9,utcM:0},{name:'USD NFP',utcH:13,utcM:30},{name:'FOMC Minutes',utcH:19,utcM:0},{name:'JPY BOJ Policy',utcH:3,utcM:0}];
function updateNewsCountdown(){const cdEl=document.getElementById('newsCountdown');const nameEl=document.getElementById('newsEventName');if(!cdEl||!nameEl)return;const now=Date.now();let best=null,minDiff=Infinity;NEWS_EVENTS.forEach(ev=>{const d=new Date();d.setUTCHours(ev.utcH,ev.utcM,0,0);if(d<=now)d.setUTCDate(d.getUTCDate()+1);const diff=d-now;if(diff<minDiff){minDiff=diff;best={...ev,ms:diff};}});if(best){const h=Math.floor(best.ms/3600000),m=Math.floor((best.ms%3600000)/60000);cdEl.textContent=h+'h '+m+'m';nameEl.textContent=best.name+' — avoid 5min before';}}
function buildPriceContext(){if(typeof PRICES==='undefined')return'prices loading...';return['EUR/USD: '+PRICES.EURUSD,'GBP/USD: '+PRICES.GBPUSD,'USD/JPY: '+PRICES.USDJPY,'AUD/USD: '+PRICES.AUDUSD,'USD/CAD: '+PRICES.USDCAD,'USD/CHF: '+PRICES.USDCHF,'EUR/GBP: '+PRICES.EURGBP,'NZD/USD: '+PRICES.NZDUSD,'XAU/USD Gold: '+PRICES.XAUUSD,'XAG/USD Silver: '+PRICES.XAGUSD].join('\n');}
let aiRunning=false,lastAIRun=0,totalSignals=0;

function isMarketOpen(){
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const hour = now.getUTCHours();
  const min = now.getUTCMinutes();
  const timeInMins = hour * 60 + min;

  // Market closed: Saturday all day + Sunday before 21:00 UTC + Friday after 21:00 UTC
  if(day === 6) return false; // Saturday - fully closed
  if(day === 0 && timeInMins < 21*60) return false; // Sunday before 9PM UTC
  if(day === 5 && timeInMins >= 21*60) return false; // Friday after 9PM UTC
  return true;
}

function getMarketClosedMessage(){
  const now = new Date();
  const day = now.getUTCDay();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  // Calculate next open (Sunday 21:00 UTC)
  const nextOpen = new Date(now);
  const daysUntilSunday = (7 - day) % 7 || 7;
  nextOpen.setUTCDate(nextOpen.getUTCDate() + (day === 0 ? 0 : daysUntilSunday));
  nextOpen.setUTCHours(21, 0, 0, 0);
  if(day === 0 && now.getUTCHours() < 21) {
    nextOpen.setUTCDate(now.getUTCDate());
  }

  const diff = nextOpen - now;
  const h = Math.floor(diff/3600000);
  const m = Math.floor((diff%3600000)/60000);
  return 'Market closed for weekend. Opens in ' + h + 'h ' + m + 'm (Sunday 9PM UTC)';
}

async function generateAISignals(forced=false){
  const now=Date.now();
  if(aiRunning)return;
  if(!forced&&now-lastAIRun<5*60*1000)return;

  // Check if market is open
  if(!isMarketOpen()){
    const msg = getMarketClosedMessage();
    console.log('[AI] '+msg);
    const aiText=document.getElementById('aiText');
    const output=document.getElementById('aiOutput');
    const btn=document.getElementById('generateBtn');
    if(output){output.style.display='block';}
    if(aiText)aiText.innerHTML='<div style="text-align:center;padding:20px"><div style="font-size:24px;margin-bottom:10px">🔴</div><div style="color:var(--red);font-family:var(--mono);font-size:12px;font-weight:700;margin-bottom:8px">MARKET CLOSED</div><div style="color:var(--text2);font-size:11px">'+msg+'</div><div style="color:var(--text3);font-size:10px;margin-top:8px">Forex market closed Fri 9PM — Sun 9PM UTC</div></div>';
    if(btn){btn.disabled=false;btn.innerHTML='✦ Generate AI Signals';}
    // Still update session badge
    updateSessionBadge();
    return;
  }
  aiRunning=true;lastAIRun=now;
  const btn=document.getElementById('generateBtn');
  const output=document.getElementById('aiOutput');
  const aiText=document.getElementById('aiText');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner"></span> AI Analyzing...';}
  if(output){output.style.display='block';}
  if(aiText)aiText.innerHTML='<span style="color:var(--text2);font-size:11px">Scanning live prices · Calculating momentum · Generating signals...</span>';
  const session=getSession();
  const prices=buildPriceContext();
  const prompt=`You are an elite professional forex scalping analyst. Your job is to analyze live market conditions and ONLY generate signals when ALL confluence factors align perfectly.

LIVE PRICES (${new Date().toUTCString()}):
${prices}

ACTIVE SESSION: ${session.name} (${session.quality} conditions)

YOUR SIGNAL RULES — STRICT:
1. ONLY generate a signal if ALL of these align:
   ✓ EMA9 crossed EMA21 (trend confirmation)
   ✓ RSI between 40-60 (not overbought/oversold)
   ✓ MACD histogram showing momentum
   ✓ Price respecting Bollinger Band
   ✓ Price above/below VWAP (direction confirmation)
   ✓ Clear market structure (swing high/low visible)
   ✓ RR ratio minimum 1:2

2. IF conditions are NOT met → return empty signals array with verdict "NO SIGNAL"

3. NEVER force a signal. If market is choppy, ranging or unclear → NO SIGNAL

4. SL PLACEMENT:
   - Always beyond last swing high (for SELL) or swing low (for BUY)
   - Minimum 12 pips for forex, $10 for Gold, $0.25 for Silver
   - Account for spread before entry

5. QUALITY SCORE (only generate if score >= 75):
   - EMA Cross confirmed: +20pts
   - RSI in safe zone (40-60): +15pts
   - MACD momentum confirmed: +15pts
   - BB position correct: +15pts
   - VWAP alignment: +15pts
   - Clean market structure: +20pts
   - Total must be 75+ to generate signal

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "signals": [
    {
      "pair": "EUR/USD",
      "sym": "EURUSD",
      "dir": "buy",
      "tf": "M15",
      "entry": 1.15610,
      "tp": 1.15850,
      "sl": 1.15450,
      "quality_score": 85,
      "rr": "1:2.1",
      "reason": "EMA9 crossed above EMA21 on M15, RSI at 52 rising, MACD bullish cross, price above VWAP, clear structure above 1.1545 support",
      "indicators": ["EMA Cross","RSI 52","MACD+","VWAP","Structure"],
      "duration": "20-35 min",
      "session_bias": "London bullish"
    }
  ],
  "verdict": "STRONG",
  "summary": "Clear bullish momentum on EUR/USD with full confluence. Gold showing reversal setup.",
  "avoid": "USD/CHF — ranging · NZD/USD — no momentum",
  "market_condition": "TRENDING"
}

If NO strong signals exist, return:
{
  "signals": [],
  "verdict": "NO SIGNAL",
  "summary": "Market conditions not ideal. Waiting for better setup.",
  "avoid": "All pairs showing chop — stay out",
  "market_condition": "CHOPPY"
}

REMEMBER: A missed trade is better than a bad trade. Quality over quantity.`;

  try{
    const res=await fetch('/api/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'You are a professional forex scalping AI. Always respond with valid JSON only, no markdown.'},{role:'user',content:prompt}]})});
    const data=await res.json();
    if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
    const raw=data.choices?.[0]?.message?.content||'';
    const json=raw.replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(json);
    // Handle NO SIGNAL case
    if(parsed.verdict==='NO SIGNAL'||!parsed.signals||parsed.signals.length===0){
      console.log('[AI] No strong signals — market conditions not ideal');
      if(aiText)aiText.innerHTML=`
        <div style="text-align:center;padding:20px">
          <div style="font-size:32px;margin-bottom:10px">⏳</div>
          <div style="font-family:var(--mono);font-size:13px;color:var(--gold);font-weight:700;margin-bottom:8px">NO STRONG SIGNALS</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.7;margin-bottom:10px">${parsed.summary||'Market conditions not ideal. Waiting for better setup.'}</div>
          <div style="font-size:11px;color:var(--red);font-family:var(--mono)">⚠ Avoid: ${parsed.avoid||'All pairs — stay patient'}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:10px;font-family:var(--mono)">Next scan in 15 minutes · ${new Date().toUTCString()}</div>
        </div>`;
      const vEl=document.getElementById('aiVerdict');
      if(vEl){vEl.textContent='NO SIGNAL';vEl.className='intel-val red';}
      if(btn){btn.disabled=false;btn.innerHTML='✦ Generate AI Signals';}
      aiRunning=false;
      return;
    }
    renderAISignals(parsed);
    if(typeof window.buildSignalList!=='undefined')window.buildSignalList(parsed.signals);
    if(typeof alertNewSignals!=='undefined')alertNewSignals(parsed.signals);
    if(typeof window.addTrade!=='undefined'&&parsed.signals){
      parsed.signals.forEach(s=>window.addTrade(s));
    }
    if(typeof window.updateStatsDisplay!=='undefined')window.updateStatsDisplay();
    totalSignals+=parsed.signals?.length||0;
    const sc=document.getElementById('signalCount');if(sc)sc.textContent=totalSignals;
    const vEl=document.getElementById('aiVerdict');
    if(vEl&&parsed.verdict){const cols={POOR:'red',MODERATE:'gold-text',STRONG:'blue',EXCELLENT:'green'};vEl.textContent=parsed.verdict;vEl.className='intel-val '+(cols[parsed.verdict]||'blue');}
    if(aiText)aiText.innerHTML='<strong style="color:var(--gold)">'+parsed.verdict+'</strong> — '+parsed.summary+'<br><span style="color:var(--red);font-size:10px">Avoid: '+parsed.avoid+'</span>';
    console.log('[AI] '+parsed.signals.length+' signals. Verdict: '+parsed.verdict);
  }catch(e){
    console.error('[AI] Failed:',e.message);
    if(aiText)aiText.innerHTML='<span style="color:var(--red)">AI Error: '+e.message+'</span>';
  }
  if(btn){btn.disabled=false;btn.innerHTML='✦ Generate AI Signals';}
  aiRunning=false;
}
function renderAISignals(parsed){
  const grid=document.getElementById('signalsGrid');
  if(!grid||!parsed?.signals?.length)return;
  grid.innerHTML=parsed.signals.map((s,i)=>{
    const isMetal=s.sym==='XAUUSD'||s.sym==='XAGUSD';
    const dec=s.sym==='USDJPY'?3:s.sym==='XAUUSD'?2:s.sym==='XAGUSD'?3:5;
    const entry=parseFloat(s.entry).toFixed(dec);
    const tp=parseFloat(s.tp).toFixed(dec);
    const sl=parseFloat(s.sl).toFixed(dec);
    return '<div class="sig-list-item" onclick="setActiveSignal('+JSON.stringify(s).replace(/"/g,"&quot;")+')" style="animation-delay:'+i*.1+'s">'
      +'<div class="sli-left"><span class="sli-pair">'+(s.pair||s.sym)+'</span>'
      +'<span class="dir-pill-sm '+s.dir+'">'+s.dir.toUpperCase()+'</span></div>'
      +'<div class="sli-right"><span class="sli-price">'+entry+'</span>'
      +'<span class="sli-conf">'+s.confidence+'%</span></div></div>';
  }).join('');
}
function generateAIAnalysis(){generateAISignals(true);}
function initAI(){updateSessionBadge();updateNewsCountdown();setInterval(()=>{updateSessionBadge();updateNewsCountdown();},60000);setTimeout(()=>generateAISignals(true),3000);setInterval(()=>generateAISignals(false),15*60*1000);}
document.addEventListener('DOMContentLoaded',initAI);
// ── POSITION SIZE CALCULATOR ──────────────────────────────
function calcPosition(){
  const balance = parseFloat(document.getElementById('calcBalance')?.value)||1000;
  const riskPct = parseFloat(document.getElementById('calcRisk')?.value)||1;
  const slPips  = parseFloat(document.getElementById('calcSL')?.value)||15;
  const pair    = document.getElementById('calcPair')?.value||'forex';

  const riskAmt = balance * (riskPct/100);

  let pipValue, lotSize, units;

  if(pair==='forex'){
    // Standard lot = 100,000 units, pip = $10/lot
    pipValue = riskAmt / slPips;
    lotSize  = pipValue / 10;
    units    = lotSize * 100000;
  } else if(pair==='jpy'){
    // JPY pairs pip = $9.09/lot approx
    pipValue = riskAmt / slPips;
    lotSize  = pipValue / 9.09;
    units    = lotSize * 100000;
  } else if(pair==='gold'){
    // Gold: 1 lot = 100 oz, $1 move = $100/lot
    pipValue = riskAmt / slPips;
    lotSize  = pipValue / 100;
    units    = lotSize * 100;
  } else if(pair==='silver'){
    // Silver: 1 lot = 5000 oz
    pipValue = riskAmt / slPips;
    lotSize  = pipValue / 50;
    units    = lotSize * 5000;
  }

  // Update display
  const riskEl=document.getElementById('calcRiskAmt');
  const lotEl=document.getElementById('calcLotSize');
  const unitEl=document.getElementById('calcUnits');
  const pipEl=document.getElementById('calcPipVal');
  const warnEl=document.getElementById('calcWarning');

  if(riskEl)riskEl.textContent='$'+riskAmt.toFixed(2);
  if(lotEl)lotEl.textContent=Math.max(0.01,lotSize).toFixed(2);
  if(unitEl)unitEl.textContent=Math.round(units).toLocaleString();
  if(pipEl)pipEl.textContent='$'+pipValue.toFixed(2);

  // Warning
  if(warnEl){
    if(riskPct>3){
      warnEl.textContent='⚠ High risk! Never risk more than 2% per trade';
      warnEl.className='calc-warning show danger';
    } else if(riskPct<=1){
      warnEl.textContent='✓ Good risk management — safe position size';
      warnEl.className='calc-warning show safe';
    } else {
      warnEl.textContent='⚡ Moderate risk — stay disciplined';
      warnEl.className='calc-warning show';
      warnEl.style.background='rgba(255,187,0,0.08)';
      warnEl.style.border='1px solid rgba(255,187,0,0.2)';
      warnEl.style.color='var(--gold)';
    }
  }
}

// ── SESSION OPEN NOTIFICATIONS ────────────────────────────
let londonNotified=false, nyNotified=false, notifDate='';

function checkSessionAlerts(){
  const now=new Date();
  const today=now.toDateString();
  const h=now.getUTCHours();
  const m=now.getUTCMinutes();
  const day=now.getUTCDay();

  // Reset daily notifications
  if(notifDate!==today){notifDate=today;londonNotified=false;nyNotified=false;}

  // Skip weekends
  if(day===0||day===6)return;

  // London Open: 7:00-7:30 UTC
  if(h===7&&m<30&&!londonNotified){
    londonNotified=true;
    showSessionBanner('london','🇬🇧 LONDON SESSION OPEN — Best time to trade! High liquidity & volatility now active');
    playSessionAlert();
    sendSessionTelegram('🇬🇧 LONDON SESSION NOW OPEN

Best scalping conditions active!
High liquidity · Tight spreads · Strong moves

⚡ Check Axion Signals for live entries');
  }

  // New York Open: 13:00-13:30 UTC
  if(h===13&&m<30&&!nyNotified){
    nyNotified=true;
    showSessionBanner('newyork','🇺🇸 NEW YORK SESSION OPEN — High impact moves expected! London/NY overlap active');
    playSessionAlert();
    sendSessionTelegram('🇺🇸 NEW YORK SESSION NOW OPEN

London/NY overlap — strongest signals!
High volatility · Maximum liquidity

⚡ Check Axion Signals for live entries');
  }
}

function showSessionBanner(type, text){
  const banner=document.getElementById('sessionBanner');
  const textEl=document.getElementById('sessionBannerText');
  if(!banner||!textEl)return;
  textEl.textContent=text;
  banner.className='session-banner '+type+' show';
  // Auto hide after 30 seconds
  setTimeout(()=>banner.classList.remove('show'),30000);
}

function playSessionAlert(){
  try{
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    [523,659,784,1047].forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);gain.connect(ctx.destination);
      osc.frequency.value=freq;osc.type='sine';
      gain.gain.setValueAtTime(0.3,ctx.currentTime+i*0.15);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+i*0.15+0.2);
      osc.start(ctx.currentTime+i*0.15);
      osc.stop(ctx.currentTime+i*0.15+0.2);
    });
  }catch(e){}
}

function sendSessionTelegram(msg){
  fetch('/api/telegram',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      pair:'SESSION ALERT',sym:'SESSION',dir:'buy',
      tf:'--',entry:'--',tp:'--',sl:'--',
      confidence:100,rr:'--',
      reason:msg,duration:'--',
      _customMsg:msg
    })
  }).catch(()=>{});
}

// Check every minute
setInterval(checkSessionAlerts, 60000);
// Check immediately on load
setTimeout(checkSessionAlerts, 2000);

// Init calculator on load
document.addEventListener('DOMContentLoaded', calcPosition);
