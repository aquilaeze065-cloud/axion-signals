/* ================================
   STEP 4: AI CONFIRMATION ENGINE
   ForexAI Pro — ai.js
================================ */


// ================================
// PART 1: YOUR API KEY
// Get yours free at console.anthropic.com
// ================================
const API_KEY = 'YOUR_API_KEY_HERE';


// ================================
// PART 2: BUILD THE PROMPT
// Tells Claude exactly what to analyse
// ================================
function buildPrompt() {
  return `You are an expert scalping forex and commodities analyst AI.

Generate a sharp, professional scalping market analysis strictly for M15 and M30 timeframes covering these pairs: EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, EUR/GBP, XAU/USD (Gold), XAG/USD (Silver).

Structure your response with these exact sections using HTML <b> tags for headers:

<b>⚡ SCALP CONDITIONS</b>
Is the current session suitable for scalping? Spread, liquidity, volatility status.

<b>📊 TOP SCALP SETUPS (M15/M30)</b>
Give 3 high-probability setups. For each one include:
- Pair and direction (BUY or SELL)
- Entry zone, tight TP (8–15 pips forex / $5–8 for Gold), tight SL
- Which indicators confirm it (EMA cross, RSI, MACD, VWAP, BB squeeze)
- Estimated hold time (15–30 mins max)

<b>🥇 METALS SCALP OUTLOOK</b>
Gold and Silver short-term momentum. Key intraday scalp levels.

<b>⚠️ RISK WARNING</b>
One critical thing that could invalidate current setups right now.

<b>🤖 AI VERDICT</b>
One sentence confidence summary for scalpers.

Keep it under 320 words. Be direct, precise and trader-focused.`;
}


// ================================
// PART 3: CALL CLAUDE AI API
// Sends prompt, returns AI response
// ================================
async function callClaudeAI() {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role:    'user',
          content: buildPrompt(),
        }
      ],
    }),
  });

  // Check for errors
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'API call failed');
  }

  const data = await response.json();

  // Extract the text from Claude's response
  return data.content
    .map(block => block.type === 'text' ? block.text : '')
    .join('');
}


// ================================
// PART 4: SHOW LOADING SPINNER
// Displays while AI is thinking
// ================================
function showLoading(btn, output) {
  btn.disabled    = true;
  btn.textContent = '⏳ AI Analysing Markets...';
  btn.style.opacity = '0.6';
  btn.style.cursor  = 'not-allowed';

  output.innerHTML = `
    <div style="text-align:center; padding: 30px 0;">
      <div style="
        display: inline-block;
        width: 32px; height: 32px;
        border: 3px solid #1a2540;
        border-top-color: #00e5ff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      "></div>
      <p style="
        margin-top: 14px;
        font-family: 'Space Mono', monospace;
        font-size: 12px;
        color: #506080;
        letter-spacing: 1px;
      ">AI scanning M15 · M30 signals...</p>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
  output.classList.add('visible');
}


// ================================
// PART 5: SHOW AI RESULT
// Displays Claude's analysis
// ================================
function showResult(output, text) {
  output.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #00e5ff;
    ">
      <div style="
        width: 20px; height: 20px;
        background: #00e5ff;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #000;
      ">AI</div>
      Live Scalp Analysis Report
    </div>
    <div style="line-height: 1.8; font-size: 14px;">
      ${text}
    </div>
    <div style="
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #1a2540;
      font-size: 10px;
      color: #506080;
      font-family: 'Space Mono', monospace;
      letter-spacing: 1px;
    ">
      ● Generated at ${new Date().toUTCString()} · M15/M30 Scalp Focus
    </div>
  `;
}


// ================================
// PART 6: SHOW ERROR MESSAGE
// If API call fails for any reason
// ================================
function showError(output, message) {
  output.innerHTML = `
    <div style="
      color: #ff3355;
      font-family: 'Space Mono', monospace;
      font-size: 12px;
      line-height: 1.7;
    ">
      <b>⚠️ AI Engine Error</b><br><br>
      ${message}<br><br>
      <span style="color: #506080;">
        Check your API key in ai.js and make sure you have
        an active internet connection.
      </span>
    </div>
  `;
}


// ================================
// PART 7: RESET BUTTON STATE
// After AI responds, re-enable button
// ================================
function resetButton(btn) {
  btn.disabled      = false;
  btn.textContent   = '✦ Regenerate AI Scalp Analysis';
  btn.style.opacity = '1';
  btn.style.cursor  = 'pointer';
}


// ================================
// PART 8: MAIN CLICK HANDLER
// Ties everything together
// ================================
async function handleAnalyseClick() {
  const btn    = document.getElementById('analyseBtn');
  const output = document.getElementById('aiOutput');

  // Step 1 — show spinner
  showLoading(btn, output);

  try {
    // Step 2 — call Claude AI
    const aiText = await callClaudeAI();

    // Step 3 — display the result
    showResult(output, aiText);

  } catch (error) {
    // If anything goes wrong show the error
    showError(output, error.message);

  } finally {
    // Always re-enable the button
    resetButton(btn);
  }
}


// ================================
// PART 9: ATTACH BUTTON LISTENER
// Runs when page is ready
// ================================
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('analyseBtn');
  if (btn) {
    btn.addEventListener('click', handleAnalyseClick);
  }
});

