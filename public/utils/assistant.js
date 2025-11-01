// Smart Assistant util: specialized prompts for analysis and recommendations
(function(){
  async function getUserName(){
    try{ const r = await window.dbManager?.getSettings?.(); return r?.settings?.['assistant.name'] || ''; }catch(_){ return ''; }
  }

  async function analyzePerformance(summary){
    const name = await getUserName();
    const sys = `أنت مساعد أعمال ذكي متخصص في تحليل الأداء، التسويق، وتطوير الأعمال. خاطب المستخدم باسمه إن توفر (${name||'—'}). قدّم توصيات عملية وموجزة وواضحة باللغة العربية.`;
    const prompt = `
المعطيات:
- المنتجات الأعلى مبيعًا: ${JSON.stringify(summary?.topSelling||[])}
- الإيراد الشهري حسب الشهر: ${JSON.stringify(summary?.monthlyRevenue||[])}
- اتجاهات الربح: ${JSON.stringify(summary?.profitTrends||[])}

أعطِ ملخصًا موجزًا لحالة الأداء الحالية، ثم 5 توصيات تسويقية/تشغيلية قابلة للتنفيذ لتحسين المبيعات والربحية (مع مبرر قصير لكل توصية).`;
    const res = await window.aiClient?.chat?.({ model:'gpt-4o-mini', messages:[{ role:'system', content: sys }, { role:'user', content: prompt }] });
    if(res?.ok) return { ok:true, text: res.content };
    return { ok:false, reason: res?.reason||'unknown' };
  }

  async function recommendForLowSales(productName){
    const name = await getUserName();
    const sys = `أنت مساعد تسويق ذكي. خاطب المستخدم باسمه إن توفر (${name||'—'}).`;
    const prompt = `مبيعات المنتج "${productName}" منخفضة. اقترح 3 أفكار عملية لزيادة المبيعات عبر منتجات مكملة، عروض، ورسائل تسويقية.`;
    const res = await window.aiClient?.chat?.({ model:'gpt-4o-mini', messages:[{ role:'system', content: sys }, { role:'user', content: prompt }] });
    if(res?.ok) return { ok:true, text: res.content };
    return { ok:false, reason: res?.reason||'unknown' };
  }

  window.Assistant = { analyzePerformance, recommendForLowSales };
})();

