const TELEGRAM_TOKEN = '8732236406:AAGFX9Y-cWCvNZIap0Y4ZVtdE5oyLp7sP5Y';
const TELEGRAM_CHAT  = '5695936404';

async function sendTelegram(signal) {
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
        if (r.ok) console.log('[Telegram] ✓ Sent:', signal.pair, signal.dir.toUpperCase());
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
