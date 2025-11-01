const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  dbInventoryList: () => ipcRenderer.invoke('db:inventory:list'),
  dbInventoryAdd: (payload) => ipcRenderer.invoke('db:inventory:add', payload),
  dbInventoryUpdate: (payload) => ipcRenderer.invoke('db:inventory:update', payload),
  dbInventoryDelete: (sku) => ipcRenderer.invoke('db:inventory:delete', sku),
  dbSettingsGet: () => ipcRenderer.invoke('db:settings:get'),
  dbSettingsSet: (key, value) => ipcRenderer.invoke('db:settings:set', key, value),
  dbInvoicesList: () => ipcRenderer.invoke('db:invoices:list'),
  dbInvoicesCreate: (payload) => ipcRenderer.invoke('db:invoices:create', payload),
  dbInvoiceGet: (invoiceId) => ipcRenderer.invoke('db:invoices:get', invoiceId),
  dbInvoicesDelete: (invoiceId) => ipcRenderer.invoke('db:invoices:delete', invoiceId),
  dbReportsSummary: () => ipcRenderer.invoke('db:reports:summary'),
  openTemplates: () => ipcRenderer.invoke('open-templates'),
  setTemplatesDir: (p) => ipcRenderer.invoke('set-templates-dir', p),
  updateDashboards: (payload) => ipcRenderer.invoke('update-dashboards', payload),
  getCleanupPolicy: () => ipcRenderer.invoke('cleanup:getPolicy'),
  aiGetKey: () => ipcRenderer.invoke('ai:getKey'),
  aiSetKey: (key) => ipcRenderer.invoke('ai:setKey', key),
  aiDeleteKey: () => ipcRenderer.invoke('ai:deleteKey'),
  aiGetKeyFingerprint: () => ipcRenderer.invoke('ai:getKeyFingerprint'),
  aiTestKey: () => ipcRenderer.invoke('ai:testKey'),
  aiChat: (payload) => ipcRenderer.invoke('ai:chat', payload),
  appRelaunch: () => ipcRenderer.invoke('app:relaunch'),
  
  // License management
  licenseCheckStatus: () => ipcRenderer.invoke('license-check-status'),
  licenseActivate: (licenseKey, customerEmail) => ipcRenderer.invoke('license-activate', licenseKey, customerEmail),
  licenseGetInfo: () => ipcRenderer.invoke('license-get-info'),
  licenseDeactivate: () => ipcRenderer.invoke('license-deactivate'),

  // Deeplink listener: quantiv://activate?key=...&email=...
  onLicenseDeeplink: (cb) => {
    try { ipcRenderer.on('license:deeplink', (_event, data) => { try{ cb(data); }catch(_){} }); } catch(_){/* noop */}
  }
});
