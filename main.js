const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
let initSqlJs; try { initSqlJs = require('sql.js'); } catch(_) { initSqlJs = null; }
let SQL = null; let sqlReady = false;
async function ensureSqlReady(){
  try{
    if(sqlReady) return true;
    if(!initSqlJs) { console.error('sql.js not available'); return false; }
    const base = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
      : path.join(__dirname, 'node_modules', 'sql.js', 'dist');
    SQL = await initSqlJs({ locateFile: (file) => path.join(base, file) });
    sqlReady = true;
    return true;
  }catch(e){ console.error('Failed to init sql.js:', e); return false; }
}




// Detect test build via embedded flag file or env var
const isTestBuild = (() => {
  try{
    const flagPath = path.join(__dirname, 'public', 'test-build.flag');
    if(fs.existsSync(flagPath)) return true;
  }catch(_){/* ignore */}
  return process.env.EBT_DISABLE_LICENSE === '1';
})();

const store = new Store({
  name: 'settings',
  encryptionKey: 'ebt-secret-2024',
  defaults: {
    dbPath: '',
    templatesDir: path.join(app.getPath('documents'), 'EBT_Templates'),
    hideSplash: false,
    aiKey: '',
    aiKeyEnc: '',
    // Enable licensing by default in packaged builds unless disabled for test builds
    requireLicense: app.isPackaged && !isTestBuild
  }
});

// Ensure runtime setting disables licensing for test builds
if(isTestBuild){
  try{ store.set('requireLicense', false); }catch(_){}
}


let win;

// ===== Enhanced Customer-Specific License System =====
function getLicensePath(){
  try{
    let baseDir;
    if(process.platform === 'win32'){
      baseDir = process.env.PROGRAMDATA || app.getPath('appData');
    } else {
      baseDir = app.getPath('userData');
    }
    const dir = path.join(baseDir, 'EBT');
    if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'license.dat');
  }catch(e){ return path.join(app.getPath('userData'), 'license.dat'); }
}

function getDeviceFingerprint(){
  try{
    const hostname = os.hostname();
    const nets = os.networkInterfaces();
    const macs = Object.values(nets).flat().map(n => n && n.mac).filter(Boolean).join('|');
    const platform = os.platform();
    const arch = os.arch();
    const seed = `${hostname}|${macs}|${platform}|${arch}`;
    return crypto.createHash('sha256').update(seed).digest('hex');
  }catch(_){
    return crypto.createHash('sha256').update(String(Date.now())).digest('hex');
  }
}

// Generate customer-specific license key
function generateCustomerLicenseKey(customerEmail, purchaseId){
  const timestamp = Date.now();
  const deviceFp = getDeviceFingerprint();
  const seed = `${customerEmail}|${purchaseId}|${timestamp}|${deviceFp}`;
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  // Format as XXXX-XXXX-XXXX-XXXX
  const key = hash.substring(0, 16).toUpperCase();
  return `${key.substring(0,4)}-${key.substring(4,8)}-${key.substring(8,12)}-${key.substring(12,16)}`;
}

// Validate customer license key format and structure
function validateLicenseKeyFormat(key){
  if(!key || typeof key !== 'string') return false;
  const cleaned = key.replace(/[-\s]/g, '');
  return /^[A-F0-9]{16}$/i.test(cleaned);
}

// Enhanced license verification with customer binding
function verifyOrCreateLicense(){
  const licPath = getLicensePath();
  const fp = getDeviceFingerprint();
  const secret = 'ebt-license-secret-2024-enhanced';
  
  try{
    if(fs.existsSync(licPath)){
      const data = JSON.parse(fs.readFileSync(licPath, 'utf8'));
      const { licenseId, device, signature, customerKey, customerEmail, activatedAt, type } = data || {};
      
      // Check for required fields
      if(!licenseId || !device || !signature) return { ok:false, reason:'license_invalid' };
      
      // Verify signature
      const signatureData = `${licenseId}|${device}|${customerKey || ''}|${customerEmail || ''}`;
      const expected = crypto.createHmac('sha256', secret).update(signatureData).digest('hex');
      if(expected !== signature) return { ok:false, reason:'license_tampered' };
      
      // Check device binding
      if(device !== fp) return { ok:false, reason:'license_device_mismatch' };
      
      // Check if customer activation is required
      if(type === 'customer' && !customerKey) return { ok:false, reason:'activation_required' };
      
      return { ok:true, type: type || 'trial', customerEmail, activatedAt };
    } else {
      // Create trial license that requires customer activation
      const licenseId = crypto.randomUUID();
      const signatureData = `${licenseId}|${fp}||`;
      const signature = crypto.createHmac('sha256', secret).update(signatureData).digest('hex');
      const payload = { 
        licenseId, 
        device: fp, 
        signature, 
        type: 'trial',
        createdAt: new Date().toISOString(),
        requiresActivation: true
      };
      fs.writeFileSync(licPath, JSON.stringify(payload, null, 2), 'utf8');
      return { ok:false, reason:'activation_required', firstRun: true };
    }
  }catch(e){ return { ok:false, reason:e.message } }
}

