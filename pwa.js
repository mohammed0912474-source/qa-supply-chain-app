/* ===================== PWA: install + auto-update ===================== */
/* Clickjacking mitigation: GitHub Pages cannot send X-Frame-Options / frame-ancestors,
   so refuse to run inside a frame from another site. */
(function(){
  if(window.top !== window.self){
    try{ window.top.location = window.self.location.href; }
    catch(e){ document.documentElement.style.display = 'none'; }
  }
})();

const APP_VERSION = 'v11.0.0';
if('serviceWorker' in navigator){
  /* Reload only when an already-controlled page receives a NEW service worker.
     On a first visit there is no previous controller, so we must not reload —
     that extra reload was the "multiple page redirects" (+4.4 s) in the audit. */
  const hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('./sw.js').then(reg=> reg.update()).catch(err=> console.warn('SW registration failed', err));
  });
  let refreshingAfterUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', ()=>{
    if(!hadController || refreshingAfterUpdate) return;
    refreshingAfterUpdate = true;
    window.location.reload();
  });
}
