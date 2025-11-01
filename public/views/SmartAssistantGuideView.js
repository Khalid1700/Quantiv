// Smart Assistant Guide view: explains key acquisition/linking and provides navigation back
(function(){
  const View = {
    id: 'assistantGuide',
    name: 'دليل المساعد الذكي',
    async render(root){
      root.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div class="label">دليل إعداد المساعد الذكي</div>
          <button id="backToSettings" class="btn btn-ghost">العودة إلى إعدادات المساعد الذكي</button>
        </div>
        <div style="margin-top:10px;line-height:1.8">
          <p>✨ ما هو المفتاح (OpenAI API Key)؟</p>
          <p style="color:var(--muted)">هو رمز يُمكّن التطبيق من الاتصال بخدمة الذكاء الاصطناعي وتوليد التحليلات الذكية والتوصيات.</p>
          <hr style="border-color:var(--chip-border);margin:10px 0" />
          <p>😊 كيف تحصل على المفتاح؟</p>
          <ul style="margin:6px 0 10px 0;padding-inline-start:18px;">
            <li>افتح موقع OpenAI وسجل الدخول.</li>
            <li>اذهب إلى صفحة المفاتيح (API Keys) وأنشئ مفتاحًا جديدًا.</li>
            <li>انسخ المفتاح ولا تشاركه مع أي شخص.</li>
          </ul>
          <p>🔗 كيف تربطه بالتطبيق؟</p>
          <ul style="margin:6px 0 10px 0;padding-inline-start:18px;">
            <li>انتقل إلى شاشة <strong>إعدادات المساعد الذكي</strong>.</li>
            <li>ألصق المفتاح في الحقل المخصص.</li>
            <li>أدخل اسمك المفضل، ثم اضغط حفظ.</li>
          </ul>
          <p>💡 لماذا المفتاح مهم؟</p>
          <p style="color:var(--muted)">بدون المفتاح، لا يمكن للمساعد الذكي تحليل الأداء أو تقديم توصيات تسويقية وخطط تحسين مخصصة لنشاطك.</p>
        </div>
      `;
      root.appendChild(card);
      document.getElementById('backToSettings')?.addEventListener('click', () => { location.hash = '#assistantSettings'; });
    }
  };
  window.SmartAssistantGuideView = View;
})();