// Activate license with customer key
function activateCustomerLicense(customerKey, customerEmail = ''){
  const licPath = getLicensePath();
  const fp = getDeviceFingerprint();
  const secret = 'ebt-license-secret-2024-enhanced';
  
  try{
    // Validate key format
    if(!validateLicenseKeyFormat(customerKey)){
      return { ok:false, reason:'invalid_key_format' };
    }
    
    // Load existing license
    let data = {};
    if(fs.existsSync(licPath)){
      data = JSON.parse(fs.readFileSync(licPath, 'utf8'));
    }
    
    // Create or update license with customer info
    const licenseId = data.licenseId || crypto.randomUUID();
    const signatureData = `${licenseId}|${fp}|${customerKey}|${customerEmail}`;
    const signature = crypto.createHmac('sha256', secret).update(signatureData).digest('hex');
    
    const payload = {
      licenseId,
      device: fp,
      signature,
      customerKey,
      customerEmail,
      type: 'customer',
      activatedAt: new Date().toISOString(),
      createdAt: data.createdAt || new Date().toISOString()
    };
    
    fs.writeFileSync(licPath, JSON.stringify(payload, null, 2), 'utf8');
    return { ok:true, type: 'customer', customerEmail };
  }catch(e){
    return { ok:false, reason:e.message };
  }
}

// Get license information
function getLicenseInfo(){
  const licPath = getLicensePath();
  try{
    if(fs.existsSync(licPath)){
      const data = JSON.parse(fs.readFileSync(licPath, 'utf8'));
      return {
        ok: true,
        info: {
          type: data.type || 'trial',
          customerEmail: data.customerEmail || '',
          activatedAt: data.activatedAt || '',
          createdAt: data.createdAt || '',
          deviceId: data.device ? data.device.substring(0, 8) + '...' : ''
        }
      };
    }
    return { ok:false, reason:'no_license_found' };
  }catch(e){
    return { ok:false, reason:e.message };
  }
}

