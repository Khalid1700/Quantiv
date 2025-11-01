// Sidebar component: renders navigation and handles active state
(function(){
  const items = [
    { id:'dashboard', label:'لوحة التحكم' },
    { id:'inventory', label:'المخزون' },
    { id:'invoices', label:'الفواتير' },
    { id:'reports', label:'التقارير' },
    { id:'feasibility', label:'الجدوى' },
    { id:'storeSettings', label:'إعدادات متجرك (اختياري)' },
    { id:'assistantSettings', label:'إعدادات المساعد الذكي' }
  ];
  function renderSidebar(container, onNavigate){
    if(!container) return;
    container.innerHTML = '';
    const brand = document.createElement('div');
    brand.className = 'brand';
    brand.innerHTML = `<img src="./icons/app-64.png" alt="" class="logo">`+
      `<span class="name">ABT</span>`;
    container.appendChild(brand);

    const nav = document.createElement('div');
    nav.className = 'nav';
    items.forEach(i => {
      const el = document.createElement('button');
      el.className = 'item';
      el.type = 'button';
      el.textContent = i.label;
      el.dataset.view = i.id;
      el.addEventListener('click', () => onNavigate?.(i.id));
      nav.appendChild(el);
    });
    container.appendChild(nav);
  }

  function setActive(viewId){
    document.querySelectorAll('.nav .item').forEach(el => {
      if(el.dataset.view === viewId) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  window.Sidebar = { renderSidebar, setActive };
})();
