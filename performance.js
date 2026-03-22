/* ============================================================
   PERFORMANCE TRACKER
   Tracks real signal outcomes — win/loss/pending
   Stored in localStorage — persists across sessions
============================================================ */

function getPerformance(){
  try{return JSON.parse(localStorage.getItem('axion_performance'))||{trades:[],lastUpdated:null};}
  catch(e){return {trades:[],lastUpdated:null};}
}

function savePerformance(data){
  localStorage.setItem('axion_performance',JSON.stringify(data));
}

function addTrade(signal){
  const perf=getPerformance();
  perf.trades.push({
    id: Date.now(),
    pair: signal.pair,
    sym: signal.sym,
    dir: signal.dir,
    entry: signal.entry,
    tp: signal.tp,
    sl: signal.sl,
    rr: signal.rr,
    quality: signal.quality_score||signal.confidence,
    date: new Date().toISOString(),
    result: 'pending', // pending, win, loss
    pips: null
  });
  savePerformance(perf);
  updateStatsDisplay();
}

function updateStatsDisplay(){
  const perf=getPerformance();
  const trades=perf.trades.slice(-30); // last 30 trades
  const closed=trades.filter(t=>t.result!=='pending');
  const wins=closed.filter(t=>t.result==='win');
  const pending=trades.filter(t=>t.result==='pending');

  // Win rate
  const winRateEl=document.getElementById('liveWinRate');
  if(winRateEl){
    if(closed.length===0){
      winRateEl.textContent='New';
      winRateEl.style.color='var(--gold)';
      winRateEl.title='No closed trades yet — performance tracking started';
    }else{
      const rate=Math.round((wins.length/closed.length)*100);
      winRateEl.textContent=rate+'%';
      winRateEl.style.color=rate>=60?'var(--green)':rate>=45?'var(--gold)':'var(--red)';
      winRateEl.title=`${wins.length} wins / ${closed.length} closed trades (last 30)`;
    }
  }

  // RR
  const rrEl=document.getElementById('liveRR');
  if(rrEl){
    if(closed.length===0){
      rrEl.textContent='--';
    }else{
      // Average RR from signal data
      const avgRR=trades.reduce((acc,t)=>{
        const parts=(t.rr||'1:1.5').split(':');
        return acc+(parseFloat(parts[1])||1.5);
      },0)/trades.length;
      rrEl.textContent='1:'+avgRR.toFixed(1);
    }
  }

  // Signals count
  const sigEl=document.getElementById('liveSignals');
  if(sigEl){
    // Count signals this week
    const weekAgo=Date.now()-7*24*3600000;
    const thisWeek=perf.trades.filter(t=>new Date(t.date).getTime()>weekAgo);
    sigEl.textContent=thisWeek.length;
  }

  // Update pending count
  const pendingEl=document.getElementById('pendingCount');
  if(pendingEl)pendingEl.textContent=pending.length;
}

// Add sublabel style
const style=document.createElement('style');
style.textContent=`.stat-box-sublabel{font-size:9px;color:var(--text3);font-family:var(--mono);margin-top:3px;letter-spacing:.5px;}`;
document.head.appendChild(style);

// Init on load
document.addEventListener('DOMContentLoaded', updateStatsDisplay);

// Expose globally
window.addTrade = addTrade;
window.updateStatsDisplay = updateStatsDisplay;
window.getPerformance = getPerformance;