// Deactivate license (for device transfer)
function deactivateLicense(){
  const licPath = getLicensePath();
  try{
    if(fs.existsSync(licPath)){
      fs.unlinkSync(licPath);
    }
    return { ok:true };
  }catch(e){
    return { ok:false, reason:e.message };
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 750,
    backgroundColor: '#0b1020',
    icon: path.join(__dirname, 'public', 'icons', 'app.png'), // أو app.ico إن أردت صراحةً
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Default to maximized on launch so content fits larger displays
  try{ win.maximize(); }catch(_){ }

  // Always show splash screen on startup
  const startFile = path.join(__dirname, 'public', 'splash.html');
  win.loadFile(startFile).catch(console.error);

  win.on('closed', () => (win = null));
}

// Alias to match IPC handler naming
function activateLicense(customerKey, customerEmail = ''){
  return activateCustomerLicense(customerKey, customerEmail);
}

// Initialize or repair the main database stored under userData
function initMainDatabase(){
  try{
    const current = store.get('dbPath');
    const userDataDir = app.getPath('userData');
    const ebtDir = path.join(userDataDir, 'EBT');
    if(!fs.existsSync(ebtDir)) fs.mkdirSync(ebtDir, { recursive: true });
    const defaultPath = path.join(ebtDir, 'Main.db');
    const targetPath = (current && fs.existsSync(current)) ? current : defaultPath;
    const needCreate = !fs.existsSync(targetPath);
    // Create an empty SQLite file placeholder; sql.js will hydrate schema on first open
    if(needCreate){ fs.writeFileSync(targetPath, Buffer.from([])); }
    if(needCreate || !current) store.set('dbPath', targetPath);
    return true;
  }catch(e){ console.error('initMainDatabase error:', e); return false; }
}

// Perform a one-time forced cleanup on first run if the build embeds a cleanup flag
async function forceInitialCleanIfNeeded(){
  try{
    const flagPath = path.join(__dirname, 'public', 'force-clean.flag');
    const did = !!store.get('didInitialCleanup');
    if(app.isPackaged && fs.existsSync(flagPath) && !did){
      const db = openDb();
      // Wipe business data tables
      try{
        db.exec('DELETE FROM invoice_items');
        db.exec('DELETE FROM invoices');
        db.exec('DELETE FROM inventory');
        // Reset settings to defaults while preserving essential defaults
        db.exec("DELETE FROM settings WHERE key NOT IN ('AutoSaveSeconds','TaxRate')");
      }catch(e){ /* continue */ }
      // Ensure default settings exist
      try{
        db.exec("INSERT OR IGNORE INTO settings(key,value) VALUES ('AutoSaveSeconds','60')");
        db.exec("INSERT OR IGNORE INTO settings(key,value) VALUES ('TaxRate','0.15')");
      }catch(e){ /* noop */ }
      // Persist changes
      saveAndCloseDb(db);
      // Remove any stored AI keys
      try{ store.delete('aiKey'); store.delete('aiKeyEnc'); }catch(_){ /* noop */ }
      // Mark as completed to avoid re-cleaning on every launch
      store.set('didInitialCleanup', true);
      console.log('Initial cleanup executed successfully');
    }
  }catch(e){ console.error('forceInitialCleanIfNeeded error:', e); }
}

app.whenReady().then(async () => {
  // Prepare database and perform forced initial cleanup if flagged
  try {
    await ensureSqlReady();
    initMainDatabase();
    await forceInitialCleanIfNeeded();
  } catch(e) {
    console.error('Initial cleanup prep error:', e);
  }

  // Enforce license in packaged build (no-op in dev unless explicitly enabled)
  try{
    const needLicense = store.get('requireLicense');
    if(app.isPackaged && needLicense){
      const lic = verifyOrCreateLicense();
      if(!lic.ok){
        if(lic.reason === 'activation_required'){
          // Attempt auto-activation using a downloaded license file in the user's Downloads folder
          try{
            const downloadsDir = path.join(os.homedir(), 'Downloads');
            const candidates = [
    path.join(downloadsDir, 'Quantiv-license.json'),
    path.join(downloadsDir, 'Quantiv-license.json'),
            ];
            let activated = false;
            for(const p of candidates){
              if(fs.existsSync(p)){
                try{
                  const raw = fs.readFileSync(p, 'utf8');
                  const data = JSON.parse(raw);
                  const key = String(data.licenseKey||'').trim();
                  const email = String(data.customerEmail||'').trim();
                  if(validateLicenseKeyFormat(key)){
                    const res = activateCustomerLicense(key, email);
                    if(res && res.ok){
                      activated = true;
                      // Optionally remove the file after successful activation
                      try{ fs.unlinkSync(p); }catch(_){/* ignore */}
                      break;
                    }
                  }
                }catch(_){ /* continue */ }
              }
            }
            if(!activated){
              console.log('Auto-activation not possible; will show activation dialog');
            }
          }catch(e){ console.error('Auto-activation error:', e); }
          // Renderer will show activation dialog if not activated
          console.log('License activation required - will show activation dialog');
        } else if(lic.reason === 'license_device_mismatch'){
          dialog.showErrorBox('خطأ في الترخيص', 'هذا الترخيص مرتبط بجهاز آخر. يرجى التواصل مع الدعم الفني لنقل الترخيص إلى هذا الجهاز.');
          app.quit();
          return;
        } else {
          dialog.showErrorBox('الترخيص مطلوب', `نسخة التطبيق غير مفعلّة: ${lic.reason}. الرجاء التواصل مع البائع للحصول على ترخيص صالح.`);
          app.quit();
          return;
        }
      }
    }
  }catch(e){ console.error('License check error:', e); }
  // جهّز مجلد القوالب إن لم يكن موجود
  try {
    const dir = store.get('templatesDir');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('templates dir error:', e);
  }
  // تهيئة قاعدة البيانات الرئيسية تلقائيًا عند بدء التشغيل (userData/EBT/Main.db)
  try {
    // Hydrate schema eagerly so first renderer operations succeed
    const db = openDb();
    const data = db.export();
    fs.writeFileSync(db.__path, Buffer.from(data));
    db.close();
  } catch(e){ console.error('DB eager init error:', e); }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ===== IPC Handlers =====
// AI key management (secure storage)
ipcMain.handle('ai:getKey', async () => {
  try{
    const enc = store.get('aiKeyEnc') || '';
    const plain = store.get('aiKey') || '';
    const hasKey = !!enc || !!plain;
    return { ok: true, hasKey, provider: 'OpenAI' };
  }catch(e){ return { ok:false, reason:e.message } }
});
ipcMain.handle('ai:setKey', async (_e, key) => {
  try{
    const raw = String(key||'').trim();
    if(!raw) return { ok:false, reason:'Empty key' };
    // Prefer OS-backed encryption (DPAPI on Windows)
    if(safeStorage && safeStorage.isEncryptionAvailable()){
      const encBuf = safeStorage.encryptString(raw);
      const b64 = Buffer.from(encBuf).toString('base64');
      store.set('aiKeyEnc', b64);
      store.delete('aiKey'); // remove any plaintext remnants
    } else {
      // Fallback: store via electron-store encryption (already configured)
      store.set('aiKey', raw);
      store.delete('aiKeyEnc');
    }
    return { ok:true };
  }catch(e){ return { ok:false, reason:e.message } }
});
ipcMain.handle('ai:deleteKey', async () => {
  try{ store.delete('aiKeyEnc'); store.delete('aiKey'); return { ok:true }; }
  catch(e){ return { ok:false, reason:e.message } }
});

// Return a fingerprint (SHA-256 hex) of the stored key without exposing it
ipcMain.handle('ai:getKeyFingerprint', async () => {
  try{
    const key = getDecryptedApiKey();
    if(!key) return { ok:false, fingerprint:'' };
    const hash = crypto.createHash('sha256').update(String(key)).digest('hex');
    return { ok:true, fingerprint: hash };
  }catch(e){ return { ok:false, fingerprint:'', reason:e.message } }
});

// ===== AI helpers and handlers =====
function getDecryptedApiKey(){
  try{
    const b64 = store.get('aiKeyEnc') || '';
    if(b64 && safeStorage && safeStorage.isEncryptionAvailable()){
      const buf = Buffer.from(String(b64), 'base64');
      const plain = safeStorage.decryptString(buf);
      if(plain) return String(plain);
    }
  }catch(e){ /* ignore and fallback */ }
  const plain = store.get('aiKey') || '';
  return String(plain||'');
}

// Validate stored key via tiny request (no key exposure to renderer)
ipcMain.handle('ai:testKey', async () => {
  try{
    const key = getDecryptedApiKey();
    if(!key) return { ok:false, reason:'no_key' };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({ model:'gpt-4o-mini', messages:[{ role:'user', content:'ping' }], max_tokens:5 })
    });
    if(res.status === 429) return { ok:true, reason:'rate_limited' };
    if(res.status === 401 || res.status === 403) return { ok:false, reason:'auth_error' };
    return { ok: res.ok };
  }catch(e){ return { ok:false, reason:'network_error' } }
});

// Generic chat completion using stored key; returns content only
ipcMain.handle('ai:chat', async (_e, payload) => {
  try{
    const key = getDecryptedApiKey();
    if(!key) return { ok:false, reason:'no_key' };
    const model = payload?.model || 'gpt-4o-mini';
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    const response_format = payload?.response_format;
    const body = { model, messages };
    if(response_format) body.response_format = response_format;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify(body)
    });
    if(res.status === 401 || res.status === 403) return { ok:false, reason:'auth_error' };
    if(res.status === 429) return { ok:false, reason:'openai_error_429' };
    if(!res.ok) return { ok:false, reason:`openai_error_${res.status}` };
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return { ok:true, content };
  }catch(e){ return { ok:false, reason:'network_error' } }
});

