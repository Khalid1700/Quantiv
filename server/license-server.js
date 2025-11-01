// Simple Dockerized License Server for Quantiv
// Endpoints:
// - POST /issue: { name, email, assetName?, version? } -> { licenseKey, downloadUrl?, message }
// - POST /resolve: { os, version? } -> { ok, assetName, downloadUrl }
// - POST /activate: { key, email, device } -> { ok, reason }
// - GET  /health -> { ok: true }

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const crypto = require('crypto');
const path = require('path');
const https = require('https');
const archiver = require('archiver');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// Reuse local generator logic
const { generateCustomerLicenseKey, validateLicenseKeyFormat } = require('../tools/license-generator');

const PORT = process.env.PORT || 8088;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'your-org-or-user';
const GITHUB_REPO = process.env.GITHUB_REPO || 'Quantiv';
const ALLOW_ANY_ASSET = process.env.ALLOW_ANY_ASSET === 'true';

// Basic in-memory store (replace with persistent DB if needed)
const issued = new Map(); // key -> { name, email, at, assetName, version }
const activations = new Map(); // key -> { email, device, at }
// Single-use download tokens
const downloadTokens = new Map(); // token -> { name?, email?, os?, version?, used:false, createdAt, usedAt? }

function createDownloadToken(payload = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  downloadTokens.set(token, {
    ...payload,
    used: false,
    createdAt: new Date().toISOString()
  });
  return token;
}

const app = express();
app.use(express.json());
app.use(cors());
app.use(morgan('tiny'));
// Serve landing page static files
app.use(express.static(path.join(__dirname, 'public')));
// Also serve app icons and styles from main app to keep branding consistent
app.use('/app-icons', express.static(path.join(__dirname, '..', 'public', 'icons')));
app.use('/app-styles', express.static(path.join(__dirname, '..', 'public', 'styles')));
// Serve docs (instructions PDF) if present
app.use('/docs', express.static(path.join(__dirname, 'public', 'docs')));

