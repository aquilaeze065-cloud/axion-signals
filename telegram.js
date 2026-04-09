const TELEGRAM_TOKEN = '8732236406:AAGFX9Y-cWCvNZIap0Y4ZVtdE5oyLp7sP5Y';
const TELEGRAM_CHAT  = '5695936404';
const TELEGRAM_CHANNEL = '-1003865341821';

function buildTelegramMessage(signal){
  const dir = signal.dir==='buy'?'🟢 LONG (BUY)':'🔴 SHORT (SELL)';
  const dirEmoji = signal.dir==='buy'?'📈':'📉';
  const quality = signal.quality_score||signal.confidence||75;
  
  // Confidence label
  const confLabel = quality>=85?'HIGH CONFIDENCE':quality>=75?'MODERATE CONFIDENCE':'STANDARD SETUP';
  const confEmoji = quality>=85?'🔥':quality>=75?'⚡':'📊';
  
  // Session
  const h = new Date().getUTCHours();
  const nigeriaH = (h+1)%24;
  const session = h>=7&&h<12?'London Session':h>=12&&h<16?'NY Session (London/NY Overlap)':'Off-Peak Session';
  
  // Risk level
  const riskLevel = quality>=85?'STANDARD SCALP':quality>=75?'MODERATE RISK SCALP':'HIGH RISK SCALP';
  const riskEmoji = quality>=85?'✅':'⚠️';
  
  // Asset type
  const isMetal = signal.sym==='XAUUSD'||signal.sym==='XAGUSD';
  const isCrypto = signal.sym==='BTCUSD'||signal.sym==='ETHUSD';
  const assetTag = isMetal?'#METALS':isCrypto?'#CRYPTO':'#FOREX';

  const msg = 
`⚡ *AXION SCALP ALERT (M15)* ⚡
━━━━━━━━━━━━━━━━━━━━
${dirEmoji} *Asset:* ${signal.pair} ${assetTag}
*Action:* ${dir}
*Confidence:* ${quality}.0%

📍 *ENTRY:* ${signal.entry}
🎯 *TP:* ${signal.tp}
🛡 *SL:* ${signal.sl}
⚖️ *R:R Ratio:* ${signal.rr}

🧠 *AI Insight:*
_${signal.reason||'Technical confluence confirmed'}_

${riskEmoji} *${riskLevel}:* _This is a 15-minute momentum setup. Wait for current M15 candle to CLOSE before entering. Do not enter if you are late to the signal._

📋 *Coach's Note:*
_${signal.dir==='buy'?
  'Price showing bullish momentum. Enter at open of next candle after confirmation close. Trail SL once +'+( isMetal?'$10':'10 pips')+' in profit.':
  'Price showing bearish momentum. Enter at open of next candle after confirmation close. Trail SL once '+( isMetal?'$10':'10 pips')+' in profit.'}_

⚠️ *PORTFOLIO WARNING:*
_Do not take every signal. Avoid over-leveraging on correlated assets. Max 1-2% risk per trade._

⏰ *Session:* ${session} | Nigeria: ${nigeriaH}:00
📊 *Powered by Axion Signals*`;

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

