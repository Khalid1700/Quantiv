// ReportsView: quick summaries and exports scaffold
(function(){
  const View = {
    id: 'reports',
    name: 'التقارير',
    async render(root){
      root.innerHTML='';
      const grid = document.createElement('div');
      grid.className = 'grid';
      const topCard = document.createElement('div');
      topCard.className = 'card';
      topCard.innerHTML = `<div class="label">أعلى المنتجات مبيعًا</div><div id="topList" class="status">—</div>`;
      const revCard = document.createElement('div');
      revCard.className = 'card';
      revCard.innerHTML = `<div class="label">الإيرادات الشهرية</div><div id="revList" class="status">—</div>`;
      const profitCard = document.createElement('div');
      profitCard.className = 'card';
      profitCard.innerHTML = `<div class="label">اتجاهات الربح</div><div id="profitList" class="status">—</div>`;
      grid.append(topCard, revCard, profitCard);
      root.appendChild(grid);

      try{
        const resp = await (window.dbManager?.getReportsSummary?.() || { ok:false });
        if(!resp?.ok){ window.App?.showToast(resp?.reason||'فشل تحميل التقارير'); return; }
        const report = resp.report || {};
        const top = report.topSelling || [];
        const monthlyRevenue = report.monthlyRevenue || [];
        const profitTrends = report.profitTrends || [];
        const topEl = document.getElementById('topList');
        const revEl = document.getElementById('revList');
        const profEl = document.getElementById('profitList');
        if(topEl){
          if(top.length){ topEl.innerHTML = top.map(t=>`${t.name} — وحدات: ${t.units}, إيراد: ${t.revenue.toFixed(2)}`).join('<br>'); }
          else topEl.textContent = 'لا توجد بيانات مبيعات بعد.';
        }
        if(revEl){
          if(monthlyRevenue.length){ revEl.innerHTML = monthlyRevenue.map(m=>`${m.month}: ${m.revenue.toFixed(2)}`).join('<br>'); }
          else revEl.textContent = 'لا توجد بيانات الإيرادات.';
        }
        if(profEl){
          if(profitTrends.length){ profEl.innerHTML = profitTrends.map(m=>`${m.month}: ${m.profit.toFixed(2)}`).join('<br>'); }
          else profEl.textContent = 'لا توجد بيانات الربح.';
        }
      }catch(e){ /* noop */ }
    }
  };
  window.ReportsView = View;
})();
