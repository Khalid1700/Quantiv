# دليل نشر بوابة التراخيص - Quantiv License Gateway

## المتطلبات الأساسية

### 1. متطلبات الخادم (VPS)
- نظام تشغيل: Ubuntu 22.04 أو أعلى
- ذاكرة: 1GB RAM كحد أدنى
- مساحة تخزين: 10GB كحد أدنى
- Docker و Docker Compose مثبتان
- المنفذ 8088 مفتوح (أو 80/443 للإنتاج)

### 2. متطلبات GitHub
- مستودع GitHub يحتوي على الإصدارات (Releases)
- ملف workflow في `.github/workflows/release.yml`
- إصدارات عامة أو GitHub Token للمستودعات الخاصة

## خطوات النشر

### 1. إعداد متغيرات البيئة
```bash
# انسخ ملف البيئة وحدث القيم
cp .env.example .env
nano .env
```

حدث القيم التالية في ملف `.env`:
```
GITHUB_OWNER=your-actual-github-username
GITHUB_REPO=Quantiv
GITHUB_TOKEN=your_token_if_private_repo
PRODUCTION_DOMAIN=https://your-domain.com
```

### 2. بناء وتشغيل البوابة
```bash
# انتقل إلى مجلد الخادم
cd server

# بناء وتشغيل الحاوية
docker-compose up -d --build

# التحقق من حالة الخدمة
docker-compose ps
docker-compose logs -f license-server
```

### 3. التحقق من عمل البوابة
```bash
# اختبار endpoint الصحة
curl http://localhost:8088/health

# اختبار الصفحة الرئيسية
curl http://localhost:8088/
```

### 4. إعداد Nginx (للإنتاج)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## اختبار التكامل

### 1. اختبار إصدار الترخيص
```bash
curl -X POST http://localhost:8088/issue \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","os":"windows"}'
```

### 2. اختبار حل رابط التحميل
```bash
curl -X POST http://localhost:8088/resolve \
  -H "Content-Type: application/json" \
  -d '{"os":"windows","version":"1.0.0"}'
```

## استكشاف الأخطاء

### مشاكل شائعة:
1. **خطأ في الاتصال بـ GitHub API**: تحقق من GITHUB_OWNER و GITHUB_REPO
2. **فشل تحميل الأصول**: تأكد من أن الإصدارات عامة أو أن GITHUB_TOKEN صحيح
3. **عدم عمل البوابة**: تحقق من logs باستخدام `docker-compose logs`

### أوامر مفيدة:
```bash
# إعادة تشغيل الخدمة
docker-compose restart

# عرض السجلات
docker-compose logs -f license-server

# إيقاف الخدمة
docker-compose down

# تحديث الخدمة
docker-compose down && docker-compose up -d --build
```

## الأمان

1. **للمستودعات الخاصة**: استخدم GitHub Token مع صلاحيات محدودة
2. **HTTPS**: استخدم SSL certificate في الإنتاج
3. **Firewall**: اقصر الوصول على المنافذ المطلوبة فقط
4. **Backup**: احتفظ بنسخة احتياطية من إعدادات البيئة

## المراقبة

البوابة تتضمن health check على `/health` يمكن استخدامه مع أنظمة المراقبة:
```bash
# مثال على مراقبة بسيطة
watch -n 30 'curl -s http://localhost:8088/health | jq'
```