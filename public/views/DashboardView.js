// DashboardView: KPI cards and two charts (placeholder setup)
(function(){
  const View = {
    id: 'dashboard',
    name: 'لوحة التحكم',
    async render(root){
      root.innerHTML = '';
      const kpiGrid = document.createElement('div');
      kpiGrid.className = 'grid kpis';
      kpiGrid.id = 'dashboardKpis';
      const kpis = [
        { label:'عدد المنتجات', value:'—' },
        { label:'الربح الشهري الإجمالي', value:'—' },
        { label:'معدل صافي الربح للمخزون', value:'—' },
        { label:'صافي الربح', value:'—' },
      ];
      kpis.forEach(k => {
        const c = document.createElement('div');
        c.className = 'card kpi';
        c.innerHTML = `<div class="label">${k.label}</div><div class="value">${k.value}</div>`;
        kpiGrid.appendChild(c);
      });
      root.appendChild(kpiGrid);

      const chartsRow = document.createElement('div');
      chartsRow.className = 'grid';
      const chart1 = document.createElement('div');
      chart1.className = 'card chart-card';
      chart1.id = 'salesPerformanceCard';
      chart1.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="label" style="display:flex;align-items:center;gap:12px">
            <span>أداء المبيعات</span>
            <div id="monthNav" class="month-nav">
              <button id="monthPrev" class="btn btn-ghost" title="Previous"><</button>
              <span id="monthLabel" class="status month-label">—</span>
              <button id="monthNext" class="btn btn-ghost" title="Next">></button>
            </div>
          </div>
        </div>
        <div style="position:relative;height:320px"><canvas id="salesChart"></canvas></div>
        <div id="salesDays" class="status" style="margin-top:8px;font-size:.85rem;white-space:nowrap;overflow:auto"></div>
        <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
          <button id="assistantReportBtn" class="btn">تقرير المساعد الذكي</button>
          <div id="assistantReportStatus" class="status" style="display:none"></div>
        </div>
        <div id="assistantReportOut" style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px"></div>`;
      chartsRow.append(chart1);
      root.appendChild(chartsRow);

      // Keep Sales Performance card self-scrolling and independent of container sizing.
      // Height is controlled via CSS clamp in components.css.

      // Dashboard content inherits scrolling from view-root; no internal scroll controls
      // No placeholder charts; they will be created/updated by applyDashboardSummary
      // Wire Smart Assistant Report
      const btn = chart1.querySelector('#assistantReportBtn');
      const status = chart1.querySelector('#assistantReportStatus');
      const out = chart1.querySelector('#assistantReportOut');
      // Reuse store settings overlay style for loading
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
                <div id="assistantOverlayLabel" class="label">جارٍ توليد تقرير المساعد الذكي</div>
                <div id="assistantOverlayStatus" class="status">يتم تحليل سلوك الرسم وتوليد خطة التحسين والنصائح التسويقية…</div>
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
        if(lbl) lbl.textContent = labelText || 'جارٍ توليد تقرير المساعد الذكي';
        if(st) st.textContent = statusText || 'يتم تحليل سلوك الرسم وتوليد خطة التحسين والنصائح التسويقية…';
        ov.style.display = 'block';
      }
      function hideAssistantOverlay(){
        const ov = document.getElementById('assistantReportOverlay');
        if(ov) ov.style.display = 'none';
      }
      function setBusy(b, msg){
        if(btn){ btn.disabled = !!b; btn.classList.toggle('btn-primary', !!b); }
        if(status){ status.style.display = msg ? '' : 'none'; status.textContent = msg||''; }
      }
      btn?.addEventListener('click', async () => {
        try{
          // Ensure key exists and is valid
          let hasKey = false, validKey = false;
          try{ hasKey = !!(await window.aiClient?.hasKey?.()); }catch(_){ }
          try{ validKey = !!(await window.aiClient?.testKey?.()); }catch(_){ }
          if(!hasKey){ setBusy(false, 'يرجى إعداد مفتاح OpenAI أولاً من إعدادات المساعد الذكي.'); window.App?.showToast?.('يرجى إعداد المفتاح أولاً'); return; }
          if(!validKey){ setBusy(false, 'المفتاح غير صالح. انتقل إلى إعدادات المساعد الذكي لتحديثه.'); window.App?.showToast?.('المفتاح غير صالح'); return; }

          setBusy(true);
          showAssistantOverlay('جارٍ توليد تقرير المساعد الذكي', 'يتم تحليل سلوك الرسم وتوليد خطة التحسين والنصائح التسويقية…');
          out.innerHTML = '';
          // Collect chart data
          const chart = window.__salesChart;
          const points = Array.isArray(chart?.data?.datasets?.[0]?.data) ? chart.data.datasets[0].data.slice(1) : []; // drop padded 0
          const labels = Array.isArray(chart?.data?.labels) ? chart.data.labels.slice(1) : [];
          const month = document.getElementById('monthLabel')?.textContent || '';
          // Build structured prompt asking for three sections
          const sys = 'أنت خبير تحليل رسومات بيانية ومختص في المبيعات والتسويق. تكتب تقارير عربية احترافية، موجزة ومنظمة، قابلة للتنفيذ.';
          const user = `\nلدينا رسم بياني يومي للمبيعات للشهر: ${month}.\nالقيم (اليومية): ${JSON.stringify(points)}\nالتسميات (أيام/فهرس): ${JSON.stringify(labels)}\n\nحلّل سلوك الرسم كمختص في تحليل البيانات: الاتجاه العام، معدل التغيّر (السرعة/الانحدار)، التذبذب، الفترات الهادئة والنشطة، وأي قمم أو قيعان.\nإذا كانت المقارنات بين الأشهر متاحة في التطبيق، افترض المقارنة شهرًا-بشهر وعلّق على التغيّرات النسبيّة.\nابنِ خطة تحسين الأداء بناءً على معدلات التغيّر عبر الشهر وما يوحي به الرسم (تشغيل، تسعير، عروض، قنوات، رسائل، جداول).\n\nالمخرجات بصيغة JSON فقط بهذه المفاتيح:\n"Explanation" — شرح موجز لسلوك الرسم والتحليل البصري ومعدل التغيّر.\n"Improvement Plan" — خطة تحسين عملية من 3–5 نقاط قابلة للتنفيذ.\n"Marketing Tips" — 3 نصائح تسويقية قصيرة ومباشرة.\n`;
          async function call(model){
            return await window.aiClient?.chat?.({ model, messages:[{ role:'system', content: sys }, { role:'user', content: user }], response_format:{ type:'json_object' } });
          }
          const models = ['gpt-4o-mini','gpt-4o'];
          let parsed = null; let lastErr = null;
          for(let m=0;m<models.length && !parsed;m++){
            for(let a=0;a<2 && !parsed;a++){
              const res = await call(models[m]);
              if(window.electronAPI){
                if(res?.ok){ try{ parsed = JSON.parse(String(res.content||'{}')); }catch(e){ parsed = null; }
                } else { lastErr = res?.reason||'unknown'; if(String(lastErr).includes('openai_error_429')) await new Promise(r=>setTimeout(r, 600)); }
              } else {
                if(res?.ok){ const data = await res.json(); const content = data?.choices?.[0]?.message?.content||'{}'; try{ parsed = JSON.parse(content); }catch(e){ parsed=null; } }
                else { lastErr = res?.status||'unknown'; if(Number(lastErr)===429) await new Promise(r=>setTimeout(r, 600)); }
              }
            }
          }
          if(!parsed){ throw new Error(String(lastErr||'openai_error')); }
          // Render sections
          const sections = [
            { key:'Explanation', title:'شرح سلوك الرسم' },
            { key:'Improvement Plan', title:'خطة تحسين' },
            { key:'Marketing Tips', title:'نصائح تسويقية' }
          ];
          sections.forEach(s => {
            const card = document.createElement('div');
            card.className = 'card';
            const val = parsed[s.key];
            const text = typeof val === 'string' ? val : Array.isArray(val) ? ('• ' + val.join('\n• ')) : '—';
            card.innerHTML = `<div class="label">${s.title}</div><pre style="white-space:pre-wrap;line-height:1.6">${text}</pre>`;
            out.appendChild(card);
          });
          setBusy(false, '');
          hideAssistantOverlay();
          window.App?.showToast?.('تم توليد تقرير المساعد الذكي');
        }catch(e){
          setBusy(false, 'تعذر توليد التقرير. تحقق من المفتاح أو الشبكة ثم أعد المحاولة.');
          hideAssistantOverlay();
          window.App?.showToast?.('تعذر توليد التقرير');
        }
      });
    }
  };
  window.DashboardView = View;
})();
