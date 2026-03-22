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
  const prompt=`You are a professional algorithmic forex scalping system. Analyze these LIVE market prices and generate precise M15/M30 scalp signals.

LIVE PRICES (${new Date().toUTCString()}):
${prices}

ACTIVE SESSION: ${session.name} (${session.quality} scalp conditions)

Generate EXACTLY 4 scalp signals. Respond with valid JSON only, no other text:
{
  "signals": [
    {
      "pair": "EUR/USD",
      "sym": "EURUSD",
      "dir": "buy",
      "tf": "M15",
      "entry": 1.15610,
      "tp": 1.15720,
      "sl": 1.15550,
      "confidence": 88,
      "rr": "1:1.8",
      "reason": "EMA9 crossed above EMA21, RSI 58 rising, MACD bullish crossover, price above VWAP",
      "indicators": ["EMA Cross","RSI 58","MACD+","VWAP"],
      "duration": "15-20 min"
    }
  ],
  "verdict": "STRONG",
  "summary": "London session showing clean momentum. Gold leading risk-on sentiment.",
  "avoid": "USD/CHF choppy · NZD/USD no momentum"
}

Rules:
- Use EXACT live prices above as basis for entry
- TP forex: 8-14 pips. Gold: $6-10. Silver: $0.15-0.25
- SL forex: 5-8 pips. Gold: $4-6. Silver: $0.10-0.15
- Confidence 75-95% only
- Include at least 1 Gold or Silver signal
- Verdict: POOR / MODERATE / STRONG / EXCELLENT
- JSON only, no markdown`;

  try{
    const res=await fetch('/api/groq',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'You are a professional forex scalping AI. Always respond with valid JSON only, no markdown.'},{role:'user',content:prompt}]})});
    const data=await res.json();
    if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));
    const raw=data.choices?.[0]?.message?.content||'';
    const json=raw.replace(/```json|```/g,'').trim();
    const parsed=JSON.parse(json);
    renderAISignals(parsed);
    if(typeof window.buildSignalList!=='undefined')window.buildSignalList(parsed.signals);
    if(typeof alertNewSignals!=='undefined')alertNewSignals(parsed.signals);
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
function initAI(){updateSessionBadge();updateNewsCountdown();setInterval(()=>{updateSessionBadge();updateNewsCountdown();},60000);setTimeout(()=>generateAISignals(true),3000);setInterval(()=>generateAISignals(false),5*60*1000);}
document.addEventListener('DOMContentLoaded',initAI);