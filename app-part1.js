
/* ===================== State & Storage ===================== */
let LANG = localStorage.getItem('qa_lang') || 'ar';
const DEFAULT_MASTER_CODE = 'DAL-QA-2026'; // <-- الكود الافتراضي لأول دخول لأفراد الفريق. يمكن للمسؤول تغييره من "إدارة الأقسام > لوحة التحكم الإدارية"، لكن لازم يبلّغ الفريق بالكود الجديد ويُعاد توزيع نفس الملف عليهم لأن التطبيق يعمل بدون سيرفر مركزي.

/* عبارات ترحيبية احترافية تخص الجودة وسلسلة الإمداد - تظهر أعلى التطبيق، وتُختار واحدة عشوائيًا مع كل جلسة استخدام جديدة */
const WELCOME_TAGLINES = [
  {ar:'الجودة تصنع الفرق', en:'Quality Makes the Difference'},
  {ar:'التميز في كل تفصيلة', en:'Excellence in Every Detail'},
  {ar:'جودة تستحق الثقة', en:'Quality You Can Trust'},
  {ar:'سلسلة إمداد بلا توقف', en:'A Supply Chain That Never Stops'},
  {ar:'دقة اليوم أساس نجاح الغد', en:"Today's Precision, Tomorrow's Success"},
  {ar:'معايير عالية، نتائج أعلى', en:'High Standards, Higher Results'},
  {ar:'كل شحنة تستحق الفحص', en:'Every Shipment Deserves Inspection'},
  {ar:'نحو سلسلة إمداد أكثر أمانًا', en:'Towards a Safer Supply Chain'},
  {ar:'الالتزام بالجودة مسؤولية الجميع', en:'Quality Commitment is Everyone\'s Responsibility'},
  {ar:'من الفحص الدقيق تبدأ الثقة', en:'Trust Begins with Careful Inspection'}
];
const SESSION_TAGLINE = WELCOME_TAGLINES[Math.floor(Math.random()*WELCOME_TAGLINES.length)];

