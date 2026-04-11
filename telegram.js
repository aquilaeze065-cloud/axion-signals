const TELEGRAM_TOKEN = '8732236406:AAGFX9Y-cWCvNZIap0Y4ZVtdE5oyLp7sP5Y';
const TELEGRAM_CHAT  = '5695936404';
const TELEGRAM_CHANNEL = '-1003865341821';

function buildTelegramMessage(signal){
  const quality = parseInt(signal.quality_score||signal.confidence||75);
  const isBuy = signal.dir==='buy';
  const isMetal = signal.sym==='XAUUSD'||signal.sym==='XAGUSD';
  const isCrypto = signal.sym==='BTCUSD'||signal.sym==='ETHUSD';

  // Direction
  const dirLine = isBuy
    ? '\u25b2 Action: \ud83d\udfe2 LONG (BUY)'
    : '\u25bc Action: \ud83d\udd34 SHORT (SELL)';

  // Confidence label
  const confLabel = quality>=85?'HIGH':quality>=75?'MODERATE':'STANDARD';

  // Aggression level based on quality + indicators
  let aggression = 'STANDARD SCALP';
  let aggrEmoji = '\u26a1';
  if(quality>=88){
    aggression = isBuy?'\ud83d\udfe2 AGGRESSIVE BUY':'\ud83d\udd34 AGGRESSIVE SELL';
    aggrEmoji = '\ud83d\udd25';
  } else if(quality>=80){
    aggression = isBuy?'\ud83d\udfe2 STRONG BUY':'\ud83d\udd34 STRONG SELL';
    aggrEmoji = '\u2705';
  } else if(quality>=70){
    aggression = isBuy?'\ud83d\udfe2 MODERATE BUY':'\ud83d\udd34 MODERATE SELL';
    aggrEmoji = '\u26a1';
  } else {
    aggression = isBuy?'\ud83d\udfe2 CAUTIOUS BUY':'\ud83d\udd34 CAUTIOUS SELL';
    aggrEmoji = '\u26a0\ufe0f';
  }

  // Risk warning
  const riskNote = quality>=85
    ? 'Setup has strong confluence. Execute with normal position size.'
    : quality>=75
    ? 'Good setup but confirm candle close before entering.'
    : 'Moderate setup. Use reduced position size (0.5-1% risk).';

  // Session
  const h = new Date().getUTCHours();
  const ng = (h+1)%24;
  const session = h>=7&&h<12?'London Session'
    :h>=12&&h<16?'NY Session (London/NY Overlap)'
    :h>=16&&h<22?'Sydney Session'
    :'Tokyo Session';

  // Asset tag
  const assetTag = isMetal?'#METALS':isCrypto?'#CRYPTO':'#FOREX';

  // Entry note based on quality
  const entryNote = quality>=85
    ? 'Enter at OPEN of next M15 candle after current one closes. Signal is strong.'
    : 'Wait for current M15 candle to FULLY CLOSE then enter at next candle open. Do not enter mid-candle.';

  const msg =
`\u26a1 *AXION SCALP ALERT (M15)* \u26a1
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\ud83d\udcca *Asset:* ${signal.pair} ${assetTag}
${dirLine}
*Confidence:* ${quality}% — *${confLabel}*

\ud83d\udccd *ENTRY:* \`${signal.entry}\`
\ud83c\udfaf *TP:* \`${signal.tp}\`
\ud83d\udee1 *SL:* \`${signal.sl}\`
\u2696\ufe0f *R:R Ratio:* ${signal.rr}

${aggrEmoji} *${aggression}*
_All indicators checked: H1 trend + M15 EMA + RSI + MACD_

\ud83e\udde0 *AI Insight:*
_${signal.reason||'Technical confluence confirmed on M15 timeframe'}_

\u23f0 *Entry Timing:*
_${entryNote}_

\u26a0\ufe0f *Risk Note:*
_${riskNote}_

\ud83d\udcdd *Coach Note:*
_Leave emotions at the door. Follow the signal rules. If you missed the entry candle — SKIP this trade and wait for the next signal._

\u26a0\ufe0f *PORTFOLIO WARNING:*
_Max 1-2% risk per trade. Do not take every signal. Avoid overtrading correlated pairs._

\u23f0 *Session:* ${session} | Nigeria: ${ng}:00
\ud83d\udcca _Powered by Axion Signals — Precision Scalping System_`;

  return msg;
}


