// Simple global store: routing and autosave placeholder
(function(){
  const listeners = new Set();
  const state = {
    currentView: 'dashboard',
    autosaveSeconds: 60,
  };

  function setState(next){
    Object.assign(state, next);
    listeners.forEach(fn => fn(state));
  }
  function subscribe(fn){ listeners.add(fn); return () => listeners.delete(fn); }
  function getState(){ return { ...state }; }

  window.Store = { setState, subscribe, getState };
})();