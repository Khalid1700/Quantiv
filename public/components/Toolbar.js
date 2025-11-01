// Toolbar component: shows title, Excel path, and actions
// Toolbar component: shows title, Excel path, and actions
(function(){
  let __dbStatusSeq = 0; // coalesce concurrent updates
  let __netStatusSeq = 0; // coalesce concurrent internet updates
  // Ensure only one DB status exists in DOM
  function ensureSingleDbStatus(){
    try{
      const nodes = document.querySelectorAll('.db-status');
      if(nodes.length>1){
        nodes.forEach((n,i) => { if(i>0) n.remove(); });
      }
    }catch(_){ /* noop */ }
  }
  // Ensure only one Net status exists in DOM
  function ensureSingleNetStatus(){
    try{
      const nodes = document.querySelectorAll('.net-status');
      if(nodes.length>1){
        nodes.forEach((n,i) => { if(i>0) n.remove(); });
      }
    }catch(_){ /* noop */ }
  }
  function renderToolbar(container){
    if(!container) return;
    container.innerHTML = '';
    const left = document.createElement('div');
    left.className = 'title';
    left.innerHTML = `
      <div class="brand">
        <img src="./icons/app-32.png" alt="" class="logo">
        <h1 class="text-lg app-name">Quantiv</h1>
      </div>
      <div id="dbStatus" class="db-status"></div>
      <div id="netStatusToolbar" class="net-status" style="margin-top:4px"></div>
      <div id="compareModeWrap" style="margin-top:4px;display:none"></div>
    `;
    const right = document.createElement('div');
    right.className = 'actions';
    // لا توجد إجراءات علوية مطلوبة حاليًا بعد إزالة زر التحديث
    right.append(document.createElement('div'));
    container.append(left, right);

    // Initialize comparison controls
    initCompareControls();
    // Prevent duplicate status indicators
    ensureSingleDbStatus();
    ensureSingleNetStatus();
    // تحديث حالة اتصال قاعدة البيانات
    try{ updateDbPath(); }catch(_){ }
    // تحديث حالة الاتصال بالإنترنت
    try{ updateNetStatus(); }catch(_){ }
    // Start lightweight polling for internet status (global)
    try{
      if(window.__netStatusTimer){ clearInterval(window.__netStatusTimer); }
      window.__netStatusTimer = setInterval(() => { try{ updateNetStatus(); }catch(_){ } }, 12000);
      window.addEventListener('online', () => { try{ updateNetStatus(true); }catch(_){ } });
      window.addEventListener('offline', () => { try{ updateNetStatus(false); }catch(_){ } });
    }catch(_){ }
  }

  async function updateDbPath(){
    const mySeq = ++__dbStatusSeq;
    const el = document.getElementById('dbStatus');
    if(!el) return;
    // Prevent duplicates before updating
    ensureSingleDbStatus();
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const text = document.createElement('span');
    text.className = 'text';
    let connected = false;
    try{
      const p = await window.dbManager.getDatabasePath();
      if(p){
        // Attempt a lightweight call to confirm IPC & DB are responsive
        try{ const s = await window.dbManager.getSettings(); connected = !!s; }
        catch(_){ connected = true; /* path is present, assume connected */ }
      }
    }catch(_){ connected = false; }
    // If a newer update started, abort writing to avoid duplicates
    if(mySeq !== __dbStatusSeq) return;
    if(connected){
      el.classList.add('ok'); el.classList.remove('bad');
      text.textContent = 'قاعدة البيانات: متصلة';
    }else{
      el.classList.add('bad'); el.classList.remove('ok');
      text.textContent = 'قاعدة البيانات: غير متصلة';
    }
    wrap.append(dot, text);
    el.appendChild(wrap);
  }

  async function updateNetStatus(forceOnline){
    const mySeq = ++__netStatusSeq;
    const el = document.getElementById('netStatusToolbar');
    if(!el) return;
    ensureSingleNetStatus();
    el.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const text = document.createElement('span');
    text.className = 'text';
    async function probeInternet(){
      const base = navigator.onLine;
      const timeout = 5000;
      const testFetch = async (url) => {
        try{
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), timeout);
          await fetch(url, { method:'GET', mode:'no-cors', cache:'no-store', signal:ctrl.signal });
          clearTimeout(t);
          return true;
        }catch(_){ return false; }
      };
      const testImage = async (url) => {
        return new Promise(resolve => {
          const img = new Image();
          let done = false;
          const tm = setTimeout(() => { if(!done){ done=true; resolve(false); } }, timeout);
          img.onload = () => { if(!done){ done=true; clearTimeout(tm); resolve(true); } };
          img.onerror = () => { if(!done){ done=true; clearTimeout(tm); resolve(false); } };
          img.crossOrigin = 'anonymous';
          img.src = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
        });
      };
      const probes = [
        testFetch('https://www.gstatic.com/generate_204'),
        testImage('https://www.google.com/favicon.ico'),
        testImage('https://www.cloudflare.com/favicon.ico'),
        testImage('https://www.microsoft.com/favicon.ico')
      ];
      const results = await Promise.allSettled(probes);
      const ok = results.some(r => r.status === 'fulfilled' && r.value === true);
      return ok || base;
    }
    let online = typeof forceOnline === 'boolean' ? forceOnline : (navigator.onLine ? true : await probeInternet());
    if(mySeq !== __netStatusSeq) return;
    if(online){
      el.classList.add('ok'); el.classList.remove('bad');
      text.textContent = 'الإنترنت: متصل';
    }else{
      el.classList.add('bad'); el.classList.remove('ok');
      text.textContent = 'الإنترنت: غير متصل';
    }
    wrap.append(dot, text);
    el.appendChild(wrap);
  }

  function initCompareControls(){
    const wrap = document.getElementById('compareModeWrap');
    if(!wrap) return;
    wrap.innerHTML = '';
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.gap = '8px';
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'compareToggle';
    toggleBtn.className = 'btn btn-ghost';
    toggleBtn.textContent = 'وضع المقارنة';
    const disableBtn = document.createElement('button');
    disableBtn.id = 'compareDisable';
    disableBtn.className = 'btn btn-ghost';
    disableBtn.textContent = 'تعطيل وضع المقارنة';
    disableBtn.style.display = 'none';
    const panel = document.createElement('div');
    panel.id = 'comparePanel';
    panel.style.display = 'none';
    panel.style.marginTop = '6px';
    panel.style.padding = '.4rem';
    panel.style.border = '1px solid var(--chip-border)';
    panel.style.background = 'var(--chip)';
    panel.style.borderRadius = '10px';
    const legendNote = document.createElement('div');
    legendNote.className = 'status';
    legendNote.textContent = 'اختر عدة أشهر للمقارنة (نفس السنة)';
    legendNote.style.marginBottom = '6px';
    const monthsRow = document.createElement('div');
    monthsRow.id = 'compareMonthsRow';
    monthsRow.style.display = 'flex';
    monthsRow.style.flexWrap = 'wrap';
    monthsRow.style.gap = '6px';
    panel.append(legendNote, monthsRow);
    bar.append(toggleBtn, disableBtn);
    wrap.append(bar, panel);

    toggleBtn.addEventListener('click', () => {
      window.__compareMode = true;
      window.__compareMonths = Array.isArray(window.__compareMonths) ? window.__compareMonths : [];
      toggleBtn.style.display = 'none';
      disableBtn.style.display = '';
      panel.style.display = '';
      rebuildCompareMonths();
      try{ window.App?.refreshDashboard?.(); }catch(_){ }
    });
    disableBtn.addEventListener('click', () => {
      window.__compareMode = false;
      window.__compareMonths = [];
      // Reset selected month to current
      try{
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        window.__selectedMonth = ym;
      }catch(_){ }
      disableBtn.style.display = 'none';
      toggleBtn.style.display = '';
      panel.style.display = 'none';
      try{ window.App?.refreshDashboard?.(); }catch(_){ }
    });
  }

  function rebuildCompareMonths(){
    const row = document.getElementById('compareMonthsRow');
    if(!row) return;
    row.innerHTML='';
    const sel = (typeof window.__selectedMonth === 'string' ? window.__selectedMonth : (() => { const n=new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; })());
    const year = Number((sel||'').split('-')[0]||new Date().getFullYear());
    const names = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const fallbackColors = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#F43F5E','#22C55E','#06B6D4','#A855F7','#D97706','#14B8A6','#64748B'];
    for(let i=1;i<=12;i++){
      const ym = `${year}-${String(i).padStart(2,'0')}`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      const col = (typeof window.getMonthColor === 'function') ? window.getMonthColor(i) : fallbackColors[(i-1)%fallbackColors.length];
      btn.style.border = `1px solid ${col}`;
      btn.style.color = col;
      btn.style.padding = '.3rem .5rem';
      btn.textContent = names[i-1];
      btn.dataset.month = ym;
      const selected = Array.isArray(window.__compareMonths) && window.__compareMonths.includes(ym);
      btn.style.background = selected ? 'var(--chip)' : 'transparent';
      btn.addEventListener('click', () => {
        window.__compareMonths = Array.isArray(window.__compareMonths) ? window.__compareMonths : [];
        const idx = window.__compareMonths.indexOf(ym);
        if(idx>=0) window.__compareMonths.splice(idx,1); else window.__compareMonths.push(ym);
        rebuildCompareMonths();
        try{ window.App?.refreshDashboard?.(); }catch(_){ }
      });
      row.appendChild(btn);
    }
  }

  function showCompareControls(isDashboard){
    const wrap = document.getElementById('compareModeWrap');
    if(!wrap) return;
    wrap.style.display = isDashboard ? '' : 'none';
  }

  window.Toolbar = { renderToolbar, updateDbPath, showCompareControls, rebuildCompareMonths, updateNetStatus };
})();
