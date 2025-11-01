// DB Manager – Renderer API wrapper around preload IPC for SQLite operations
(function(){
  const HAS_ELECTRON = !!window.electronAPI;

  async function getDatabasePath(){
    if(!HAS_ELECTRON) return '';
    const r = await window.electronAPI.getDbPath();
    return r?.path || '';
  }

  // Inventory CRUD
  async function listProducts(){
    if(!HAS_ELECTRON) return { ok:true, items: [] };
    return await window.electronAPI.dbInventoryList();
  }
  async function addProduct(payload){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbInventoryAdd(payload);
  }
  async function updateProduct(payload){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbInventoryUpdate(payload);
  }
  async function deleteProduct(sku){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbInventoryDelete(sku);
  }

  // Settings
  async function getSettings(){
    if(!HAS_ELECTRON) return { ok:true, settings:{} };
    return await window.electronAPI.dbSettingsGet();
  }
  async function setSetting(key, value){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbSettingsSet(key, value);
  }

  // Invoices
  async function listInvoices(){
    if(!HAS_ELECTRON) return { ok:true, invoices: [] };
    return await window.electronAPI.dbInvoicesList();
  }
  async function createInvoice(payload){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbInvoicesCreate(payload);
  }
  async function getInvoice(invoiceId){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbInvoiceGet(invoiceId);
  }
  async function deleteInvoice(invoiceId){
    if(!HAS_ELECTRON) return { ok:false, reason:'Electron-only feature' };
    return await window.electronAPI.dbInvoicesDelete(invoiceId);
  }

  // Reports
  async function getReportsSummary(){
    if(!HAS_ELECTRON) return { ok:true, report:{ topSelling:[], monthlyRevenue:[], profitTrends:[] } };
    return await window.electronAPI.dbReportsSummary();
  }

  window.dbManager = {
    getDatabasePath,
    listProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getSettings,
    setSetting,
    listInvoices,
    createInvoice,
    getInvoice,
    deleteInvoice,
    getReportsSummary
  };
})();
