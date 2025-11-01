// FeasibilityView: inputs for feasibility calculation and chart placeholder
// FeasibilityView: inputs, compute, KPIs, chart, save and export
(function(){
  const View = {
    id: 'feasibility',
    name: 'الجدوى',
    chart: null,
    async render(root){
      root.innerHTML = '';
      

      // (تمت الإزالة) نافذة إدخال مفتاح الذكاء الاصطناعي – أصبحت الدراسة تعتمد على المفتاح المحفوظ في إعدادات المساعد الذكي.

      const formCard = document.createElement('div');
      formCard.className = 'card';
      formCard.innerHTML = `
        <div class="label">بيانات الدراسة</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
          <input id="fProjectName" type="text" placeholder="اسم المشروع" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <select id="fSector" class="select">
            <option value="التجزئة">التجزئة</option>
            <option value="الأغذية والمشروبات">الأغذية والمشروبات</option>
            <option value="الخدمات">الخدمات</option>
            <option value="التجارة الإلكترونية">التجارة الإلكترونية</option>
            <option value="التصنيع">التصنيع</option>
            <option value="أخرى">أخرى</option>
          </select>
          <input id="fLocation" type="text" placeholder="المدينة / الموقع" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fTarget" type="text" placeholder="العميل المستهدف" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fCapital" type="number" placeholder="رأس المال الابتدائي" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fRent" type="number" placeholder="إيجار شهري" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fPayroll" type="number" placeholder="رواتب شهرية" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fUtilities" type="number" placeholder="مرافق وإنترنت شهريًا" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fCOGS" type="number" placeholder="تكلفة البضاعة/المخزون شهريًا" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fMarketing" type="number" placeholder="تسويق شهري" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fCustomers" type="number" placeholder="العملاء المتوقعون شهريًا" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fAOV" type="number" placeholder="متوسط قيمة الطلب" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fSetupMonths" type="number" placeholder="مدة التجهيز (أشهر)" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
          <input id="fGrowth" type="number" placeholder="نمو شهري متوقع % (اختياري)" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
          <button id="genStudyBtn" class="btn">تقرير المساعد الذكي</button>
          <button id="regenStudyBtn" class="btn btn-ghost">إعادة التوليد</button>
        </div>`;

      // (Removed) Numeric KPIs and chart in favor of AI-driven text flow

      // Summary KPI cards
      const summaryCard = document.createElement('div');
      summaryCard.className = 'card';
      summaryCard.innerHTML = `
        <div class="label">ملخص شهري</div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:8px">
          <div class="card" style="padding:.8rem">
            <div class="status">الإيراد الشهري</div>
            <div id="kMonthlyRevenue" class="value">—</div>
          </div>
          <div class="card" style="padding:.8rem">
            <div class="status">التكلفة التشغيلية الشهرية</div>
            <div id="kOperatingCost" class="value">—</div>
          </div>
          <div class="card" style="padding:.8rem">
            <div class="status">صافي الربح</div>
            <div id="kNetProfit" class="value">—</div>
          </div>
          <div class="card" style="padding:.8rem">
            <div class="status">نقطة التعادل (أشهر)</div>
            <div id="kBreakEven" class="value">—</div>
          </div>
          <div class="card" style="padding:.8rem">
            <div class="status">الحكم</div>
            <div id="kVerdict" class="value">—</div>
          </div>
        </div>`;

      const aiActions = document.createElement('div');
      aiActions.className = 'card';
      aiActions.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div class="label">الدراسة النصية بالذكاء الاصطناعي</div>
          <div>
            <button id="exportAiPdf" class="btn btn-ghost">تصدير الدراسة PDF</button>
          </div>
        </div>
        <div id="aiAlert" class="status" style="display:none;margin-top:8px;background:var(--chip);border:1px solid #cc5555;color:#ffdddd;padding:.6rem;border-radius:10px">تعذر الاتصال بخدمة الذكاء الاصطناعي. تحقق من المفتاح.</div>
        <div id="aiStudy" style="margin-top:10px"></div>`;

      root.append(formCard, summaryCard, aiActions);

      // Loading overlay (styled to match app theme)
      const loadingOverlay = document.createElement('div');
      loadingOverlay.id = 'aiLoading';
      loadingOverlay.style.display = 'none';
      loadingOverlay.innerHTML = `
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
              <div class="label">جارٍ توليد تقرير المساعد الذكي</div>
              <div class="status">يتم تحليل المدخلات وتوليد توصيات وخطة تطوير…</div>
            </div>
          </div>
        </div>`;
      document.body.appendChild(loadingOverlay);

      function showLoading(){ const el = document.getElementById('aiLoading'); if(el) el.style.display = 'block'; }
      function hideLoading(){ const el = document.getElementById('aiLoading'); if(el) el.style.display = 'none'; }

      // === Live calculations ===
      function readFields(){
        const n = id => Number(document.getElementById(id)?.value||0);
        return {
          projectName: document.getElementById('fProjectName')?.value||'',
          sector: document.getElementById('fSector')?.value||'',
          location: document.getElementById('fLocation')?.value||'',
          targetCustomer: document.getElementById('fTarget')?.value||'',
          capital: n('fCapital'),
          rent: n('fRent'),
          payroll: n('fPayroll'),
          utilities: n('fUtilities'),
          cogs: n('fCOGS'),
          marketing: n('fMarketing'),
          customers: n('fCustomers'),
          aov: n('fAOV'),
          setupMonths: n('fSetupMonths'),
          growthPct: n('fGrowth')
        };
      }

      function computeMetrics(f){
        const monthlyRevenue = (f.customers||0) * (f.aov||0);
        const operatingCost = (f.rent||0) + (f.payroll||0) + (f.utilities||0) + (f.cogs||0) + (f.marketing||0);
        const netProfit = monthlyRevenue - operatingCost;
        let breakEvenMonths = Infinity;
        if(netProfit > 0){
          const g = Math.max(0, (f.growthPct||0)/100);
          if(g > 0){
            const target = 1 + (f.capital * g / netProfit);
            const denom = Math.log(1+g);
            breakEvenMonths = Math.ceil(Math.log(target) / denom);
          } else {
            breakEvenMonths = Math.ceil((f.capital||0) / netProfit);
          }
        }
        let verdict = '—';
        if(netProfit <= 0){ verdict = 'غير مجدي'; }
        else if(breakEvenMonths < 18){ verdict = 'مجدي'; }
        else if(breakEvenMonths <= 24){ verdict = 'حدّي'; }
        else { verdict = 'مخاطرة عالية'; }
        return { monthlyRevenue, operatingCost, netProfit, breakEvenMonths, verdict };
      }

      function fmt(n){
        if(!isFinite(n)) return '—';
        try{ return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(Math.round(n)); }catch(e){ return String(Math.round(n)); }
      }

      function updateSummaryUI(m){
        const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        set('kMonthlyRevenue', fmt(m.monthlyRevenue));
        set('kOperatingCost', fmt(m.operatingCost));
        set('kNetProfit', fmt(m.netProfit));
        set('kBreakEven', isFinite(m.breakEvenMonths) ? String(m.breakEvenMonths) : '—');
        set('kVerdict', m.verdict);
      }

      const recalcAndRender = () => { const f = readFields(); const m = computeMetrics(f); updateSummaryUI(m); };
      ['fCapital','fRent','fPayroll','fUtilities','fCOGS','fMarketing','fCustomers','fAOV','fGrowth'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', recalcAndRender);
      });
      recalcAndRender();

      // (تمت الإزالة) ربط نافذة المفاتيح – يعتمد على إعدادات المساعد الذكي فقط

      async function runGeneration(){
        let hasKey = false;
        try{ if(window.aiClient){ hasKey = !!(await window.aiClient.hasKey()); } }catch(e){}
        if(!hasKey){ const alert = document.getElementById('aiAlert'); if(alert){ alert.style.display='block'; alert.textContent='يرجى إعداد مفتاح OpenAI أولاً من إعدادات المساعد الذكي.'; } window.App?.showToast('يرجى إعداد المفتاح من إعدادات المساعد الذكي'); return; }
        // Validate key before generating (use native testKey)
        try{
          const valid = await window.aiClient?.testKey?.();
          if(!valid){ const alert = document.getElementById('aiAlert'); if(alert){ alert.style.display='block'; alert.textContent='المفتاح غير صالح. حدّثه من إعدادات المساعد الذكي.'; } window.App?.showToast('المفتاح غير صالح – حدّثه من إعدادات المساعد الذكي'); return; }
        }catch(err){ const alert = document.getElementById('aiAlert'); if(alert){ alert.style.display='block'; alert.textContent='تعذر التحقق من المفتاح (قد يكون حدّ الطلبات).'; } }
        const fields = readFields();
        const metrics = computeMetrics(fields);
        try{
          showLoading();
          const study = await generateAIReport(fields, metrics);
          renderAIStudy(study);
          hideLoading();
          const alert = document.getElementById('aiAlert'); if(alert){ alert.style.display='none'; }
          window.App?.showToast('تم توليد التقرير بنجاح');
        }catch(e){
          hideLoading();
          const alert = document.getElementById('aiAlert');
          if(alert){
            alert.style.display='block';
            if(String(e?.message||'').includes('auth_error')){
              alert.textContent='فشل المصادقة مع OpenAI. تحقق من الـ API Key وصلاحيات الحساب.';
            } else if(String(e?.message||'').includes('openai_error_429')){
              alert.textContent='تم تجاوز حد الطلبات (429). انتظر قليلًا ثم أعد المحاولة.';
            } else {
              alert.textContent='تعذر توليد التقرير. تحقق من المفتاح أو الشبكة ثم أعد المحاولة.';
            }
          }
        }
      }
      document.getElementById('genStudyBtn')?.addEventListener('click', runGeneration);
      document.getElementById('regenStudyBtn')?.addEventListener('click', runGeneration);

      // generateAIStudy deprecated; use generateAIReport

      function renderAIStudy(study){
        const container = document.getElementById('aiStudy');
        container.innerHTML = '';
        const normalized = ensureStudyShape(study, readFields(), computeMetrics(readFields()));
        const order = [ 'Executive Summary','Market','Financial Snapshot','Risks','Action Plan','Marketing Recommendations' ];
        order.forEach(title => {
          const text = typeof normalized[title] === 'string' ? normalized[title] : '—';
          const section = document.createElement('div');
          section.className = 'card';
          section.innerHTML = `<div class="label">${title}</div><pre style="white-space:pre-wrap;line-height:1.6">${text}</pre>`;
          container.appendChild(section);
        });
      }

      async function generateAIReport(fields, metrics){
        const p = fields; const m = metrics;
        const brief = `
مشروع: ${p.projectName||'—'}
قطاع: ${p.sector||'—'}
مدينة: ${p.location||'—'}
العميل المستهدف: ${p.targetCustomer||'—'}
رأس المال: ${p.capital}
إيجار شهري: ${p.rent}, رواتب: ${p.payroll}, مرافق: ${p.utilities}, مخزون/تكلفة البضاعة: ${p.cogs}, تسويق: ${p.marketing}
العملاء/شهر: ${p.customers}, متوسط الطلب: ${p.aov}
مدة التجهيز (أشهر): ${p.setupMonths}, نمو شهري متوقع: ${p.growthPct}%

الحسابات:
إيراد شهري: ${m.monthlyRevenue}
تكلفة تشغيلية: ${m.operatingCost}
صافي الربح: ${m.netProfit}
نقطة التعادل (أشهر): ${isFinite(m.breakEvenMonths)?m.breakEvenMonths:'غير متاح'}
الحكم: ${m.verdict}
        `;
        const prompt = `
اكتب دراسة جدوى عربية مهنية وموجزة مستندة إلى بيانات المشروع والحسابات أدناه. المخرجات يجب أن تكون بصيغة JSON حصراً بالمفاتيح:
"Executive Summary", "Market", "Financial Snapshot", "Risks", "Action Plan", "Marketing Recommendations".

التوجيهات المهنية:
1) إذا كان الحكم "غير مجدي" أو "حدّي": قدّم اقتراحات دقيقة لتحسين الجدوى (خفض تكاليف التشغيل، إعادة توزيع الميزانية التسويقية، ضبط التسعير، تطوير نموذج الإيرادات)، مع خطوات قابلة للتنفيذ.
2) إذا كان الحكم "مجدي": قدّم دراسة سوق مختصرة للفئة/القطاع واسم المشروع في مدينة المستخدم (${fields.location||'—'}), مع تركيز على المنافسين، اتجاهات الطلب، وقنوات الوصول.
3) "Marketing Recommendations": توصيات عملية تشمل القنوات، الرسائل، الميزانية، العروض، الشراكات، والقياس.
4) "Action Plan": خطة تطوير مرتبة زمنيًا (0-3 أشهر، 3-6 أشهر، 6-12 شهر) مرتبطة بنتيجة الحكم.
5) استخدم نبرة مهنية، نقاط مرتبة، وجُمَل قصيرة واضحة.

