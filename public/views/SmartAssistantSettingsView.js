// Smart Assistant Settings view: manage OpenAI key, preferred name, and guide navigation
(function(){
  const View = {
    id: 'assistantSettings',
    name: 'إعدادات المساعد الذكي',
    async render(root){
      // Clear any previous internet polling when re-rendering this view
      if(View.__internetTimer){ try{ clearInterval(View.__internetTimer); }catch(_){ } View.__internetTimer = null; }
      root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr';
      wrap.style.gap = '12px';

      const header = document.createElement('div');
      header.className = 'card';
      header.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div class="label">إعدادات المساعد الذكي</div>
          <button id="assistantGuideBtn" class="btn btn-ghost">طريقة تفعيل المساعد الذكي 🔑🤖</button>
        </div>
        <div class="status" style="margin-top:8px">قم بإعداد مفتاح OpenAI واسمك المفضل لتفعيل ميزات المساعد الذكي.</div>
      `;

      const form = document.createElement('div');
      form.className = 'card';
      form.innerHTML = `
        <div class="label">المفتاح والاسم</div>
        <div style="display:grid;grid-template-columns:1fr;gap:10px">
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
            <input id="assistantApiKey" type="password" placeholder="أدخل OpenAI API Key" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <button id="assistantResetKey" class="btn btn-ghost">إعادة تعيين المفتاح</button>
          </div>
          <div id="netStatus" class="net-status bad" style="display:flex;align-items:center;gap:10px">
            <span class="dot" aria-hidden="true"></span>
            <span class="text">لا يوجد اتصال بالإنترنت</span>
            <button id="netRetry" class="btn btn-ghost" style="padding:.3rem .6rem">إعادة المحاولة</button>
          </div>
          <input id="assistantPreferredName" type="text" placeholder="اسمك المفضل الذي سيناديك به المساعد" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
          <button id="assistantSave" class="btn">حفظ</button>
        </div>
        <div id="assistantStatus" class="status" style="display:none;margin-top:8px"></div>
      `;

      wrap.append(header, form);
      root.appendChild(wrap);

      // Load existing name setting and last invalid fingerprint
      try{
        const s = await window.dbManager?.getSettings?.();
        const name = s?.settings?.['assistant.name'] || '';
        document.getElementById('assistantPreferredName').value = name;
        View.__lastInvalidFingerprint = s?.settings?.['assistant.lastInvalidFingerprint'] || '';
      }catch(_){ }

      // Reflect whether a key exists
      let lastFingerprint = '';
      try{
        const fp = await window.electronAPI?.aiGetKeyFingerprint?.();
        lastFingerprint = fp?.fingerprint || '';
      }catch(_){ }

      document.getElementById('assistantGuideBtn')?.addEventListener('click', () => {
        location.hash = '#assistantGuide';
      });

      function setStatus(msg, show = true){
        const el = document.getElementById('assistantStatus');
        if(!el) return;
        el.textContent = msg;
        el.style.display = show ? '' : 'none';
      }

      // Internet connectivity indicator & logic
      function renderNetIndicator(isOnline){
        const el = document.getElementById('netStatus');
        if(!el) return;
        el.classList.remove('ok','bad');
        el.classList.add(isOnline ? 'ok' : 'bad');
        const textEl = el.querySelector('.text');
        if(textEl) textEl.textContent = isOnline ? 'متصل بالإنترنت' : 'لا يوجد اتصال بالإنترنت';
      }
      async function checkInternet(){
        // Robust multi-probe approach to avoid false negatives
        const base = navigator.onLine;
        const timeout = 6000;
        const testFetch = async (url) => {
          try{
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), timeout);
            await fetch(url, { method:'GET', mode:'no-cors', cache:'no-store', signal:ctrl.signal });
            clearTimeout(t);
            return true;
          }catch(_){ return false; }
        };
        const testImage = async (url) => new Promise(resolve => {
          const img = new Image();
          let done=false;
          const tm = setTimeout(()=>{ if(!done){ done=true; resolve(false); } }, timeout);
          img.onload = () => { if(!done){ done=true; clearTimeout(tm); resolve(true); } };
          img.onerror = () => { if(!done){ done=true; clearTimeout(tm); resolve(false); } };
          img.crossOrigin = 'anonymous';
          img.src = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();
        });
        const probes = [
          testFetch('https://www.gstatic.com/generate_204'),
          testImage('https://www.google.com/favicon.ico'),
          testImage('https://www.cloudflare.com/favicon.ico'),
          testImage('https://www.microsoft.com/favicon.ico')
        ];
        const results = await Promise.allSettled(probes);
        const ok = results.some(r => r.status==='fulfilled' && r.value===true);
        const online = base ? true : ok;
        renderNetIndicator(online);
        return online;
      }
      // Initial check and periodic polling
      checkInternet();
      View.__internetTimer = setInterval(checkInternet, 10000);
      window.addEventListener('online', () => { renderNetIndicator(true); onConnectivityRecovered(); });
      window.addEventListener('offline', () => { renderNetIndicator(false); window.App?.showToast?.('انقطع الاتصال بالإنترنت'); });

      async function onConnectivityRecovered(){
        try{
          const has = await window.aiClient?.hasKey?.();
          if(has){
            const ok = await window.aiClient?.testKey?.();
            if(ok){
              window.App?.showToast?.('تم استرداد الاتصال. تم تفعيل المساعد الذكي');
              setStatus('متصل بالإنترنت. المساعد الذكي جاهز للاستخدام.', true);
            }
          }
        }catch(_){ }
      }

      document.getElementById('netRetry')?.addEventListener('click', async () => {
        const online = await checkInternet();
        if(online){ await onConnectivityRecovered(); }
      });

      // Unified loading overlay (matches Smart Assistant report style)
      function ensureAssistantOverlay(){
        let ov = document.getElementById('assistantReportOverlay');
        if(ov) return ov;
        ov = document.createElement('div');
        ov.id = 'assistantReportOverlay';
        ov.style.display = 'none';
        ov.innerHTML = `
          <div style="position:fixed;inset:0;background:rgba(11,15,22,.55);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center">
            <div class="card" style="padding:24px;min-width:320px;text-align:center">
              <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
                <svg width="56" height="56" viewBox="0 0 50 50" aria-hidden="true">
                  <defs>
                    <linearGradient id="lg-assistant" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stop-color="var(--primary-start)" />
                      <stop offset="100%" stop-color="var(--primary-end)" />
                    </linearGradient>
                  </defs>
                  <circle cx="25" cy="25" r="20" stroke="var(--chip-border)" stroke-width="5" fill="none" opacity=".25"></circle>
                  <path d="M25 5 A20 20 0 0 1 45 25" stroke="url(#lg-assistant)" stroke-width="5" fill="none">
                    <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                  </path>
                </svg>
                <div id="assistantOverlayLabel" class="label">جارٍ تطبيق إعدادات المساعد الذكي</div>
                <div id="assistantOverlayStatus" class="status">سيُعاد تشغيل التطبيق خلال لحظات…</div>
              </div>
            </div>
          </div>`;
        document.body.appendChild(ov);
        return ov;
      }
      function showAssistantOverlay(labelText, statusText){
        const ov = ensureAssistantOverlay();
        const lbl = ov.querySelector('#assistantOverlayLabel');
        const st = ov.querySelector('#assistantOverlayStatus');
        if(lbl) lbl.textContent = labelText || 'جارٍ تطبيق إعدادات المساعد الذكي';
        if(st) st.textContent = statusText || 'سيُعاد تشغيل التطبيق خلال لحظات…';
        ov.style.display = 'block';
      }
      function hideAssistantOverlay(){
        const ov = document.getElementById('assistantReportOverlay');
        if(ov) ov.style.display = 'none';
      }

      document.getElementById('assistantResetKey')?.addEventListener('click', async () => {
        const confirmReset = confirm('سيتم حذف المفتاح الحالي. هل أنت متأكد؟');
        if(!confirmReset) return;
        try{
          const fp = await window.electronAPI?.aiGetKeyFingerprint?.();
          lastFingerprint = fp?.fingerprint || lastFingerprint || '';
        }catch(_){ }
        try{
          await window.electronAPI?.aiDeleteKey?.();
          // Store last invalid fingerprint for future comparison (no raw key stored)
          if(lastFingerprint){ try{ await window.dbManager?.setSetting?.('assistant.lastInvalidFingerprint', lastFingerprint); }catch(_){ } }
          setStatus('تم حذف المفتاح. يرجى إدخال مفتاح جديد ثم الحفظ.');
          window.App?.showToast?.('تم حذف المفتاح');
        }catch(e){ setStatus('تعذر حذف المفتاح'); }
      });

      document.getElementById('assistantSave')?.addEventListener('click', async () => {
        const key = (document.getElementById('assistantApiKey')?.value||'').trim();
        const name = (document.getElementById('assistantPreferredName')?.value||'').trim();
        if(!key){ window.App?.showToast?.('يرجى إدخال OpenAI API Key'); setStatus('يرجى إدخال OpenAI API Key'); return; }
        // Block saving when offline to avoid confusing errors
        const online = await checkInternet();
        if(!online){ setStatus('لا يوجد اتصال. يرجى الاتصال بالإنترنت ثم إعادة المحاولة.'); window.App?.showToast?.('لا يوجد اتصال بالإنترنت'); return; }
        setStatus('جارٍ التحقق من المفتاح وحفظ الإعدادات...');
        try{
          await window.electronAPI?.aiSetKey?.(key);
          if(name) await window.dbManager?.setSetting?.('assistant.name', name);
          const test = await window.aiClient?.testKey?.();
          // Compare fingerprint (best-effort)
          let newFp = '';
          try{ const fp = await window.electronAPI?.aiGetKeyFingerprint?.(); newFp = fp?.fingerprint || ''; }catch(_){ }
          // Reject if identical to previously invalidated key
          const prevInvalid = View.__lastInvalidFingerprint || '';
          if(prevInvalid && newFp && prevInvalid === newFp){
            setStatus('يبدو أن هذا المفتاح مطابق لمفتاحك السابق المنتهي. يرجى تزويد مفتاح OpenAI جديد صالح.');
            window.App?.showToast?.('المفتاح مطابق للمفتاح السابق غير الصالح');
            return;
          }
          // Notice if fingerprint unchanged (non-blocking info)
          if(lastFingerprint && newFp && lastFingerprint === newFp){ window.App?.showToast?.('المفتاح لم يتغير'); }
          if(test){
            setStatus('تم حفظ المفتاح والاسم بنجاح. سيُعاد تشغيل التطبيق لتطبيق الإعدادات.');
            window.App?.showToast?.('تم حفظ الإعدادات بنجاح');
            // Show 5-second loading window informing restart
            showAssistantOverlay('جارٍ تطبيق الإعدادات', 'سيُعاد تشغيل التطبيق خلال 5 ثوانٍ…');
            const saveBtn = document.getElementById('assistantSave');
            if(saveBtn){ saveBtn.disabled = true; saveBtn.classList.add('btn-primary'); }
            await new Promise(r => setTimeout(r, 5000));
            try{ await window.electronAPI?.appRelaunch?.(); }
            catch(_){ hideAssistantOverlay(); location.reload(); }
          } else {
            setStatus('المفتاح غير صالح. يرجى التحقق والمحاولة مرة أخرى.');
            window.App?.showToast?.('المفتاح غير صالح.');
          }
        }catch(e){ setStatus('تعذر حفظ الإعدادات. تحقق من الشبكة ثم أعد المحاولة.'); }
      });
    }
  };
  window.SmartAssistantSettingsView = View;
})();
