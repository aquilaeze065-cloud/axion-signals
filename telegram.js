const TELEGRAM_TOKEN = '8732236406:AAGFX9Y-cWCvNZIap0Y4ZVtdE5oyLp7sP5Y';
const TELEGRAM_CHAT  = '5695936404';
const TELEGRAM_CHANNEL = '-1003865341821';

async function sendTelegram(signal) {
  // Handle session alert messages
  if(signal._customMsg){
    const url2=`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body2=JSON.stringify({chat_id:TELEGRAM_CHAT,text:signal._customMsg,parse_mode:'Markdown'});
    const body3=JSON.stringify({chat_id:TELEGRAM_CHANNEL,text:signal._customMsg,parse_mode:'Markdown'});
    const https=require('https');
    [body2,body3].forEach(b=>{
      const r=https.request(url2,{method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}},(res)=>{res.resume();});
      r.on('error',()=>{});r.write(b);r.end();
    });
    console.log('[Telegram] Session alert sent');
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

module.exports = { sendTelegram, sendTelegramText };
module.exports = { sendTelegram, sendTelegramText };
