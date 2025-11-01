// License Manager - Client-side license validation and activation
(function(){
  const HAS_ELECTRON = !!window.electronAPI;

  // License status constants
  const LICENSE_STATUS = {
    VALID: 'valid',
    INVALID: 'invalid',
    EXPIRED: 'expired',
    DEVICE_MISMATCH: 'device_mismatch',
    NOT_ACTIVATED: 'not_activated',
    ACTIVATION_REQUIRED: 'activation_required'
  };

  // Check current license status
  async function checkLicenseStatus(){
    if(!HAS_ELECTRON) return { status: LICENSE_STATUS.VALID, isDemo: true };
    try {
      const result = await window.electronAPI.licenseCheck();
      return result;
    } catch(e) {
      console.error('License check failed:', e);
      return { status: LICENSE_STATUS.INVALID, reason: e.message };
    }
  }

  // Activate license with customer key
  async function activateLicense(customerKey, customerEmail = ''){
    if(!HAS_ELECTRON) return { ok: false, reason: 'Electron-only feature' };
    try {
      const result = await window.electronAPI.licenseActivate(customerKey, customerEmail);
      return result;
    } catch(e) {
      console.error('License activation failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  // Get license information
  async function getLicenseInfo(){
    if(!HAS_ELECTRON) return { ok: true, info: { type: 'demo', customer: 'Demo User' } };
    try {
      const result = await window.electronAPI.licenseInfo();
      return result;
    } catch(e) {
      console.error('Get license info failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  // Request license transfer (for device changes)
  async function requestLicenseTransfer(newDeviceInfo = ''){
    if(!HAS_ELECTRON) return { ok: false, reason: 'Electron-only feature' };
    try {
      const result = await window.electronAPI.licenseTransfer(newDeviceInfo);
      return result;
    } catch(e) {
      console.error('License transfer failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  // Deactivate license (for device changes or refunds)
  async function deactivateLicense(){
    if(!HAS_ELECTRON) return { ok: false, reason: 'Electron-only feature' };
    try {
      const result = await window.electronAPI.licenseDeactivate();
      return result;
    } catch(e) {
      console.error('License deactivation failed:', e);
      return { ok: false, reason: e.message };
    }
  }

  // Show license activation dialog
  function showActivationDialog(){
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'license-overlay';
      overlay.innerHTML = `
        <div class="license-dialog">
          <div class="license-header">
            <h2>تفعيل الترخيص</h2>
            <p>يرجى إدخال مفتاح الترخيص الخاص بك لتفعيل التطبيق</p>
          </div>
          <div class="license-form">
            <div class="form-group">
              <label for="customerKey">مفتاح الترخيص:</label>
              <input type="text" id="customerKey" placeholder="أدخل مفتاح الترخيص" />
            </div>
            <div class="form-group">
              <label for="customerEmail">البريد الإلكتروني (اختياري):</label>
              <input type="email" id="customerEmail" placeholder="your@email.com" />
            </div>
            <div class="license-actions">
              <button id="activateBtn" class="btn-primary">تفعيل</button>
              <button id="cancelBtn" class="btn-secondary">إلغاء</button>
            </div>
            <div id="licenseStatus" class="license-status"></div>
          </div>
        </div>
      `;

      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .license-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        .license-dialog {
          background: #1a1a2e;
          border-radius: 8px;
          padding: 2rem;
          max-width: 500px;
          width: 90%;
          color: #fff;
        }
        .license-header h2 {
          margin: 0 0 1rem 0;
          color: #4a9eff;
        }
        .license-header p {
          margin: 0 0 2rem 0;
          color: #ccc;
        }
        .form-group {
          margin-bottom: 1rem;
        }
        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: #fff;
        }
        .form-group input {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #333;
          border-radius: 4px;
          background: #2a2a3e;
          color: #fff;
          font-size: 1rem;
        }
        .form-group input:focus {
          outline: none;
          border-color: #4a9eff;
        }
        .license-actions {
          display: flex;
          gap: 1rem;
          margin-top: 2rem;
        }
        .btn-primary, .btn-secondary {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1rem;
        }
        .btn-primary {
          background: #4a9eff;
          color: #fff;
        }
        .btn-primary:hover {
          background: #357abd;
        }
        .btn-secondary {
          background: #666;
          color: #fff;
        }
        .btn-secondary:hover {
          background: #555;
        }
        .license-status {
          margin-top: 1rem;
          padding: 0.75rem;
          border-radius: 4px;
          display: none;
        }
        .license-status.error {
          background: #ff4444;
          color: #fff;
          display: block;
        }
        .license-status.success {
          background: #44ff44;
          color: #000;
          display: block;
        }
        .license-status.loading {
          background: #ffaa44;
          color: #000;
          display: block;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(overlay);

      const customerKeyInput = overlay.querySelector('#customerKey');
      const customerEmailInput = overlay.querySelector('#customerEmail');
      const activateBtn = overlay.querySelector('#activateBtn');
      const cancelBtn = overlay.querySelector('#cancelBtn');
      const statusDiv = overlay.querySelector('#licenseStatus');

      activateBtn.addEventListener('click', async () => {
        const key = customerKeyInput.value.trim();
        const email = customerEmailInput.value.trim();

        if (!key) {
          statusDiv.className = 'license-status error';
          statusDiv.textContent = 'يرجى إدخال مفتاح الترخيص';
          return;
        }

        statusDiv.className = 'license-status loading';
        statusDiv.textContent = 'جاري التفعيل...';
        activateBtn.disabled = true;

        const result = await activateLicense(key, email);
        
        if (result.ok) {
          statusDiv.className = 'license-status success';
          statusDiv.textContent = 'تم تفعيل الترخيص بنجاح!';
          setTimeout(() => {
            document.body.removeChild(overlay);
            document.head.removeChild(style);
            resolve({ activated: true, result });
          }, 2000);
        } else {
          statusDiv.className = 'license-status error';
          statusDiv.textContent = `فشل التفعيل: ${result.reason || 'خطأ غير معروف'}`;
          activateBtn.disabled = false;
        }
      });

      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        document.head.removeChild(style);
        resolve({ activated: false });
      });

      // Focus on key input
      customerKeyInput.focus();
    });
  }

  // Auto-activate when deeplink arrives: quantiv://activate?key=...&email=...
  if(HAS_ELECTRON && typeof window.electronAPI.onLicenseDeeplink === 'function'){
    try{
      window.electronAPI.onLicenseDeeplink(async (data) => {
        try{
          const key = String((data && data.key) || '').trim();
          const email = String((data && data.email) || '').trim();
          if(!key) return;
          const result = await activateLicense(key, email);
          if(result && result.ok){
            try{ alert('تم تفعيل الترخيص تلقائيًا عبر الرابط.'); }catch(_){/* silent */}
          } else {
            try{ alert('فشل التفعيل عبر الرابط: ' + (result && result.reason ? result.reason : 'غير معروف')); }catch(_){/* silent */}
          }
        }catch(e){ console.error('deeplink activation error:', e); }
      });
    }catch(_){ /* noop */ }
  }

  // Export public API
  window.LicenseManager = {
    LICENSE_STATUS,
    checkLicenseStatus,
    activateLicense,
    getLicenseInfo,
    requestLicenseTransfer,
    deactivateLicense,
    showActivationDialog
  };
})();
