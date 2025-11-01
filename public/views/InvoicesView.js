// InvoicesView: scaffolding for invoice creation and export
(function(){
  const View = {
    id: 'invoices',
    name: 'الفواتير',
    async render(root){
      root.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'card';
      wrap.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="label">إنشاء فاتورة جديدة</div>
          <div>
            <button class="btn" id="addLine">إضافة عنصر</button>
            <button class="btn btn-ghost" id="saveInvoice">حفظ الفاتورة</button>
          </div>
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="field"><label class="status">التاريخ</label><input id="invDate" type="date" class="input" /></div>
          <div class="field"><label class="status">العميل</label><input id="invCustomer" type="text" placeholder="اسم العميل" class="input" /></div>
          <div class="field">
            <label class="status">الإجمالي</label>
            <input id="invTotal" type="number" min="0" step="0.01" class="input" disabled />
          </div>
        </div>
        <div style="margin-top:12px">
          <table class="table">
            <thead>
              <tr>
                <th>المنتج</th>
                <th>السعر</th>
                <th>الكمية</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody id="linesBody"></tbody>
          </table>
        </div>`;
      root.appendChild(wrap);

      const productsResp = await (window.dbManager?.listProducts?.() || { items: [] });
      const products = productsResp?.items || [];
      // Default tax rate from settings (as decimal fraction, e.g., 0.15)
      let defaultTaxRate = 0.15;
      try{
        const s = await (window.dbManager?.getSettings?.() || { ok:false });
        if(s?.ok){
          const v = s.settings?.TaxRate;
          if(typeof v !== 'undefined') defaultTaxRate = Number(v||0);
        }
      }catch(e){ /* noop */ }

      const body = wrap.querySelector('#linesBody');
      function computeInvoiceTotal(){
        let t = 0; body.querySelectorAll('tr').forEach(tr => { t += Number(tr.dataset.lineTotal||0); });
        const el = document.getElementById('invTotal'); if(el) el.value = String(t.toFixed(2));
        return t;
      }
      function renderLine(initial){
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>
            <select class="lineSku select">
              <option value="">— اختر المنتج —</option>
              ${products.map(p=>`<option value="${p.sku}">${p.name} (${p.sku})</option>`).join('')}
            </select>
          </td>
          <td><input class="linePrice input" type="number" min="0" step="0.01" /></td>
          <td><input class="lineQty input" type="number" min="0" step="1" /></td>
          <td class="lineTotal">0.00</td>`;
        const skuEl = tr.querySelector('.lineSku');
        const priceEl = tr.querySelector('.linePrice');
        const qtyEl = tr.querySelector('.lineQty');
        const totalEl = tr.querySelector('.lineTotal');

        function recalc(){
          const price = Number(priceEl.value||0);
          const qty = Number(qtyEl.value||0);
          const sku = skuEl.value;
          const p = products.find(x=>x.sku===sku);
          const taxRate = (typeof p?.tax === 'number') ? p.tax : defaultTaxRate;
          const total = price*qty*(1 + (taxRate||0));
          totalEl.textContent = String(total.toFixed(2));
          tr.dataset.lineTotal = String(total);
          computeInvoiceTotal();
        }
        skuEl.addEventListener('change', () => {
          const sku = skuEl.value;
          const p = products.find(x=>x.sku===sku);
          if(p){ priceEl.value = String(Number(p.price||0)); qtyEl.value = '1'; }
          recalc();
        });
        priceEl.addEventListener('input', recalc);
        qtyEl.addEventListener('input', recalc);

        if(initial){
          if(initial.sku){ skuEl.value = initial.sku; const p = products.find(x=>x.sku===initial.sku); if(p){ priceEl.value = String(Number(p.price||0)); } }
          if(typeof initial.price === 'number') priceEl.value = String(initial.price);
          if(typeof initial.qty === 'number') qtyEl.value = String(initial.qty);
          recalc();
        }

        return tr;
      }

      document.getElementById('addLine')?.addEventListener('click', () => { body.appendChild(renderLine({ qty:1 })); });
      body.appendChild(renderLine({ qty:1 }));

      document.getElementById('saveInvoice')?.addEventListener('click', async () => {
        const date = document.getElementById('invDate')?.value || new Date().toISOString().slice(0,10);
        const customer = document.getElementById('invCustomer')?.value || '';
        const items = [];
        body.querySelectorAll('tr').forEach(tr => {
          const sku = tr.querySelector('.lineSku')?.value||'';
          const price = Number(tr.querySelector('.linePrice')?.value||0);
          const qty = Number(tr.querySelector('.lineQty')?.value||0);
          if(sku && qty>0) items.push({ sku, price, qty });
        });
        if(!items.length){ window.App?.showToast('أضف عنصرًا واحدًا على الأقل'); return; }
        const resp = await (window.dbManager?.createInvoice?.({ date, customer, items }) || { ok:false });
        if(resp?.ok){
          window.App?.showToast('تم حفظ الفاتورة');
          // Refresh dashboards after issuing invoice
          try{ const s = await window.electronAPI.updateDashboards(); if(s?.ok) window.App.applyDashboardSummary(s.summary); }catch(e){}
          // Refresh invoices list
          try{ await renderInvoicesList(); }catch(e){}
          // Reset Create New Invoice form to default state
          try{
            const dateEl = document.getElementById('invDate');
            const custEl = document.getElementById('invCustomer');
            const totalEl = document.getElementById('invTotal');
            const linesEl = wrap.querySelector('#linesBody');
            if(dateEl) dateEl.value = new Date().toISOString().slice(0,10);
            if(custEl) custEl.value = '';
            if(totalEl) totalEl.value = '0.00';
            if(linesEl){
              linesEl.innerHTML = '';
              linesEl.appendChild(renderLine({ qty:1 }));
            }
          }catch(_){ }
        }
        else { window.App?.showToast(resp?.reason||'فشل حفظ الفاتورة'); }
      });

      // ===== Helper: Export a specific invoice by ID to PDF =====
      async function exportInvoiceById(invoiceId){
        try{
          const jspdf = window.jspdf; const html2canvas = window.html2canvas;
          if(!jspdf || !html2canvas){ window.App?.showToast('مكتبات تصدير PDF غير متوفرة'); return; }
          const resp = await (window.dbManager?.getInvoice?.(invoiceId) || { ok:false });
          if(!resp?.ok){ window.App?.showToast('تعذر جلب بيانات الفاتورة'); return; }
          const inv = resp.invoice || {};
          const items = Array.isArray(inv.items) ? inv.items : [];
          const doc = new jspdf.jsPDF({ unit:'pt', format:'a4' });

          // Build printable wrapper with the same branded layout used in Feasibility
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
          wrapper.style.setProperty('--chip', '#ffffff');
          wrapper.style.setProperty('--chip-border', '#dddddd');
          wrapper.style.setProperty('--card-bg', '#ffffff');
          wrapper.style.setProperty('--card-border', '#dddddd');

          // Load user branding (if any)
          await window.Branding?.load?.();
          const brand = window.Branding?.get?.() || {};
          const header = document.createElement('div');
          header.style.display = 'flex'; header.style.alignItems = 'center'; header.style.justifyContent = 'space-between';
          header.style.padding = '12px 16px'; header.style.margin = '0 0 16px 0'; header.style.borderRadius = '12px';
          header.style.background = 'linear-gradient(90deg, var(--primary-start), var(--primary-end))'; header.style.color = '#ffffff';
const brandName = document.createElement('div'); brandName.textContent = brand.name || 'Quantiv'; brandName.style.fontWeight = '700'; brandName.style.fontSize = '16px';
          const logo = document.createElement('img'); logo.src = brand.logo || './icons/app-64.png'; logo.alt = 'Logo'; logo.style.width = '28px'; logo.style.height = '28px'; logo.style.marginInlineStart = '12px';
          header.appendChild(brandName); header.appendChild(logo); wrapper.appendChild(header);

          const title = document.createElement('div');
          title.style.margin = '0 0 10px 0';
          const exportDateLabel = (() => {
            try {
              const d = new Date(inv.date);
              if (!isNaN(d)) {
                return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
              }
            } catch (e) {}
            return inv.date||'—';
          })();
          title.innerHTML = `<div style="font-size:22px;font-weight:700">فاتورة مبيعات</div>
            <div style="color:#64748B;font-size:12px;margin-top:4px">رقم: ${inv.invoiceId||'—'} — تاريخ: ${exportDateLabel}</div>`;
          wrapper.appendChild(title);
          // Optional brand meta beneath title
          const brandMetaText = [
            brand.cr ? `السجل التجاري: ${brand.cr}` : '',
            brand.tax ? `الرقم الضريبي: ${brand.tax}` : ''
          ].filter(Boolean).join(' • ');
          if(brandMetaText){
            const metaBrand = document.createElement('div');
            metaBrand.style.color = '#64748B';
            metaBrand.style.fontSize = '12px';
            metaBrand.style.margin = '6px 0 10px 0';
            metaBrand.textContent = brandMetaText;
            wrapper.appendChild(metaBrand);
          }

          const meta = document.createElement('div');
          meta.style.display = 'grid'; meta.style.gridTemplateColumns = 'repeat(3,1fr)'; meta.style.gap = '8px'; meta.style.marginBottom = '8px';
          meta.innerHTML = `
            <div class="card" style="padding:.6rem"><div class="status">العميل</div><div class="value">${inv.customer||'—'}</div></div>
            <div class="card" style="padding:.6rem"><div class="status">عدد العناصر</div><div class="value">${items.length}</div></div>
            <div class="card" style="padding:.6rem"><div class="status">الإجمالي</div><div class="value">${Number(inv.total||0).toFixed(2)}</div></div>`;
          wrapper.appendChild(meta);

          const table = document.createElement('table');
          table.style.width = '100%'; table.style.borderCollapse = 'collapse'; table.style.background = '#ffffff'; table.style.border = '1px solid #dddddd'; table.style.borderRadius = '8px';
          const thead = document.createElement('thead');
          thead.innerHTML = `<tr style="background:#f1f5f9"><th style="padding:8px;border-bottom:1px solid #e5e7eb">المنتج</th><th style="padding:8px;border-bottom:1px solid #e5e7eb">السعر</th><th style="padding:8px;border-bottom:1px solid #e5e7eb">الكمية</th><th style="padding:8px;border-bottom:1px solid #e5e7eb">الإجمالي</th></tr>`;
          table.appendChild(thead);
          const tbodyEl = document.createElement('tbody');
          items.forEach(r => {
            const trEl = document.createElement('tr');
            const lineTotal = Number(r.qty||0) * Number(r.price||0);
            trEl.innerHTML = `<td style="padding:8px;border-bottom:1px solid #e5e7eb">${r.name||r.sku||'—'}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${Number(r.price||0).toFixed(2)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${Number(r.qty||0)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${lineTotal.toFixed(2)}</td>`;
            tbodyEl.appendChild(trEl);
          });
          table.appendChild(tbodyEl);
          wrapper.appendChild(table);

          const footer = document.createElement('div');
          footer.style.marginTop = '16px'; footer.style.padding = '8px 12px'; footer.style.borderTop = '1px solid #E5E7EB'; footer.style.color = '#64748B'; footer.style.fontSize = '12px';
footer.textContent = 'تم توليد الفاتورة عبر Quantiv';
          wrapper.appendChild(footer);
          document.body.appendChild(wrapper);

          const canvas = await html2canvas(wrapper, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
          document.body.removeChild(wrapper);
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

          const safeCustomer = String(inv.customer||'').replace(/[<>:"/\\|?*]+/g, '-');
          const filename = `Invoice – ${safeCustomer} – ${inv.date||''}.pdf`;
          doc.save(filename);
          window.App?.showToast('تم تصدير الفاتورة PDF');
          // After export, refresh dashboards and chart to compare with previous month
          try{ const s = await window.electronAPI.updateDashboards(); if(s?.ok) window.App.applyDashboardSummary(s.summary); }catch(e){}
        }catch(e){
          console.error('Invoice PDF export error:', e);
          window.App?.showToast('تعذر تصدير PDF');
        }
      }

      // ===== Existing invoices list =====
      const listCard = document.createElement('div');
      listCard.className = 'card';
      listCard.innerHTML = `<div class="label">الفواتير الصادرة</div><table class="table"><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>إجراءات</th></tr></thead><tbody id="invListBody"></tbody></table>`;
      root.appendChild(listCard);
      async function renderInvoicesList(){
        const r = await (window.dbManager?.listInvoices?.() || { ok:true, invoices:[] });
        const rows = r?.invoices || [];
        const tbody = listCard.querySelector('#invListBody');
        if(!tbody) return;
        tbody.innerHTML = '';
        if(!rows.length){ tbody.innerHTML = '<tr><td colspan="5" class="status">لا توجد فواتير بعد.</td></tr>'; return; }
        rows.forEach(inv => {
          const tr = document.createElement('tr');
          const totalHtml = `${Number(inv.total||0).toFixed(2)}`;
          const actionsHtml = `<button class="btn btn-ghost exportInvoiceRow" data-id="${inv.invoiceId}" title="تصدير الفاتورة PDF">تصدير PDF</button> <button class="btn btn-ghost deleteInvoiceRow" data-id="${inv.invoiceId}" title="حذف الفاتورة">حذف</button>`;
          tr.innerHTML = `<td>${inv.invoiceId}</td><td>${inv.date}</td><td>${inv.customer||'—'}</td><td>${totalHtml}</td><td>${actionsHtml}</td>`;
          tbody.appendChild(tr);
        });
        tbody.querySelectorAll('.exportInvoiceRow').forEach(btn => {
          btn.addEventListener('click', async (ev) => {
            const id = ev.currentTarget?.getAttribute('data-id');
            if(id) await exportInvoiceById(id);
          });
        });
        tbody.querySelectorAll('.deleteInvoiceRow').forEach(btn => {
          btn.addEventListener('click', async (ev) => {
            const id = ev.currentTarget?.getAttribute('data-id');
            if(!id) return;
            const resp = await (window.dbManager?.deleteInvoice?.(id) || { ok:false });
            if(resp?.ok){
              window.App?.showToast('تم حذف الفاتورة');
              try{ const s = await window.electronAPI.updateDashboards(); if(s?.ok) window.App.applyDashboardSummary(s.summary); }catch(e){}
              try{ await renderInvoicesList(); }catch(e){}
            }
            else { window.App?.showToast(resp?.reason||'فشل حذف الفاتورة'); }
          });
        });
      }
      await renderInvoicesList();
    }
  };
  window.InvoicesView = View;
})();
