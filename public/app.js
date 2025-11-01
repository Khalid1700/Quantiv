// ============================
// Quantiv – App
// ============================

const HAS_ELECTRON = !!window.electronAPI;

function showToast(msg, timeout = 2600) {
  const el = document.getElementById('toast');
  if (!el) return alert(msg);
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), timeout);
}
// Fixed default month color palette (shared between toolbar and charts)
// Ensures each month has a clear, consistent color
window.__monthPalette = window.__monthPalette || ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#F43F5E','#22C55E','#06B6D4','#A855F7','#D97706','#14B8A6','#64748B'];
window.getMonthColor = function(monthIndex1to12){
  const idx = Math.max(1, Math.min(12, Number(monthIndex1to12||1))) - 1;
  if(!Array.isArray(window.__monthPalette) || window.__monthPalette.length<12){
    window.__monthPalette = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#F43F5E','#22C55E','#06B6D4','#A855F7','#D97706','#14B8A6','#64748B'];
  }
  return window.__monthPalette[idx];
};


// Routing and view management
const Views = {
  dashboard: () => window.DashboardView,
  inventory: () => window.InventoryView,
  invoices: () => window.InvoicesView,
  reports: () => window.ReportsView,
  feasibility: () => window.FeasibilityView,
  storeSettings: () => window.StoreSettingsView,
  assistantSettings: () => window.SmartAssistantSettingsView,
  assistantGuide: () => window.SmartAssistantGuideView,
};

function navigateTo(viewId){
  const root = document.getElementById('view-root');
  const view = Views[viewId]?.();
  if(!root || !view) return;
  // Tag dashboard-only class for red area overrides
  try{ root.classList.toggle('dashboard-root', viewId === 'dashboard'); }catch(_){ }
  Store.setState({ currentView: viewId });
  Sidebar.setActive(viewId);
  view.render(root);
  // Auto-refresh dashboard when navigating to it
  if(viewId === 'dashboard' && HAS_ELECTRON && window.electronAPI){
    try{ Toolbar?.showCompareControls?.(true); Toolbar?.rebuildCompareMonths?.(); }catch(_){ }
    // Recompute toolbar height in case controls changed its size
    try{ updateToolbarHeight(); }catch(_){ }
    refreshDashboard();
    bindMonthNav();
  }
  else {
    try{ Toolbar?.showCompareControls?.(false); }catch(_){ }
    try{ updateToolbarHeight(); }catch(_){ }
  }
}

function initLayout(){
  Sidebar.renderSidebar(document.getElementById('sidebar'), (id) => navigateTo(id));
  Toolbar.renderToolbar(document.getElementById('toolbar'));
  // Toolbar handles its own initial DB + internet status updates
  // Measure toolbar height and keep it updated on window resize
  try{
    updateToolbarHeight();
    window.addEventListener('resize', () => { updateToolbarHeight(); });
  }catch(_){ }
}

function refreshCurrentView(){
  const { currentView } = Store.getState();
  navigateTo(currentView);
}

