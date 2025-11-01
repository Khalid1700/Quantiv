// App Cleaner Utility
// Ensures the app starts in a clean default state for new installations

class AppCleaner {
  static async cleanForProduction() {
    if (!window.electronAPI) {
      console.log('AppCleaner: Not in Electron environment, skipping cleanup');
      return;
    }

    try {
      console.log('AppCleaner: Starting production cleanup...');
      
      // Clean database tables
      await this.cleanDatabase();
      
      // Clean settings
      await this.cleanSettings();
      
      // Clean AI keys
      await this.cleanAIKeys();
      
      console.log('AppCleaner: Production cleanup completed successfully');
    } catch (error) {
      console.error('AppCleaner: Error during cleanup:', error);
    }
  }

  static async cleanDatabase() {
    try {
      console.log('AppCleaner: Cleaning database tables...');
      
      // Get current inventory and clear it
      const inventory = await window.electronAPI.dbInventoryList();
      if (inventory && inventory.length > 0) {
        console.log(`AppCleaner: Removing ${inventory.length} inventory items`);
        for (const item of inventory) {
          await window.electronAPI.dbInventoryDelete(item.sku);
        }
      }

      // Get current invoices and clear them
      const invoicesRes = await window.electronAPI.dbInvoicesList();
      const invoices = invoicesRes?.invoices || invoicesRes || [];
      if (invoices && invoices.length > 0) {
        console.log(`AppCleaner: Removing ${invoices.length} invoices`);
        for (const invoice of invoices) {
          const id = invoice.invoiceId || invoice.id;
          if(id) await window.electronAPI.dbInvoicesDelete(id);
        }
      }

      console.log('AppCleaner: Database tables cleaned');
    } catch (error) {
      console.error('AppCleaner: Error cleaning database:', error);
    }
  }

  static async cleanSettings() {
    try {
      console.log('AppCleaner: Cleaning settings...');
      
      // Get current settings
      const settings = await window.electronAPI.dbSettingsGet();
      
      if (settings) {
        // Keep only essential default settings, remove user-specific ones
        const defaultSettings = {
          'AutoSaveSeconds': 30,
          'TaxRate': 0.15
        };

        // Reset to defaults
        for (const [key, value] of Object.entries(defaultSettings)) {
          await window.electronAPI.dbSettingsSet(key, value);
        }

        console.log('AppCleaner: Settings reset to defaults');
      }
    } catch (error) {
      console.error('AppCleaner: Error cleaning settings:', error);
    }
  }

  static async cleanAIKeys() {
    try {
      console.log('AppCleaner: Cleaning AI keys...');
      
      // Check if AI key exists and remove it
      const hasKey = await window.electronAPI.aiGetKey();
      if (hasKey) {
        await window.electronAPI.aiDeleteKey();
        console.log('AppCleaner: AI key removed');
      }
    } catch (error) {
      console.error('AppCleaner: Error cleaning AI keys:', error);
    }
  }

  static async isFirstRun() {
    try {
      // Check if this is the first run by looking for any existing data
      const inventory = await window.electronAPI.dbInventoryList();
      const invoices = await window.electronAPI.dbInvoicesList();
      const aiKey = await window.electronAPI.aiGetKey();
      
      // If no data exists, this is likely a first run
      return (!inventory || inventory.length === 0) && 
             (!invoices || invoices.length === 0) && 
             !aiKey;
    } catch (error) {
      console.error('AppCleaner: Error checking first run:', error);
      return false;
    }
  }

  static async shouldCleanForProduction() {
    if (!window.electronAPI) return false;
    
    try {
      // Respect cleanup policy from main process
      let force = false; let did = false;
      try{
        const policy = await window.electronAPI.getCleanupPolicy();
        force = !!policy?.force; did = !!policy?.did;
      }catch(_e){ /* noop */ }
      if(force && !did) return true;
      // Otherwise, decide based on first-run heuristic
      const isFirst = await this.isFirstRun();
      return isFirst;
    } catch (error) {
      console.error('AppCleaner: Error determining if cleanup needed:', error);
      return false;
    }
  }

  static async markCleanupComplete() {
    try {
      // Mark that cleanup has been completed
      await window.electronAPI.dbSettingsSet('_cleanupCompleted', true);
    } catch (error) {
      console.error('AppCleaner: Error marking cleanup complete:', error);
    }
  }

  static async wasCleanupCompleted() {
    try {
      const settings = await window.electronAPI.dbSettingsGet();
      return settings && settings['_cleanupCompleted'] === true;
    } catch (error) {
      console.error('AppCleaner: Error checking cleanup status:', error);
      return false;
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.AppCleaner = AppCleaner;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppCleaner;
}