// Dynamic instructions PDF for testing (served when no file exists)
app.get('/docs/instructions.pdf', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'public', 'docs', 'instructions.pdf');
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="instructions.pdf"');
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.pipe(res);

    // Header
    doc.fillColor('#0F172A');
    doc.rect(50, 50, doc.page.width - 100, 60).fill('#E2E8F0');
    doc.fillColor('#0F172A').fontSize(22).text('Quantiv — إرشادات التشغيل', 60, 70, { align: 'left' });

    // Body
    doc.moveDown(2);
    doc.fillColor('#334155').fontSize(14).text('شكراً لشرائك Quantiv. يرجى اتباع الخطوات التالية:', { align: 'right' });
    doc.moveDown();
    doc.fillColor('#0F172A').fontSize(12);
    const steps = [
      '1) قم باستخراج ملف ZIP الذي تم تنزيله.',
      '2) شغّل ملف المُثبّت المناسب لنظامك.',
      '   • Windows: إذا ظهر SmartScreen اختر "More info" ثم "Run anyway".',
      '   • macOS: إذا ظهر Gatekeeper، اضغط بالزر الأيمن ثم "Open".',
      '3) يتم التفعيل تلقائياً عند التشغيل الأول عبر ملف Quantiv-license.json.',
      '4) بعد التثبيت، افتح التطبيق وسيتم ربط الترخيص ببصمة جهازك.',
      '5) للاستخدام المؤسسي، يُرجى عدم مشاركة الترخيص خارج الجهاز المرخّص.'
    ];
    steps.forEach(line => doc.text(line, { align: 'right' }));

    doc.moveDown(2);
    doc.fillColor('#334155').fontSize(12).text('الدعم الفني: support@quantiv.local', { align: 'right' });
    doc.end();
  } catch (e) {
    console.error('instructions.pdf error:', e);
    res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Root serves landing page
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Exit route: invalidate token (if provided) and attempt to close the page
app.get('/exit', (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    if (token) {
      const rec = downloadTokens.get(token);
      if (rec) {
        rec.used = true;
        rec.usedAt = new Date().toISOString();
        downloadTokens.set(token, rec);
        // Optionally remove the token entirely
        downloadTokens.delete(token);
      }
    }
    // Return a minimal page that tries to close the tab/window
    const html = `<!doctype html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>الخروج من البوابة</title>
      <style>
        body{background:#0F172A;color:#E2E8F0;font-family:Segoe UI,Tahoma,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
        .card{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:24px;text-align:center;width:min(520px,92vw)}
        .btn{margin-top:12px;padding:10px 16px;border-radius:10px;border:2px solid #334155;background:transparent;color:#E2E8F0;cursor:pointer}
      </style>
    </head>
    <body>
      <div class="card">
        <h2>تم إنهاء الجلسة</h2>
        <p>سيتم إغلاق الصفحة الآن. إن رفض المتصفح الإغلاق، يمكنك إغلاقها يدويًا.</p>
        <button class="btn" onclick="manualClose()">إغلاق الآن</button>
      </div>
      <script>
        function attemptClose(){
          // Common attempts to close the tab/window
          try{ window.opener = null; }catch(e){}
          try{ window.open('', '_self'); }catch(e){}
          try{ window.close(); }catch(e){}
        }
        function manualClose(){ attemptClose(); }
        // Try immediately, then fallback to navigating away
        attemptClose();
        setTimeout(() => {
          // Navigate away to a blank page if close is blocked
          try{ location.replace('about:blank'); }catch(e){ }
        }, 300);
      </script>
    </body>
    </html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('Exit route error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Helper: build GitHub download URL for release assets
function buildDownloadUrl(assetName, version) {
  // If version provided, you may target a specific tag: /download/v1.0.0/<asset>
  // Otherwise, use latest: /releases/latest/download/<asset>
  if (version) {
    return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${version}/${assetName}`;
  }
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/${assetName}`;
}

// Detect OS from User-Agent to choose asset extension
function detectOSFromUA(ua = '') {
  const u = ua.toLowerCase();
  if (u.includes('mac os') || u.includes('macintosh')) return 'macos';
  if (u.includes('windows')) return 'windows';
  return 'windows';
}

// Resolve asset via GitHub API when assetName is not provided
async function resolveAssetUrl({ assetName, version, os }) {
  try {
    if (assetName) {
      return { assetName, downloadUrl: buildDownloadUrl(assetName, version) };
    }
    const token = process.env.GITHUB_TOKEN;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Quantiv-License-Server'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = version
      ? `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/v${version}`
      : `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      throw new Error(`GitHub API error ${resp.status}`);
    }
    const rel = await resp.json();
    const assets = Array.isArray(rel.assets) ? rel.assets : [];
    const pick = assets.find(a => {
      const name = (a && a.name) || '';
      const lower = name.toLowerCase();
      switch (os) {
        case 'windows-x86':
          return lower.endsWith('.exe') && lower.includes('x86');
        case 'windows-x64':
          return lower.endsWith('.exe') && !lower.includes('x86');
        case 'macos-apple':
          return lower.endsWith('.dmg') && (lower.includes('arm64') || lower.includes('apple') || lower.includes('aarch64'));
        case 'macos-intel':
          return lower.endsWith('.dmg') && !(lower.includes('arm64') || lower.includes('aarch64'));
        default:
          // Fallback generic
          if (os && os.startsWith('mac')) return lower.endsWith('.dmg');
          return lower.endsWith('.exe') || lower.endsWith('.msi');
      }
    });
    if (!pick) {
      throw new Error('No matching asset for OS');
    }
    return { assetName: pick.name, downloadUrl: pick.browser_download_url };
  } catch (e) {
    console.warn('resolveAssetUrl fallback:', e.message);
    return { assetName: null, downloadUrl: null };
  }
}