// Compute and store toolbar height for dynamic viewport-calculated layouts
function updateToolbarHeight(){
  const tb = document.getElementById('toolbar');
  const h = tb ? tb.offsetHeight : 0;
  document.documentElement.style.setProperty('--toolbar-h', `${h}px`);
}

  function applyDashboardSummary(summary){
    try{
    // Reset Smart Assistant report outputs when dashboard refreshes
    try{
      const out = document.getElementById('assistantReportOut');
      if(out) out.innerHTML = '';
      const st = document.getElementById('assistantReportStatus');
      if(st){ st.style.display = 'none'; st.textContent = ''; }
      const ov = document.getElementById('assistantReportOverlay');
      if(ov) ov.style.display = 'none';
    }catch(_){ }
    // Update KPI cards (dashboard only)
    const dashRoot = document.getElementById('dashboardKpis');
    const kpiValues = dashRoot ? dashRoot.querySelectorAll('.kpi .value') : [];
    const k = summary?.kpis || {};
    // Net profit after removing 15% from monthly revenue (second card includes tax)
    const netAfter = Number((((k.totalInventoryValue||0) * 0.85)).toFixed(2));
    // Net Profit Rate for Inventory: margin% = (NetProfit / InventoryValue) * 100
    // Use COST-based inventory value (inventoryCostValueStock). Fallback: sum(cost * qty) from details
    const stockDetails = Array.isArray(summary?.stock?.details) ? summary.stock.details : [];
    const invFallback = stockDetails.reduce((acc, d) => acc + (Number(d.cost||0) * Number(d.qty||0)), 0);
    const invVal = Math.max(0, Number((k.inventoryCostValueStock ?? invFallback) || 0));
    const marginPct = Number((invVal > 0 ? ((netAfter / invVal) * 100) : 0).toFixed(2));
    // Format Monthly Profit to two decimals for display
    const monthlyProfit = Number(((k.totalInventoryValue||0)).toFixed(2));
    // KPI order: [Products, Total Monthly Revenue, Avg Margin, Net Profit]
    const vals = [k.totalProducts, monthlyProfit, marginPct+'%', netAfter];
    kpiValues.forEach((el, idx) => {
      const v = vals[idx];
      if(typeof v !== 'undefined') el.textContent = String(v);
    });
    // Update sales chart – robust against re-renders
    const canvas = document.getElementById('salesChart');
    if(canvas && window.Chart){
      // Ensure the card has a reasonable height so Chart can size properly
      try{ const parent = canvas.closest('.chart-card'); if(parent){ parent.style.minHeight = '300px'; } }catch(_){ }
      // If an existing chart is bound to a different canvas, destroy it
      if(window.__salesChart && window.__salesChart.ctx && window.__salesChart.ctx.canvas !== canvas){
        try{ if(window.__salesChart.__pulseRaf){ cancelAnimationFrame(window.__salesChart.__pulseRaf); window.__salesChart.__pulseRaf=null; } }catch(_){ }
        try{ window.__salesChart.destroy(); }catch(_){ }
        window.__salesChart = null;
      }
      // Reuse chart if bound to this canvas; otherwise create a new one
      const bound = window.__salesChart && window.__salesChart.ctx && window.__salesChart.ctx.canvas === canvas ? window.__salesChart : null;
      const existing = Chart.getChart(canvas);
      const chart = bound || existing || new Chart(canvas, {
        type:'line',
        data:{ labels:[], datasets:[{label:'المبيعات اليومية', data:[], borderColor:'#38BDF8', tension:0.35, pointRadius:0, pointHitRadius:8 }] },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{ legend:{ display:false } },
          scales:{
            y:{ beginAtZero:true, ticks:{ precision:2 } },
            x:{ ticks:{ display:false }, offset:false, bounds:'data' }
          },
          layout:{ padding:{ bottom: 22 } },
          animation:false
        }
      });
      window.__salesChart = chart;
      const labels = Array.isArray(summary?.chart?.labels) ? summary.chart.labels : [];
      const pointsRaw = Array.isArray(summary?.chart?.points) ? summary.chart.points : [];
      const points = pointsRaw.map(v => {
        const n = Number(v||0);
        return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
      });
      // Pad one empty cell at the start so day 1 begins at the second cell
      // Also start line from zero at the first (empty) cell
      chart.data.labels = [''].concat(labels);
      chart.data.datasets = [{
        label:'المبيعات اليومية',
        data: [0].concat(points),
        borderColor:'#38BDF8',
        tension:0.35,
        pointRadius:0,
        pointHitRadius:8
      }];
      if(chart.options?.plugins?.legend){ chart.options.plugins.legend.display = false; }
      // Adjust suggestedMax to prevent extreme scaling on decimals
  const max = points.length ? Math.max(...points) : 0;
  const y = chart.options.scales.y;
  if(y){ y.suggestedMax = max > 0 ? max * 1.1 : 10; }
  chart.update();

  // Pulsing peaks/troughs plugin and animation loop
  ensurePulsePlugin();
  ensureDaysPlugin();
  ensureRevealPlugin();
  ensurePulseAnimation(chart, points);
}
    // Update date range text
  try{
    // Month label and days strip
    const monthLabel = document.getElementById('monthLabel');
    const r = summary?.chart?.range;
    const sel = summary?.chart?.selectedMonth;
    if(monthLabel){
      const parts = (sel||'').split('-');
      const yyyy = Number(parts[0]||new Date().getFullYear());
      const mm = Number(parts[1]||new Date().getMonth()+1);
      const mName = new Date(yyyy, mm-1, 1).toLocaleString('en-US', { month:'long' });
      monthLabel.textContent = `${mName} ${yyyy}`;
    }
    const daysEl = document.getElementById('salesDays');
  if(daysEl && r && r.start && r.end){
      const s = new Date(r.start);
      const e = new Date(r.end);
      const totalDays = (e.getDate());
      // Clear DOM days strip to avoid double display; numbers are drawn via canvas plugin for exact alignment
      daysEl.textContent = '';
    }
  }catch(_){ }
  // Save snapshot for next comparison
  window.__lastSummary = summary || null;
}catch(e){ /* noop */ }
}