// Relaunch the app to apply settings
ipcMain.handle('app:relaunch', async () => {
  try{
    app.relaunch();
    app.exit(0);
    return { ok:true };
  }catch(e){ return { ok:false, reason:e.message } }
});

ipcMain.handle('get-db-path', async () => {
  try{
    const current = store.get('dbPath') || '';
    const exists = current && fs.existsSync(current);
    if(!exists) initMainDatabase();
    const p = store.get('dbPath') || '';
    const ok = !!p && fs.existsSync(p);
    return { ok, path: p };
  }catch(e){ return { ok:false, path:'', reason:e.message } }
});

// Create a new Excel file in project Documents with user-provided name

// ===== SQLite handlers =====
function ensureDbTables(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (
      serial TEXT,
      sku TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      cost REAL,
      price REAL,
      qty INTEGER,
      reorderPoint INTEGER,
      barcode TEXT,
      tax REAL,
      image TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      invoiceId TEXT PRIMARY KEY,
      date TEXT,
      customer TEXT,
      total REAL
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId TEXT,
      sku TEXT,
      qty INTEGER,
      price REAL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sales_history (
      date TEXT PRIMARY KEY,
      total_sales REAL
    );
  `);
  // Defaults via SQL.js exec
  db.exec(`INSERT OR IGNORE INTO settings(key,value) VALUES ('AutoSaveSeconds','60');`);
  db.exec(`INSERT OR IGNORE INTO settings(key,value) VALUES ('TaxRate','0.15');`);
}

// Ensure legacy databases have the new tax column
function ensureInventoryHasTaxColumn(db){
  try{
    const res = db.exec("PRAGMA table_info('inventory')");
    const cols = res[0]?.values?.map(r => String(r[1]||'')) || [];
    if(!cols.includes('tax')){
      db.exec('ALTER TABLE inventory ADD COLUMN tax REAL');
    }
  }catch(e){ /* noop */ }
}

// Ensure legacy databases have the new image column
function ensureInventoryHasImageColumn(db){
  try{
    const res = db.exec("PRAGMA table_info('inventory')");
    const cols = res[0]?.values?.map(r => String(r[1]||'')) || [];
    if(!cols.includes('image')){
      db.exec('ALTER TABLE inventory ADD COLUMN image TEXT');
    }
  }catch(e){ /* noop */ }
}

// Helpers for DB operations
function openDb() {
  const p = store.get('dbPath');
  if (!p) throw new Error('قاعدة البيانات غير محددة.');
  // Load using sql.js (pure JS)
  // Initialize sql.js lazily
  // eslint-disable-next-line no-sync
  const exists = fs.existsSync(p);
  const db = exists && fs.statSync(p).size > 0 ? new SQL.Database(fs.readFileSync(p)) : new SQL.Database();
  ensureDbTables(db);
  ensureInventoryHasTaxColumn(db);
  // attach path for saving
  db.__path = p;
  return db;
}

function nextSkuDb(db){
  // Generate SKU in format: SKUYYYYMMNNN (e.g., SKU202505001)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth()+1).padStart(2,'0');
  const prefix = `SKU${year}${month}`;
  // Fetch existing SKUs for this month prefix
  const res = db.exec(`SELECT sku FROM inventory WHERE sku LIKE '${prefix}%'`);
  const rows = res[0]?.values || [];
  let maxSeq = 0;
  rows.forEach(r => {
    const s = String(r[0]||'');
    const m = s.match(/^SKU(\d{4})(\d{2})(\d{3})$/);
    if(m){
      const n = Number(m[3]);
      if(!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
    } else if(s.startsWith(prefix)) {
      const suf = Number(s.slice(prefix.length));
      if(!Number.isNaN(suf)) maxSeq = Math.max(maxSeq, suf);
    }
  });
  const next = String(maxSeq + 1).padStart(3,'0');
  return `${prefix}${next}`;
}

function ensureSkuFormatCompliance(db){
  // Migrate any nonconforming SKUs (e.g., 'SKU-0001') to SKUYYYYMMNNN and update invoice_items references
  const res = db.exec('SELECT sku FROM inventory');
  const rows = res[0]?.values || [];
  const allSkus = rows.map(r => String(r[0]||''));
  const validRe = /^SKU\d{4}\d{2}\d{3}$/;
  const nonConforming = allSkus.filter(s => s && !validRe.test(s));
  if(!nonConforming.length) return; // nothing to do
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth()+1).padStart(2,'0');
  const prefix = `SKU${year}${month}`;
  // Find the maximum existing sequence for this prefix
  let maxSeq = 0;
  allSkus.forEach(s => {
    const m = s.match(/^SKU(\d{4})(\d{2})(\d{3})$/);
    if(m && m[1] === String(year) && m[2] === month){
      const n = Number(m[3]);
      if(!Number.isNaN(n)) maxSeq = Math.max(maxSeq, n);
    }
  });
  const existingSet = new Set(allSkus);
  const invUpd = db.prepare('UPDATE inventory SET sku = ? WHERE sku = ?');
  const itemsUpd = db.prepare('UPDATE invoice_items SET sku = ? WHERE sku = ?');
  try{
    nonConforming.forEach(oldSku => {
      let seq = maxSeq + 1; let nextSku = `${prefix}${String(seq).padStart(3,'0')}`;
      // ensure uniqueness across all SKUs
      while(existingSet.has(nextSku)){
        seq++; nextSku = `${prefix}${String(seq).padStart(3,'0')}`;
      }
      invUpd.run([nextSku, oldSku]);
      itemsUpd.run([nextSku, oldSku]);
      existingSet.add(nextSku);
      maxSeq = seq;
    });
  }finally{
    invUpd.free(); itemsUpd.free();
  }
}

function generateDefaultBarcode(){
  // Ensure barcode differs from SKU/Serial by using numeric timestamp-based code
  const d = new Date();
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const rand = String(Math.floor(Math.random()*100000)).padStart(5,'0');
  return `${y}${m}${day}${rand}`; // e.g., 25050112345
}

function saveAndCloseDb(db){
  const data = db.export();
  fs.writeFileSync(db.__path, Buffer.from(data));
  db.close();
}

function closeDb(db){ db.close(); }

// Inventory CRUD (SQLite)
ipcMain.handle('db:inventory:list', async () => {
  try{
    const db = openDb();
    // Ensure SKU format compliance for existing records
    try{ ensureSkuFormatCompliance(db); }catch(_e){ /* noop */ }
    // Ensure image column exists for legacy databases
    try{ ensureInventoryHasImageColumn(db); }catch(_e){ /* noop */ }
    const res = db.exec('SELECT serial, sku, name, category, cost, price, qty, reorderPoint, barcode, tax, image FROM inventory');
    const items = (res[0]?.values||[]).map(r=>({ serial:String(r[0]||''), sku:String(r[1]||''), name:r[2], category:r[3], cost:Number(r[4]||0), price:Number(r[5]||0), qty:Number(r[6]||0), reorderPoint:Number(r[7]||0), barcode:r[8], tax: (r[9]!==null && r[9]!==undefined) ? Number(r[9]) : null, image: r[10] || '' }));
    // Persist any migration changes
    saveAndCloseDb(db);
    return { ok:true, items };
  }catch(e){ return { ok:false, reason:e.message } }
});

ipcMain.handle('db:inventory:add', async (_e, payload) => {
  try{
    const db = openDb();
    try{ ensureInventoryHasImageColumn(db); }catch(_e){ /* noop */ }
    const sku = nextSkuDb(db);
    const serial = null; // Serial disabled per requirements
    const barcodeCandidate = payload?.barcodeText || generateDefaultBarcode();
    const barcode = barcodeCandidate === serial ? generateDefaultBarcode() : barcodeCandidate;
    const stmt = db.prepare('INSERT INTO inventory(serial,sku,name,category,cost,price,qty,reorderPoint,barcode,tax,image) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    stmt.run([serial, sku, payload.name||'', payload.category||'', Number(payload.cost||0), Number(payload.price||0), Number(payload.qty||0), Number(payload.reorderPoint||0), barcode, (typeof payload.tax === 'number' ? payload.tax : null), (typeof payload.imageDataUrl === 'string' ? payload.imageDataUrl : null)]);
    stmt.free();
    saveAndCloseDb(db);
    return { ok:true, item:{...payload, serial, sku, barcode} };
  }catch(e){ return { ok:false, reason:e.message } }
});

ipcMain.handle('db:inventory:update', async (_e, payload) => {
  try{
    const db = openDb();
    try{ ensureInventoryHasImageColumn(db); }catch(_e){ /* noop */ }
    const stmt = db.prepare('UPDATE inventory SET name = COALESCE(?, name), category = COALESCE(?, category), cost = COALESCE(?, cost), price = COALESCE(?, price), qty = COALESCE(?, qty), reorderPoint = COALESCE(?, reorderPoint), barcode = COALESCE(?, barcode), tax = COALESCE(?, tax), image = COALESCE(?, image) WHERE sku = ?');
    stmt.run([payload.name ?? null, payload.category ?? null, (typeof payload.cost==='number'?payload.cost:null), (typeof payload.price==='number'?payload.price:null), (typeof payload.qty==='number'?payload.qty:null), (typeof payload.reorderPoint==='number'?payload.reorderPoint:null), (typeof payload.barcodeText==='string'?payload.barcodeText:null), (typeof payload.tax==='number'?payload.tax:null), (typeof payload.imageDataUrl==='string'?payload.imageDataUrl:null), String(payload.sku||'')]);
    stmt.free();
    saveAndCloseDb(db);
    return { ok:true };
  }catch(e){ return { ok:false, reason:e.message } }
});

ipcMain.handle('db:inventory:delete', async (_e, sku) => {
  try{
    const db = openDb();
    const stmt = db.prepare('DELETE FROM inventory WHERE sku = ?');
    stmt.run([String(sku||'')]);
    stmt.free();
    saveAndCloseDb(db);
    return { ok:true };
  }catch(e){ return { ok:false, reason:e.message } }
});

// Settings (SQLite)
ipcMain.handle('db:settings:get', async () => {
  try{
    const db = openDb();
    const res = db.exec('SELECT key, value FROM settings');
    const values = res[0]?.values || [];
    const settings = {}; values.forEach(r => { settings[String(r[0])] = String(r[1]??''); });
    closeDb(db);
    return { ok:true, settings };
  }catch(e){ return { ok:false, reason:e.message } }
});

ipcMain.handle('db:settings:set', async (_e, key, value) => {
  try{
    const db = openDb();
    const stmt1 = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
    stmt1.run([String(key||''), String(value??'')]); stmt1.free();
    const stmt2 = db.prepare('UPDATE settings SET value=? WHERE key=?');
    stmt2.run([String(value??''), String(key||'')]); stmt2.free();
    saveAndCloseDb(db);
    return { ok:true };
  }catch(e){ return { ok:false, reason:e.message } }
});

// Invoices (SQLite)
ipcMain.handle('db:invoices:list', async () => {
  try{
    const db = openDb();
    const res = db.exec('SELECT invoiceId, date, customer, total FROM invoices ORDER BY date DESC');
    const rows = res[0]?.values || [];
    const invoices = rows.map(r => ({ invoiceId:String(r[0]||''), date:String(r[1]||''), customer:String(r[2]||''), total:Number(r[3]||0) }));
    closeDb(db);
    return { ok:true, invoices };
  }catch(e){ return { ok:false, reason:e.message } }
});

ipcMain.handle('db:invoices:create', async (_e, payload) => {
  try{
    const db = openDb();
    const id = payload?.invoiceId || `INV-${Date.now()}`;
    const date = payload?.date || new Date().toISOString().slice(0,10);
    const customer = String(payload?.customer||'');
    const items = Array.isArray(payload?.items) ? payload.items : [];
    // Compute total including tax per item
    let computedTotal = 0;
    // Fetch default tax rate
    let defaultTaxRate = 0.15;
    try{
      const s = db.exec("SELECT value FROM settings WHERE key='TaxRate'");
      const v = s[0]?.values?.[0]?.[0];
      if(typeof v !== 'undefined' && v !== null) defaultTaxRate = Number(v||0);
    }catch(e){ /* noop */ }
    const getItemTax = (sku) => {
      try{
        const r = db.exec(`SELECT tax FROM inventory WHERE sku = '${String(sku).replace(/'/g, "''")}'`);
        const tv = r[0]?.values?.[0]?.[0];
        if(tv === null || typeof tv === 'undefined') return defaultTaxRate;
        const n = Number(tv);
        return isNaN(n) ? defaultTaxRate : n;
      }catch(e){ return defaultTaxRate; }
    };
    items.forEach(it => {
      const qty = Number(it.qty||0);
      const price = Number(it.price||0);
      const taxRate = getItemTax(it.sku);
      computedTotal += qty * price * (1 + (taxRate||0));
    });
    const total = Number(payload?.total ?? computedTotal);
    const invStmt = db.prepare('INSERT INTO invoices(invoiceId,date,customer,total) VALUES (?,?,?,?)');
    invStmt.run([id, date, customer, total]); invStmt.free();
    if(items.length){
      const itemStmt = db.prepare('INSERT INTO invoice_items(invoiceId,sku,qty,price) VALUES (?,?,?,?)');
      const updStmt = db.prepare('UPDATE inventory SET qty = MAX(0, qty - ?) WHERE sku = ?');
      items.forEach(it => {
        itemStmt.run([id, String(it.sku||''), Number(it.qty||0), Number(it.price||0)]);
        updStmt.run([Number(it.qty||0), String(it.sku||'')]);
      });
      itemStmt.free();
      updStmt.free();
    }
    saveAndCloseDb(db);
    return { ok:true, invoice:{ invoiceId:id, date, customer, total }, items };
  }catch(e){ return { ok:false, reason:e.message } }
});

