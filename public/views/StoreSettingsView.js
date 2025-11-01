// StoreSettingsView: user-provided store identity used to brand PDF exports
(function(){
  async function render(root){
    if(!root) return;
    root.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'container';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="label">إعدادات متجرك (اختياري)</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        <input id="storeName" type="text" placeholder="اسم المتجر / الشركة" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
        <input id="crNumber" type="text" placeholder="السجل التجاري" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
        <input id="taxNumber" type="text" placeholder="الرقم الضريبي (اختياري)" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.6rem;border-radius:10px">
        <div style="display:flex;flex-direction:column;gap:8px">
          <label style="font-size:12px;color:#64748B">شعار المتجر</label>
          <input id="logoFile" type="file" accept="image/*" style="background:var(--chip);border:1px solid var(--chip-border);color:var(--fg);padding:.4rem;border-radius:10px">
          <div id="logoPreview" style="display:none;align-items:center;gap:10px">
            <img id="logoImg" alt="معاينة الشعار" style="width:64px;height:64px;border-radius:12px;border:1px solid var(--chip-border);object-fit:contain;background:#fff">
            <span style="color:#64748B;font-size:12px">معاينة</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:12px">
        <button id="deleteStoreSettings" class="btn btn-ghost">حذف إعدادات المتجر</button>
        <button id="saveStoreSettings" class="btn">حفظ الإعدادات</button>
      </div>`;
    container.appendChild(card);

    // Loading overlay shown during save/initialization
    const overlay = document.createElement('div');
    overlay.id = 'storeInitOverlay';
    overlay.style.display = 'none';
    overlay.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(11,15,22,.55);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center">
        <div class="card" style="padding:24px;min-width:320px;text-align:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:14px">
            <svg width="56" height="56" viewBox="0 0 50 50" aria-hidden="true">
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="var(--primary-start)" />
                  <stop offset="100%" stop-color="var(--primary-end)" />
                </linearGradient>
              </defs>
              <circle cx="25" cy="25" r="20" stroke="var(--chip-border)" stroke-width="5" fill="none" opacity=".25"></circle>
              <path d="M25 5 A20 20 0 0 1 45 25" stroke="url(#lg)" stroke-width="5" fill="none">
                <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
              </path>
            </svg>
            <div class="label">جارٍ تهيئة النظام لمتجرك</div>
            <div class="status">يتم إعداد ملفات PDF بعلامتك التجارية…</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    root.appendChild(container);

    // Prefill from settings
    try{
      const existing = await (window.Branding?.load?.() || {});
      const brand = window.Branding?.get?.() || {};
      const nameEl = document.getElementById('storeName');
      const crEl = document.getElementById('crNumber');
      const taxEl = document.getElementById('taxNumber');
      const previewEl = document.getElementById('logoPreview');
      const imgEl = document.getElementById('logoImg');
      if(nameEl) nameEl.value = brand.name || '';
      if(crEl) crEl.value = brand.cr || '';
      if(taxEl) taxEl.value = brand.tax || '';
      if(imgEl && brand.logo){ imgEl.src = brand.logo; previewEl.style.display = 'flex'; }
    }catch(_){ }

    // Logo file handling
    let logoDataUrl = (window.Branding?.get?.() || {}).logo || '';
    document.getElementById('logoFile')?.addEventListener('change', (ev) => {
      const file = ev.target?.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        logoDataUrl = String(reader.result || '');
        const imgEl = document.getElementById('logoImg');
        const previewEl = document.getElementById('logoPreview');
        if(imgEl){ imgEl.src = logoDataUrl; }
        if(previewEl){ previewEl.style.display = logoDataUrl ? 'flex' : 'none'; }
      };
      reader.readAsDataURL(file);
    });

    // Save settings and initialize branding
    document.getElementById('saveStoreSettings')?.addEventListener('click', async () => {
      try{
        const name = document.getElementById('storeName')?.value?.trim() || '';
        const cr = document.getElementById('crNumber')?.value?.trim() || '';
        const tax = document.getElementById('taxNumber')?.value?.trim() || '';

        // Show overlay while preparing
        const ov = document.getElementById('storeInitOverlay');
        if(ov) ov.style.display = 'block';

        // Persist values (Electron path only; on web preview, no-op)
        if(window.dbManager?.setSetting){
          if(name || name==='') await window.dbManager.setSetting('store.name', name);
          if(cr || cr==='') await window.dbManager.setSetting('store.cr', cr);
          if(tax || tax==='') await window.dbManager.setSetting('store.tax', tax);
          if(logoDataUrl || logoDataUrl==='') await window.dbManager.setSetting('store.logo', logoDataUrl);
        }

        // Refresh cache and preload assets
        await window.Branding?.refresh?.();
        await window.Branding?.prepareForPdfBranding?.();

        // Simulate preparation to ensure smooth UX (5 seconds)
        await new Promise(r => setTimeout(r, 5000));

        if(ov) ov.style.display = 'none';
        window.App?.showToast?.('تم حفظ إعدادات المتجر');
      }catch(e){
        console.error(e);
        const ov = document.getElementById('storeInitOverlay');
        if(ov) ov.style.display = 'none';
        window.App?.showToast?.('فشل حفظ الإعدادات');
      }
    });

    // Delete store settings: clear identity and restore defaults with confirmation
    document.getElementById('deleteStoreSettings')?.addEventListener('click', async () => {
      try{
        const confirmed = window.confirm('هل تريد بالتأكيد حذف جميع إعدادات المتجر وإعادة التطبيق إلى الوضع الافتراضي؟ سيتم مسح الاسم والسجل التجاري والرقم الضريبي والشعار وإعادة نمط تصدير PDF إلى التصميم الافتراضي.');
        if(!confirmed) return;

        // Optional: show overlay during reset for clarity
        const ov = document.getElementById('storeInitOverlay');
        if(ov) {
          const statusEl = ov.querySelector('.status');
          if(statusEl) statusEl.textContent = 'جارٍ إعادة تعيين الإعدادات إلى الافتراضي…';
          ov.style.display = 'block';
        }

        // Clear stored branding keys (Electron only; on web preview it will no-op)
        if(window.dbManager?.setSetting){
          // Canonical keys used by Branding
          await window.dbManager.setSetting('store.name', '');
          await window.dbManager.setSetting('store.cr', '');
          await window.dbManager.setSetting('store.tax', '');
          await window.dbManager.setSetting('store.logo', '');
          // Legacy aliases (for compatibility with older data)
          await window.dbManager.setSetting('storeName', '');
          await window.dbManager.setSetting('crNumber', '');
          await window.dbManager.setSetting('taxNumber', '');
          await window.dbManager.setSetting('logo', '');
        }

        // Refresh cache and preloading (will result in defaults)
        await window.Branding?.refresh?.();
        await window.Branding?.prepareForPdfBranding?.();

        // UX pause to keep feedback consistent
        await new Promise(r => setTimeout(r, 1200));

        window.App?.showToast?.('تم حذف إعدادات المتجر وإعادة الضبط إلى الافتراضي');

        // Auto-reload the app to apply default identity everywhere
        try{ await window.electronAPI?.appRelaunch?.(); }
        catch(_){ location.reload(); }
      }catch(e){
        console.error(e);
        const ov = document.getElementById('storeInitOverlay');
        if(ov) ov.style.display = 'none';
        window.App?.showToast?.('تعذر حذف إعدادات المتجر');
      }
    });
  }

  window.StoreSettingsView = { render };
})();
