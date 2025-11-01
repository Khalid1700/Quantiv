// Branding util: loads cached store identity and provides helpers for PDF exports
(function(){
  const cache = { loaded:false, settings:{} };

  function normalize(settings){
    const s = settings || {};
    const name = s['store.name'] || s.storeName || '';
    const cr = s['store.cr'] || s.crNumber || '';
    const tax = s['store.tax'] || s.taxNumber || '';
    const logo = s['store.logo'] || s.logo || '';
    return { name, cr, tax, logo };
  }

  async function load(){
    try{
      const resp = await (window.dbManager?.getSettings?.() || { ok:true, settings:{} });
      cache.settings = resp?.settings || {};
      cache.loaded = true;
      return normalize(cache.settings);
    }catch(_){ return normalize({}); }
  }

  function get(){ return normalize(cache.settings); }

  async function prepareForPdfBranding(){
    // Ensure settings are loaded and logo (if any) is preloaded
    const brand = cache.loaded ? get() : await load();
    const src = brand.logo;
    if(!src){ return; }
    await new Promise((resolve) => {
      try{
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      }catch(_){ resolve(); }
    });
  }

  async function refresh(){ await load(); }

  window.Branding = { load, get, prepareForPdfBranding, refresh };
})();