// Fetch a specific invoice and its line items
ipcMain.handle('db:invoices:get', async (_e, invoiceId) => {
  try{
    const db = openDb();
    const invStmt = db.prepare('SELECT invoiceId, date, customer, total FROM invoices WHERE invoiceId = ?');
    const invRows = [];
    invStmt.bind([invoiceId]);
    while(invStmt.step()){ invRows.push(invStmt.getAsObject()); }
    invStmt.free();
    if(!invRows.length){ saveAndCloseDb(db); return { ok:false, reason:'invoice_not_found' }; }
    const inv = invRows[0];
    const itemsStmt = db.prepare('SELECT ii.sku as sku, i.name as name, ii.price as price, ii.qty as qty FROM invoice_items ii LEFT JOIN inventory i ON i.sku = ii.sku WHERE ii.invoiceId = ?');
    const items = [];
    itemsStmt.bind([invoiceId]);
    while(itemsStmt.step()){ items.push(itemsStmt.getAsObject()); }
    itemsStmt.free();
    saveAndCloseDb(db);
    return { ok:true, invoice: { invoiceId: inv.invoiceId, date: inv.date, customer: inv.customer, total: inv.total, items } };
  }catch(e){ return { ok:false, reason:e.message } }
});

// Delete an invoice: restore inventory quantities and remove records
ipcMain.handle('db:invoices:delete', async (_e, invoiceId) => {
  try{
    const db = openDb();
    // Fetch items to restore inventory qty
    const itemsStmt = db.prepare('SELECT sku, qty FROM invoice_items WHERE invoiceId = ?');
    const items = [];
    itemsStmt.bind([invoiceId]);
    while(itemsStmt.step()){ items.push(itemsStmt.getAsObject()); }
    itemsStmt.free();
    if(items.length){
      const restoreStmt = db.prepare('UPDATE inventory SET qty = COALESCE(qty,0) + ? WHERE sku = ?');
      items.forEach(it => { restoreStmt.run([Number(it.qty||0), String(it.sku||'')]); });
      restoreStmt.free();
    }
    // Remove invoice items then invoice
    const delItemsStmt = db.prepare('DELETE FROM invoice_items WHERE invoiceId = ?');
    delItemsStmt.run([invoiceId]); delItemsStmt.free();
    const delInvStmt = db.prepare('DELETE FROM invoices WHERE invoiceId = ?');
    delInvStmt.run([invoiceId]); delInvStmt.free();
    saveAndCloseDb(db);
    return { ok:true };
  }catch(e){ return { ok:false, reason:e.message } }
});