// ===== Comparison mode rendering =====
function applyComparisonSummaries(summaries){
  try{
    // Summaries: array of { summary, ym }
    const dashRoot = document.getElementById('dashboardKpis');
    const kpiValues = dashRoot ? dashRoot.querySelectorAll('.kpi .value') : [];
    const selSumm = summaries.map(s => s.summary).filter(Boolean);
    // Compute per-month metrics using same formulas
    const perMonth = selSumm.map(sum => {
      const k = sum?.kpis || {};
      const netAfter = Number((((k.totalInventoryValue||0) * 0.85)).toFixed(2));
      const stockDetails = Array.isArray(sum?.stock?.details) ? sum.stock.details : [];
      const invFallback = stockDetails.reduce((acc, d) => acc + (Number(d.cost||0) * Number(d.qty||0)), 0);
      const invVal = Math.max(0, Number((k.inventoryCostValueStock ?? invFallback) || 0));
      const marginPct = Number((invVal > 0 ? ((netAfter / invVal) * 100) : 0).toFixed(2));
      const monthlyProfit = Number(((k.totalInventoryValue||0)).toFixed(2));
      return { monthlyProfit, marginPct, netAfter };
    });
    const avg = (arr) => arr.length ? Number((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)) : 0;
    // KPI order: [Products, Total Monthly Revenue, Avg Margin, Net Profit]
    // In comparison mode: keep first card unchanged (products not meaningful per-month here), update cards 2-4 with averages
    const avgMonthlyProfit = avg(perMonth.map(m => m.monthlyProfit));
    const avgMarginPct = avg(perMonth.map(m => m.marginPct));
    const avgNetAfter = avg(perMonth.map(m => m.netAfter));
    const vals = [kpiValues[0]?.textContent || '—', avgMonthlyProfit, `${avgMarginPct}%`, avgNetAfter];
    kpiValues.forEach((el, idx) => {
      if(idx===0) return; // leave first card as-is
      const v = vals[idx];
      if(typeof v !== 'undefined') el.textContent = String(v);
    });
    // Sales chart: multiple datasets with legend
    const canvas = document.getElementById('salesChart');
    if(canvas && window.Chart){
      if(window.__salesChart && window.__salesChart.ctx && window.__salesChart.ctx.canvas !== canvas){
        try{ window.__salesChart.destroy(); }catch(_){ }
        window.__salesChart = null;
      }
      const bound = window.__salesChart && window.__salesChart.ctx && window.__salesChart.ctx.canvas === canvas ? window.__salesChart : null;
      const existing = Chart.getChart(canvas);
      const chart = bound || existing || new Chart(canvas, {
        type:'line',
        data:{ labels:[], datasets:[] },
        options:{
          responsive:true,
          maintainAspectRatio:false,
          plugins:{ legend:{ display:true, position:'bottom' } },
          scales:{ y:{ beginAtZero:true, ticks:{ precision:2 } }, x:{ ticks:{ display:false }, offset:false, bounds:'data' } },
          layout:{ padding:{ bottom: 22 } },
          animation:false
        }
      });
      window.__salesChart = chart;
      // Use brand gradient palette per month
      const baseLabels = Array.isArray(selSumm[0]?.chart?.labels) ? selSumm[0].chart.labels : [];
      chart.data.labels = [''].concat(baseLabels);
      chart.data.datasets = summaries.map((entry) => {
        const sum = entry?.summary;
        const pointsRaw = Array.isArray(sum?.chart?.points) ? sum.chart.points : [];
        const points = pointsRaw.map(v => { const n=Number(v||0); return Number.isFinite(n) ? Number(n.toFixed(2)) : 0; });
        const ym = entry?.ym || sum?.chart?.selectedMonth || '';
        const parts = String(ym).split('-');
        const yyyy = Number(parts[0]||new Date().getFullYear());
        const mm = Number(parts[1]||1);
        const mName = new Date(yyyy, mm-1, 1).toLocaleString('ar', { month:'long' });
        const color = typeof window.getMonthColor === 'function' ? window.getMonthColor(mm) : '#38BDF8';
        return {
          label: `${mName} ${yyyy}`,
          data: [0].concat(points),
          borderColor: color,
          tension:0.35,
          pointRadius:0,
          pointHitRadius:8
        };
      });
      const y = chart.options.scales.y;
      const allPoints = chart.data.datasets.flatMap(d => d.data.slice(1));
      const max = allPoints.length ? Math.max(...allPoints) : 0;
      if(y){ y.suggestedMax = max > 0 ? max * 1.1 : 10; }
      chart.update();
      ensurePulsePlugin();
      ensureDaysPlugin();
      ensureRevealPlugin();
      // no pulse animation per-dataset in comparison mode
    }
    // Month label indicate comparison mode
    const monthLabel = document.getElementById('monthLabel');
    if(monthLabel){ monthLabel.textContent = 'وضع المقارنة'; }
    window.__lastSummary = null; // disable delta badges in comparison mode
  }catch(_){ }
}

