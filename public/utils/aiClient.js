// aiClient: centralize AI key presence, validation, and chat calls
// Exposes window.aiClient with helpers that prefer secure Electron IPC
// and gracefully fall back to browser-only preview behavior.

(function(){
  const isElectron = !!window.electronAPI;
  let errorStreak = 0;

  async function hasKey(){
    if(!isElectron) return false;
    try { const r = await window.electronAPI.aiGetKey(); return !!r?.hasKey; } catch(e){ return false; }
  }

  async function testKey(){
    if(!isElectron) return false;
    try { const r = await window.electronAPI.aiTestKey(); return !!r?.ok; } catch(e){ return false; }
  }

  async function chat(opts){
    const { model, messages, response_format } = opts || {};
    if(isElectron){
      try{
        const r = await window.electronAPI.aiChat({ model, messages, response_format });
        // Reset streak on apparent success
        errorStreak = 0;
        return r;
      }catch(e){
        errorStreak++;
        if(errorStreak >= 3){ try{ await markKeyDegraded('api_errors'); }catch(_){ } }
        throw e;
      }
    }
    // Browser preview fallback: expects a password input#aiKey in the DOM
    const key = (document.getElementById('aiKey')?.value||'').trim();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({ model, messages, response_format })
    });
    return res;
  }

  async function markKeyDegraded(reason){
    if(!isElectron) return;
    try{
      const fp = await window.electronAPI.aiGetKeyFingerprint();
      const fingerprint = fp?.fingerprint || '';
      if(fingerprint){
        try{ await window.dbManager?.setSetting?.('assistant.lastInvalidFingerprint', fingerprint); }catch(_){ }
      }
      await window.electronAPI.aiDeleteKey();
      // Notify UI layers (settings view can respond if mounted)
      try{ window.dispatchEvent(new CustomEvent('assistant:keyInvalidated', { detail:{ reason: reason||'degraded' } })); }catch(_){ }
    }catch(_){ }
  }

  async function getLastInvalidFingerprint(){
    try{ const s = await window.dbManager?.getSettings?.(); return s?.settings?.['assistant.lastInvalidFingerprint'] || ''; }
    catch(_){ return ''; }
  }

  window.aiClient = { hasKey, testKey, chat, markKeyDegraded, getLastInvalidFingerprint };
})();