// Reports summary (top-selling products, monthly revenue, profit trends)
ipcMain.handle('db:reports:summary', async () => {
  try{
    const db = openDb();
    // Top-selling products by units and revenue
    const topRes = db.exec('SELECT i.name, ii.sku, SUM(ii.qty) AS units, SUM(ii.qty*ii.price) AS revenue FROM invoice_items ii JOIN inventory i ON i.sku = ii.sku GROUP BY ii.sku ORDER BY units DESC LIMIT 10');
    const topRows = topRes[0]?.values || [];
    const topSelling = topRows.map(r => ({ name:String(r[0]||''), sku:String(r[1]||''), units:Number(r[2]||0), revenue:Number(r[3]||0) }));
    // Monthly revenue from invoices
    const revRes = db.exec("SELECT substr(date,1,7) as ym, SUM(total) as revenue FROM invoices GROUP BY ym ORDER BY ym ASC");
    const monthlyRevenue = (revRes[0]?.values||[]).map(r => ({ month:String(r[0]||''), revenue:Number(r[1]||0) }));
    // Profit trends per month: sum((price - cost) * qty)
    const profitRes = db.exec("SELECT substr(inv.date,1,7) as ym, SUM((i.price - i.cost) * v.qty) as profit FROM invoice_items v JOIN invoices inv ON inv.invoiceId = v.invoiceId JOIN inventory i ON i.sku = v.sku GROUP BY ym ORDER BY ym ASC");
    const profitTrends = (profitRes[0]?.values||[]).map(r => ({ month:String(r[0]||''), profit:Number(r[1]||0) }));
    closeDb(db);
    return { ok:true, report:{ topSelling, monthlyRevenue, profitTrends } };
  }catch(e){ return { ok:false, reason:e.message } }
});