// ===== Month navigation =====
function getSelectedMonth(){
  if(typeof window.__selectedMonth === 'string') return window.__selectedMonth;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
function setSelectedMonth(ym){ window.__selectedMonth = ym; }
function shiftMonth(delta){
  const cur = getSelectedMonth();
  const y = Number(cur.slice(0,4)); const m = Number(cur.slice(5,7));
  const d = new Date(y, m-1, 1);
  d.setMonth(d.getMonth()+delta);
  const ym = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  setSelectedMonth(ym);
}

function bindMonthNav(){
  const prev = document.getElementById('monthPrev');
  const next = document.getElementById('monthNext');
  if(prev){ prev.addEventListener('click', async () => {
    shiftMonth(-1);
    try{ Toolbar?.rebuildCompareMonths?.(); }catch(_){ }
    await refreshDashboard();
  }); }
  if(next){ next.addEventListener('click', async () => {
    shiftMonth(1);
    try{ Toolbar?.rebuildCompareMonths?.(); }catch(_){ }
    await refreshDashboard();
  }); }
}

// Ensure nav binds whenever dashboard renders
document.addEventListener('click', (e) => {
  if(e.target && (e.target.id==='monthPrev' || e.target.id==='monthNext')){
    // events handled in bind; noop
  }
});

// Hook into navigation to initialize month label
const _origApply = window.App?.applyDashboardSummary;
if(!_origApply){ /* ensure exported later */ }

window.App = { showToast, navigateTo, refreshCurrentView, applyDashboardSummary };

// Unified dashboard refresh respecting comparison mode
async function refreshDashboard(){
  try{
    if(!HAS_ELECTRON || !window.electronAPI) return;
    const isCompare = !!window.__compareMode;
    const months = Array.isArray(window.__compareMonths) ? window.__compareMonths.slice(0,12) : [];
    if(isCompare && months.length){
      const tasks = months.map(m => window.electronAPI.updateDashboards({ month:m }).then(r => ({ ok:r?.ok, summary:r?.summary, ym:m })).catch(()=>({ ok:false, summary:null, ym:m })));
      const res = await Promise.all(tasks);
      const good = res.filter(x => x.ok && x.summary);
      if(good.length){ applyComparisonSummaries(good); }
    }else{
      const sel = getSelectedMonth();
      const r = await window.electronAPI.updateDashboards({ month: sel });
      if(r?.ok){
        applyDashboardSummary(r.summary);
        // After rendering default month, compute annual aggregates to override cards 3 & 4
        try{
          const yyyy = Number(String(sel).split('-')[0]||new Date().getFullYear());
          const allMonths = Array.from({length:12}, (_,_i) => `${yyyy}-${String(_i+1).padStart(2,'0')}`);
          const tasks = allMonths.map(m => window.electronAPI.updateDashboards({ month:m }).then(r => ({ ok:r?.ok, summary:r?.summary })).catch(()=>({ ok:false, summary:null })));
          const res = await Promise.all(tasks);
          const samples = res.filter(x => x.ok && x.summary).map(x => x.summary);
          if(samples.length){
            const per = samples.map(sum => {
              const k = sum?.kpis || {};
              const netAfter = Number((((k.totalInventoryValue||0) * 0.85)).toFixed(2));
              return { netAfter };
            });
            const sum = (arr) => arr.reduce((a,b)=>a+b,0);
            const annualNetAfter = Number(sum(per.map(p=>p.netAfter)).toFixed(2));
            const dashRoot = document.getElementById('dashboardKpis');
            const kpiValues = dashRoot ? dashRoot.querySelectorAll('.kpi .value') : [];
            if(kpiValues[3]) kpiValues[3].textContent = String(annualNetAfter);
          }
        }catch(_){ /* noop */ }
      }
    }
  }catch(_){ }
}

window.App.refreshDashboard = refreshDashboard;

// Bind month nav when dashboard becomes active
function initMonthNavIfPresent(){
  bindMonthNav();
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  initLayout();
  
  // Check license status first if in Electron
  if(HAS_ELECTRON && window.electronAPI && typeof LicenseActivation !== 'undefined'){
    try{
      const licenseStatus = await window.electronAPI.licenseCheckStatus();
      if(!licenseStatus.activated && licenseStatus.status === 'activation_required'){
        // Show activation dialog
        const licenseDialog = new LicenseActivation();
        licenseDialog.show();
        return; // Don't continue with normal app initialization until activated
      }
    }catch(e){ 
      console.error('License check error:', e);
    }
  }
  
  // Clean app data for production if needed
  if(HAS_ELECTRON && window.AppCleaner){
    try{
      const needsCleanup = await window.AppCleaner.shouldCleanForProduction();
      const wasCleanupCompleted = await window.AppCleaner.wasCleanupCompleted();
      
      if(needsCleanup && !wasCleanupCompleted){
        console.log('First run detected - cleaning app data for production');
        await window.AppCleaner.cleanForProduction();
        await window.AppCleaner.markCleanupComplete();
        showToast('تم تهيئة التطبيق للاستخدام الأول');
      }
    }catch(e){
      console.error('App cleanup error:', e);
    }
  }
  
  if(HAS_ELECTRON && window.dbManager){
    try{
      const p = await window.dbManager.getDatabasePath();
      if(p){ showToast('قاعدة البيانات جاهزة.'); }
    }catch(e){ /* noop */ }
  }
  // initial route from hash or default
  const initial = (location.hash || '#dashboard').replace('#','');
  navigateTo(initial);
  // Auto-refresh dashboard on startup
  try{
    if(HAS_ELECTRON && window.electronAPI){
      await refreshDashboard();
    }
  }catch(e){ /* noop */ }
  window.addEventListener('hashchange', () => {
    const v = (location.hash || '#dashboard').replace('#','');
    navigateTo(v);
  });
});