/* شعار مخصص (درع + علامة صح) بدل الإيموجي - متسق مع أيقونة التطبيق */
const APP_ICON_URL = 'app-icon-professional.png';
const AUTH_HEROES = ['login-bg-optimized.jpg','login-port-optimized.jpg','login-truck-optimized.jpg','login-processing-optimized.jpg','login-reporting-optimized.jpg'];
const IMAGE_FALLBACK_ATTR = `onerror="this.remove();this.parentElement.classList.add('icon-fallback');"`;
const AUTH_WELCOME_MESSAGES = {
  ar:['الجودة تبدأ من معلومة موثقة.','كل سجل واضح يدعم قرارًا أفضل.','من الميدان إلى التقرير… نعمل بدقة.','سلامة المنتج مسؤولية تبدأ بالتفاصيل.'],
  en:['Quality starts with a documented fact.','Every clear record supports a better decision.','From field work to reporting — with precision.','Product safety begins with the details.']
};
function getAuthHeroIndex(){ return Math.floor(Date.now()/60000) % AUTH_HEROES.length; }
function getAuthWelcomeMessage(){ const list=AUTH_WELCOME_MESSAGES[LANG]||AUTH_WELCOME_MESSAGES.ar; return list[getAuthHeroIndex()%list.length]; }
const LOGO_SVG = `<svg width="22" height="22" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#2E7BD6"/><stop offset="100%" stop-color="#0EA5A0"/>
  </linearGradient></defs>
  <path d="M50 4 L88 18 V48 C88 74 70 90 50 96 C30 90 12 74 12 48 V18 Z" fill="url(#logoGrad)"/>
  <path d="M50 12 L80 24 V48 C80 69 65 82 50 87 C35 82 20 69 20 48 V24 Z" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="2.5"/>
  <path d="M32 50 L44 62 L70 34" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/* ===================== ImgBB image hosting =====================
   الأمان: مفتاح ImgBB لم يعد مكتوباً داخل الكود. المستودع عام، وأي مفتاح يُكتب هنا
   يصبح مقروءاً للجميع. المفتاح الآن يُدخَل مرة واحدة من داخل التطبيق (لوحة التحكم
   الإدارية) ويُحفظ في localStorage على جهاز المستخدم فقط.
   لو لم يُضبط مفتاح، التطبيق يستمر في العمل ويخزّن الصور محلياً بدون أي عطل. */
const IMGBB_KEY_STORAGE = 'qa_imgbb_key';
const IMGBB_MAX_RETRIES = 2;

function getImgbbKey(){
  try{ return (localStorage.getItem(IMGBB_KEY_STORAGE) || '').trim(); }
  catch(e){ return ''; }
}
function setImgbbKey(key){
  try{
    const clean = String(key||'').trim();
    if(clean) localStorage.setItem(IMGBB_KEY_STORAGE, clean);
    else localStorage.removeItem(IMGBB_KEY_STORAGE);
    return true;
  }catch(e){ return false; }
}
function hasImgbbKey(){ return !!getImgbbKey(); }

async function uploadToImgBB(dataUrl, retryCount = 0){
  const apiKey = getImgbbKey();
  // لا يوجد مفتاح مضبوط: نرجع null بهدوء والتطبيق يستخدم التخزين المحلي.
  if(!apiKey) return null;
  try{
    if(!dataUrl || typeof dataUrl !== 'string') return null;
    const parts = dataUrl.split(',');
    if(parts.length < 2) return null;
    const base64 = parts[1];
    if(base64.length > 20971520) return null; // 20MB limit

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let res;
    try{
      res = await fetch('https://api.imgbb.com/1/upload', {
        method:'POST',
        body: formData,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId); // كان يتسرب عند فشل fetch
    }

    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if(json && json.success && json.data && json.data.url) return json.data.url;

    // مفتاح غير صالح أو مرفوض: إعادة المحاولة لن تفيد.
    console.warn('ImgBB upload rejected:', json && json.error);
    return null;
  }catch(e){
    // أخطاء شبكة/مهلة فقط هي التي تستحق إعادة المحاولة.
    console.warn(`ImgBB upload failed (attempt ${retryCount + 1}):`, e.message);
    if(retryCount < IMGBB_MAX_RETRIES){
      await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
      return uploadToImgBB(dataUrl, retryCount + 1);
    }
    return null;
  }
}
const state = { view:'home', auth:null, editingSectionId:null, editingRecordId:null, currentRecord:null, detailSectionId:null, detailRecord:null, search:'', dateFrom:'', dateTo:'', sectionFilters:{}, sectionFilterRenderTimer:null, builderFields:[], monthly:{month:new Date().getMonth()+1, year:new Date().getFullYear()}, dashboardPeriod:'all', regTempBiometric:null, formTemp:{}, builtinFieldTarget:null, draftSaveTimer:null, draftRestored:false };

const Store = {
  get(key, def){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }catch(e){ return def; } },
  set(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); return true; }catch(e){ console.error('storage error',e); return false; } }
};

/* Local form drafts never write to Firebase. They protect unfinished field work on this device only. */
function draftKey(sectionId){ return 'qa_formDraft_'+String(sectionId||''); }
function getFormDraft(sectionId){
  const draft = Store.get(draftKey(sectionId), null);
  return draft && draft.record && typeof draft.record==='object' ? draft : null;
}
function formatDraftTime(iso){
  try{ return new Intl.DateTimeFormat(LANG==='ar'?'ar-EG':'en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(iso)); }
  catch(e){ return ''; }
}
function saveCurrentDraft(sectionId){
  if(!sectionId || !state.currentRecord) return;
  const savedAt = new Date().toISOString();
  Store.set(draftKey(sectionId), {record:state.currentRecord, savedAt});
  const status = document.getElementById('draftStatus');
  if(status) status.textContent = `${t(STR.draftSaved)} ${formatDraftTime(savedAt)}`;
}
function scheduleDraftSave(sectionId){
  if(!sectionId || !state.currentRecord) return;
  if(state.draftSaveTimer) clearTimeout(state.draftSaveTimer);
  state.draftSaveTimer = setTimeout(()=> saveCurrentDraft(sectionId), 350);
}
function clearFormDraft(sectionId){ try{ localStorage.removeItem(draftKey(sectionId)); }catch(e){} }

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function t(o){ if(o==null) return ''; if(typeof o==='string') return o; return o[LANG] || o.ar || o.en || ''; }
function todayISO(){ const d = new Date(); const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pct(part,total){ const p=parseFloat(part)||0; const tt=parseFloat(total)||0; if(tt<=0) return null; return p/tt*100; }

/* ===================== Work status (manual, all sections) =====================
   Every operation in every section is either 'working' or 'completed'. The value
   is set ONLY by the user (manual control) — nothing infers or derives it.
   All analytics count 'completed' operations exclusively. */
const WORK_STATUS_DEFAULT = 'working';
function workStatusOf(record){
  return (record && record.workStatus) === 'completed' ? 'completed' : WORK_STATUS_DEFAULT;
}
function isCompleted(record){ return workStatusOf(record) === 'completed'; }
function completedOnly(records){ return (records||[]).filter(isCompleted); }
function workStatusLabel(status){
  return status === 'completed'
    ? (LANG === 'ar' ? 'منتهية' : 'Completed')
    : (LANG === 'ar' ? 'قيد العمل' : 'In progress');
}
/* Reads a numeric record total, falling back to summing the per-container rows
   when the record-level aggregate was never stored. Keeps analytics correct for
   records saved before aggregates existed. */
function metricOf(record, totalKey, detailKey){
  const direct = parseFloat(record && record[totalKey]);
  if(Number.isFinite(direct)) return direct;
  const rows = (record && record.containerDetails) || [];
  return rows.reduce((sum,row)=> sum + (parseFloat(row && row[detailKey])||0), 0);
}

/* ===================== IndexedDB (images + exported files) ===================== */
let _dbPromise=null;
function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve,reject)=>{
    const req = indexedDB.open('qaSystemDB', 2);
    let settled = false;
    req.onupgradeneeded = e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('images')) db.createObjectStore('images',{keyPath:'id'});
      if(!db.objectStoreNames.contains('files')) db.createObjectStore('files',{keyPath:'id'});
    };
    req.onsuccess = e=>{ settled = true; resolve(e.target.result); };
    req.onerror = e=>{ settled = true; _dbPromise = null; reject(e); };
    req.onblocked = ()=>{ console.warn('IndexedDB upgrade blocked — another tab of this app may be open'); };
    setTimeout(()=>{ if(!settled){ settled = true; _dbPromise = null; reject(new Error('IndexedDB open timed out')); } }, 5000);
  });
  return _dbPromise;
}
async function saveImage(id, dataUrl){ const db = await openDB(); return new Promise((res,rej)=>{ const tx=db.transaction('images','readwrite'); tx.objectStore('images').put({id,dataUrl}); tx.oncomplete=()=>res(true); tx.onerror=e=>rej(e); }); }
async function getImage(id){ try{ const db = await openDB(); return new Promise((res)=>{ const tx=db.transaction('images','readonly'); const r=tx.objectStore('images').get(id); r.onsuccess=()=>res(r.result?r.result.dataUrl:null); r.onerror=()=>res(null); }); }catch(e){ return null; } }
async function deleteImageFromDB(id){ try{ const db = await openDB(); const tx=db.transaction('images','readwrite'); tx.objectStore('images').delete(id); }catch(e){} }

function compressImageDataUrl(dataUrl, maxDim, quality){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      try{
        let w = img.naturalWidth, h = img.naturalHeight;
        if(w<=0 || h<=0){ resolve(dataUrl); return; }
        if(w > maxDim || h > maxDim){
          if(w>=h){ h = Math.round(h * (maxDim/w)); w = maxDim; }
          else { w = Math.round(w * (maxDim/h)); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality||0.82));
      }catch(e){ resolve(dataUrl); }
    };
    img.onerror = ()=> resolve(dataUrl);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> typeof reader.result==='string' ? resolve(reader.result) : reject(new Error('Unreadable image'));
    reader.onerror = ()=> reject(new Error('Image reading failed'));
    reader.readAsDataURL(file);
  });
}

async function uploadProfilePicture(file){
  if(!file || !String(file.type||'').startsWith('image/')) throw new Error('Unsupported image type');
  if(file.size > 12 * 1024 * 1024) throw new Error('Image is too large');
  const original = await readFileAsDataUrl(file);
  const optimized = await compressImageDataUrl(original, 768, 0.84);
  if(!optimized) throw new Error('Image compression failed');
  try{
    const url = await uploadToImgBB(optimized);
    if(url) return url;
  }catch(err){ console.warn('Profile image remote upload failed; using local fallback', err); }
  // Immediate fallback keeps the profile usable even when the image host is unavailable.
  return optimized;
}

function parseContainerCount(record){
  const details = Array.isArray(record && record.containerDetails) ? record.containerDetails : [];
  if(details.length) return details.length;
  const value = Number(record && record.containerCount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function textToDataUrl(text, mime){
  const bytes = new TextEncoder().encode(text);
  let binary = ''; bytes.forEach(b=> binary += String.fromCharCode(b));
  return `data:${mime};base64,${btoa(binary)}`;
}
async function storeExportedFile(filename, kind, dataUrl){
  try{
    const db = await openDB();
    const meta = { id: uid(), filename, kind, dataUrl, createdAt: new Date().toISOString() };
    await new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(meta); tx.oncomplete=()=>res(true); tx.onerror=e=>rej(e); });
  }catch(e){ console.warn('storeExportedFile failed', e); }
}
async function getExportedFiles(){
  try{
    const db = await openDB();
    return new Promise((res)=>{ const tx=db.transaction('files','readonly'); const req=tx.objectStore('files').getAll(); req.onsuccess=()=>res(req.result||[]); req.onerror=()=>res([]); });
  }catch(e){ return []; }
}
async function deleteExportedFile(id){
  try{ const db = await openDB(); const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(id); }catch(e){}
}
function downloadDataUrlFile(filename, dataUrl){
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}
async function viewDataUrlFile(dataUrl){
  try{
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const w = window.open(blobUrl, '_blank');
    if(!w) downloadDataUrlFile('file.pdf', dataUrl);
    setTimeout(()=> URL.revokeObjectURL(blobUrl), 120000);
  }catch(e){
    console.warn('view failed', e);
    downloadDataUrlFile('file.pdf', dataUrl);
  }
}
async function dataUrlToFile(dataUrl, filename, mime){
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, {type: mime || blob.type});
}
async function shareStoredFileMeta(f){
  const mimeMap = { pdf:'application/pdf', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv:'text/csv' };
  try{
    const file = await dataUrlToFile(f.dataUrl, f.filename, mimeMap[f.kind]);
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], title: f.filename});
    } else {
      showToast(t(STR.shareNotSupported));
    }
  }catch(err){
    if(err && err.name === 'AbortError') return; // user cancelled the share sheet
    console.warn('share failed', err);
    showToast(t(STR.shareNotSupported));
  }
}

/* ===================== Security helpers (password hashing + biometric) ===================== */
async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function biometricAvailable(){
  try{
    if(!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  }catch(e){ return false; }
}
async function registerBiometric(userLabel){
  try{
    const available = await biometricAvailable();
    if(!available) return null;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userIdBytes = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey:{
        challenge, rp:{name:'QA Supply Chain'},
        user:{ id:userIdBytes, name:userLabel||'user', displayName:userLabel||'user' },
        pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
        authenticatorSelection:{authenticatorAttachment:'platform', userVerification:'required'},
        timeout:60000
      }
    });
    if(!cred) return null;
    return btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
  }catch(e){ console.warn('biometric register failed', e); return null; }
}
async function verifyBiometric(credIdB64){
  try{
    const rawId = Uint8Array.from(atob(credIdB64), c=>c.charCodeAt(0));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey:{ challenge, allowCredentials:[{id:rawId, type:'public-key', transports:['internal']}], userVerification:'required', timeout:60000 }
    });
    return !!assertion;
  }catch(e){ console.warn('biometric verify failed', e); return false; }
}

/* ===================== UI strings ===================== */
const STR = {
  appName:{ar:'منظومة الجودة - سلسلة الإمداد', en:'QA Supply Chain'},
  home:{ar:'الرئيسية', en:'Home'},
  dashboard:{ar:'التحليلات', en:'Dashboard'},
  containers:{ar:'الشحنات', en:'Shippment'},
  trucks:{ar:'الشحن', en:'Loading'},
  rebacking:{ar:'معالجة المنتجات', en:'Rebacking'},
  chat:{ar:'الدردشة', en:'Chat'},
  profilePic:{ar:'صورة الملف الشخصي', en:'Profile Picture'},
  uploadPhoto:{ar:'رفع صورة', en:'Upload Photo'},
  chatPlaceholder:{ar:'اكتب رسالة...', en:'Type a message...'},
  send:{ar:'إرسال', en:'Send'},
  adminMonitoring:{ar:'مراقبة المسؤول', en:'Admin Monitoring'},
  newRecordNotify:{ar:'سجل جديد مضاف!', en:'New record added!'},
  newTruckNotify:{ar:'شاحنة جديدة مضافة!', en:'New truck added!'},
  newRebackingNotify:{ar:'عملية معالجة جديدة!', en:'New rebacking process!'},
  monitoring:{ar:'مراقبة النظام والنشاط', en:'System & Activity Monitoring'},
  recentActivity:{ar:'النشاط الأخير', en:'Recent Activity'},
  loggedInAs:{ar:'مسجل دخول باسم', en:'Logged in as'},
  logout:{ar:'تسجيل الخروج', en:'Logout'},
  changePic:{ar:'تغيير الصورة', en:'Change Photo'},
  monthly:{ar:'التقرير الشهري', en:'Monthly Report'},
  builder:{ar:'الإعدادات', en:'Settings'},
  add:{ar:'إضافة', en:'Add'},
  save:{ar:'حفظ', en:'Save'},
  cancel:{ar:'إلغاء', en:'Cancel'},
  edit:{ar:'تعديل', en:'Edit'},
  delete:{ar:'حذف', en:'Delete'},
  search:{ar:'بحث...', en:'Search...'},
  from:{ar:'من', en:'From'},
  to:{ar:'إلى', en:'To'},
  exportCsv:{ar:'تصدير CSV', en:'Export CSV'},
  exportXlsx:{ar:'تصدير Excel', en:'Export Excel'},
  exportAll:{ar:'تصدير الكل (مجمع)', en:'Export All (Combined)'},
  noRecords:{ar:'لا توجد سجلات بعد', en:'No records yet'},
  confirmDelete:{ar:'هل تريد حذف هذا السجل؟', en:'Delete this record?'},
  accessLog:{ar:'الحساب والدخول', en:'Account & Access'},
  name:{ar:'الاسم', en:'Name'},
  role:{ar:'الوظيفة/الدور', en:'Role'},
  continue:{ar:'متابعة', en:'Continue'},
  newSection:{ar:'إضافة قسم جديد', en:'Add New Section'},
  sectionNameAr:{ar:'اسم القسم (عربي)', en:'Section Name (Arabic)'},
  sectionNameEn:{ar:'اسم القسم (إنجليزي)', en:'Section Name (English)'},
  icon:{ar:'الأيقونة (إيموجي)', en:'Icon (emoji)'},
  fields:{ar:'الحقول', en:'Fields'},
  addField:{ar:'+ إضافة حقل', en:'+ Add Field'},
  fieldLabelAr:{ar:'تسمية (عربي)', en:'Label (Arabic)'},
  fieldLabelEn:{ar:'تسمية (إنجليزي)', en:'Label (English)'},
  optionsCsv:{ar:'خيارات (افصل بفاصلة)', en:'Options (comma separated)'},
  saveSection:{ar:'حفظ القسم', en:'Save Section'},
  deleteSectionConfirm:{ar:'حذف هذا القسم وكل سجلاته؟', en:'Delete this section and all its records?'},
  month:{ar:'الشهر', en:'Month'},
  year:{ar:'السنة', en:'Year'},
  summary:{ar:'ملخص', en:'Summary'},
  recordsCount:{ar:'عدد السجلات', en:'Records'},
  requiredMissing:{ar:'برجاء تعبئة الحقول المطلوبة', en:'Please fill required fields'},
  savedOk:{ar:'تم الحفظ بنجاح ✅', en:'Saved successfully ✅'},
  draftSaved:{ar:'تم حفظ المسودة محليًا', en:'Draft saved locally'},
  draftRestored:{ar:'تمت استعادة المسودة المحفوظة على هذا الجهاز', en:'A local draft was restored'},
  discardDraft:{ar:'حذف المسودة', en:'Discard draft'},
  draftDiscarded:{ar:'تم حذف المسودة المحلية', en:'Local draft discarded'},
  deletedOk:{ar:'تم الحذف', en:'Deleted'},
  online:{ar:'متصل', en:'Online'},
  offline:{ar:'غير متصل', en:'Offline'},
  builtin:{ar:'قسم أساسي', en:'Built-in'},
  customFieldTag:{ar:'حقل مُضاف', en:'Added field'},
  addFieldToSectionHint:{ar:'الحقل الجديد هيتضاف في آخر نموذج هذا القسم لكل السجلات القادمة', en:'The new field will be appended to the end of this section\'s form for future records'},
  addPhotos:{ar:'إضافة صور', en:'Add Photos'},
  xlsxOfflineFallback:{ar:'تعذر الاتصال لتحميل مُصدِّر الإكسل، تم التصدير كملف CSV بدلاً من ذلك.', en:'Could not reach the Excel exporter, exported as CSV instead.'},
  sharePdf:{ar:'تنزيل PDF', en:'Download PDF'},
  dailyReportPdf:{ar:'📄 تقرير اليوم PDF', en:'📄 Today\'s Report PDF'},
  generatingPdf:{ar:'جاري تجهيز ملف PDF...', en:'Preparing PDF...'},
  pdfLoadFailed:{ar:'تعذر تحميل أداة PDF، تأكد من الاتصال بالإنترنت وحاول تاني', en:'Could not load the PDF tool — check your internet connection and try again'},
  pdfGenericError:{ar:'حصلت مشكلة أثناء تجهيز التقرير، حاول تاني', en:'Something went wrong preparing the report — please try again'},
  imageSaveFailed:{ar:'تعذر حفظ الصورة، جرب تقفل كل نوافذ/تابات التطبيق وافتحه من جديد', en:'Could not save the image — try closing all tabs/windows of the app and reopening it'},
  addingPhotos:{ar:'جاري إضافة الصور...', en:'Adding photos...'},
  photosAdded:{ar:'تمت إضافة الصور ✅', en:'Photos added ✅'},
  profilePhotoInvalid:{ar:'اختر صورة صالحة بحجم لا يتجاوز 12 ميجابايت', en:'Choose a valid image up to 12 MB'},
  notificationEnabled:{ar:'تم تفعيل إشعارات التقارير على هذا الجهاز', en:'Report notifications are enabled on this device'},
  notificationBlocked:{ar:'لم يتم تفعيل الإشعارات. يمكنك السماح بها من إعدادات المتصفح.', en:'Notifications are not enabled. Allow them in browser settings.'},
  reportReadyTitle:{ar:'تم حفظ التقرير', en:'Report saved'},
  reportReadyBody:{ar:'أصبح التقرير جاهزًا في ملفات التطبيق.', en:'The report is ready in application files.'},
  popupBlocked:{ar:'المتصفح منع فتح نافذة جديدة، من فضلك اسمح بالنوافذ المنبثقة لهذا الموقع وحاول تاني', en:'Your browser blocked the new window — please allow pop-ups for this site and try again'},
  filesTab:{ar:'الملفات', en:'Files'},
  filesHint:{ar:'الملفات دي (PDF/Excel/CSV) محفوظة على هذا الجهاز فقط، مش متزامنة مع باقي الفريق', en:'These files (PDF/Excel/CSV) are stored on this device only — not synced with the rest of the team'},
  downloadAgain:{ar:'تنزيل', en:'Download'},
  deleteFile:{ar:'حذف', en:'Delete'},
  viewFile:{ar:'عرض', en:'View'},
  shareFile:{ar:'مشاركة', en:'Share'},
  shareNotSupported:{ar:'المشاركة غير مدعومة على هذا المتصفح، استخدم زرار التنزيل بدلاً منها', en:'Sharing is not supported on this browser — use the Download button instead'},

  /* auth */
  welcomeTitle:{ar:'أهلاً بك 👋', en:'Welcome 👋'},
  welcomeSub:{ar:'اختر حسابك أو سجّل دخول لأول مرة', en:'Choose your account or sign in for the first time'},
  whoAreYou:{ar:'من أنت؟', en:'Who are you?'},
  newUserBtn:{ar:'➕ مستخدم جديد (لدي كود دخول)', en:'➕ New user (I have an access code)'},
  existingUserNewDevice:{ar:'أنا مستخدم بالفعل (جهاز جديد)', en:'I already have an account (new device)'},
  findAccountTitle:{ar:'البحث عن حسابك', en:'Find your account'},
  findAccountSub:{ar:'اكتب اسمك بالظبط زي ما سجّلته أول مرة', en:'Type your name exactly as you registered it'},
  accountNotFound:{ar:'لم يتم العثور على حساب بهذا الاسم، تأكد من الاسم أو اعمل حساب جديد', en:'No account found with that name — check the spelling or create a new account'},
  adminEntry:{ar:'دخول المسؤول الرئيسي', en:'Main admin sign-in'},
  accessCodeTitle:{ar:'كود الدخول', en:'Access Code'},
  accessCodeSub:{ar:'أدخل كود الدخول اللي استلمته من المسؤول الرئيسي (م. محمد) عشان تقدر تسجّل حسابك', en:'Enter the access code you received from the main admin to register your account'},
  accessCodeLabel:{ar:'كود الدخول', en:'Access code'},
  accessCodeWrong:{ar:'الكود غير صحيح، تأكد منه مع المسؤول', en:'Incorrect code, please check with the admin'},
  registerTitle:{ar:'إنشاء حسابك', en:'Create your account'},
  registerSub:{ar:'بعد الحفظ، هتدخل بعدها بكلمة السر أو بصمة الجهاز فقط', en:'After saving, you will sign in afterwards with just your password or device fingerprint'},
  choosePassword:{ar:'كلمة السر (٤ أرقام/أحرف على الأقل)', en:'Password (at least 4 characters)'},
  confirmPassword:{ar:'تأكيد كلمة السر', en:'Confirm password'},
  passwordMismatch:{ar:'كلمتا السر غير متطابقتين', en:'Passwords do not match'},
  passwordTooShort:{ar:'كلمة السر قصيرة جداً', en:'Password is too short'},
  enableBiometric:{ar:'🔒 تفعيل الدخول ببصمة الجهاز', en:'🔒 Enable device fingerprint sign-in'},
  biometricEnabled:{ar:'✅ تم تفعيل البصمة لهذا الجهاز', en:'✅ Fingerprint enabled on this device'},
  biometricNotAvailable:{ar:'البصمة غير مدعومة على هذا الجهاز', en:'Fingerprint is not supported on this device'},
  createAccount:{ar:'إنشاء الحساب والدخول', en:'Create account & sign in'},
  adminSetupTitle:{ar:'إعداد حساب المسؤول', en:'Set up admin account'},
  adminSetupSub:{ar:'أول مرة تفتح فيها التطبيق كمسؤول رئيسي، حدد كلمة سر لحسابك', en:'First time opening as main admin — set a password for your account'},
  adminPasswordLabel:{ar:'كلمة سر المسؤول (٦ أرقام/أحرف على الأقل)', en:'Admin password (at least 6 characters)'},
  saveAndEnter:{ar:'حفظ ودخول', en:'Save & sign in'},
  adminLoginTitle:{ar:'دخول المسؤول الرئيسي', en:'Main admin sign-in'},
  wrongPassword:{ar:'كلمة السر غير صحيحة', en:'Incorrect password'},
  lockWelcomeBack:{ar:'مرحباً بعودتك', en:'Welcome back'},
  enterPassword:{ar:'كلمة السر', en:'Password'},
  lockPasswordHint:{ar:'أدخل كلمة السر للمتابعة إلى مساحة العمل', en:'Enter your password to continue to your workspace'},
  lockPasswordPlaceholder:{ar:'اكتب كلمة السر', en:'Enter your password'},
  unlockBtn:{ar:'دخول', en:'Sign in'},
  unlockBiometricBtn:{ar:'🔓 دخول بالبصمة', en:'🔓 Sign in with fingerprint'},
  switchAccount:{ar:'مستخدم آخر', en:'Switch account'},
  forgotPassword:{ar:'نسيت كلمة السر؟', en:'Forgot password?'},
  resetRequestSent:{ar:'تم إرسال طلبك للمسؤول الرئيسي، تواصل معاه ليعيد ضبط كلمة السر لك', en:'Your request was sent to the main admin — contact them to reset your password'},
  pendingResetRequests:{ar:'طلبات إعادة تعيين كلمة السر', en:'Pending Password Reset Requests'},
  resetPasswordAction:{ar:'إعادة تعيين', en:'Reset'},
  setNewPasswordTitle:{ar:'كلمة سر جديدة لـ', en:'New password for'},
  setNewPasswordPlaceholder:{ar:'اكتب كلمة السر الجديدة (٤ أحرف على الأقل)', en:'Enter new password (min 4 characters)'},
  resetDonePrefix:{ar:'تم ضبط كلمة السر. أبلغ المستخدم بالكلمة الجديدة:', en:'Password reset. Tell the user their new password:'},
  logout:{ar:'تسجيل الخروج', en:'Log out'},
  loggedInAs:{ar:'مسجّل دخول باسم', en:'Signed in as'},
  adminPanelTitle:{ar:'لوحة التحكم الإدارية', en:'Admin Control Panel'},
  masterCodeLabel:{ar:'كود الدخول الحالي لأفراد الفريق', en:'Current team access code'},
  masterCodeHint:{ar:'شارك هذا الكود مع أفراد فريقك ليسجّلوا حساباتهم أول مرة فقط. تغييره يفعّل على هذا الجهاز فقط؛ لو غيّرته لازم توزّع نفس نسخة الملف على الجميع.', en:'Share this code with your team for first-time registration only. Changing it applies to this device only; redistribute the same file if changed.'},
  saveCode:{ar:'حفظ الكود', en:'Save code'},
  registeredUsers:{ar:'المستخدمون المسجّلون في الفريق', en:'Registered Team Members'},
  noUsers:{ar:'لا يوجد مستخدمون بعد', en:'No users yet'},
  revokeUser:{ar:'إلغاء الحساب', en:'Revoke'},
  makeAdmin:{ar:'اجعله مسؤولاً', en:'Make Admin'},
  removeAdmin:{ar:'إلغاء صلاحية المسؤول', en:'Remove Admin'},
  revokeConfirm:{ar:'إلغاء حساب هذا المستخدم؟ هيحتاج كود دخول جديد للتسجيل تاني', en:'Revoke this user? They will need a new access code to register again'},
  you:{ar:'أنت', en:'You'},
  roleAdmin:{ar:'مسؤول رئيسي', en:'Main Admin'},
  adminOnlyNotice:{ar:'إضافة أو تعديل الأقسام متاحة للمسؤول الرئيسي فقط. حسابك مخصص للتعبئة اليومية.', en:'Adding or editing sections is available to the main admin only. Your account is for daily data entry.'},
  adminLoginCount:{ar:'عدد مرات دخول المسؤول الرئيسي', en:'Main admin sign-in count'}
};

const ROLE_OPTIONS = [
  {v:'مسؤول جودة', l:{ar:'مسؤول جودة', en:'QA Officer'}},
  {v:'مشرف', l:{ar:'مشرف', en:'Supervisor'}},
  {v:'مدير', l:{ar:'مدير', en:'Manager'}},
  {v:'أخرى', l:{ar:'أخرى', en:'Other'}}
];

/* ===================== Field helpers ===================== */
const UNIT_OPTIONS = [
  {ar:'كجم', en:'KG'}, {ar:'طن', en:'Ton'}, {ar:'لتر', en:'Liter'}, {ar:'كرتونة', en:'Carton'},
  {ar:'بالة', en:'Pallet'}, {ar:'قطعة', en:'Piece'}, {ar:'جوال', en:'Sack'}, {ar:'صندوق', en:'Box'}
];
const SEL = (val, labelAr, labelEn) => ({value:val, label:{ar:labelAr, en:labelEn}});

/* ===================== Built-in Section Schemas ===================== */
const BUILTIN_SECTIONS = [
  { id:'containers', builtin:true, icon:'📦', name:{ar:'Shipment', en:'Shipment'}, bgImage:'shipment-bg.jpg',
    listFields:['date','blNumber','location','productDesc','operationType'],
    fields:[
      {key:'date', type:'date', label:{ar:'التاريخ', en:'Date'}, required:true},
      {key:'blNumber', type:'text', label:{ar:'رقم البوليصة', en:'BL Number'}, required:true},
      {key:'location', type:'text', label:{ar:'الموقع', en:'Location'}},
      {key:'readyForDispatch', type:'select', label:{ar:'جاهز للتوزيع', en:'Ready for Dispatch'},
        options:[SEL('yes','نعم','Yes'), SEL('no','لا','No'), SEL('pending','قيد الانتظار','Pending')]},
      {key:'transportMethod', type:'select', label:{ar:'طريقة النقل', en:'Transport Method'},
        options:[SEL('air','عبر المطار','By Air'), SEL('sea','عبر الحاويات (بحري)','By Sea/Container'), SEL('road','عبر الطريق','By Road')]},
      {key:'shippingLine', type:'text', label:{ar:'الناقل البحري (Shipping Line)', en:'Shipping Line'}},
      {key:'transportComment', type:'text', label:{ar:'تعليق على طريقة النقل (إن وجد)', en:'Transport comment (if any)'}},
      {key:'containerCount', type:'number', label:{ar:'عدد الحاويات', en:'Number of Containers'}},
      {key:'billQty', type:'number', label:{ar:'الكمية الكاملة بالبوليصة', en:'Total Quantity per Bill'}},
      {key:'factory', type:'text', label:{ar:'المصنع', en:'Factory'}},
      {key:'countryOfOrigin', type:'text', label:{ar:'بلد المنشأ', en:'Country of Origin'}},
      {key:'productDesc', type:'text', label:{ar:'المنتج ووصفه', en:'Product & Description'}, required:true},
      {key:'unit', type:'unit', label:{ar:'الوحدة', en:'Unit'}},
      {key:'prodExpDates', type:'multiDate', label:{ar:'تواريخ الإنتاج والانتهاء', en:'Production & Expiry Dates'}},
      {key:'operationType', type:'select', label:{ar:'نوع العملية', en:'Operation Type'},
        options:[SEL('cross','Cross Loading','Cross Loading'), SEL('off','Off Loading','Off Loading')]},
      {key:'containerDetails', type:'group', label:{ar:'تفاصيل الحاويات', en:'Container Details'},
        fields:[
          {key:'containerNo', type:'text', label:{ar:'رقم الحاوية', en:'Container No.'}},
          {key:'condition', type:'select', label:{ar:'حالة الحاوية', en:'Condition'}, options:[SEL('good','سليمة','Good'),SEL('bad','غير سليمة','Bad')]},
          {key:'qty', type:'number', label:{ar:'الكمية', en:'Qty'}},
          {key:'nc', type:'number', label:{ar:'عدد NC بالحاوية', en:'NC in this Container'}},
          {key:'reback', type:'number', label:{ar:'Reback بالحاوية', en:'Reback in this Container'}},
          {key:'loss', type:'number', label:{ar:'Loss بالحاوية', en:'Loss in this Container'}},
          {key:'notes', type:'textarea', label:{ar:'ملاحظات', en:'Notes'}}
        ]},
      {key:'ncType', type:'select', label:{ar:'نوع الـ NC', en:'NC Type'},
        options:[SEL('from_container','From Container','From Container'), SEL('handling','During Handling','During Handling'), SEL('other','أخرى','Other')]},
      {key:'productView', type:'image', label:{ar:'صورة المنتج (Product View)', en:'Product View'}},
      {key:'issuePhoto', type:'image', label:{ar:'توثيق مشكلة المنتج (إن وُجدت)', en:'Product Issue Documentation (if any)'}},
      {key:'totalNC', type:'number', label:{ar:'إجمالي Total NC (تلقائي)', en:'Total NC (auto)'}},
      {key:'ncReason', type:'textarea', label:{ar:'سبب/توضيح الـ NC', en:'NC Reason'}},
      /* كان هنا حقل يدوي منفصل (ncTreated) للمعالج بجانب الإجمالي التلقائي
         (totalReback)، فينتج رقمان مختلفان للمعالج في نفس التطبيق. الآن مصدر
         واحد: بند المعالجة المخصص في السجل، محسوب تلقائياً من تفاصيل الحاويات. */
      {key:'totalReback', type:'number', label:{ar:'إجمالي المعالج Re-addressed (تلقائي)', en:'Total Re-addressed (auto)'}},
      {key:'totalLoss', type:'number', label:{ar:'إجمالي الفاقد Total Loss (تلقائي)', en:'Total Loss (auto)'}},
      {key:'ncTreatedPercent', type:'computed', label:{ar:'نسبة المعالجة من NC (Re-addressed %)', en:'Re-addressed % of NC'},
        compute:(r)=> pct(r.totalReback, r.totalNC)},
      {key:'lossPercentOfNC', type:'computed', label:{ar:'نسبة الفاقد من NC (Loss of NC %)', en:'Loss % of NC'},
        compute:(r)=> pct(r.totalLoss, r.totalNC)},
      {key:'lossPercentOfBillQty', type:'computed', label:{ar:'نسبة الفاقد الكلية في البوليصة', en:'Total Loss % of Bill Quantity'},
        compute:(r)=> pct(r.totalLoss, r.billQty)},
      {key:'note', type:'textarea', label:{ar:'NOTE - ملاحظات عامة', en:'NOTE - General'}},
      {key:'images', type:'image', label:{ar:'صور البوليصة', en:'Bill Images'}}
    ]
  },
  { id:'trucks', builtin:true, icon:'🚚', name:{ar:'فحص الشاحنات', en:'Truck Inspection'}, bgImage:'trucks-bg.jpg',
    listFields:['date','truckNo','destination','inspectionResult'],
    fields:[
      {key:'date', type:'date', label:{ar:'التاريخ', en:'Date'}, required:true},
      {key:'location', type:'text', label:{ar:'الموقع', en:'Location'}},
      {key:'truckNo', type:'text', label:{ar:'رقم الشاحنة', en:'Truck No'}, required:true},
      {key:'destination', type:'text', label:{ar:'الوجهة', en:'Destination'}},
      {key:'transporter', type:'text', label:{ar:'الناقل', en:'Transporter'}},
      {key:'prodExpDates', type:'multiDate', label:{ar:'تواريخ الإنتاج والانتهاء', en:'Production & Expiry Dates'}},
      {key:'driverName', type:'text', label:{ar:'اسم السائق', en:'Driver Name'}},
      {key:'driverPhone', type:'text', label:{ar:'هاتف السائق', en:'Driver Phone'}},
      {key:'products', type:'group', label:{ar:'المنتجات المحمّلة (أضف بند لكل منتج)', en:'Products Loaded (add an item per product)'},
        fields:[
          {key:'product', type:'text', label:{ar:'المنتج', en:'Product'}},
          {key:'qty', type:'text', label:{ar:'الكمية (يدوياً)', en:'Qty (Manual)'}},
          {key:'unit', type:'unit', label:{ar:'الوحدة (اكتبها يدوياً لو مختلفة)', en:'Unit (type manually if different)'}}
        ]},
      {key:'orderType', type:'select', label:{ar:'نوع الطلب', en:'Order Type'},
        options:[SEL('sales','مبيعات','Sales'), SEL('replenishment','تغذية مخزون','Replenishment'), SEL('consignment','بضاعة أمانة','Consignment'), SEL('cash','عميل نقدي','Cash Customer'), SEL('staffsales','منفذ بيع الموظفين','Staff Sales Point'), SEL('other','أخرى','Other')]},
      {key:'orderTypeComment', type:'text', label:{ar:'تعليق على نوع الطلب (اختياري)', en:'Order type comment (optional)'}},
      {key:'cleaning', type:'select', label:{ar:'النظافة', en:'Cleaning'}, options:[SEL('good','جيدة','Good'),SEL('bad','غير جيدة','Not Good')]},
      {key:'tarpFloor', type:'select', label:{ar:'مشمع سطح الشاحنة', en:'Truck Floor Tarp'}, options:[SEL('avail','متوفر','Available'),SEL('notavail','غير متوفر','Not Available')]},
      {key:'tarpCover', type:'select', label:{ar:'مشمع غطاء الشاحنة', en:'Truck Cover Tarp'}, options:[SEL('avail','متوفر','Available'),SEL('notavail','غير متوفر','Not Available')]},
      {key:'inspectionResult', type:'select', label:{ar:'نتيجة الفحص', en:'Inspection Result'}, options:[SEL('accepted','مقبولة','Accepted'),SEL('rejected','مرفوضة','Rejected')]},
      {key:'remark', type:'textarea', label:{ar:'ملاحظات', en:'Remark'}},
      {key:'images', type:'image', label:{ar:'صور', en:'Images'}}
    ]
  },
  { id:'rebacking', builtin:true, icon:'📦♻️', name:{ar:'معالجة المنتجات', en:'Rebacking'}, bgImage:'reback-bg.jpg',
    listFields:['date','blNumber','product','processedPercent'],
    fields:[
      {key:'date', type:'date', label:{ar:'التاريخ', en:'Date'}, required:true},
      {key:'location', type:'text', label:{ar:'الموقع', en:'Location'}},
      {key:'blNumber', type:'text', label:{ar:'رقم البوليصة', en:'BL Number'}, required:true},
      {key:'product', type:'text', label:{ar:'المنتج', en:'Product'}},
      {key:'unit', type:'unit', label:{ar:'الوحدة', en:'Unit'}},
      {key:'mergeReason', type:'textarea', label:{ar:'سبب NC', en:'NC Reason'}},
      {key:'mergeType', type:'text', label:{ar:'نوع NC', en:'NC Type'}},
      {key:'mergeQty', type:'number', label:{ar:'كمية NC', en:'NC Quantity'}, required:true},
      {key:'processedQty', type:'number', label:{ar:'الكمية المعالجة', en:'Processed Quantity'}},
      {key:'damagedQty', type:'number', label:{ar:'الكمية التالفة', en:'Damaged Quantity'}},
      {key:'processedPercent', type:'computed', label:{ar:'نسبة معالجة NC', en:'NC Processed %'},
        compute:(r)=> pct(r.processedQty, r.mergeQty)},
      {key:'notes', type:'textarea', label:{ar:'ملاحظات', en:'Notes'}},
      {key:'images', type:'image', label:{ar:'صور', en:'Images'}}
    ]
  }
];

/* ===================== Firestore-backed shared data (cross-device sync) ===================== */
/* أي بيانات مشتركة بين كل الأفراد (السجلات، المستخدمين، الأقسام المخصصة، كود الدخول) بتتخزن هنا
   وبتتحدث تلقائيًا لحظيًا لكل جهاز فاتح التطبيق، عن طريق Firestore. */
const CUSTOM_SECTIONS_CACHE = { list: [] };
const RECORDS_CACHE = {};        // { sectionId: [records...] }
const USERS_CACHE = { list: [] };
const CHAT_CACHE = { list: [] };
const META_CACHE = { masterCode: null, adminPasswordHash: null, adminBiometricCredId: null };
const ACCESS_LOG_CACHE = { list: [] };
const RESET_REQUESTS_CACHE = { list: [] };
const BUILTIN_EXTENSIONS_CACHE = { map: {} }; // { sectionId: [extraField, ...] }
const _subscribedSections = new Set();

function qaCol(path){ return db.collection('qa_app').doc(path.split('/')[0]).collection(path.split('/')[1] || 'items'); }

let _appBooted = false;
let _metaReady = false;
let _usersReady = false;
let _renderScheduled = false;
function scheduleRender(){
  if(!_appBooted) return;
  if(_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(()=>{ _renderScheduled = false; render(); });
}
function tryBootApp(){
  if(_appBooted) return;
  if(!_metaReady || !_usersReady) return;
  _appBooted = true;
  initAuthState();
  render();
  setTimeout(()=> retryPendingImageUploads(), 1500);
}
function renderLoadingScreen(){
  return `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:var(--bg);">
    <div style="text-align:center;">
      <div style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,var(--navy),var(--navy3));color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 14px;">🛡️</div>
      <div style="color:var(--muted);font-size:13px;">${LANG==='ar'?'جاري التحميل...':'Loading...'}</div>
    </div>
  </div>`;
}

function subscribeMeta(){
  db.collection('qa_app').doc('meta').onSnapshot(snap=>{
    const d = snap.data() || {};
    META_CACHE.masterCode = d.masterCode || null;
    META_CACHE.adminPasswordHash = d.adminPasswordHash || null;
    META_CACHE.adminBiometricCredId = d.adminBiometricCredId || null;
    if(!_metaReady){ _metaReady = true; tryBootApp(); }
    if(_appBooted){ if(state.auth) scheduleRender(); else if(state.view==='builder') scheduleRender(); }
  }, err=> console.warn('meta sync error', err));
}
function subscribeUsers(){
  qaCol('users/items').onSnapshot(snap=>{
    const arr = []; snap.forEach(doc=> arr.push({id:doc.id, ...doc.data()}));
    USERS_CACHE.list = arr;
    if(!_usersReady){ _usersReady = true; tryBootApp(); }
    scheduleRender();
  }, err=> console.warn('users sync error', err));
}
function subscribeAccessLog(){
  qaCol('accessLog/items').orderBy('time','desc').limit(500).onSnapshot(snap=>{
    const arr = []; snap.forEach(doc=> arr.push({id:doc.id, ...doc.data()}));
    ACCESS_LOG_CACHE.list = arr;
    if(_appBooted && state.view==='builder') scheduleRender();
  }, err=> console.warn('accessLog sync error', err));
}
function subscribeResetRequests(){
  qaCol('passwordResetRequests/items').onSnapshot(snap=>{
    const arr = []; snap.forEach(doc=> arr.push({id:doc.id, ...doc.data()}));
    RESET_REQUESTS_CACHE.list = arr;
    if(_appBooted && state.view==='builder') scheduleRender();
  }, err=> console.warn('resetRequests sync error', err));
}
function subscribeCustomSections(){
  qaCol('customSections/items').onSnapshot(snap=>{
    const arr = []; snap.forEach(doc=> arr.push(doc.data()));
    CUSTOM_SECTIONS_CACHE.list = arr;
    arr.forEach(s=> subscribeSection(s.id));
    scheduleRender();
  }, err=> console.warn('customSections sync error', err));
}
function subscribeSection(sectionId){
  if(_subscribedSections.has(sectionId)) return;
  _subscribedSections.add(sectionId);
  RECORDS_CACHE[sectionId] = RECORDS_CACHE[sectionId] || [];
  qaCol('records_'+sectionId+'/items').onSnapshot(snap=>{
    const isFirstLoad = RECORDS_CACHE[sectionId].length === 0;
    const arr = []; snap.forEach(doc=> arr.push(doc.data()));
    RECORDS_CACHE[sectionId] = arr;
    
    if (_appBooted && !isFirstLoad) {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const rec = change.doc.data();
          // لا نظهر إشعار لو إحنا اللي ضفنا السجل (عشان showToast بيظهر أصلاً في saveRecord)
          if (rec.userId && rec.userId !== state.userId) {
            let msg = '';
            if (sectionId === 'containers') msg = esc(t(STR.newRecordNotify));
            else if (sectionId === 'trucks') msg = esc(t(STR.newTruckNotify));
            else if (sectionId === 'rebacking') msg = esc(t(STR.newRebackingNotify));
            else msg = (LANG === 'ar' ? 'سجل جديد في ' : 'New record in ') + sectionId;
            showToast(msg);
          }
        }
      });
    }
    
    if(_appBooted && !state.auth && state.view!=='form') scheduleRender();
  }, err=> console.warn('records sync error', sectionId, err));
}
function subscribeBuiltinExtensions(){
  db.collection('qa_app').doc('builtinExtensions').onSnapshot(snap=>{
    const d = snap.data() || {};
    BUILTIN_EXTENSIONS_CACHE.map = d;
    scheduleRender();
  }, err=> console.warn('builtinExtensions sync error', err));
}
function subscribeAllCoreData(){
  subscribeMeta();
  subscribeUsers();
  subscribeAccessLog();
  subscribeResetRequests();
  subscribeCustomSections();
  subscribeBuiltinExtensions();
  subscribeChat();
  BUILTIN_SECTIONS.forEach(s=> subscribeSection(s.id));
}

function subscribeChat() {
  qaCol('chatMessages/items').orderBy('time', 'asc').limitToLast(100).onSnapshot(snap => {
    const isFirstLoad = CHAT_CACHE.list.length === 0;
    CHAT_CACHE.list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (state.view === 'chat') scheduleRender();
    
    if (!isFirstLoad && state.view !== 'chat') {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          if (msg.userId !== state.userId) {
            showToast((LANG === 'ar' ? 'رسالة جديدة من ' : 'New message from ') + msg.userName);
          }
        }
      });
    }
  }, err => console.warn('Chat sync error', err));
}

function getCustomSections(){ return CUSTOM_SECTIONS_CACHE.list; }
function saveCustomSection(section){ return qaCol('customSections/items').doc(section.id).set(section); }
function addFieldToBuiltinSection(sectionId, field){
  const current = BUILTIN_EXTENSIONS_CACHE.map[sectionId] || [];
  const updated = [...current, field];
  return db.collection('qa_app').doc('builtinExtensions').set({[sectionId]: updated}, {merge:true});
}
function removeFieldFromBuiltinSection(sectionId, fieldKey){
  const current = BUILTIN_EXTENSIONS_CACHE.map[sectionId] || [];
  const updated = current.filter(f=>f.key!==fieldKey);
  return db.collection('qa_app').doc('builtinExtensions').set({[sectionId]: updated}, {merge:true});
}
function deleteCustomSectionRemote(sectionId){
  qaCol('customSections/items').doc(sectionId).delete();
  qaCol('records_'+sectionId+'/items').get().then(snap=> snap.forEach(doc=> doc.ref.delete()));
}
function getAllSections(){
  const builtinsWithExtras = BUILTIN_SECTIONS.map(s=>{
    const extra = BUILTIN_EXTENSIONS_CACHE.map[s.id];
    if(!extra || !extra.length) return s;
    return {...s, fields: [...s.fields, ...extra]};
  });
  return [...builtinsWithExtras, ...getCustomSections()];
}
function getSection(id){ return getAllSections().find(s=>s.id===id); }

/* ===================== Records storage ===================== */
function getRecords(sectionId){ return RECORDS_CACHE[sectionId] || []; }
function saveRecordRemote(sectionId, record){
  if(!record || !record.id) return Promise.reject(new Error('Invalid record'));
  const user = getCurrentUser();
  if (user) record.userId = user.id;
  return qaCol('records_'+sectionId+'/items').doc(record.id).set(record).catch(err=>{
    console.error('saveRecordRemote failed:', err);
    throw err;
  });
}
function deleteRecordRemote(sectionId, id){
  if(!id) return Promise.reject(new Error('Invalid id'));
  return qaCol('records_'+sectionId+'/items').doc(id).delete().catch(err=>{
    console.error('deleteRecordRemote failed:', err);
    throw err;
  });
}

/* ===================== Path get/set ===================== */
function getPath(obj, path){ return path.split('.').reduce((o,p)=> (o==null?undefined:o[p]), obj); }
function setPath(obj, path, value){
  const parts = path.split('.'); let cur = obj;
  for(let i=0;i<parts.length-1;i++){ const p = parts[i]; if(cur[p]===undefined || cur[p]===null) cur[p] = /^\d+$/.test(parts[i+1]) ? [] : {}; cur = cur[p]; }
  cur[parts[parts.length-1]] = value;
}

/* ===================== Default record builder ===================== */
function emptyValueFor(field){
  if(field.type==='group') return [];
  if(field.type==='multiDate') return [];
  if(field.type==='image') return [];
  return '';
}
function newRecord(section){
  const r = { id: uid(), _created: new Date().toISOString() };
  section.fields.forEach(f=>{ if(f.type!=='computed') r[f.key] = emptyValueFor(f); });
  return r;
}

/* ===================== Auth / User accounts ===================== */
/* ---- Automation / Auto-calculation ---- */
function updateAggregates(sectionId, record){
  if(sectionId==='containers'){
    const details = asArray(record.containerDetails);
    record.billQty = details.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0);
    record.totalNC = details.reduce((sum, item) => sum + (parseFloat(item.nc) || 0), 0);
    record.totalLoss = details.reduce((sum, item) => sum + (parseFloat(item.loss) || 0), 0);
    record.totalReback = details.reduce((sum, item) => sum + (parseFloat(item.reback) || 0), 0);
    record.containerCount = details.length;
  }
}

function getUsers(){ return USERS_CACHE.list; }
function saveUserRemote(user){ return qaCol('users/items').doc(user.id).set(user); }
function deleteUserRemote(userId){ return qaCol('users/items').doc(userId).delete(); }
function isAdminSetup(){ return !!META_CACHE.adminPasswordHash; }
function getMasterCode(){ return META_CACHE.masterCode || DEFAULT_MASTER_CODE; }
function saveMetaRemote(partial){ return db.collection('qa_app').doc('meta').set(partial, {merge:true}); }
function getCurrentUser(){
  const id = Store.get('qa_currentUserId', null);
  if(id==='__admin__') return {id:'__admin__', name: t(STR.roleAdmin), role:t(STR.roleAdmin), isAdmin:true, biometricCredId: META_CACHE.adminBiometricCredId};
  if(!id) return null;
  return getUsers().find(u=>u.id===id) || null;
}
function isAdmin(){ const u = getCurrentUser(); return !!(u && u.isAdmin); }
function adminLoginCount(){ return ACCESS_LOG_CACHE.list.filter(e=> e.type==='admin-login' || e.type==='admin-setup').length; }
function pushAccessLog(entry){ qaCol('accessLog/items').doc(uid()).set(entry).catch(err=>console.warn('log error',err)); }

function initAuthState(){
  const cur = getCurrentUser();
  if(!cur){ state.auth = {screen:'welcome'}; return; }
  const unlocked = sessionStorage.getItem('qa_unlocked')==='1';
  state.auth = unlocked ? null : {screen:'lock', targetUserId: cur.id};
}

/* ===================== Rendering ===================== */
const app = document.getElementById('app');

function render(){
  document.body.className = 'lang-'+LANG;
  document.documentElement.dir = LANG==='ar' ? 'rtl':'ltr';
  document.documentElement.lang = LANG;

  if(state.auth){ app.innerHTML = renderAuthGate(); return; }

  let html = renderHeader() + '<div class="container">';
  if(state.view==='home') html += renderHome();
  else if(state.view==='dashboard') html += renderDashboard();
  else if(state.view==='chat') html += renderChat();
  else if(state.view==='list') html += renderList(state.viewSectionId);
  else if(state.view==='form') html += renderForm(state.viewSectionId);
  else if(state.view==='detail') html += renderRecordDetail(state.detailSectionId, state.detailRecord);
  else if(state.view==='monthly') html += renderMonthly();
  else if(state.view==='files') html += renderFilesView();
  else if(state.view==='builder') html += renderBuilder();
  html += '</div>' + renderTabbar();
  app.innerHTML = html;
  hydrateAllImages();
}

function renderHeader(){
  const online = navigator.onLine;
  const user = getCurrentUser();
  return `
  <div class="app-header">
    <div class="header-top">
      <div class="brand">
        <div class="logo"><img src="${APP_ICON_URL}" alt="QA Supply Chain" ${IMAGE_FALLBACK_ATTR} style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div>
        <div class="titles">
          <h1>${esc(t(STR.appName))}</h1>
          <div class="sub">${user?esc(user.name):'QA Supply Chain'}</div>
        </div>
      </div>
      <div class="header-actions">
        <span class="status-pill ${online?'':'offline'}"><span class="status-dot"></span>${online?esc(t(STR.online)):esc(t(STR.offline))}</span>
        <button class="icon-btn" data-action="open-account-modal" title="${esc(t(STR.accessLog))}">🔑</button>
        <button class="icon-btn" data-action="toggle-lang" title="Lang">${LANG==='ar'?'EN':'ع'}</button>
      </div>
    </div>
    <div class="tagline-strip">${LANG==='ar'?'عمليات الجودة وسلسلة الإمداد':'Quality & Supply Chain Operations'}</div>
  </div>`;
}

const NAV_ICONS = {
  home: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v9a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1v-9"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="20" x2="5" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="19" y1="20" x2="19" y2="10"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  monthly: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>`,
  files: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>`,
  builder: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
};

const SECTION_ICONS = {
  containers:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>`,
  trucks:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h11v11H3z"/><path d="M14 9h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>`,
  rebacking:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8.1 8.1 0 00-15.5-2L3 12"/><path d="M3 7v5h5"/><path d="M4 13a8.1 8.1 0 0015.5 2L21 12"/><path d="M21 17v-5h-5"/></svg>`
};