ipcMain.handle('set-templates-dir', async (_e, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    store.set('templatesDir', dirPath);
    return { ok: true, path: dirPath };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
});

ipcMain.handle('open-templates', async () => {
  const dir = store.get('templatesDir');
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return { ok: true, path: dir };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
});

// Expose cleanup policy to renderer
ipcMain.handle('cleanup:getPolicy', async () => {
  try{
    const flagPath = path.join(__dirname, 'public', 'force-clean.flag');
    const force = app.isPackaged && fs.existsSync(flagPath);
    const did = !!store.get('didInitialCleanup');
    return { ok:true, force, did };
  }catch(e){ return { ok:false, force:false, did:false, reason:e.message } }
});

// Splash preferences removed: splash is always shown on startup

ipcMain.handle('update-dashboards', async (_e, payload) => {
  const dbPath = store.get('dbPath');
  const hasDb = dbPath && fs.existsSync(dbPath);
  

  try {
    if(hasDb){
      const db = openDb();
      const getScalar = (sql) => {
        const res = db.exec(sql);
        const v = res[0]?.values?.[0]?.[0];
        return Number(v||0);
      };
      const k_totalProducts = getScalar('SELECT COUNT(*) FROM inventory');
      const k_remainingStock = getScalar('SELECT COALESCE(SUM(qty),0) FROM inventory');
      // Current inventory valuation (selling value: sum of qty * price)
      const invValRes = db.exec('SELECT COALESCE(SUM(qty*price),0) FROM inventory');
      const k_inventoryValueStock = Number(invValRes[0]?.values?.[0]?.[0]||0);
      // Current inventory valuation (cost value: sum of qty * cost)
      const invCostRes = db.exec('SELECT COALESCE(SUM(qty*cost),0) FROM inventory');
      const k_inventoryCostValueStock = Number(invCostRes[0]?.values?.[0]?.[0]||0);
      // Monthly metrics
      // Optional selected month from renderer (YYYY-MM)
      const sel = typeof payload?.month === 'string' && /\d{4}-\d{2}/.test(payload.month) ? payload.month : null;
      const baseDate = sel ? new Date(Number(sel.slice(0,4)), Number(sel.slice(5,7))-1, 1) : new Date();
      const year = baseDate.getFullYear();
      const month = String(baseDate.getMonth()+1).padStart(2,'0');
      const monthPrefix = `${year}-${month}`; // ISO YYYY-MM
      // Total monthly sales including tax: sum of invoice totals for current month
      const k_inventoryValue = getScalar(`SELECT COALESCE(SUM(total),0) FROM invoices WHERE substr(date,1,7)='${monthPrefix}'`);
      // Net profit excluding tax for current month
      const profitRes = db.exec(`SELECT COALESCE(SUM((ii.price - i.cost)*ii.qty),0) FROM invoice_items ii JOIN invoices inv ON inv.invoiceId = ii.invoiceId JOIN inventory i ON i.sku = ii.sku WHERE substr(inv.date,1,7)='${monthPrefix}'`);
      const k_profitPotential = Number(profitRes[0]?.values?.[0]?.[0]||0);
      const k_numberOfSales = getScalar(`SELECT COUNT(*) FROM invoices WHERE substr(date,1,7)='${monthPrefix}'`);
      // Inventory distribution (labels = product names, data = quantities)
      const stockRes = db.exec('SELECT name, qty, price, cost, sku FROM inventory');
      const stockRows = stockRes[0]?.values || [];
      const stockLabels = stockRows.map(r=>String(r[0]||''));
      const stockData = stockRows.map(r=>Number(r[1]||0));
      // Sales by product (units sold)
      const salesRes = db.exec('SELECT i.name, SUM(ii.qty) as units, MAX(i.price) as price, ii.sku FROM invoice_items ii JOIN inventory i ON i.sku = ii.sku GROUP BY ii.sku ORDER BY units DESC');
      const salesRows = salesRes[0]?.values || [];
      const stockDetails = stockRows.map(r=>({ name:String(r[0]||''), price:Number(r[2]||0), cost:Number(r[3]||0), qty:Number(r[1]||0), sales: Number((salesRows.find(s=>String(s[3]||'')===String(r[4]||''))?.[1])||0) }));
      // Daily chart for the current month: aggregate invoice totals (including tax) per day
      const startDate = new Date(year, baseDate.getMonth(), 1);
      const endDate = new Date(year, baseDate.getMonth()+1, 0);
      // Format YYYY-MM-DD using local time components to avoid UTC shifting to previous/next day
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const endStr = fmt(endDate);
      const dailyRes = db.exec(`SELECT date as d, COALESCE(SUM(total),0) as dtot FROM invoices WHERE substr(date,1,7)='${monthPrefix}' GROUP BY d ORDER BY d ASC`);
      const dailyRows = dailyRes[0]?.values || [];
      const map = new Map(dailyRows.map(r=>[String(r[0]||''), Number(r[1]||0)]));
      const labels = [];
      const points = [];
      for(let d = new Date(startDate); d <= endDate; d.setDate(d.getDate()+1)){
        const iso = fmt(d);
        labels.push(iso);
        points.push(Number(map.get(iso)||0));
      }
      // Current vs previous month (from monthly totals)
      const monthlyRes = db.exec("SELECT substr(date,1,7) as ym, COALESCE(SUM(total),0) as mtotal FROM invoices GROUP BY ym ORDER BY ym ASC");
      const monthlyRows = monthlyRes[0]?.values || [];
      const months = monthlyRows.map(r=>String(r[0]||''));
      const mpoints = monthlyRows.map(r=>Number(r[1]||0));
      const idx = months.findIndex(l=>l===monthPrefix);
      const currentMonthly = idx>=0 ? mpoints[idx] : 0;
      const prevIdx = idx>0 ? idx-1 : -1;
      const prev = prevIdx>=0 ? mpoints[prevIdx] : 0;
      const delta = currentMonthly - prev;
      saveAndCloseDb(db);
      return { ok:true, summary: {
        dbPath,
        kpis: { totalProducts: k_totalProducts, remainingStock: k_remainingStock, totalInventoryValue: k_inventoryValue, totalProfitPotential: k_profitPotential, inventoryValueStock: k_inventoryValueStock, inventoryCostValueStock: k_inventoryCostValueStock, numberOfSales: k_numberOfSales },
        sales: { current: currentMonthly, previous: prev, delta },
        chart: { labels, points, range: { start: `${year}-${month}-01`, end: endStr }, selectedMonth: monthPrefix },
        stock: { labels: stockLabels, data: stockData, details: stockDetails }
      } };
    }

    // إذا لم توجد قاعدة البيانات، أبلغ بعدم توفر مصدر البيانات
    return { ok:false, reason:'لا يوجد مصدر بيانات (قاعدة بيانات).' };
  } catch (e) {
    return { ok: false, reason: e.message || String(e) };
  }
});

