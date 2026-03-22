const { sendTelegram, sendTelegramText } = require('./telegram');
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
