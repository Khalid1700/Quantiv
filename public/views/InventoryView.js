// InventoryView: searchable/sortable table and basic CRUD modal placeholders
(function(){
  const View = {
    id: 'inventory',
    name: 'المخزون',
    async render(root){
      root.innerHTML = '';
      const header = document.createElement('div');
      header.className = 'card';
      header.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="display:flex;gap:8px">
            <input id="invSearch" type="text" placeholder="بحث" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.5rem;border-radius:10px;outline:none">
            <button id="invAddBtn" class="btn">إضافة</button>
            <button id="invExportSerials" class="btn btn-ghost" title="تصدير قائمة المنتجات">تصدير قائمة المنتجات</button>
            <button id="invAssistantReportBtn" class="btn" title="تقرير المساعد الذكي">تقرير المساعد الذكي</button>
          </div>
          <div class="label">جدول المخزون</div>
        </div>`;
      root.appendChild(header);
      // Inventory summary KPI cards above the table
      const statsGrid = document.createElement('div');
      statsGrid.className = 'grid kpis';
      root.appendChild(statsGrid);

      const tableWrap = document.createElement('div');
      tableWrap.className = 'card';
      tableWrap.id = 'inventoryTableCard';
      const table = document.createElement('table');
      table.className = 'table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>المنتج</th>
            <th>رقم SKU</th>
            <th>الفئة</th>
            <th>سعر التكلفة</th>
            <th>سعر البيع</th>
            <th>الكمية</th>
            <th>الضريبة (%)</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody id="invBody"></tbody>`;
      tableWrap.appendChild(table);
      root.appendChild(tableWrap);

      // Fixed max-height based on default window height at initial render.
      // This makes the card scroll internally only when content exceeds the
      // initial window height, and keeps behavior stable across later resizes.
      try {
        if (!window.__defaultViewportH) {
          window.__defaultViewportH = window.innerHeight;
        }
        const rect = tableWrap.getBoundingClientRect();
        const bottomPadding = 18; // approximate view-root bottom padding
        const maxH = Math.max(240, Math.floor(window.__defaultViewportH - rect.top - bottomPadding));
        tableWrap.style.maxHeight = `${maxH}px`;
        tableWrap.style.overflowY = 'auto';
        tableWrap.style.flex = '0 0 auto';
      } catch (_) { /* non-blocking */ }

      const data = await (window.dbManager?.listProducts?.() || { items: [] });
      let items = data?.items || [];

      function renderStats(){
        try{
          const totalProducts = items.length;
          const inventoryValue = items.reduce((sum, i) => sum + (Number(i.cost||0) * Number(i.qty||0)), 0);
          const sellingValue = items.reduce((sum, i) => sum + (Number(i.price||0) * Number(i.qty||0)), 0);
          const expectedProfit = sellingValue - inventoryValue;
          const cards = [
            { label:'إجمالي المنتجات المضافة', value: String(totalProducts) },
            { label:'قيمة المخزون', value: Number(inventoryValue).toFixed(2) },
            { label:'سعر بيع المخزون', value: Number(sellingValue).toFixed(2) },
            { label:'الربح المتوقع بعد البيع', value: Number(expectedProfit).toFixed(2) },
          ];
          statsGrid.innerHTML = '';
          cards.forEach(k => {
            const c = document.createElement('div');
            c.className = 'card kpi';
            c.innerHTML = `<div class="label">${k.label}</div><div class="value">${k.value}</div>`;
            statsGrid.appendChild(c);
          });
        }catch(_){ /* noop */ }
      }
      const body = table.querySelector('#invBody');
      const renderRow = (row) => {
        const tr = document.createElement('tr');
        tr.dataset.sku = row.sku || '';
        tr.innerHTML = `
          <td>${row.name ?? '—'}</td>
          <td>${row.sku ?? '—'}</td>
          <td>${row.category ?? '—'}</td>
          <td>${typeof row.cost==='number' ? row.cost : '—'}</td>
          <td>${typeof row.price==='number' ? row.price : '—'}</td>
          <td>${row.qty ?? 0}</td>
          <td>${typeof row.tax==='number' ? Math.round(row.tax*100) : 0}</td>
          <td>
            <button class="btn btn-ghost" data-action="edit" data-sku="${row.sku}">تعديل</button>
            <button class="btn btn-ghost" data-action="delete" data-sku="${row.sku}">حذف</button>
          </td>`;
        return tr;
      };
      const refreshTable = () => { body.innerHTML=''; items.forEach(i => body.appendChild(renderRow(i))); attachRowEvents(); };
      const attachRowEvents = () => {
        body.querySelectorAll('button[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const sku = btn.dataset.sku;
            const r = await window.dbManager.deleteProduct(sku);
            if(r.ok){
              window.App.showToast('تم حذف المنتج');
              const l = await window.dbManager.listProducts(); items = l.items||[]; refreshTable(); renderStats();
              try{ const s = await window.electronAPI.updateDashboards(); if(s?.ok) window.App.applyDashboardSummary(s.summary); }catch(e){}
            }
            else { window.App.showToast(r.reason||'فشل الحذف'); }
          });
        });
        body.querySelectorAll('button[data-action="edit"]').forEach(btn => {
          btn.addEventListener('click', () => openModal(items.find(x=>x.sku===btn.dataset.sku)));
        });
        attachHoverHandlers();
      };
      renderStats();
      refreshTable();

      // Modal for Add/Edit with backdrop and robust closing
      const modal = document.createElement('div');
      modal.className = 'card';
      modal.style.display = 'none'; modal.style.position='fixed'; modal.style.top='20%'; modal.style.left='50%'; modal.style.transform='translateX(-50%)'; modal.style.minWidth='420px'; modal.style.zIndex = '1001';
      const backdrop = document.createElement('div');
      backdrop.style.display = 'none'; backdrop.style.position='fixed'; backdrop.style.top='0'; backdrop.style.left='0'; backdrop.style.right='0'; backdrop.style.bottom='0'; backdrop.style.background='rgba(0,0,0,0.35)'; backdrop.style.zIndex = '1000';
      document.body.appendChild(backdrop);
      document.body.appendChild(modal);
      let isModalOpen = false;

      // ===== Smart Assistant overlay and modal (reused style from StoreSettings/Dashboard) =====
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
                <div id="assistantOverlayLabel" class="label">جارٍ تحليل المخزون والمبيعات</div>
                <div id="assistantOverlayStatus" class="status">يتم تحليل سلوك المنتجات عبر الفواتير والتقارير…</div>
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
        if(st) st.textContent = statusText || 'يتم تحليل البيانات وتوليد الملاحظات والخطة والنصيحة…';
        ov.style.display = 'block';
      }
      function hideAssistantOverlay(){
        const ov = document.getElementById('assistantReportOverlay');
        if(ov) ov.style.display = 'none';
      }

      function ensureAssistantModal(){
        let m = document.getElementById('assistantReportModal');
        if(m) return m;
        m = document.createElement('div');
        m.id = 'assistantReportModal';
        m.className = 'card';
        m.style.display = 'none';
        m.style.position = 'fixed';
        m.style.top = '10%';
        m.style.left = '50%';
        m.style.transform = 'translateX(-50%)';
        m.style.maxWidth = '720px';
        m.style.width = '90%';
        m.style.zIndex = '10001';
        m.style.maxHeight = '80vh';
        m.style.overflowY = 'auto';
        document.body.appendChild(m);
        return m;
      }


      function modalContent(){
        return `
          <div class="label">تفاصيل المنتج</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <input id="fName" placeholder="الاسم" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <input id="fCategory" placeholder="الفئة" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <input id="fCost" type="number" placeholder="التكلفة" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <input id="fPrice" type="number" placeholder="السعر" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <input id="fQty" type="number" placeholder="الكمية" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <input id="fTax" type="number" placeholder="الضريبة (%)" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
            <div style="grid-column:1 / -1; display:flex; align-items:flex-start; gap:10px">
              <input id="fImage" type="file" accept="image/*" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.5rem;border-radius:10px">
              <img id="fImagePreview" alt="معاينة الصورة" style="max-height:120px; display:none; border-radius:8px; border:1px solid var(--chip-border)">
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px">
            <button id="fCancel" class="btn btn-ghost">إلغاء</button>
            <button id="fSave" class="btn btn-primary">حفظ</button>
          </div>`;
      }

      function openModal(item){
        modal.innerHTML = modalContent();
        modal.style.display='block';
        backdrop.style.display='block';
        isModalOpen = true;
        document.getElementById('fName').value = item?.name||'';
        document.getElementById('fCategory').value = item?.category||'';
        document.getElementById('fCost').value = item?.cost||0;
        document.getElementById('fPrice').value = item?.price||0;
        document.getElementById('fQty').value = item?.qty||0;
        document.getElementById('fTax').value = (typeof item?.tax === 'number' ? Math.round(item.tax*100) : '');
        // Image upload + immediate preview
        let imageDataUrl = item?.image || '';
        const imgEl = document.getElementById('fImagePreview');
        if(imageDataUrl){ imgEl.src = imageDataUrl; imgEl.style.display = 'block'; }
        document.getElementById('fImage').addEventListener('change', async (ev) => {
          const file = ev.target.files && ev.target.files[0];
          if(!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            imageDataUrl = reader.result;
            imgEl.src = imageDataUrl;
            imgEl.style.display = 'block';
          };
          reader.readAsDataURL(file);
        });
        const onEsc = (ev) => { if(ev.key==='Escape'){ close(); } };
        const close = () => {
          isModalOpen = false;
          modal.style.display='none';
          backdrop.style.display='none';
          try{ window.removeEventListener('keydown', onEsc); }catch(_){}
        };
        backdrop.addEventListener('click', close, { once:true });
        try{ window.addEventListener('keydown', onEsc); }catch(_){}
        document.getElementById('fCancel').addEventListener('click', close);
        document.getElementById('fSave').addEventListener('click', async () => {
          const payload = {
            name: document.getElementById('fName').value,
            category: document.getElementById('fCategory').value,
            cost: Number(document.getElementById('fCost').value||0),
            price: Number(document.getElementById('fPrice').value||0),
            qty: Number(document.getElementById('fQty').value||0),
            tax: (function(){
              const v = document.getElementById('fTax').value;
              if(v === '' || v === null || typeof v === 'undefined') return null;
              const n = Number(v);
              if(isNaN(n) || n < 0) return null;
              return n/100;
            })(),
            imageDataUrl: imageDataUrl
          };
          // Basic validation
          if(!payload.name){ window.App.showToast('يرجى إدخال اسم المنتج'); return; }
          if(payload.cost < 0 || payload.price < 0 || payload.qty < 0){ window.App.showToast('القيم يجب أن تكون صفرًا أو أكبر'); return; }
          let r;
          if(item?.sku){ r = await window.dbManager.updateProduct({ ...payload, sku:item.sku }); }
          else { r = await window.dbManager.addProduct(payload); }
          if(r.ok){
            window.App.showToast('تم الحفظ بنجاح');
            const l = await window.dbManager.listProducts(); items = l.items||[]; refreshTable(); renderStats();
            try{ const s = await window.electronAPI.updateDashboards(); if(s?.ok) window.App.applyDashboardSummary(s.summary); }catch(e){}
          }
          else { window.App.showToast(r.reason||'فشل الحفظ'); }
          close();
        });
      }

      document.getElementById('invAddBtn')?.addEventListener('click', () => {
        if(isModalOpen){ return; }
        openModal(null);
      });
      // Export product list to PDF with identical branding to Feasibility export
      document.getElementById('invExportSerials')?.addEventListener('click', async () => {
        try{
          const jspdf = window.jspdf; const html2canvas = window.html2canvas;
          if(!jspdf || !html2canvas){ window.App?.showToast('مكتبات تصدير PDF غير متوفرة'); return; }
          const doc = new jspdf.jsPDF({ unit:'pt', format:'a4' });

          // Branded wrapper (exact style approach as FeasibilityView)
          const wrapper = document.createElement('div');
          wrapper.style.position = 'absolute';
          wrapper.style.left = '-9999px';
          wrapper.style.top = '0';
          wrapper.style.width = '800px';
          wrapper.style.background = 'linear-gradient(180deg, #ffffff 0%, #F7FAFC 55%), radial-gradient(1200px 600px at 15% -10%, rgba(0,184,148,0.08), transparent), radial-gradient(1200px 600px at 85% 110%, rgba(56,189,248,0.08), transparent)';
          wrapper.style.direction = 'rtl';
          wrapper.style.padding = '24px';
          wrapper.style.fontFamily = "'Noto Sans Arabic','Inter','Poppins','Segoe UI',Tahoma,sans-serif";
          wrapper.style.color = '#111827';
          // Normalize variables for solid export
          wrapper.style.setProperty('--chip', '#ffffff');
          wrapper.style.setProperty('--chip-border', '#dddddd');
          wrapper.style.setProperty('--card-bg', '#ffffff');
          wrapper.style.setProperty('--card-border', '#dddddd');

          // Header branding
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.alignItems = 'center';
          header.style.justifyContent = 'space-between';
          header.style.padding = '12px 16px';
          header.style.margin = '0 0 16px 0';
          header.style.borderRadius = '12px';
          header.style.background = 'linear-gradient(90deg, var(--primary-start), var(--primary-end))';
          header.style.color = '#ffffff';
          // Load user branding (if any)
          await window.Branding?.load?.();
          const brand = window.Branding?.get?.() || {};
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

          // Title and date
          const title = document.createElement('div');
          title.style.margin = '0 0 10px 0';
          title.innerHTML = `<div style="font-size:22px;font-weight:700">قائمة المنتجات</div>
            <div style="color:#64748B;font-size:12px;margin-top:4px">تاريخ: ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())} • عدد المنتجات: ${(items||[]).length}</div>`;
          wrapper.appendChild(title);
          // Optional brand meta beneath title
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

          // Products table (solid card-like appearance)
          const card = document.createElement('div');
          card.style.background = '#ffffff';
          card.style.border = '1px solid #dddddd';
          card.style.boxShadow = 'none';
          card.style.borderRadius = '10px';
          card.style.padding = '12px';

          const tableLabel = document.createElement('div');
          tableLabel.className = 'label';
          tableLabel.textContent = 'تفاصيل المنتجات';
          tableLabel.style.background = 'linear-gradient(90deg, var(--primary-start), var(--primary-end))';
          tableLabel.style.color = '#ffffff';
          tableLabel.style.fontWeight = '600';
          tableLabel.style.padding = '10px 12px';
          tableLabel.style.borderRadius = '8px';
          tableLabel.style.marginBottom = '8px';
          tableLabel.style.fontSize = '15px';
          card.appendChild(tableLabel);

          const tbl = document.createElement('table');
          tbl.style.width = '100%';
          tbl.style.borderCollapse = 'collapse';
          tbl.style.background = 'white';
          tbl.style.border = '1px solid #e5e7eb';
          tbl.innerHTML = `
            <thead>
              <tr style="background:#f3f4f6">
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">المنتج</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">رقم SKU</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">الفئة</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">سعر التكلفة</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">سعر البيع</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">الكمية</th>
                <th style="padding:8px;border:1px solid #e5e7eb;text-align:right">الضريبة (%)</th>
              </tr>
            </thead>
            <tbody></tbody>`;
          const tbody = tbl.querySelector('tbody');
          (items||[]).forEach(i => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td style="padding:8px;border:1px solid #e5e7eb">${i.name ?? '—'}</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${i.sku ?? '—'}</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${i.category ?? '—'}</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${(Number(i.cost||0)).toFixed(2)}</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${(Number(i.price||0)).toFixed(2)}</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${Number(i.qty||0)}</td>
              <td style="padding:8px;border:1px solid #e5e7eb">${typeof i.tax==='number' ? Math.round(i.tax*100) : 0}</td>`;
            tbody.appendChild(tr);
          });
          card.appendChild(tbl);
          wrapper.appendChild(card);

          // Footer note for branding consistency
          const footer = document.createElement('div');
          footer.style.marginTop = '16px';
          footer.style.padding = '8px 12px';
          footer.style.borderTop = '1px solid #E5E7EB';
          footer.style.color = '#64748B';
          footer.style.fontSize = '12px';
footer.textContent = 'تم توليده عبر Quantiv';
          wrapper.appendChild(footer);

          document.body.appendChild(wrapper);

          // High-scale render, solid background, JPEG export (matches feasibility)
          const canvas = await html2canvas(wrapper, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
          try{ document.body.removeChild(wrapper); }catch(_){ }

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
            const sliceOffsetY = margin - i * contentHeight;
            doc.addImage(imgData, 'JPEG', margin, sliceOffsetY, pdfWidth, pdfHeight);
          }

        const dateStr = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
          const filename = `Product List – ${dateStr}.pdf`;
          doc.save(filename);
          window.App?.showToast('تم تصدير قائمة المنتجات PDF');

          try{ const s = await window.electronAPI.updateDashboards(); if(s?.ok) window.App.applyDashboardSummary(s.summary); }catch(e){}
        }catch(e){
          console.error('Product list PDF export error:', e);
          window.App?.showToast('تعذر تصدير PDF');
        }
      });

      // Smart Assistant Report (Inventory-focused)
      document.getElementById('invAssistantReportBtn')?.addEventListener('click', async () => {
        try{
          // Gate on AI key presence and validity (match Dashboard behavior)
          let hasKey = false, validKey = false;
          try{ hasKey = !!(await window.aiClient?.hasKey?.()); }catch(_){ }
          try{ validKey = !!(await window.aiClient?.testKey?.()); }catch(_){ }
          if(!hasKey){ window.App?.showToast?.('يرجى إعداد مفتاح OpenAI أولاً من إعدادات المساعد الذكي.'); return; }
          if(!validKey){ window.App?.showToast?.('المفتاح غير صالح. انتقل إلى إعدادات المساعد الذكي لتحديثه.'); return; }

          showAssistantOverlay('جارٍ تحليل المخزون والمبيعات', 'يتم تحليل بيانات المخزون والفواتير والتقارير…');
          // Fetch necessary data in parallel
          const [prodResp, invResp, repResp] = await Promise.all([
            (window.dbManager?.listProducts?.() || { items: [] }),
            (window.dbManager?.listInvoices?.() || { invoices: [] }),
            (window.dbManager?.getReportsSummary?.() || { summary: { topSelling:[], monthlyRevenue:[], profitTrends:[] } })
          ]);
          const products = prodResp?.items || [];
          const invoices = invResp?.invoices || [];
          const summary = repResp?.summary || repResp?.report || { topSelling:[], monthlyRevenue:[], profitTrends:[] };

          // Compute basic activity signals
          const activeSkus = new Set((summary.topSelling||[]).map(t => String(t.sku||'')));
          const inactiveProducts = products.filter(p => !activeSkus.has(String(p.sku||'')));
          const brief = `
عدد المنتجات: ${products.length}
عدد المنتجات النشطة (وفق أعلى المبيعات): ${activeSkus.size}
عدد المنتجات غير النشطة: ${inactiveProducts.length}
أعلى المنتجات مبيعًا:
${(summary.topSelling||[]).slice(0,5).map(t => `• ${t.name||t.sku||'—'} — وحدات: ${Number(t.units||0)}, إيراد: ${Number(t.revenue||0).toFixed(2)}`).join('\n')}
آخر اتجاهات الإيراد الشهري:
${(summary.monthlyRevenue||[]).slice(-3).map(r => `• ${r.month||'—'} — ${Number(r.revenue||0).toFixed(2)}`).join('\n')}
الفواتير (عدد): ${invoices.length}
          `;

          const prompt = `
أنت خبير تسويق ومبيعات. حلّل سلوك المخزون وعدد المنتجات النشطة وغير النشطة للبيع من خلال مراجعة الفواتير الصادرة والتقرير الشهري.
أنتج دراسة عربية مهنية حول كيفية تحسين أداء بيع المنتجات صعبة البيع، وقدّم نصائح تسويقية وخطة تطوير لتحسين مبيعات المخزون.
المخرجات يجب أن تكون JSON بالمفاتيح: "Observations", "Improvement Plan", "Marketing Tips", "Development Plan".
استخدم نقاط واضحة وجُمَل قصيرة عملية، وركّز على تكتيكات قابلة للتنفيذ (التسعير، العروض، الباقات، القنوات، الرسائل، الجدولة، القياس).

البيانات:
${brief}
          `;

          // Call AI
          const res = await window.aiClient.chat({
            model: 'gpt-4o-mini',
            messages: [
              { role:'system', content:'أنت خبير تسويق ومبيعات محترف. تكتب تقارير عربية موجزة ومنظمة مع توصيات عملية قابلة للتنفيذ.' },
              { role:'user', content: prompt }
            ],
            response_format: { type:'json_object' }
          });

          let obs = '', plan = '', tips = '', dev = '';
          if(res?.ok){
            try{
              const parsed = JSON.parse(String(res.content||'{}'));
              obs = String(parsed['Observations']||'').trim();
              plan = String(parsed['Improvement Plan']||'').trim();
              tips = String(parsed['Marketing Tips']||'').trim();
              dev = String(parsed['Development Plan']||'').trim();
            }catch(_){ }
          }
          // Fallback if AI failed
          if(!obs){
            obs = [
              'أعلى المنتجات أداءً (حسب الوحدات):',
              ...(summary.topSelling||[]).slice(0,3).map(t => `• ${t.name||t.sku||'—'} — وحدات: ${Number(t.units||0)}, إيراد: ${Number(t.revenue||0).toFixed(2)}`),
              'اتجاه الإيراد الشهري:',
              ...(summary.monthlyRevenue||[]).slice(-3).map(r => `• ${r.month||'—'} — ${Number(r.revenue||0).toFixed(2)}`)
            ].join('\n');
          }
          if(!plan){
            const underperformers = inactiveProducts.sort((a,b) => Number(b.qty||0) - Number(a.qty||0)).slice(0,3);
            plan = [
              'خطة تحسين للمنتجات منخفضة الأداء:',
              ...(underperformers.length ? underperformers.map(u => `• ${u.name||u.sku||'—'}: باقات مع منتج أعلى مبيعًا، إعادة تسعير تدريجية، وعرض ترويجي محدود.`) : ['• لا توجد منتجات منخفضة الأداء واضحة حالياً. استمر بمراقبة الاتجاهات أسبوعياً.'])
            ].join('\n');
          }
          if(!tips){ tips = 'ركّز الإعلانات على الفئات الأعلى مبيعًا مع عروض حزم وزيادة متوسط الطلبات.'; }
          if(!dev){ dev = 'خطة 0-3 أشهر: تنظيف البيانات ومراقبة أسبوعية • 3-6 أشهر: اختبار تسعير وحزم • 6-12 شهر: توسيع القنوات والشراكات.'; }

          // Render modal
          hideAssistantOverlay();
          const m = ensureAssistantModal();
          m.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
              <div class="label">تقرير المساعد الذكي</div>
              <button id="assistantModalClose" class="btn btn-ghost">إغلاق</button>
            </div>
            <div style="margin-top:10px;display:grid;grid-template-columns:1fr;gap:10px">
              <div class="card" style="padding:.6rem">
                <div class="status">الملاحظات</div>
                <pre style="white-space:pre-wrap;line-height:1.8;margin:0">${obs}</pre>
              </div>
              <div class="card" style="padding:.6rem">
                <div class="status">خطة التحسين</div>
                <pre style="white-space:pre-wrap;line-height:1.8;margin:0">${plan}</pre>
              </div>
              <div class="card" style="padding:.6rem">
                <div class="status">نصائح تسويقية</div>
                <pre style="white-space:pre-wrap;line-height:1.8;margin:0">${tips}</pre>
              </div>
              <div class="card" style="padding:.6rem">
                <div class="status">خطة تطوير المبيعات</div>
                <pre style="white-space:pre-wrap;line-height:1.8;margin:0">${dev}</pre>
              </div>
            </div>`;
          m.style.display = 'block';
          m.querySelector('#assistantModalClose')?.addEventListener('click', () => { m.style.display = 'none'; });
        }catch(e){
          console.error('Assistant report error:', e);
          hideAssistantOverlay();
          window.App?.showToast('تعذر توليد تقرير المساعد');
        }
      });

      // Search
      document.getElementById('invSearch')?.addEventListener('input', e => {
        const q = (e.target.value||'').toLowerCase();
        const filtered = items.filter(x => (x.name||'').toLowerCase().includes(q) || (x.category||'').toLowerCase().includes(q) || (x.sku||'').toLowerCase().includes(q));
        body.innerHTML=''; filtered.forEach(i => body.appendChild(renderRow(i))); attachRowEvents();
      });

      // Hover image preview above cursor
      let hoverImg = null;
      
      function initHoverImage(){
        if(hoverImg) return; // Already initialized
        hoverImg = document.createElement('img');
        hoverImg.style.position = 'fixed';
        hoverImg.style.pointerEvents = 'none';
        hoverImg.style.zIndex = '2000';
        hoverImg.style.display = 'none';
        hoverImg.style.maxWidth = '200px';
        hoverImg.style.maxHeight = '200px';
        hoverImg.style.border = '1px solid var(--chip-border)';
        hoverImg.style.borderRadius = '8px';
        hoverImg.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
        hoverImg.style.backgroundColor = 'white';
        document.body.appendChild(hoverImg);
      }

      function positionHover(x, y){
        if(!hoverImg) return;
        const imgW = hoverImg.offsetWidth || 200;
        const imgH = hoverImg.offsetHeight || 200;
        const padding = 8;
        // Place image centered horizontally above cursor
        let left = Math.min(Math.max(padding, x - imgW/2), window.innerWidth - imgW - padding);
        let top = Math.max(padding, y - imgH - 16);
        hoverImg.style.left = left + 'px';
        hoverImg.style.top = top + 'px';
      }
      
      function showHover(imgDataUrl, x, y){
        if(!imgDataUrl) return;
        initHoverImage();
        hoverImg.style.display = 'block';
        hoverImg.onload = () => positionHover(x, y);
        hoverImg.onerror = () => hoverImg.style.display = 'none';
        hoverImg.src = imgDataUrl;
        // Position immediately in case image is cached
        setTimeout(() => positionHover(x, y), 10);
      }
      
      function hideHover(){ 
        if(hoverImg) hoverImg.style.display = 'none'; 
      }

      function attachHoverHandlers(){
        body.querySelectorAll('tr').forEach(tr => {
          const sku = tr.dataset.sku;
          if(!sku) return;
          
          const row = items.find(x => x.sku === sku);
          const imgDataUrl = row?.image;
          
          if(imgDataUrl) {
            tr.addEventListener('mouseenter', (ev) => {
              showHover(imgDataUrl, ev.clientX, ev.clientY);
            });
            
            tr.addEventListener('mousemove', (ev) => {
              if(hoverImg && hoverImg.style.display === 'block') {
                positionHover(ev.clientX, ev.clientY);
              }
            });
            
            tr.addEventListener('mouseleave', hideHover);
          }
        });
      }
    }
  };
  window.InventoryView = View;
})();