async function sendTelegram(signal) {
  // Handle custom messages (session alerts, no signal notifications)
  if(signal._customMsg){
    const https=require('https');
    const msg=signal._customMsg;
    [TELEGRAM_CHAT, TELEGRAM_CHANNEL].forEach(chatId=>{
      const body=JSON.stringify({chat_id:chatId,text:msg});
      const req=https.request({
        hostname:'api.telegram.org',
        path:'/bot'+TELEGRAM_TOKEN+'/sendMessage',
        method:'POST',
        headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}
      },(res)=>{res.resume();});
      req.on('error',()=>{});
      req.write(body);
      req.end();
    });
    console.log('[Telegram] Custom message sent to personal + VIP channel');
    return {ok:true};
  }
  const isMetal = signal.sym === 'XAUUSD' || signal.sym === 'XAGUSD';
  const isBuy   = signal.dir === 'buy';
  const icon    = isMetal ? '⬡' : isBuy ? '🟢' : '🔴';
  const dirIcon = isBuy ? '▲' : '▼';

  const msg = `${icon} *AXION SIGNALS*\n\n`+
    `${dirIcon} *${signal.pair} — ${signal.dir.toUpperCase()}*\n`+
    `⏱ ${signal.tf} · AI Confirmed\n\n`+
    `📥 Entry:  \`${signal.entry}\`\n`+
    `🎯 TP:     \`${signal.tp}\`\n`+
    `🛑 SL:     \`${signal.sl}\`\n`+
    `📊 RR:     ${signal.rr}\n`+
    `🤖 Conf:   ${signal.confidence}%\n\n`+
    `💬 _${signal.reason||'AI confirmed signal'}_\n\n`+
    `⚠ Not financial advice`;

  // Send to personal chat
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const body = JSON.stringify({
    chat_id: TELEGRAM_CHAT,
    text: msg,
    parse_mode: 'Markdown'
  });

  const https = require('https');
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const r = JSON.parse(d);
        if (r.ok) {
          console.log('[Telegram] ✓ Sent:', signal.pair, signal.dir.toUpperCase());
          // Also send to VIP channel
          const https2 = require('https');
          const body2 = JSON.stringify({chat_id: TELEGRAM_CHANNEL, text: msg, parse_mode: 'Markdown'});
          const req2 = https2.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body2)}},(res2)=>{res2.resume();});
          req2.on('error',()=>{});
          req2.write(body2);
          req2.end();
          console.log('[Telegram] ✓ Sent to VIP channel');
        }
        else console.error('[Telegram] ✗ Failed:', r.description);
        resolve(r);
      });
    });
    req.on('error', e => { console.error('[Telegram] Error:', e.message); resolve(null); });
    req.write(body);
    req.end();
  });
}

function sendTelegramText(text) {
  const https = require('https');
  const body = JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'Markdown' });
  const req = https.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, (res) => { res.resume(); });
  req.on('error', ()=>{});
  req.write(body);
  req.end();
}


// ── WELCOME NEW MEMBER ────────────────────────────────────
function sendWelcomeMessage(username) {
  const https = require('https');
  const msg = `🚀 *Welcome to Axion Signals VIP!* 🚀

Hello @${username}! You now have access to AI-powered forex signals.

*HOW IT WORKS:*
⚡ Signals fire automatically every 15 minutes
🇬🇧 London open alert: 7AM UTC (8AM Nigeria)
🇺🇸 NY open alert: 1PM UTC (2PM Nigeria)
✅ Only HIGH quality signals (75+ score) are sent
⏳ NO SIGNAL = market not ideal, stay patient

*SIGNAL FORMAT:*
📥 Entry price
🎯 Take Profit (TP)
🛑 Stop Loss (SL)
📊 Risk/Reward ratio
🤖 Trade Quality Score

*RISK RULES:*
- Never risk more than 1-2% per trade
- Always use the position size calculator
- Best sessions: London & New York open
- Avoid trading 30min before major news

*DASHBOARD:*
🌐 axion-signals-production.up.railway.app

⚠️ Not financial advice. Trade responsibly.

Good luck and profitable trading! 💰`;

  [TELEGRAM_CHAT, TELEGRAM_CHANNEL].forEach(chatId => {
    const body = JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: 'Markdown'
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + TELEGRAM_TOKEN + '/sendMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => { res.resume(); });
    req.on('error', () => {});
    req.write(body);
    req.end();
  });
  console.log('[Telegram] Welcome message sent for:', username);
}

module.exports = { sendTelegram, sendTelegramText, sendWelcomeMessage };


// ── WELCOME NEW MEMBER ────────────────────────────────────
function sendWelcomeMessage(username) {
  const https = require('https');
  const msg = `🚀 *Welcome to Axion Signals VIP!* 🚀

Hello @${username}! You now have access to AI-powered forex signals.

*HOW IT WORKS:*
⚡ Signals fire automatically every 15 minutes
🇬🇧 London open alert: 7AM UTC (8AM Nigeria)
🇺🇸 NY open alert: 1PM UTC (2PM Nigeria)
✅ Only HIGH quality signals (75+ score) are sent
⏳ NO SIGNAL = market not ideal, stay patient

*SIGNAL FORMAT:*
📥 Entry price
🎯 Take Profit (TP)
🛑 Stop Loss (SL)
📊 Risk/Reward ratio
🤖 Trade Quality Score

*RISK RULES:*
- Never risk more than 1-2% per trade
- Always use the position size calculator
- Best sessions: London & New York open
- Avoid trading 30min before major news

*DASHBOARD:*
🌐 axion-signals-production.up.railway.app

⚠️ Not financial advice. Trade responsibly.

Good luck and profitable trading! 💰`;

  [TELEGRAM_CHAT, TELEGRAM_CHANNEL].forEach(chatId => {
    const body = JSON.stringify({
      chat_id: chatId,
      text: msg,
      parse_mode: 'Markdown'
    });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: '/bot' + TELEGRAM_TOKEN + '/sendMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => { res.resume(); });
    req.on('error', () => {});
    req.write(body);
    req.end();
  });
  console.log('[Telegram] Welcome message sent for:', username);
}

module.exports = { sendTelegram, sendTelegramText, sendWelcomeMessage };