البيانات:
${brief}
        `;
        // Retry/backoff and model fallback for rate limits
        async function call(model){
          return await window.aiClient.chat({
            model,
            messages: [
              { role:'system', content:'أنت خبير دراسات جدوى وتسويق محترف. تحلل البيانات المالية والسوقية وتُخرج تقارير عربية منظمة وموجزة مع توصيات قابلة للتنفيذ.' },
              { role:'user', content: prompt }
            ],
            response_format: { type:'json_object' }
          });
        }
        const models = ['gpt-4o','gpt-4o-mini'];
        let lastError = null;
        for(let mIdx=0; mIdx<models.length; mIdx++){
          const model = models[mIdx];
          for(let attempt=0; attempt<3; attempt++){
            const res = await call(model);
            if(window.electronAPI){
              if(res?.ok){
                let parsed = {};
                try{ parsed = JSON.parse(String(res.content||'{}')); }catch(e){ parsed = {}; }
                return ensureStudyShape(parsed, fields, metrics);
              }
              lastError = res?.reason || 'unknown';
              if(String(res?.reason||'').includes('openai_error_429')){ await new Promise(r=>setTimeout(r, 500 * Math.pow(2, attempt))); continue; }
              if(String(res?.reason||'').includes('auth_error')){ throw new Error('auth_error'); }
              await new Promise(r=>setTimeout(r, 300));
            } else {
              if(res.ok){ const data = await res.json(); const content = data?.choices?.[0]?.message?.content || '{}';
                let parsed = {}; try{ parsed = JSON.parse(content); }catch(e){ parsed = {}; }
                return ensureStudyShape(parsed, fields, metrics);
              }
              lastError = res.status;
              if(res.status === 429){ await new Promise(r=>setTimeout(r, 500 * Math.pow(2, attempt))); continue; }
              if(res.status === 401 || res.status === 403){ throw new Error('auth_error'); }
              await new Promise(r=>setTimeout(r, 300));
            }
          }
        }
        throw new Error(`openai_error_${lastError||'unknown'}`);
      }

      function ensureStudyShape(study, fields, metrics){
        const s = study||{}; const p = fields||{}; const m = metrics||{};
        const safe = (v, fallback='—') => typeof v === 'string' && v.trim().length ? v : fallback;
        const fsFallback = (
`ملخص مالي:
• الإيراد الشهري: ${m.monthlyRevenue}
• التكلفة التشغيلية: ${m.operatingCost}
• صافي الربح: ${m.netProfit}
• نقطة التعادل (أشهر): ${isFinite(m.breakEvenMonths)?m.breakEvenMonths:'غير متاح'}
• الحكم: ${m.verdict}`
        );
        const execFallback = (
`ملخص تنفيذي:
المشروع: ${p.projectName||'—'} في قطاع ${p.sector||'—'} بمدينة ${p.location||'—'}.
وفق الحسابات، ${m.verdict}. يوصى بالبدء بخطة تشغيل منضبطة ومراقبة شهرية.`
        );
        const marketFallback = (
`السوق:
القطاع ${p.sector||'—'} مع عملاء مستهدفين: ${p.targetCustomer||'—'}. ينصح بدراسة المنافسين المحليين وتحديد تسعير تنافسي.`
        );
        const risksFallback = (
`المخاطر:
تقلب الطلب، ارتفاع التكاليف، تأخّر التجهـيز، وحدود السيولة. خفّف المخاطر عبر ضبط الإنفاق ومراقبة الأداء.`
        );
        const planFallback = (
`خطة عمل:
1) إنهاء التجهيز خلال ${p.setupMonths||'—'} أشهر.
2) ضبط التكاليف الشهرية (إيجار/رواتب/مرافق/تسويق).
3) متابعة الإيراد والعملاء وتحسين التسويق.
4) مراجعة التعادل والربحية شهريًا.`
        );
        const marketingRecFallback = (
`توصيات تسويقية:
• القنوات: منصات اجتماعية محلية، بحث (SEO/SEM)، ورسائل فورية.
• الرسائل: إبراز القيمة والتميز في ${p.sector||'القطاع'}، مع دعوات واضحة للشراء.
• الميزانية: تخصيص ${p.marketing||'—'} شهريًا بتركيز على الحملات الأعلى عائدًا.
• العروض: حوافز افتتاحية، باقات، وبرامج إحالة.
• الشراكات: تعاون مع متاجر أو مؤثرين محليين مرتبطين بـ ${p.targetCustomer||'العملاء المستهدفين'}.
• القياس: تتبّع العملاء/شهر والتحويل ومتوسط قيمة الطلب ${p.aov||'—'}، وتحسين الرسائل أسبوعيًا.`
        );
        return {
          'Executive Summary': safe(s['Executive Summary'], execFallback),
          'Market': safe(s['Market'], marketFallback),
          'Financial Snapshot': safe(s['Financial Snapshot'], fsFallback),
          'Risks': safe(s['Risks'], risksFallback),
          'Action Plan': safe(s['Action Plan'], planFallback),
          'Marketing Recommendations': safe(s['Marketing Recommendations'], marketingRecFallback)
        };
      }

      // تمت إزالة خيار حفظ النص في Excel وفق الطلب

      document.getElementById('exportAiPdf')?.addEventListener('click', async () => {
        try{
          const jspdf = window.jspdf; const html2canvas = window.html2canvas;
          if(!jspdf || !html2canvas){ window.App?.showToast('مكتبات تصدير PDF غير متوفرة'); return; }
          const doc = new jspdf.jsPDF({ unit:'pt', format:'a4' });

          const source = document.getElementById('aiStudy');
          if(!source){ window.App?.showToast('لم يتم العثور على محتوى التقرير', 'warning'); return; }

          // Create an offscreen printable wrapper with branded styling and ensure RTL
          const wrapper = document.createElement('div');
          wrapper.style.position = 'absolute';
          wrapper.style.left = '-9999px';
          wrapper.style.top = '0';
          wrapper.style.width = '800px';
          // Subtle branded background using app colors for an official look
          wrapper.style.background = 'linear-gradient(180deg, #ffffff 0%, #F7FAFC 55%), radial-gradient(1200px 600px at 15% -10%, rgba(0,184,148,0.08), transparent), radial-gradient(1200px 600px at 85% 110%, rgba(56,189,248,0.08), transparent)';
          wrapper.style.direction = 'rtl';
          wrapper.style.padding = '24px';
          wrapper.style.fontFamily = "'Noto Sans Arabic','Inter','Poppins','Segoe UI',Tahoma,sans-serif";
          // Force solid black text and light card backgrounds for clarity
          wrapper.style.color = '#111827';
          // Keep card backgrounds solid to avoid semi-transparency in export
          wrapper.style.setProperty('--chip', '#ffffff');
          wrapper.style.setProperty('--chip-border', '#dddddd');
          wrapper.style.setProperty('--card-bg', '#ffffff');
          wrapper.style.setProperty('--card-border', '#dddddd');
          // Load user branding (if any)
          await window.Branding?.load?.();
          const brand = window.Branding?.get?.() || {};
          // Header with branding (gradient bar + logo + name)
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.alignItems = 'center';
          header.style.justifyContent = 'space-between';
          header.style.padding = '12px 16px';
          header.style.margin = '0 0 16px 0';
          header.style.borderRadius = '12px';
          header.style.background = 'linear-gradient(90deg, var(--primary-start), var(--primary-end))';
          header.style.color = '#ffffff';
          const brandName = document.createElement('div');
brandName.textContent = brand.name || 'Quantiv';
          brandName.style.fontWeight = '700';
          brandName.style.fontSize = '16px';
          const logo = document.createElement('img');
          logo.src = brand.logo || './icons/app-64.png';
          logo.alt = 'Logo';
          logo.style.width = '28px';
          logo.style.height = '28px';
          logo.style.marginInlineStart = '12px';
          header.appendChild(brandName);
          header.appendChild(logo);
          wrapper.appendChild(header);

          // Title with project name
          const projectNameTitle = document.getElementById('fProjectName')?.value?.trim() || '—';
          const title = document.createElement('div');
          title.style.margin = '0 0 10px 0';
          title.innerHTML = `<div style="font-size:22px;font-weight:700">دراسة جدوى – ${projectNameTitle}</div>
            <div style="color:#64748B;font-size:12px;margin-top:4px">تاريخ: ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())}</div>`;
          wrapper.appendChild(title);
          const clone = source.cloneNode(true);
          clone.style.margin = '0';
          clone.style.padding = '0';
          clone.style.opacity = '1';
          // Normalize card visuals to avoid translucent export
          [...clone.querySelectorAll('.card')].forEach(el => {
            el.style.background = '#ffffff';
            el.style.border = '1px solid #dddddd';
            el.style.boxShadow = 'none';
          });
          // Slightly increase content font size for readability
          [...clone.querySelectorAll('pre')].forEach(el => {
            el.style.fontSize = '16px';
            el.style.lineHeight = '1.75';
          });
          // Brand section labels with gradient and better typography
          [...clone.querySelectorAll('.label')].forEach(el => {
            el.style.background = 'linear-gradient(90deg, var(--primary-start), var(--primary-end))';
            el.style.color = '#ffffff';
            el.style.fontWeight = '600';
            el.style.padding = '10px 12px';
            el.style.borderRadius = '8px';
            el.style.marginBottom = '8px';
            el.style.fontSize = '15px';
          });
          // Optional brand meta (CR / Tax) beneath title
          const brandMetaText = [
            brand.cr ? `السجل التجاري: ${brand.cr}` : '',
            brand.tax ? `الرقم الضريبي: ${brand.tax}` : ''
          ].filter(Boolean).join(' • ');
          if(brandMetaText){
            const meta = document.createElement('div');
            meta.style.color = '#64748B';
            meta.style.fontSize = '12px';
            meta.style.margin = '6px 0 10px 0';
            meta.textContent = brandMetaText;
            wrapper.appendChild(meta);
          }
          wrapper.appendChild(clone);

          // Footer note (appears at end of document)
          const footer = document.createElement('div');
          footer.style.marginTop = '16px';
          footer.style.padding = '8px 12px';
          footer.style.borderTop = '1px solid #E5E7EB';
          footer.style.color = '#64748B';
          footer.style.fontSize = '12px';
footer.textContent = 'تم توليده عبر Quantiv';
          wrapper.appendChild(footer);
          document.body.appendChild(wrapper);

          // Render with html2canvas at high scale for clarity
          const canvas = await html2canvas(wrapper, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
          document.body.removeChild(wrapper);

          // Use JPEG to eliminate alpha semi-transparency
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const margin = 40;
          const pdfWidth = pageWidth - margin * 2;
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const pdfHeight = (imgHeight * pdfWidth) / imgWidth;

          let y = margin;
          doc.addImage(imgData, 'JPEG', margin, y, pdfWidth, pdfHeight);

          const contentHeight = pageHeight - margin * 2;
          const totalPages = Math.ceil(pdfHeight / contentHeight);
          for(let i = 1; i < totalPages; i++){
            doc.addPage();
            const sliceOffsetY = margin - i * contentHeight; // precise slice per page without overlap
            doc.addImage(imgData, 'JPEG', margin, sliceOffsetY, pdfWidth, pdfHeight);
          }

          // Filename: Feasibility Study – [Project Name]
          const projectNameFile = document.getElementById('fProjectName')?.value?.trim() || 'Untitled';
          const safeProject = projectNameFile.replace(/[<>:"/\\|?*]+/g, '-');
          const filename = `Feasibility Study – ${safeProject}.pdf`;
          doc.save(filename);
          window.App?.showToast('تم تصدير الدراسة النصية PDF');
        }catch(e){
          console.error('PDF export error:', e);
          window.App?.showToast('تعذر تصدير PDF');
        }
      });

      // Centralize AI key management: redirect to Smart Assistant Settings if missing/invalid
      try{
        if(window.electronAPI){
          const resp = await window.electronAPI.aiGetKey();
          const hasKey = !!resp?.hasKey;
          if(!hasKey){
            const alert = document.getElementById('aiAlert'); if(alert){ alert.style.display='block'; alert.textContent='يرجى إعداد مفتاح OpenAI أولاً من إعدادات المساعد الذكي.'; }
          }
          window.electronAPI.aiTestKey().then(r => {
            if(!r?.ok){ const alert = document.getElementById('aiAlert'); if(alert){ alert.style.display='block'; alert.textContent='المفتاح غير صالح. انتقل إلى إعدادات المساعد الذكي لتحديثه.'; } }
          }).catch(()=>{});
        }
      }catch(e){}
    }
  };
  window.FeasibilityView = View;
})();