// License management IPC handlers
ipcMain.handle('license-check-status', async () => {
  try {
    const needLicense = store.get('requireLicense');
    // If licensing is disabled (test build), always report activated
    if (!needLicense) {
      return { status: 'no_license_required', activated: true };
    }

    const result = verifyOrCreateLicense();
    if (result.ok) {
      return { status: 'activated', activated: true, info: result };
    } else {
      return { status: result.reason, activated: false };
    }
  } catch (error) {
    console.error('License status check error:', error);
    return { status: 'error', activated: false, error: error.message };
  }
});

ipcMain.handle('license-activate', async (event, licenseKey, customerEmail) => {
    try {
      const result = activateLicense(licenseKey, customerEmail);
      return result;
    } catch (error) {
      console.error('License activation error:', error);
      return { ok: false, reason: error.message };
    }
  });

  ipcMain.handle('license-get-info', async () => {
    try {
      const licensePath = getLicensePath();
      if (!fs.existsSync(licensePath)) {
        return { ok: false, reason: 'no_license' };
      }
      
      const licenseData = JSON.parse(fs.readFileSync(licensePath, 'utf8'));
      return {
        ok: true,
        customerName: licenseData.customerName,
        customerEmail: licenseData.customerEmail,
        activatedAt: licenseData.activatedAt,
        deviceFingerprint: licenseData.deviceFingerprint
      };
    } catch (error) {
      console.error('License info error:', error);
      return { ok: false, reason: error.message };
    }
  });

ipcMain.handle('license-deactivate', async () => {
  try {
    const result = deactivateLicense();
    return result;
  } catch (error) {
    console.error('License deactivation error:', error);
    return { ok: false, reason: error.message };
  }
});

// ===== Inventory helpers (ensure and list) =====