// ===== Pulsing peaks plugin =====
function ensurePulsePlugin(){
  if(window.__pulsePluginRegistered) return;
  const pulsePlugin = {
    id:'pulse-peaks',
    afterDatasetsDraw(chart){
      // Clip pulses to reveal progress so they appear as the line traverses
      const area = chart.chartArea;
      const ctx = chart.ctx;
      const p = Math.max(0, Math.min(1, Number(chart.__revealProgress||0)));
      if(area && ctx){
        ctx.save();
        const w = (area.right - area.left) * p;
        ctx.rect(area.left, area.top, w, area.bottom - area.top);
        ctx.clip();
      }
      const ds = chart.data?.datasets?.[0];
      if(!ds) return;
      const data = Array.isArray(ds.data) ? ds.data.map(v => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }) : [];
      const meta = chart.getDatasetMeta(0);
      const time = performance.now();
      const radiusBase = 3;
      const radiusPulse = 2 * (0.5 + 0.5*Math.sin(time/300));
      const indices = [];
      for(let i=0;i<data.length;i++){
        const prev = i>0 ? data[i-1] : null;
        const next = i<data.length-1 ? data[i+1] : null;
        const cur = data[i];
        if(prev==null || next==null || cur==null) continue;
        const isPeak = cur>prev && cur>next;
        const isTrough = cur<prev && cur<next;
        if(isPeak || isTrough) indices.push(i);
      }
      ctx.save();
      indices.forEach(i => {
        const pt = meta.data?.[i];
        if(!pt) return;
        const x = pt.x; const y = pt.y;
        ctx.beginPath();
        ctx.arc(x, y, radiusBase + radiusPulse, 0, Math.PI*2);
        ctx.strokeStyle = '#38BDF8';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.restore();
      if(area && ctx){ ctx.restore(); }
    }
  };
  if(typeof Chart !== 'undefined' && Chart?.register){ Chart.register(pulsePlugin); }
  window.__pulsePluginRegistered = true;
}

// Draw day numbers aligned with chart ticks below the chart area
function ensureDaysPlugin(){
  if(window.__daysPluginRegistered) return;
  const daysPlugin = {
    id:'days-strip',
    afterDraw(chart){
      const labels = Array.isArray(chart.data?.labels) ? chart.data.labels : [];
      if(!labels.length) return;
      const xScale = chart.scales?.x;
      const ctx = chart.ctx;
      const area = chart.chartArea;
      if(!xScale || !area) return;
      ctx.save();
      ctx.font = '10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const y = area.bottom + 4;
      for(let i=0;i<labels.length;i++){
        let x;
        try{
          if(typeof xScale.getPixelForTick === 'function') x = xScale.getPixelForTick(i);
          else x = xScale.getPixelForValue(labels[i]);
        }catch(_){ x = null; }
        if(x==null) continue;
        const iso = typeof labels[i] === 'string' ? labels[i] : '';
        if(/^\d{4}-\d{2}-\d{2}$/.test(iso)){
          const d = iso.slice(8,10);
          ctx.fillText(d, x, y);
        }
      }
      ctx.restore();
    }
  };
  if(typeof Chart !== 'undefined' && Chart?.register){ Chart.register(daysPlugin); }
  window.__daysPluginRegistered = true;
}

function ensurePulseAnimation(chart, points){
  try{
    if(chart.__pulseRaf){ cancelAnimationFrame(chart.__pulseRaf); chart.__pulseRaf = null; }
  }catch(_){ }
  // Initialize reveal animation meta
  chart.__revealStart = performance.now();
  chart.__revealDuration = 3600; // ms (more slow reveal)
  chart.__revealProgress = 0;
  function tick(){
    if(chart && chart.ctx){
      // Update reveal progress
      const t = performance.now();
      const dur = Number(chart.__revealDuration||900);
      const start = Number(chart.__revealStart||t);
      const p = Math.max(0, Math.min(1, (t - start) / dur));
      chart.__revealProgress = p;
      chart.draw();
      chart.__pulseRaf = requestAnimationFrame(tick);
    }
  }
  chart.__pulseRaf = requestAnimationFrame(tick);
}
// Reveal the line from left to right using a clipping plugin
function ensureRevealPlugin(){
  if(window.__revealPluginRegistered) return;
  const revealPlugin = {
    id:'reveal-line',
    beforeDatasetsDraw(chart){
      const area = chart.chartArea;
      const ctx = chart.ctx;
      const p = Math.max(0, Math.min(1, Number(chart.__revealProgress||0)));
      if(!area || !ctx) return;
      ctx.save();
      const w = (area.right - area.left) * p;
      ctx.rect(area.left, area.top, w, area.bottom - area.top);
      ctx.clip();
    },
    afterDatasetsDraw(chart){
      try{ chart.ctx.restore(); }catch(_){ }
    }
  };
  if(typeof Chart !== 'undefined' && Chart?.register){ Chart.register(revealPlugin); }
  window.__revealPluginRegistered = true;
}