// Create a single-use download token (called post-payment before redirecting the customer)
app.post('/token/create', (req, res) => {
  try {
    const { name, email, os, version } = req.body || {};
    const token = createDownloadToken({ name, email, os, version });
    const redirectUrl = `/?token=${encodeURIComponent(token)}`;
    return res.json({ ok: true, token, redirectUrl });
  } catch (e) {
    console.error('Token create error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Stream a minimal ZIP containing installer, auto-activation license file, and README; mark token as used
app.get('/download', async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const name = String(req.query.name || '').trim();
    const email = String(req.query.email || '').trim();
    const os = String(req.query.os || '').trim();
    const version = String(req.query.version || '').trim() || undefined;

    if (!token) return res.status(400).json({ ok: false, reason: 'missing_token' });
    const tk = downloadTokens.get(token);
    if (!tk) return res.status(404).json({ ok: false, reason: 'invalid_token' });
    if (tk.used) return res.status(410).json({ ok: false, reason: 'already_downloaded' });

    if (!name || !email || !os) {
      return res.status(400).json({ ok: false, reason: 'missing_fields' });
    }

    // Issue license
    const licenseKey = generateCustomerLicenseKey(name, email);
    issued.set(licenseKey, { name, email, at: new Date().toISOString(), assetName: null, version });

    // Resolve installer asset
    const { assetName, downloadUrl } = await resolveAssetUrl({ assetName: null, version, os });

    // Prepare ZIP response
    const zipName = `Quantiv-${os}-${version || 'latest'}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      try { res.status(500).end(); } catch {}
    });
    archive.pipe(res);

    // Add auto-activation license file
    const licensePayload = JSON.stringify({ licenseKey, customerEmail: email }, null, 2);
    archive.append(licensePayload, { name: 'Quantiv-license.json' });

    // Add README-INSTALL.txt
    const readmeText = [
      'Quantiv — إرشادات التثبيت',
      '',
      '- قم بفك ضغط هذا الملف.',
      '- شغّل ملف المثبّت المناسب لنظامك:',
      '  * Windows: ملف ‎.exe — إذا ظهر SmartScreen اضغط "More info" ثم "Run anyway".',
      '  * macOS: ملف ‎.dmg — إن ظهر تحذير Gatekeeper، افتح بالزر الأيمن ثم "Open".',
      '- سيُفعّل الترخيص تلقائيًا في التشغيل الأول عبر ملف Quantiv-license.json.',
      '- للاطلاع على إرشادات تفصيلية، افتح instructions.pdf من البوابة.',
      ''
    ].join('\n');
    archive.append(readmeText, { name: 'README-INSTALL.txt' });

    // Fetch installer from GitHub and append to archive (fallback to placeholder if unavailable)
    const installerFileName = assetName || (os.startsWith('windows') ? 'Quantiv-Setup.exe' : 'Quantiv.dmg');
    // Local installer fallback paths (place your built installers here)
    const localPaths = {
      'windows-x64': path.join(__dirname, 'public', 'installer', 'Quantiv-Setup.exe'),
      'windows-x86': path.join(__dirname, 'public', 'installer', 'Quantiv-Setup-x86.exe'),
      'macos-intel': path.join(__dirname, 'public', 'installer', 'Quantiv-Intel.dmg'),
      'macos-apple': path.join(__dirname, 'public', 'installer', 'Quantiv-Apple.dmg')
    };
    const localPath = localPaths[os];

    if (localPath && fs.existsSync(localPath)) {
      const stream = fs.createReadStream(localPath);
      archive.append(stream, { name: path.basename(localPath) });
    } else if (downloadUrl) {
      await new Promise((resolveDownload, rejectDownload) => {
        https.get(downloadUrl, (resp) => {
          if (resp.statusCode !== 200) {
            rejectDownload(new Error(`Installer HTTP ${resp.statusCode}`));
            return;
          }
          archive.append(resp, { name: installerFileName });
          resp.on('end', resolveDownload);
          resp.on('error', rejectDownload);
        }).on('error', rejectDownload);
      });
    } else {
      const placeholder = [
        'Installer asset is not available.',
        'Place a local installer at server/public/installer/,',
        'or configure GITHUB_OWNER/GITHUB_REPO and publish release assets.',
        `Requested OS: ${os}`
      ].join('\n');
      archive.append(placeholder, { name: `INSTALLER-NOT-AVAILABLE-${os}.txt` });
    }

    archive.finalize().then(() => {
      const rec = downloadTokens.get(token);
      if (rec) {
        rec.used = true;
        rec.usedAt = new Date().toISOString();
        downloadTokens.set(token, rec);
      }
    }).catch((e) => console.error('Finalize error:', e));
  } catch (e) {
    console.error('Download ZIP error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Issue a new license and provide a download URL through the gateway
app.post('/issue', (req, res) => {
  try {
    const { name, email, assetName, version } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ ok: false, reason: 'missing_name_or_email' });
    }
    const licenseKey = generateCustomerLicenseKey(name, email);
    const at = new Date().toISOString();
    issued.set(licenseKey, { name, email, at, assetName, version });

    const downloadUrl = assetName ? buildDownloadUrl(assetName, version) : undefined;
    return res.json({ ok: true, licenseKey, downloadUrl, message: 'License issued. Use this key during activation.' });
  } catch (e) {
    console.error('Issue error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Resolve endpoint: manual OS selection mapped to latest GitHub asset
app.post('/resolve', async (req, res) => {
  try {
    const { os, version } = req.body || {};
    if (!os) {
      return res.status(400).json({ ok: false, reason: 'missing_os' });
    }
    const { assetName, downloadUrl } = await resolveAssetUrl({ assetName: null, version, os });
    return res.json({ ok: true, assetName, downloadUrl });
  } catch (e) {
    console.error('Resolve error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Auto endpoint: detect OS, resolve asset from GitHub, issue license, return key + URL
app.post('/auto', async (req, res) => {
  try {
    const { name, email, version } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ ok: false, reason: 'missing_name_or_email' });
    }
    const os = detectOSFromUA(req.headers['user-agent'] || '');
    const { assetName, downloadUrl } = await resolveAssetUrl({ assetName: null, version, os });

    const licenseKey = generateCustomerLicenseKey(name, email);
    issued.set(licenseKey, { name, email, at: new Date().toISOString(), assetName, version });
    return res.json({ ok: true, licenseKey, downloadUrl, os, assetName });
  } catch (e) {
    console.error('Auto issue error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Provide a downloadable license file containing key and email
app.get('/license-file', (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    const email = String(req.query.email || '').trim();
    if (!key || !email) {
      return res.status(400).json({ ok: false, reason: 'missing_key_or_email' });
    }
    const payload = { licenseKey: key, customerEmail: email };
    res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="Quantiv-license.json"');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (e) {
    console.error('License file error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Activate a license: bind to device fingerprint and email
app.post('/activate', (req, res) => {
  try {
    const { key, email, device } = req.body || {};
    if (!key || !email || !device) {
      return res.status(400).json({ ok: false, reason: 'missing_fields' });
    }
    if (!validateLicenseKeyFormat(key)) {
      return res.status(400).json({ ok: false, reason: 'invalid_key_format' });
    }

    const record = issued.get(key);
    if (!record || record.email.toLowerCase() !== String(email).toLowerCase()) {
      return res.status(404).json({ ok: false, reason: 'license_not_found_or_email_mismatch' });
    }

    // Prevent sharing: allow one activation per license (or enforce policy)
    if (activations.has(key)) {
      const prev = activations.get(key);
      if (prev.device !== device) {
        return res.status(409).json({ ok: false, reason: 'device_mismatch_existing_activation' });
      }
      // Same device re-activation
      return res.json({ ok: true, reason: 'already_activated' });
    }

    activations.set(key, { email, device, at: new Date().toISOString() });
    return res.json({ ok: true });
  } catch (e) {
    console.error('Activate error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

// Verify endpoint (optional) to check current activation state
app.post('/verify', (req, res) => {
  try {
    const { key, device } = req.body || {};
    if (!key || !device) {
      return res.status(400).json({ ok: false, reason: 'missing_fields' });
    }
    const act = activations.get(key);
    if (!act) return res.json({ ok: false, reason: 'not_activated' });
    if (act.device !== device) return res.json({ ok: false, reason: 'device_mismatch' });
    return res.json({ ok: true, email: act.email, activatedAt: act.at });
  } catch (e) {
    console.error('Verify error:', e);
    return res.status(500).json({ ok: false, reason: 'server_error', detail: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`License server running on port ${PORT}`);
});
