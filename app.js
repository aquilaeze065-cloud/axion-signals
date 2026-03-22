/* ============================================
   APP.JS
   - Tab navigation
   - Global app initialization
   - Keyboard shortcuts
============================================ */

// ─── TAB NAVIGATION ────────────────────────
function initTabs() {
  const navLinks = document.querySelectorAll('.nav-link[data-tab]');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = link.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabName) {
  // Update nav links
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.nav-link[data-tab="${tabName}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Update tab panels
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const activePanel = document.getElementById(`tab-${tabName}`);
  if (activePanel) activePanel.classList.add('active');

  // Lazy-load chart when chart tab opens
  if (tabName === 'chart') {
    setTimeout(() => {
      if (typeof renderTVChart === 'function') {
        renderTVChart(currentSymbol || 'FX:EURUSD', currentTF || '15');
        if (typeof buildMiniCharts === 'function') buildMiniCharts();
      }
    }, 100);
  }
}

// ─── KEYBOARD SHORTCUTS ────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Only trigger if not typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch(e.key) {
      case '1': switchTab('signals');  break;
      case '2': switchTab('chart');    break;
      case '3': switchTab('history');  break;
      case '4': switchTab('calendar'); break;
      case 'r': case 'R':
        if (typeof refreshNews === 'function') refreshNews();
        break;
    }
  });
}

// ─── INIT ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initKeyboardShortcuts();
  console.log('%c ForexAI Pro Loaded ✦', 'color:#00e5ff;font-size:14px;font-weight:bold;');
  console.log('%c Keys: 1=Signals 2=Chart 3=History 4=Calendar R=Refresh News',
    'color:#506080;font-size:11px;');
});