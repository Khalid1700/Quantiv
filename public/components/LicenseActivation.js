class LicenseActivation {
  constructor() {
    this.isVisible = false;
    this.activationInProgress = false;
  }

  show() {
    if (this.isVisible) return;
    
    this.isVisible = true;
    const dialog = this.createDialog();
    document.body.appendChild(dialog);
    
    // Focus on license key input
    setTimeout(() => {
      const input = dialog.querySelector('#licenseKey');
      if (input) input.focus();
    }, 100);
  }

  hide() {
    const dialog = document.getElementById('licenseActivationDialog');
    if (dialog) {
      dialog.remove();
      this.isVisible = false;
    }
  }

  createDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'licenseActivationDialog';
    dialog.className = 'license-dialog-overlay';
    
    dialog.innerHTML = `
      <div class="license-dialog">
        <div class="license-dialog-header">
          <h2>تفعيل الترخيص</h2>
          <p>يرجى إدخال مفتاح الترخيص الخاص بك لتفعيل التطبيق</p>
        </div>
        
        <div class="license-dialog-body">
          <div class="form-group">
            <label for="licenseKey">مفتاح الترخيص:</label>
            <input type="text" id="licenseKey" placeholder="أدخل مفتاح الترخيص هنا" maxlength="29">
            <small>مثال: ABTK-XXXX-XXXX-XXXX-XXXX</small>
          </div>
          
          <div class="form-group">
            <label for="customerEmail">البريد الإلكتروني:</label>
            <input type="email" id="customerEmail" placeholder="أدخل بريدك الإلكتروني">
            <small>البريد الإلكتروني المستخدم في الشراء</small>
          </div>
          
          <div id="activationError" class="error-message" style="display: none;"></div>
          <div id="activationSuccess" class="success-message" style="display: none;"></div>
        </div>
        
        <div class="license-dialog-footer">
          <button id="activateBtn" class="btn-primary">تفعيل</button>
          <button id="cancelBtn" class="btn-secondary">إلغاء</button>
        </div>
        
        <div class="license-dialog-help">
          <p>لا تملك مفتاح ترخيص؟ <a href="#" id="purchaseLink">اشترِ الآن</a></p>
          <p>تحتاج مساعدة؟ <a href="#" id="supportLink">تواصل مع الدعم</a></p>
        </div>
      </div>
    `;

    // Add event listeners
    this.attachEventListeners(dialog);
    
    return dialog;
  }

  attachEventListeners(dialog) {
    const activateBtn = dialog.querySelector('#activateBtn');
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const licenseKeyInput = dialog.querySelector('#licenseKey');
    const customerEmailInput = dialog.querySelector('#customerEmail');
    const purchaseLink = dialog.querySelector('#purchaseLink');
    const supportLink = dialog.querySelector('#supportLink');

    // Format license key input
    licenseKeyInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/[^A-Z0-9]/g, '');
      let formatted = '';
      
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
          formatted += '-';
        }
        formatted += value[i];
      }
      
      e.target.value = formatted;
    });

    // Handle Enter key
    const handleEnter = (e) => {
      if (e.key === 'Enter' && !this.activationInProgress) {
        this.handleActivation();
      }
    };
    
    licenseKeyInput.addEventListener('keydown', handleEnter);
    customerEmailInput.addEventListener('keydown', handleEnter);

    // Activate button
    activateBtn.addEventListener('click', () => {
      if (!this.activationInProgress) {
        this.handleActivation();
      }
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
      this.hide();
      // In packaged app, quit if no valid license
      if (window.electronAPI) {
        window.electronAPI.licenseCheckStatus().then(status => {
          if (!status.activated) {
            window.close();
          }
        });
      }
    });

    // External links
    purchaseLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Open purchase page
      if (window.electronAPI) {
        // In a real app, you'd open the purchase URL
        alert('يرجى زيارة موقعنا الإلكتروني لشراء الترخيص');
      }
    });

    supportLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Open support page
      if (window.electronAPI) {
        // In a real app, you'd open the support URL
        alert('يرجى التواصل معنا عبر البريد الإلكتروني: support@example.com');
      }
    });
  }

  async handleActivation() {
    const licenseKey = document.getElementById('licenseKey').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const errorDiv = document.getElementById('activationError');
    const successDiv = document.getElementById('activationSuccess');
    const activateBtn = document.getElementById('activateBtn');

    // Clear previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    // Validate inputs
    if (!licenseKey) {
      this.showError('يرجى إدخال مفتاح الترخيص');
      return;
    }

    if (!customerEmail) {
      this.showError('يرجى إدخال البريد الإلكتروني');
      return;
    }

    if (!this.isValidEmail(customerEmail)) {
      this.showError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    // Start activation
    this.activationInProgress = true;
    activateBtn.textContent = 'جاري التفعيل...';
    activateBtn.disabled = true;

    try {
      const result = await window.electronAPI.licenseActivate(licenseKey, customerEmail);
      
      if (result.ok) {
        this.showSuccess('تم تفعيل الترخيص بنجاح!');
        setTimeout(() => {
          this.hide();
          // Refresh the app or show success message
          if (window.location) {
            window.location.reload();
          }
        }, 2000);
      } else {
        this.showError(this.getErrorMessage(result.reason));
      }
    } catch (error) {
      console.error('Activation error:', error);
      this.showError('حدث خطأ أثناء التفعيل. يرجى المحاولة مرة أخرى.');
    } finally {
      this.activationInProgress = false;
      activateBtn.textContent = 'تفعيل';
      activateBtn.disabled = false;
    }
  }

  showError(message) {
    const errorDiv = document.getElementById('activationError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }

  showSuccess(message) {
    const successDiv = document.getElementById('activationSuccess');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  getErrorMessage(reason) {
    const messages = {
      'invalid_format': 'تنسيق مفتاح الترخيص غير صحيح',
      'invalid_key': 'مفتاح الترخيص غير صالح',
      'email_mismatch': 'البريد الإلكتروني لا يتطابق مع مفتاح الترخيص',
      'already_activated': 'هذا المفتاح مفعل بالفعل على جهاز آخر',
      'expired': 'مفتاح الترخيص منتهي الصلاحية',
      'network_error': 'خطأ في الاتصال. يرجى التحقق من الإنترنت',
      'server_error': 'خطأ في الخادم. يرجى المحاولة لاحقاً'
    };
    
    return messages[reason] || 'حدث خطأ غير معروف. يرجى التواصل مع الدعم الفني';
  }
}

// CSS styles for the license dialog
const licenseDialogStyles = `
<style>
.license-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.license-dialog {
  background: white;
  border-radius: 12px;
  padding: 0;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  direction: rtl;
  text-align: right;
}

.license-dialog-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px;
  border-radius: 12px 12px 0 0;
  text-align: center;
}

.license-dialog-header h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.license-dialog-header p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.license-dialog-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.3s ease;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #fcc;
  margin: 16px 0;
  font-size: 14px;
}

.success-message {
  background: #efe;
  color: #363;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #cfc;
  margin: 16px 0;
  font-size: 14px;
}

.license-dialog-footer {
  padding: 0 24px 24px 24px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-primary, .btn-secondary {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 100px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #dee2e6;
}

.btn-secondary:hover {
  background: #e9ecef;
}

.license-dialog-help {
  background: #f8f9fa;
  padding: 16px 24px;
  border-radius: 0 0 12px 12px;
  text-align: center;
  border-top: 1px solid #e9ecef;
}

.license-dialog-help p {
  margin: 4px 0;
  font-size: 13px;
  color: #666;
}

.license-dialog-help a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.license-dialog-help a:hover {
  text-decoration: underline;
}
</style>
`;

// Add styles to document head
if (typeof document !== 'undefined') {
  document.head.insertAdjacentHTML('beforeend', licenseDialogStyles);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LicenseActivation;
}