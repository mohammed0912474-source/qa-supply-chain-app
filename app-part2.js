

/* ===================== CSV / Export ===================== */
function flattenRecordForExport(section, r){
  const out = {};
  section.fields.forEach(f=>{
    if(f.type==='group'){
      const arr = r[f.key]||[];
      out[t(f.label)] = arr.map((item,i)=>{
        const lines = f.fields.map(sf=>{
          const val = sf.type==='image' ? `${(item[sf.key]||[]).length} ${LANG==='ar'?'صورة':'photo(s)'}` : (item[sf.key]!=null ? item[sf.key] : '');
          return `${t(sf.label)}: ${val}`;
        });
        return `#${i+1}\n` + lines.join('\n');
      }).join('\n\n');
    } else if(f.type==='multiDate'){
      const arr = r[f.key]||[];
      out[t(f.label)] = arr.map(item=> `${item.prod||''} → ${item.exp||''}`).join('\n');
    } else if(f.type==='image'){
      out[t(f.label)] = (r[f.key]||[]).length + ' ' + (LANG==='ar'?'صورة':'photo(s)');
    } else if(f.type==='select'){
      const opt = (f.options||[]).find(o=>o.value===r[f.key]);
      out[t(f.label)] = opt ? t(opt.label) : (r[f.key]||'');
    } else if(f.type==='computed'){
      let v; try{ v = f.compute(r); }catch(e){ v=null; }
      out[t(f.label)] = (v==null||isNaN(v)) ? '' : v.toFixed(2)+'%';
    } else {
      out[t(f.label)] = r[f.key]!=null ? r[f.key] : '';
    }
  });
  return out;
}
function computeColumnWidths(flatRows){
  if(!flatRows.length) return [];
  const headers = Object.keys(flatRows[0]);
  return headers.map(h=>{
    let maxLen = h.length;
    flatRows.forEach(row=>{
      const v = row[h]==null ? '' : String(row[h]);
      v.split('\n').forEach(line=>{ if(line.length>maxLen) maxLen = line.length; });
    });
    return { wch: Math.min(Math.max(maxLen+2, 14), 45) };
  });
}

function toCSV(rowsObjArr){
  if(!rowsObjArr.length) return '';
  const headers = Object.keys(rowsObjArr[0]);
  const escCsv = v=> `"${String(v==null?'':v).replace(/"/g,'""')}"`;
  const lines = [headers.map(escCsv).join(',')];
  rowsObjArr.forEach(row=> lines.push(headers.map(h=>escCsv(row[h])).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}

function downloadFile(filename, content, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 500);
}

function exportSectionCSV(sectionId, filterFn, filenameOverride){
  const section = getSection(sectionId);
  let records = getRecords(sectionId);
  if(filterFn) records = records.filter(filterFn);
  const flat = records.map(r=> flattenRecordForExport(section, r));
  const csv = toCSV(flat);
  const filename = filenameOverride || `${section.id}_${todayISO()}.csv`;
  downloadFile(filename, csv, 'text/csv;charset=utf-8;');
  storeExportedFile(filename, 'csv', textToDataUrl(csv, 'text/csv;charset=utf-8'));
  showToast(t(STR.savedOk));
}

let _sheetJsLoading = null;
function loadSheetJS(){
  if(window.XLSX) return Promise.resolve(true);
  if(_sheetJsLoading) return _sheetJsLoading;
  _sheetJsLoading = loadScriptWithFallback([
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
  ]).then(()=> !!window.XLSX);
  return _sheetJsLoading;
}

async function exportSectionXLSX(sectionId, filterFn, filenameOverride){
  const section = getSection(sectionId);
  let records = getRecords(sectionId);
  if(filterFn) records = records.filter(filterFn);
  const flat = records.map(r=> flattenRecordForExport(section, r));
  const ok = await loadSheetJS();
  if(!ok || !window.XLSX){ exportSectionCSV(sectionId, filterFn); showToast(t(STR.xlsxOfflineFallback)); return; }
  const ws = XLSX.utils.json_to_sheet(flat);
  ws['!cols'] = computeColumnWidths(flat);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, section.id.slice(0,28));
  const filename = filenameOverride || `${section.id}_${todayISO()}.xlsx`;
  XLSX.writeFile(wb, filename);
  const base64 = XLSX.write(wb, {type:'base64', bookType:'xlsx'});
  storeExportedFile(filename, 'xlsx', 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+base64);
  showToast(t(STR.savedOk));
}

function safeSheetName(name, fallback){
  const cleaned = String(name||fallback||'Sheet').replace(/[\\/:?*\[\]]/g,' ').trim().slice(0,31);
  return cleaned || fallback || 'Sheet';
}
function styleMonthlySheet(ws, flat, title, period){
  const headers = flat.length ? Object.keys(flat[0]) : [LANG==='ar'?'لا توجد سجلات':'No records'];
  const data = flat.length ? flat : [{[headers[0]]:''}];
  XLSX.utils.sheet_add_aoa(ws, [[title],[LANG==='ar'?'الفترة':'Period', period],[LANG==='ar'?'تاريخ إنشاء الملف':'Generated', new Date().toISOString().slice(0,10)]], {origin:'A1'});
  XLSX.utils.sheet_add_json(ws, data, {origin:'A5', skipHeader:false});
  ws['!cols'] = computeColumnWidths(flat.length ? flat : data).map(c=>({wch:Math.min(Math.max(c.wch,14),42)}));
  ws['!freeze'] = {xSplit:0,ySplit:5};
  ws['!autofilter'] = {ref:`A5:${String.fromCharCode(64+Math.min(headers.length,26))}${5+data.length}`};
  ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:Math.max(0,headers.length-1)}}];
  return ws;
}
async function exportCombinedMonth(){
  const {month, year} = state.monthly;
  const prefix = `${year}-${String(month).padStart(2,'0')}`;
  const sections = getAllSections();
  const ok = await loadSheetJS();
  if(!ok || !window.XLSX){
    sections.forEach(s=> exportSectionCSV(s.id, r=> r.date && r.date.startsWith(prefix)));
    showToast(t(STR.xlsxOfflineFallback));
    return;
  }
  const wb = XLSX.utils.book_new();
  const summaryRows = sections.map(s=>{
    const recs = getRecords(s.id).filter(r=> r.date && r.date.startsWith(prefix));
    const numberFields = s.fields.filter(f=>f.type==='number');
    const totals = numberFields.map(f=>`${t(f.label)}: ${recs.reduce((a,r)=>a+(parseFloat(r[f.key])||0),0)}`).join(' | ');
    return { [LANG==='ar'?'القسم':'Section']:t(s.name), [LANG==='ar'?'عدد السجلات':'Records']:recs.length, [LANG==='ar'?'الإجماليات':'Totals']:totals||'—' };
  });
  const summary = XLSX.utils.aoa_to_sheet([[t(STR.appName)],[LANG==='ar'?'التقرير الشهري المؤسسي':'Monthly corporate operations report'],[LANG==='ar'?'الفترة':'Period',prefix],[LANG==='ar'?'تاريخ إنشاء الملف':'Generated',new Date().toISOString().slice(0,10)]]);
  XLSX.utils.sheet_add_json(summary, summaryRows, {origin:'A6', skipHeader:false});
  summary['!cols']=[{wch:28},{wch:14},{wch:60}]; summary['!freeze']={xSplit:0,ySplit:6}; summary['!autofilter']={ref:`A6:C${6+summaryRows.length}`}; summary['!merges']=[{s:{r:0,c:0},e:{r:0,c:2}},{s:{r:1,c:0},e:{r:1,c:2}}];
  XLSX.utils.book_append_sheet(wb, summary, safeSheetName(LANG==='ar'?'ملخص شهري':'Monthly Summary','Summary'));
  sections.forEach(s=>{
    const recs = getRecords(s.id).filter(r=> r.date && r.date.startsWith(prefix));
    const flat = recs.map(r=> flattenRecordForExport(s, r));
    const ws = styleMonthlySheet(XLSX.utils.aoa_to_sheet([]), flat, `${t(s.name)} — ${prefix}`, prefix);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(t(s.name), s.id));
  });
  const filename = `QA_SupplyChain_Monthly_${prefix}.xlsx`;
  XLSX.writeFile(wb, filename);
  const base64 = XLSX.write(wb, {type:'base64', bookType:'xlsx'});
  storeExportedFile(filename, 'xlsx', 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'+base64);
  notifyReportSaved(filename);
  showToast(t(STR.savedOk));
}
async function exportCombinedMonthPDF(){
  const {month, year} = state.monthly;
  const prefix = `${year}-${String(month).padStart(2,'0')}`;
  const sections = getAllSections();
  const blocks = [];
  for(const section of sections){
    const records = getRecords(section.id).filter(r=>r.date && r.date.startsWith(prefix));
    if(!records.length) continue;
    const imageMap = await buildImageMapForRecords(section, records).catch(()=>({}));
    blocks.push(`<div class="pf-sectiontitle">${esc(t(section.name))} <span>${records.length} ${LANG==='ar'?'سجل':'records'}</span></div>${records.map(r=>renderRecordPrintHtml(section,r,imageMap)).join('')}`);
  }
  if(!blocks.length){ showToast(t(STR.noRecords)); return; }
  showToast(t(STR.generatingPdf));
  const title = `${LANG==='ar'?'التقرير الشهري الموحد':'Combined monthly report'} — ${prefix}`;
  const html = buildCombinedReportHtml(title, blocks.join(''));
  const filename = `QA_SupplyChain_Monthly_${prefix}.pdf`;
  const libsOk = await loadPdfLibs().catch(()=>false);
  if(libsOk){ try{ await generatePdfBlobAndStore(html, filename); notifyReportSaved(filename); showToast(t(STR.savedOk)); return; }catch(err){ console.error('Combined PDF generation failed:',err); } }
  const printWindow = window.open('', '_blank');
  if(!printWindow){ showToast(t(STR.popupBlocked)); return; }
  writeAndPrintWindow(printWindow, html);
}


/* ===================== PDF export (native browser print, no external dependencies) ===================== */
function loadScriptWithFallback(urls){
  return new Promise((resolve)=>{
    let i = 0;
    function tryNext(){
      if(i >= urls.length){ resolve(false); return; }
      const s = document.createElement('script');
      s.src = urls[i];
      s.async = true;
      let settled = false;
      const timeout = setTimeout(()=>{ if(!settled){ settled=true; s.remove(); i++; tryNext(); } }, 8000);
      s.onload = ()=>{ if(!settled){ settled=true; clearTimeout(timeout); resolve(true); } };
      s.onerror = ()=>{ if(!settled){ settled=true; clearTimeout(timeout); s.remove(); i++; tryNext(); } };
      document.head.appendChild(s);
    }
    tryNext();
  });
}

function pdfFieldValue(f, record){
  const val = record[f.key];
  if(f.type==='select'){ const opt=(f.options||[]).find(o=>o.value===val); return opt? esc(t(opt.label)) : (val? esc(val):'—'); }
  if(f.type==='computed'){ let v; try{ v=f.compute(record); }catch(e){ v=null; } return (v==null||isNaN(v))?'—':(v.toFixed(2)+'%'); }
  if(f.type==='multiDate'){ const arr=val||[]; return arr.length? arr.map(i=>`${esc(i.prod||'')} → ${esc(i.exp||'')}`).join('<br>') : '—'; }
  if(f.type==='textarea') return val? esc(val).replace(/\n/g,'<br>') : '—';
  return (val==null || val==='') ? '—' : esc(val);
}

function asArray(v){ return Array.isArray(v) ? v : []; }

function collectImageIdsFromRecord(section, record){
  let ids = [];
  section.fields.forEach(f=>{
    if(f.type==='image'){ ids = ids.concat(asArray(record[f.key])); }
    if(f.type==='group'){
      asArray(record[f.key]).forEach(item=>{
        f.fields.forEach(sf=>{ if(sf.type==='image'){ ids = ids.concat(asArray(item[sf.key])); } });
      });
    }
  });
  return ids;
}
function collectImagePathsFromRecord(section, record){
  const results = [];
  section.fields.forEach(f=>{
    if(f.type==='image'){
      asArray(record[f.key]).forEach((id, idx)=> results.push({path:`${f.key}.${idx}`, id}));
    }
    if(f.type==='group'){
      asArray(record[f.key]).forEach((item, gi)=>{
        f.fields.forEach(sf=>{
          if(sf.type==='image'){
            asArray(item[sf.key]).forEach((id, idx)=> results.push({path:`${f.key}.${gi}.${sf.key}.${idx}`, id}));
          }
        });
      });
    }
  });
  return results;
}
let _retryingUploads = false;
async function retryPendingImageUploads(){
  if(_retryingUploads || !navigator.onLine) return;
  _retryingUploads = true;
  try{
    const sections = getAllSections();
    for(const section of sections){
      const records = getRecords(section.id).slice();
      for(const record of records){
        const pending = collectImagePathsFromRecord(section, record).filter(p=> !/^https?:\/\//.test(p.id));
        if(!pending.length) continue;
        let changed = false;
        for(const p of pending){
          const dataUrl = await getImage(p.id);
          if(!dataUrl) continue;
          const url = await uploadToImgBB(dataUrl);
          if(url){ setPath(record, p.path, url); changed = true; }
        }
        if(changed) await saveRecordRemote(section.id, record).catch(()=>{});
      }
    }
  } finally { _retryingUploads = false; }
}
async function buildImageMapForRecords(section, records){
  const allIds = new Set();
  records.forEach(r=> collectImageIdsFromRecord(section, r).forEach(id=>allIds.add(id)));
  const map = {};
  for(const id of allIds){
    map[id] = /^https?:\/\//.test(id) ? id : await getImage(id);
  }
  return map;
}

function renderRecordPrintHtml(section, record, imageMap){
  const plainFields = section.fields.filter(f=>f.type!=='group' && f.type!=='image');
  const rows = plainFields.map(f=> `<tr><td class="pf-label">${esc(t(f.label))}</td><td class="pf-value">${pdfFieldValue(f, record)}</td></tr>`).join('');

  const topImageFields = section.fields.filter(f=>f.type==='image');
  const topImages = topImageFields.map(f=>{
    const ids = Array.isArray(record[f.key]) ? record[f.key] : [];
    if(!ids.length) return '';
    const imgs = ids.map(id=> imageMap[id] ? `<img crossorigin="anonymous" src="${imageMap[id]}">` : '').join('');
    return `<div class="pf-imgblock"><div class="pf-imglabel">${esc(t(f.label))}</div><div class="pf-imggrid">${imgs}</div></div>`;
  }).join('');

  const groupFields = section.fields.filter(f=>f.type==='group');
  const groups = groupFields.map(f=>{
    const items = Array.isArray(record[f.key]) ? record[f.key] : [];
    if(!items.length) return '';
    const normalSub = f.fields.filter(sf=>sf.type!=='image');
    const imageSub = f.fields.filter(sf=>sf.type==='image');
    const itemsHtml = items.map((item,i)=>{
      const subRows = normalSub.map(sf=>{
        let val = item[sf.key];
        if(sf.type==='select'){ const opt=(sf.options||[]).find(o=>o.value===val); val = opt? t(opt.label): val; }
        return `<tr><td class="pf-label">${esc(t(sf.label))}</td><td class="pf-value">${val!=null && val!==''? esc(val):'—'}</td></tr>`;
      }).join('');
      const subImages = imageSub.map(sf=>{
        const ids = Array.isArray(item[sf.key]) ? item[sf.key] : [];
        if(!ids.length) return '';
        const imgs = ids.map(id=> imageMap[id]? `<img crossorigin="anonymous" src="${imageMap[id]}">`:'').join('');
        return `<div class="pf-imgblock"><div class="pf-imglabel">${esc(t(sf.label))}</div><div class="pf-imggrid">${imgs}</div></div>`;
      }).join('');
      return `<div class="pf-groupitem"><div class="pf-groupnum">#${i+1}</div><table class="pf-table">${subRows}</table>${subImages}</div>`;
    }).join('');
    return `<div class="pf-group"><div class="pf-grouptitle">${esc(t(f.label))}</div>${itemsHtml}</div>`;
  }).join('');

  return `<div class="pf-record">
    <div class="pf-recordheader">${section.icon} ${esc(t(section.name))} — ${esc(record.date||'')}</div>
    <table class="pf-table">${rows}</table>
    ${topImages}
    ${groups}
  </div>`;
}

function buildCombinedReportHtml(reportTitle, bodyBlocks){
  const dir = LANG==='ar' ? 'rtl':'ltr';
  return `<!DOCTYPE html><html dir="${dir}" lang="${LANG}"><head><meta charset="UTF-8"><title>${esc(reportTitle)}</title><style>*{box-sizing:border-box;}body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#152232;padding:16px;margin:0;background:#fff}.pf-cover{background:linear-gradient(135deg,#0B2A4A,#0E355C);color:#fff;padding:22px;border-radius:10px;margin-bottom:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.pf-cover h1{margin:0 0 6px;font-size:21px}.pf-cover .sub{font-size:12.5px;opacity:.85}.pf-sectiontitle{font-size:16px;font-weight:900;color:#0B2A4A;border-bottom:2px solid #2E7BD6;padding:8px 2px;margin:18px 0 10px}.pf-sectiontitle span{font-size:11px;color:#66768C;font-weight:600;margin-inline-start:8px}.pf-record{border:1px solid #DCE3EC;border-radius:10px;padding:16px;margin-bottom:16px;background:#fff;page-break-inside:avoid}.pf-recordheader{font-size:15px;font-weight:800;color:#0B2A4A;margin-bottom:10px;border-bottom:2px solid #2E7BD6;padding-bottom:6px}.pf-table{width:100%;border-collapse:collapse;margin-bottom:8px}.pf-table td{padding:6px 8px;border-bottom:1px solid #EEF2F7;font-size:12px;vertical-align:top}.pf-label{color:#66768C;font-weight:700;width:38%}.pf-value{color:#152232}.pf-imgblock{margin:8px 0}.pf-imglabel{font-size:11.5px;font-weight:700;color:#123A5E;margin-bottom:4px}.pf-imggrid{display:flex;flex-wrap:wrap;gap:8px}.pf-imggrid img{width:150px;height:150px;object-fit:cover;border-radius:6px;border:1px solid #DCE3EC}.pf-group{margin:10px 0;border-top:1px dashed #DCE3EC;padding-top:8px}.pf-grouptitle{font-weight:800;color:#0B2A4A;font-size:12.5px;margin-bottom:6px}.pf-groupitem{background:#FAFBFD;border:1px solid #EEF2F7;border-radius:8px;padding:8px;margin-bottom:8px}.pf-groupnum{font-size:11px;font-weight:700;color:#2E7BD6;margin-bottom:4px}@media print{body{padding:0}.pf-sectiontitle{page-break-after:avoid}}</style></head><body><div class="pf-cover"><h1>${esc(reportTitle)}</h1><div class="sub">${esc(t(STR.appName))} · ${new Date().toLocaleString(LANG==='ar'?'ar-EG':'en-GB')}</div></div>${bodyBlocks}</body></html>`;
}
function buildReportHtml(section, records, reportTitle, imageMap){
  const dir = LANG==='ar' ? 'rtl':'ltr';
  const bodyBlocks = records.map(r=> renderRecordPrintHtml(section, r, imageMap)).join('');
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${LANG}">
<head>
<meta charset="UTF-8">
<title>${esc(reportTitle)}</title>
<style>
  *{box-sizing:border-box;}
  body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#152232;padding:16px;margin:0;background:#fff;}
  .pf-cover{background:linear-gradient(135deg,#0B2A4A,#0E355C);color:#fff;padding:22px;border-radius:10px;margin-bottom:18px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  .pf-cover h1{margin:0 0 6px;font-size:21px;}
  .pf-cover .sub{font-size:12.5px;opacity:.85;}
  .pf-record{border:1px solid #DCE3EC;border-radius:10px;padding:16px;margin-bottom:16px;background:#fff;page-break-inside:avoid;}
  .pf-recordheader{font-size:15px;font-weight:800;color:#0B2A4A;margin-bottom:10px;border-bottom:2px solid #2E7BD6;padding-bottom:6px;}
  .pf-table{width:100%;border-collapse:collapse;margin-bottom:8px;}
  .pf-table td{padding:6px 8px;border-bottom:1px solid #EEF2F7;font-size:12px;vertical-align:top;}
  .pf-label{color:#66768C;font-weight:700;width:38%;}
  .pf-value{color:#152232;}
  .pf-imgblock{margin:8px 0;}
  .pf-imglabel{font-size:11.5px;font-weight:700;color:#123A5E;margin-bottom:4px;}
  .pf-imggrid{display:flex;flex-wrap:wrap;gap:8px;}
  .pf-imggrid img{width:150px;height:150px;object-fit:cover;border-radius:6px;border:1px solid #DCE3EC;}
  .pf-group{margin:10px 0;border-top:1px dashed #DCE3EC;padding-top:8px;}
  .pf-grouptitle{font-weight:800;color:#0B2A4A;font-size:12.5px;margin-bottom:6px;}
  .pf-groupitem{background:#FAFBFD;border:1px solid #EEF2F7;border-radius:8px;padding:8px;margin-bottom:8px;}
  .pf-groupnum{font-size:11px;font-weight:700;color:#2E7BD6;margin-bottom:4px;}
  @media print{ body{padding:0;} }
</style>
</head>
<body>
  <div class="pf-cover">
    <h1>${esc(reportTitle)}</h1>
    <div class="sub">${esc(t(STR.appName))} · ${new Date().toLocaleString(LANG==='ar'?'ar-EG':'en-GB')}</div>
  </div>
  ${bodyBlocks}
</body>
</html>`;
}

let _pdfLibsLoading = null;
function loadPdfLibs(){
  if(window.jspdf && window.html2canvas) return Promise.resolve(true);
  if(_pdfLibsLoading) return _pdfLibsLoading;
  _pdfLibsLoading = (async ()=>{
    if(!window.jspdf){
      await loadScriptWithFallback([
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
      ]);
    }
    if(!window.html2canvas){
      await loadScriptWithFallback([
        'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
        'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
      ]);
    }
    return !!(window.jspdf && window.html2canvas);
  })();
  return _pdfLibsLoading;
}

function writeAndPrintWindow(printWindow, htmlDocString){
  printWindow.document.open();
  printWindow.document.write(htmlDocString);
  printWindow.document.close();
  // Small delay to ensure styles and images are ready for printing
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

async function generatePdfBlobAndStore(htmlDocString, filename){
  const container = document.createElement('iframe');
  container.style.position='fixed'; container.style.left='-9999px'; container.style.top='0';
    container.style.width='800px'; container.style.height='10000px'; container.style.border='none';
    container.style.visibility='visible'; container.style.opacity='0'; container.style.pointerEvents='none';
  document.body.appendChild(container);
  try{
    container.srcdoc = htmlDocString;
    await new Promise(res=>{ 
      let loaded = false;
      container.onload = () => { loaded = true; res(); };
      setTimeout(() => { if(!loaded) res(); }, 3000);
    });
    const doc = container.contentDocument;
    if(!doc) throw new Error('Failed to access iframe document');
    const body = doc.body;
    if(!body) throw new Error('Failed to access iframe body');
    
    const imgs = Array.from(body.querySelectorAll('img'));
    await Promise.all(imgs.map(img=>{
      if(img.complete) return img.decode ? img.decode().catch(()=>{}) : Promise.resolve();
      return new Promise(res=>{ img.onload=res; img.onerror=res; setTimeout(res, 5000); });
    }));
    await new Promise(res=>setTimeout(res, 500));
    container.style.height = Math.max(1000, Math.min(30000, body.scrollHeight + 40)) + 'px';

    const canvas = await window.html2canvas(body, {scale:2, useCORS:true, backgroundColor:'#ffffff', windowWidth:800, allowTaint:true, logging:false, letterRendering:true, useCORS:true, imageTimeout:15000});
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.85);

    let heightLeft = imgHeight, position = 0;
    pdf.addImage(imgData, 'JPEG', 10, position + 10, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while(heightLeft > 0){
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 10, position + 10, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    const dataUri = pdf.output('datauristring');
    pdf.save(filename);
    await storeExportedFile(filename, 'pdf', dataUri);
    return true;
  } finally {
    document.body.removeChild(container);
  }
}

async function generateOrViewReport(records, section, title, filename){
  if(!records.length){ showToast(t(STR.noRecords)); return; }
  showToast(t(STR.generatingPdf));
  const libsOk = await loadPdfLibs().catch(()=>false);
  const imageMap = await buildImageMapForRecords(section, records).catch(()=>({}));
  const html = buildReportHtml(section, records, title, imageMap);
  if(libsOk){
    try{
      await generatePdfBlobAndStore(html, filename);
      showToast(t(STR.savedOk));
      notifyReportSaved(filename);
      return;
    }catch(err){
      console.error('PDF generation failed, falling back to print view', err);
    }
  }
  /* لو تعذر تحميل أداة الـ PDF أو فشلت، نفتح معاينة في نافذة جديدة كخطة بديلة مضمونة */
  const printWindow = window.open('', '_blank');
  if(!printWindow){ showToast(t(STR.popupBlocked)); return; }
  writeAndPrintWindow(printWindow, html);
}

async function notifyReportSaved(filename){
  if(!('Notification' in window)) return;
  let permission = Notification.permission;
  if(permission === 'default'){
    try{ permission = await Notification.requestPermission(); }
    catch(e){ permission = 'denied'; }
  }
  if(permission !== 'granted'){
    showToast(t(STR.notificationBlocked));
    return;
  }
  const options = { body:`${t(STR.reportReadyBody)} ${filename||''}`.trim(), icon:'icon-192.png', badge:'icon-192.png', tag:'qa-report-ready', renotify:true, silent:false, vibrate:[120,60,120] };
  try{
    if('serviceWorker' in navigator){
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(t(STR.reportReadyTitle), options);
    }else{
      new Notification(t(STR.reportReadyTitle), options);
    }
  }catch(err){ console.warn('Report notification failed', err); }
}

async function shareRecordAsPDF(sectionId, recordId){
  const section = getSection(sectionId);
  const record = getRecords(sectionId).find(r=>r.id===recordId);
  if(!section || !record) return;
  await generateOrViewReport([record], section, `${t(section.name)} — ${record.date||''}`, `${section.id}_${record.date||todayISO()}.pdf`);
}

async function shareDailyPDF(sectionId, dateStr){
  const section = getSection(sectionId);
  const records = getRecords(sectionId).filter(r=>r.date===dateStr);
  await generateOrViewReport(records, section, `${t(section.name)} — ${LANG==='ar'?'تقرير يوم':'Daily report'} ${dateStr}`, `${section.id}_daily_${dateStr}.pdf`);
}

async function shareFilteredPDF(sectionId){
  const section = getSection(sectionId);
  const records = getFilteredRecords(sectionId);
  const title = `${t(section.name)} — ${LANG==='ar'?'نتائج مفلترة':'Filtered results'} (${records.length})`;
  await generateOrViewReport(records, section, title, `${section.id}_filtered_${todayISO()}.pdf`);
}

async function shareMonthlyPDF(sectionId, year, month){
  const section = getSection(sectionId);
  const prefix = `${year}-${String(month).padStart(2,'0')}`;
  const records = getRecords(sectionId).filter(r=>r.date && r.date.startsWith(prefix));
  await generateOrViewReport(records, section, `${t(section.name)} — ${LANG==='ar'?'تقرير شهر':'Monthly report'} ${month}/${year}`, `${section.id}_monthly_${prefix}.pdf`);
}

/* ===================== Toast ===================== */
function showToast(msg, duration){
  const el = document.createElement('div'); el.className='toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(()=> el.remove(), duration||2400);
}

/* ===================== Auth screens ===================== */
function renderAuthGate(){
  const s = state.auth.screen;
  let inner = '';
  if(s==='welcome') inner = renderWelcomeScreen();
  else if(s==='accessCode') inner = renderAccessCodeScreen();
  else if(s==='register') inner = renderRegisterScreen();
  else if(s==='adminSetup') inner = renderAdminSetupScreen();
  else if(s==='adminLogin') inner = renderAdminLoginScreen();
  else if(s==='findAccount') inner = renderFindAccountScreen();
  else if(s==='lock') inner = renderLockScreen();
  return `
  <div class="app-header">
    <div class="header-top">
      <div class="brand"><div class="logo"><img src="${APP_ICON_URL}" alt="QA Supply Chain" ${IMAGE_FALLBACK_ATTR} style="width:100%;height:100%;object-fit:cover;border-radius:8px;"></div><div class="titles"><h1>${esc(t(STR.appName))}</h1><div class="sub">QA Supply Chain</div></div></div>
      <div class="header-actions"><button class="icon-btn" data-action="toggle-lang" title="Lang">${LANG==='ar'?'EN':'ع'}</button></div>
    </div>
    <div class="tagline-strip">${LANG==='ar'?'عمليات الجودة وسلسلة الإمداد':'Quality & Supply Chain Operations'}</div>
  </div>
  <div class="container"><div class="auth-screen" style="background-image:url('${AUTH_HEROES[getAuthHeroIndex()]}');"><div class="auth-box">${inner}</div></div></div>`;
}

function getDeviceKnownUserIds(){ return Store.get('qa_deviceKnownUsers', []); }
function markUserKnownOnThisDevice(userId){
  if(!userId || userId==='__admin__') return;
  const known = getDeviceKnownUserIds();
  if(!known.includes(userId)){ known.push(userId); Store.set('qa_deviceKnownUsers', known); }
}

function renderWelcomeScreen(){
  const knownIds = getDeviceKnownUserIds();
  const users = getUsers().filter(u=>knownIds.includes(u.id));
  const chips = users.map(u=>`
    <button class="user-chip" data-action="auth-pick-user" data-id="${u.id}">
      <div style="display:flex;align-items:center;">
        ${u.profilePic ? `<img src="${u.profilePic}" class="profile-pic-chip">` : `<div class="profile-pic-chip" style="background:var(--border);display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>`}
        <div><div class="nm">${esc(u.name)}</div><div class="rl">${esc(u.role)}</div></div>
      </div>
      <span>➡️</span>
    </button>`).join('');
  return `
  <div class="auth-logo"><img src="${APP_ICON_URL}" alt="QA Supply Chain" ${IMAGE_FALLBACK_ATTR}></div>
  <div class="auth-title">${esc(t(STR.welcomeTitle))}</div>
  <div class="auth-welcome-quote">${esc(getAuthWelcomeMessage())}</div>
  <div class="auth-sub">${esc(t(STR.welcomeSub))}</div>
  ${users.length? `<div class="hint" style="margin-bottom:8px;">${esc(t(STR.whoAreYou))}</div>${chips}`:''}
  <div class="auth-divider">${LANG==='ar'?'أو':'or'}</div>
  <button class="btn btn-outline btn-block" style="margin-bottom:8px;" data-action="auth-goto" data-screen="findAccount">${esc(t(STR.existingUserNewDevice))}</button>
  <button class="btn btn-primary btn-block" data-action="auth-goto" data-screen="accessCode">${esc(t(STR.newUserBtn))}</button>
  <div style="text-align:center;margin-top:16px;">
    <button class="link-btn" data-action="auth-goto-admin">${esc(t(STR.adminEntry))}</button>
  </div>`;
}

function renderFindAccountScreen(){
  return `
  <div class="auth-title">🔎 ${esc(t(STR.findAccountTitle))}</div>
  <div class="auth-sub">${esc(t(STR.findAccountSub))}</div>
  <div class="field"><label>${esc(t(STR.name))}</label><input type="text" id="findAccountName" autocomplete="off" value="${esc(state.formTemp.findAccountName||'')}"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px;" data-action="auth-find-account">${esc(t(STR.continue))}</button>
  <div style="text-align:center;margin-top:14px;"><button class="link-btn" data-action="auth-goto" data-screen="welcome">${esc(t(STR.cancel))}</button></div>`;
}

function renderAccessCodeScreen(){
  return `
  <div class="auth-title">🔑 ${esc(t(STR.accessCodeTitle))}</div>
  <div class="auth-sub">${esc(t(STR.accessCodeSub))}</div>
  <div class="field"><label>${esc(t(STR.accessCodeLabel))}</label><input type="text" id="accessCodeInput" autocomplete="off" value="${esc(state.formTemp.accessCodeInput||'')}"></div>
  <button class="btn btn-primary btn-block" style="margin-top:14px;" data-action="auth-submit-accesscode">${esc(t(STR.continue))}</button>
  <div style="text-align:center;margin-top:14px;"><button class="link-btn" data-action="auth-goto" data-screen="welcome">${esc(t(STR.cancel))}</button></div>`;
}

function renderRegisterScreen(){
  const bio = state.regTempBiometric;
  return `
  <div class="auth-title">📝 ${esc(t(STR.registerTitle))}</div>
  <div class="auth-sub">${esc(t(STR.registerSub))}</div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.name))}</label><input type="text" id="regName" value="${esc(state.formTemp.regName||'')}"></div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.role))}</label>
    <select id="regRole">${ROLE_OPTIONS.map(r=>`<option value="${esc(r.v)}" ${(state.formTemp.regRole||ROLE_OPTIONS[0].v)===r.v?'selected':''}>${esc(t(r.l))}</option>`).join('')}</select>
  </div>
  <div class="field" style="margin-bottom:10px;"><label>${LANG==='ar'?'رقم الهاتف':'Phone number'}</label><input type="tel" id="regPhone" value="${esc(state.formTemp.regPhone||'')}" autocomplete="tel"></div>
  <div class="field" style="margin-bottom:10px;"><label>${LANG==='ar'?'البريد الإلكتروني':'Email address'}</label><input type="email" id="regEmail" value="${esc(state.formTemp.regEmail||'')}" autocomplete="email"></div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.profilePic))}</label>
    <div style="display:flex; align-items:center; gap:10px;">
      <div id="regPicPreview" style="width:50px; height:50px; border-radius:50%; background:#eee; overflow:hidden; border:1px solid var(--border); display:flex; align-items:center; justify-content:center;">
        ${state.regTempPic ? `<img src="${state.regTempPic}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
      </div>
      <label class="file-btn"><input type="file" accept="image/*" data-action="auth-upload-pic">📷 ${esc(t(STR.uploadPhoto))}</label>
    </div>
  </div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.choosePassword))}</label><input type="password" id="regPass" value="${esc(state.formTemp.regPass||'')}"></div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.confirmPassword))}</label><input type="password" id="regPass2" value="${esc(state.formTemp.regPass2||'')}"></div>
  <button class="btn btn-outline btn-block" style="margin-bottom:6px;" data-action="auth-register-biometric">${bio? esc(t(STR.biometricEnabled)) : esc(t(STR.enableBiometric))}</button>
  <button class="btn btn-primary btn-block" style="margin-top:8px;" data-action="auth-submit-register">${esc(t(STR.createAccount))}</button>
  <div style="text-align:center;margin-top:14px;"><button class="link-btn" data-action="auth-goto" data-screen="welcome">${esc(t(STR.cancel))}</button></div>`;
}

function renderAdminSetupScreen(){
  return `
  <div class="auth-title">🛡️ ${esc(t(STR.adminSetupTitle))}</div>
  <div class="auth-sub">${esc(t(STR.adminSetupSub))}</div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.adminPasswordLabel))}</label><input type="password" id="adminPass" value="${esc(state.formTemp.adminPass||'')}"></div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.confirmPassword))}</label><input type="password" id="adminPass2" value="${esc(state.formTemp.adminPass2||'')}"></div>
  <button class="btn btn-primary btn-block" style="margin-top:8px;" data-action="auth-submit-adminsetup">${esc(t(STR.saveAndEnter))}</button>
  <div style="text-align:center;margin-top:14px;"><button class="link-btn" data-action="auth-goto" data-screen="welcome">${esc(t(STR.cancel))}</button></div>`;
}

function renderAdminLoginScreen(){
  return `
  <div class="auth-title">🛡️ ${esc(t(STR.adminLoginTitle))}</div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.adminPasswordLabel))}</label><input type="password" id="adminLoginPass" value="${esc(state.formTemp.adminLoginPass||'')}"></div>
  <button class="btn btn-primary btn-block" data-action="auth-submit-adminlogin">${esc(t(STR.unlockBtn))}</button>
  <div style="text-align:center;margin-top:14px;"><button class="link-btn" data-action="auth-goto" data-screen="welcome">${esc(t(STR.cancel))}</button></div>`;
}

function renderLockScreen(){
  const targetId = state.auth.targetUserId;
  const isAdminTarget = targetId==='__admin__';
  const user = isAdminTarget ? {name:t(STR.roleAdmin), biometricCredId: META_CACHE.adminBiometricCredId} : getUsers().find(u=>u.id===targetId);
  if(!user) return renderWelcomeScreen();
  return `
  <div class="auth-logo"><img src="${APP_ICON_URL}" alt="QA Supply Chain" ${IMAGE_FALLBACK_ATTR}></div>
  <div class="auth-title">${esc(t(STR.lockWelcomeBack))}</div>
  <div class="auth-welcome-quote">${esc(getAuthWelcomeMessage())}</div>
  <div class="auth-sub">${esc(user.name)}</div>
  <div class="field" style="margin-bottom:10px;"><label>${esc(t(STR.enterPassword))}</label><input type="password" id="lockPass" value="${esc(state.formTemp.lockPass||'')}"></div>
  <button class="btn btn-primary btn-block" data-action="auth-unlock-password">${esc(t(STR.unlockBtn))}</button>
  ${user.biometricCredId? `<button class="btn btn-outline btn-block" style="margin-top:8px;" data-action="auth-unlock-biometric">${esc(t(STR.unlockBiometricBtn))}</button>`:''}
  ${!isAdminTarget? `<div style="text-align:center;margin-top:12px;"><button class="link-btn" data-action="auth-request-reset">${esc(t(STR.forgotPassword))}</button></div>`:''}
  <div style="text-align:center;margin-top:10px;"><button class="link-btn" data-action="auth-switch">${esc(t(STR.switchAccount))}</button></div>`;
}

function showAccountModal(){
  const user = getCurrentUser();
  const overlay = document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal-box">
    <h3>👤 ${esc(t(STR.accessLog))}</h3>
    <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px;">
      <div style="width:80px; height:80px; border-radius:50%; background:#eee; overflow:hidden; border:2px solid var(--accent); margin-bottom:10px; display:flex; align-items:center; justify-content:center; font-size:32px;">
        ${user && user.profilePic ? `<img src="${user.profilePic}" style="width:100%;height:100%;object-fit:cover;">` : '👤'}
      </div>
      <label class="file-btn" style="font-size:12px; padding:6px 12px;"><input type="file" accept="image/*" data-action="auth-update-profile-pic">📷 ${esc(t(STR.changePic))}</label>
    </div>
    <div class="record-card"><div class="main">${esc(t(STR.loggedInAs))}: ${esc(user?user.name:'')}</div><div class="meta">${esc(user?(user.role||''):'')}</div><div class="meta">${LANG==='ar'?'رقم الهاتف':'Phone'}: ${esc(user?(user.phone||'—'):'—')}</div><div class="meta">${LANG==='ar'?'البريد الإلكتروني':'Email'}: ${esc(user?(user.email||'—'):'—')}</div></div>
    <div class="field" style="margin-top:12px;"><label>${LANG==='ar'?'اسم المستخدم':'Username'}</label><input type="text" id="profileName" value="${esc(user?user.name:'')}"></div>
    <div class="field"><label>${LANG==='ar'?'رقم الهاتف':'Phone number'}</label><input type="tel" id="profilePhone" value="${esc(user?(user.phone||''):'')}" autocomplete="tel"></div>
    <div class="field"><label>${LANG==='ar'?'البريد الإلكتروني':'Email address'}</label><input type="email" id="profileEmail" value="${esc(user?(user.email||''):'')}" autocomplete="email"></div>
    <button class="btn btn-primary btn-block" style="margin-top:10px;" data-action="auth-save-profile">${LANG==='ar'?'حفظ الملف الشخصي':'Save profile'}</button>
    <button class="btn btn-danger btn-block" style="margin-top:10px;" data-action="auth-logout">${esc(t(STR.logout))}</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" data-action="close-modal">${esc(t(STR.cancel))}</button>
  </div>`;
  document.body.appendChild(overlay);
}

function showResetPasswordModal(userId, reqId, name){
  const overlay = document.createElement('div'); overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal-box">
    <h3>🔓 ${esc(t(STR.setNewPasswordTitle))} ${esc(name)}</h3>
    <div class="field"><input type="text" id="newPassForUser" placeholder="${esc(t(STR.setNewPasswordPlaceholder))}"></div>
    <button class="btn btn-primary btn-block" style="margin-top:10px;" data-action="confirm-reset-password" data-userid="${userId}" data-reqid="${reqId}">${esc(t(STR.resetPasswordAction))}</button>
    <button class="btn btn-outline btn-block" style="margin-top:8px;" data-action="close-modal">${esc(t(STR.cancel))}</button>
  </div>`;
  document.body.appendChild(overlay);
}

/* ===================== Event handling ===================== */
document.addEventListener('input', e=>{
  const el = e.target;
  if(el.id){ state.formTemp[el.id] = el.value; }
  const path = el.getAttribute('data-field');
  if(path && state.currentRecord){
    setPath(state.currentRecord, path, el.value);
    const section = getSection(state.viewSectionId);
    if(section) updateComputedDisplays(section);
    scheduleDraftSave(state.viewSectionId);
  }
  const filterSection = el.getAttribute('data-section-filter');
  if(filterSection){
    setSectionFilter(filterSection, el.getAttribute('data-filter-key'), el.value);
    refreshSectionFilterPreview(filterSection);
    return;
  }
  const bf = el.getAttribute('data-builder-field');
  if(bf){
    const idx = parseInt(el.getAttribute('data-index'),10);
    if(bf==='labelAr') state.builderFields[idx].labelAr = el.value;
    if(bf==='labelEn') state.builderFields[idx].labelEn = el.value;
    if(bf==='options') state.builderFields[idx].optionsCsv = el.value;
  }
  if(el.getAttribute('data-action')==='filter-search'){ state.search = el.value; render(); }
});

document.addEventListener('change', e=>{
  const el = e.target;
  if(el.id){ state.formTemp[el.id] = el.value; }
  const path = el.getAttribute('data-field');
  if(path && el.tagName==='SELECT' && state.currentRecord){
    setPath(state.currentRecord, path, el.value);
    const section = getSection(state.viewSectionId);
    if(section) updateComputedDisplays(section);
    scheduleDraftSave(state.viewSectionId);
  }
  const filterSection = el.getAttribute('data-section-filter');
  if(filterSection){
    setSectionFilter(filterSection, el.getAttribute('data-filter-key'), el.value);
    refreshSectionFilterPreview(filterSection);
    return;
  }
  const bf = el.getAttribute('data-builder-field');
  if(bf==='type'){ const idx = parseInt(el.getAttribute('data-index'),10); state.builderFields[idx].type = el.value; render(); }

  if(el.getAttribute('data-action')==='auth-upload-pic'){
    const file = el.files[0];
    if(!file) return;
    showToast(t(STR.addingPhotos));
    uploadProfilePicture(file).then(url => {
      state.regTempPic = url;
      render();
      showToast(t(STR.photosAdded));
    }).catch(() => showToast(t(STR.profilePhotoInvalid)));
    return;
  }
  if(el.getAttribute('data-action')==='add-image'){
    const path = el.getAttribute('data-field');
    const files = Array.from(el.files||[]);
    if(!files.length) return;
    
    const recordRef = state.currentRecord;
    const sectionIdRef = state.viewSectionId;
    let remaining = files.length;
    let successCount = 0;
    
    showToast(t(STR.addingPhotos));
    
    files.forEach((file, fileIdx) => {
      if(file.size > 50 * 1024 * 1024) {
        console.warn(`File ${fileIdx} too large: ${file.size} bytes`);
        remaining--;
        if(remaining === 0) { render(); showToast(t(STR.photosAdded)); }
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await compressImageDataUrl(reader.result, 1600, 0.82);
          if(!compressed) throw new Error('Compression failed');
          
          const tempId = uid();
          await saveImage(tempId, compressed);
          
          const arr = getPath(recordRef, path) || [];
          arr.push(tempId);
          setPath(recordRef, path, arr);
          successCount++;
          scheduleDraftSave(sectionIdRef);
          
          remaining--;
          if(remaining === 0) { 
            render(); 
            showToast(successCount === files.length ? t(STR.photosAdded) : `${successCount}/${files.length} ${t(STR.photosAdded)}`);
          }

          /* رفع في الخلفية لخدمة ImgBB عشان الصورة تظهر لكل الأفراد */
          (async () => {
            try {
              const url = await uploadToImgBB(compressed);
              if(!url) {
                console.warn(`Failed to upload image ${fileIdx} to ImgBB`);
                return;
              }
              const arr2 = getPath(recordRef, path) || [];
              const idx = arr2.indexOf(tempId);
              if(idx === -1) return;
              arr2[idx] = url;
              setPath(recordRef, path, arr2);
              scheduleDraftSave(sectionIdRef);
              const imgEl = document.querySelector(`img[data-imgid="${tempId}"]`);
              if(imgEl) { 
                imgEl.src = url; 
                imgEl.setAttribute('data-imgid', url); 
              }
              if(recordRef && recordRef.id) { 
                await saveRecordRemote(sectionIdRef, recordRef).catch(err => console.warn('Save after upload failed:', err)); 
              }
            } catch(uploadErr) {
              console.warn(`Upload error for image ${fileIdx}:`, uploadErr);
            }
          })();
        } catch(err) {
          console.error('add-image processing failed:', err);
          showToast(t(STR.imageSaveFailed));
          remaining--;
          if(remaining === 0) render();
        }
      };
      reader.onerror = (err) => {
        console.error('file read failed:', err);
        showToast(t(STR.imageSaveFailed));
        remaining--;
        if(remaining === 0) render();
      };
      reader.readAsDataURL(file);
    });
  }
  if(el.getAttribute('data-action')==='filter-from'){ state.dateFrom = el.value; render(); }
  if(el.getAttribute('data-action')==='filter-to'){ state.dateTo = el.value; render(); }
  if(el.getAttribute('data-action')==='monthly-month'){ state.monthly.month = parseInt(el.value,10); render(); }
  if(el.getAttribute('data-action')==='monthly-year'){ state.monthly.year = parseInt(el.value,10); render(); }
  if(el.getAttribute('data-action')==='dashboard-trend-metric'){ state.dashboardTrendMetric = el.value; render(); }
  if(el.getAttribute('data-action')==='dashboard-trend-months'){ state.dashboardTrendMonths = parseInt(el.value,10); render(); }
});

document.addEventListener('click', e=>{
  const el = e.target.closest('[data-action]');
  if(!el) return;
  const action = el.getAttribute('data-action');

  /* ---- Chat actions ---- */
  if(action==='send-chat'){
    const input = document.getElementById('chatInput');
    const text = (input.value||'').trim();
    if(!text) return;
    const user = getCurrentUser();
    qaCol('chatMessages/items').doc(uid()).set({
      userId: user.id,
      userName: user.name,
      text: text,
      time: new Date().toISOString()
    }).then(() => {
      input.value = '';
    }).catch(err => {
      console.warn('Send chat error', err);
      showToast(LANG==='ar'?'فشل الإرسال':'Failed to send');
    });
    return;
  }

  /* ---- Auth actions ---- */
  if(action==='auth-goto'){
    const screen = el.getAttribute('data-screen');
    if(screen==='welcome') state.formTemp = {};
    state.auth = {screen}; render(); return;
  }
  if(action==='auth-goto-admin'){ state.auth = {screen: isAdminSetup() ? 'adminLogin' : 'adminSetup'}; render(); return; }
  if(action==='auth-pick-user'){ state.auth = {screen:'lock', targetUserId: el.getAttribute('data-id')}; render(); return; }
  if(action==='auth-find-account'){
    const name = (document.getElementById('findAccountName').value||'').trim();
    if(!name){ showToast(t(STR.requiredMissing)); return; }
    const found = getUsers().find(u=> (u.name||'').trim().toLowerCase() === name.toLowerCase());
    if(!found){ showToast(t(STR.accountNotFound)); return; }
    state.auth = {screen:'lock', targetUserId: found.id};
    render();
    return;
  }
  if(action==='auth-switch'){ state.auth = {screen:'welcome'}; render(); return; }
  if(action==='auth-save-profile'){
    const user = getCurrentUser();
    if(!user) return;
    const name = (document.getElementById('profileName').value||'').trim();
    const phone = (document.getElementById('profilePhone').value||'').trim();
    const email = (document.getElementById('profileEmail').value||'').trim();
    if(!name){ showToast(t(STR.requiredMissing)); return; }
    user.name = name; user.phone = phone; user.email = email;
    saveUserRemote(user).then(()=>{ render(); showToast(t(STR.savedOk)); }).catch(()=> showToast(LANG==='ar'?'تعذر حفظ الملف الشخصي':'Could not save profile'));
    return;
  }
  if(action==='auth-update-profile-pic'){
    const file = el.files[0];
    if(!file) return;
    showToast(t(STR.addingPhotos));
    uploadProfilePicture(file).then(url => {
      const user = getCurrentUser();
      if(user){
        user.profilePic = url;
        return saveUserRemote(user).then(()=>{
          render();
          showToast(t(STR.photosAdded));
        });
      }
    }).catch(() => showToast(t(STR.profilePhotoInvalid)));
    return;
  }
  if(action==='auth-request-reset'){
    const targetId = state.auth.targetUserId;
    const u = getUsers().find(x=>x.id===targetId);
    if(!u) return;
    qaCol('passwordResetRequests/items').doc(uid()).set({userId:u.id, name:u.name, time:new Date().toISOString()})
      .then(()=> showToast(t(STR.resetRequestSent)))
      .catch(err=> console.warn('reset request error', err));
    return;
  }

  if(action==='auth-submit-accesscode'){
    const val = (document.getElementById('accessCodeInput').value||'').trim();
    if(val !== getMasterCode()){ showToast(t(STR.accessCodeWrong)); return; }
    state.regTempBiometric = null;
    state.auth = {screen:'register'};
    render();
    return;
  }

  if(action==='auth-register-biometric'){
    (async ()=>{
      const nameField = document.getElementById('regName');
      const label = (nameField && nameField.value.trim()) || 'user';
      const available = await biometricAvailable();
      if(!available){ showToast(t(STR.biometricNotAvailable)); return; }
      const credId = await registerBiometric(label);
      if(credId){ state.regTempBiometric = credId; render(); } else { showToast(t(STR.biometricNotAvailable)); }
    })();
    return;
  }

  if(action==='auth-submit-register'){
    (async ()=>{
      const name = (document.getElementById('regName').value||'').trim();
      const role = document.getElementById('regRole').value;
      const phone = (document.getElementById('regPhone').value||'').trim();
      const email = (document.getElementById('regEmail').value||'').trim();
      const pass = document.getElementById('regPass').value;
      const pass2 = document.getElementById('regPass2').value;
      if(!name){ showToast(t(STR.requiredMissing)); return; }
      if(pass.length<4){ showToast(t(STR.passwordTooShort)); return; }
      if(pass!==pass2){ showToast(t(STR.passwordMismatch)); return; }
      const passwordHash = await sha256Hex(pass);
      const user = { 
        id:uid(), name, role, phone, email, passwordHash, 
        biometricCredId: state.regTempBiometric||null, 
        profilePic: state.regTempPic || null,
        createdAt:new Date().toISOString() 
      };
      await saveUserRemote(user);
      Store.set('qa_currentUserId', user.id);
      markUserKnownOnThisDevice(user.id);
      pushAccessLog({name, role, time:new Date().toISOString(), type:'register'});
      sessionStorage.setItem('qa_unlocked','1');
      state.regTempBiometric = null; state.regTempPic = null; state.auth = null; state.view='home'; state.formTemp = {};
      showToast(t(STR.savedOk)); render();
    })();
    return;
  }

  if(action==='auth-submit-adminsetup'){
    (async ()=>{
      const p1 = document.getElementById('adminPass').value;
      const p2 = document.getElementById('adminPass2').value;
      if(p1.length<6){ showToast(t(STR.passwordTooShort)); return; }
      if(p1!==p2){ showToast(t(STR.passwordMismatch)); return; }
      const hash = await sha256Hex(p1);
      await saveMetaRemote({adminPasswordHash: hash});
      Store.set('qa_currentUserId', '__admin__');
      pushAccessLog({name:t(STR.roleAdmin), role:t(STR.roleAdmin), time:new Date().toISOString(), type:'admin-setup'});
      sessionStorage.setItem('qa_unlocked','1');
      state.auth = null; state.view='home'; state.formTemp = {};
      showToast(t(STR.savedOk)); render();
    })();
    return;
  }

  if(action==='auth-submit-adminlogin'){
    (async ()=>{
      const p = document.getElementById('adminLoginPass').value;
      const hash = await sha256Hex(p);
      if(hash !== META_CACHE.adminPasswordHash){ showToast(t(STR.wrongPassword)); return; }
      Store.set('qa_currentUserId', '__admin__');
      pushAccessLog({name:t(STR.roleAdmin), role:t(STR.roleAdmin), time:new Date().toISOString(), type:'admin-login'});
      sessionStorage.setItem('qa_unlocked','1');
      state.auth = null; state.view='home'; state.formTemp = {};
      render();
    })();
    return;
  }

  if(action==='auth-unlock-password'){
    (async ()=>{
      const targetId = state.auth.targetUserId;
      const p = document.getElementById('lockPass').value;
      const hash = await sha256Hex(p);
      let ok=false, name='', role='';
      if(targetId==='__admin__'){ ok = hash===META_CACHE.adminPasswordHash; name=t(STR.roleAdmin); role=t(STR.roleAdmin); }
      else { const u = getUsers().find(x=>x.id===targetId); if(u){ ok = hash===u.passwordHash; name=u.name; role=u.role; } }
      if(!ok){ showToast(t(STR.wrongPassword)); return; }
      Store.set('qa_currentUserId', targetId);
      markUserKnownOnThisDevice(targetId);
      pushAccessLog({name, role, time:new Date().toISOString(), type:'login'});
      sessionStorage.setItem('qa_unlocked','1');
      state.auth = null; state.view='home'; state.formTemp = {};
      render();
    })();
    return;
  }

  if(action==='auth-unlock-biometric'){
    (async ()=>{
      const targetId = state.auth.targetUserId;
      let credId=null, name='', role='';
      if(targetId==='__admin__'){ credId = META_CACHE.adminBiometricCredId; name=t(STR.roleAdmin); role=t(STR.roleAdmin); }
      else { const u = getUsers().find(x=>x.id===targetId); if(u){ credId=u.biometricCredId; name=u.name; role=u.role; } }
      if(!credId){ showToast(t(STR.biometricNotAvailable)); return; }
      const ok = await verifyBiometric(credId);
      if(!ok){ showToast(t(STR.biometricNotAvailable)); return; }
      Store.set('qa_currentUserId', targetId);
      markUserKnownOnThisDevice(targetId);
      pushAccessLog({name, role, time:new Date().toISOString(), type:'login-biometric'});
      sessionStorage.setItem('qa_unlocked','1');
      state.auth = null; state.view='home'; state.formTemp = {};
      render();
    })();
    return;
  }

  if(action==='auth-logout'){
    document.querySelectorAll('.modal-overlay').forEach(m=>m.remove());
    Store.set('qa_currentUserId', null);
    sessionStorage.removeItem('qa_unlocked');
    state.auth = {screen:'welcome'};
    state.formTemp = {};
    render();
    return;
  }

  if(action==='toggle-user-admin'){
    const id = el.getAttribute('data-id');
    const u = getUsers().find(x=>x.id===id);
    if(!u) return;
    const updated = Object.assign({}, u, {isAdmin: !u.isAdmin});
    saveUserRemote(updated);
    return;
  }
  if(action==='open-reset-modal'){
    showResetPasswordModal(el.getAttribute('data-userid'), el.getAttribute('data-reqid'), el.getAttribute('data-name'));
    return;
  }
  if(action==='confirm-reset-password'){
    (async ()=>{
      const userId = el.getAttribute('data-userid');
      const reqId = el.getAttribute('data-reqid');
      const newPass = (document.getElementById('newPassForUser').value||'').trim();
      if(newPass.length<4){ showToast(t(STR.passwordTooShort)); return; }
      const u = getUsers().find(x=>x.id===userId);
      if(!u) return;
      const passwordHash = await sha256Hex(newPass);
      await saveUserRemote(Object.assign({}, u, {passwordHash}));
      qaCol('passwordResetRequests/items').doc(reqId).delete().catch(()=>{});
      document.querySelectorAll('.modal-overlay').forEach(m=>m.remove());
      alert(t(STR.resetDonePrefix) + '\n\n' + newPass);
    })();
    return;
  }
  if(action==='revoke-user'){
    if(!confirm(t(STR.revokeConfirm))) return;
    const id = el.getAttribute('data-id');
    deleteUserRemote(id);
    return;
  }
  if(action==='save-master-code'){
    const val = (document.getElementById('masterCodeInput').value||'').trim();
    if(!val) return;
    saveMetaRemote({masterCode: val});
    delete state.formTemp.masterCodeInput;
    showToast(t(STR.savedOk));
    return;
  }

  /* ---- General app actions ---- */
  if(action==='nav'){
    const view = el.getAttribute('data-view'); const section = el.getAttribute('data-section');
    if(view==='builder' && !isAdmin()){ showToast(t(STR.adminOnlyNotice)); return; }
    state.view = view; state.viewSectionId = section || null; state.search=''; state.dateFrom=''; state.dateTo='';
    render();
    if(view==='files') refreshFilesCache();
  }
  else if(action==='toggle-lang'){ LANG = LANG==='ar'?'en':'ar'; localStorage.setItem('qa_lang', LANG); render(); }
  else if(action==='open-account-modal'){ showAccountModal(); }
  else if(action==='close-modal'){ document.querySelectorAll('.modal-overlay').forEach(m=>m.remove()); }

  else if(action==='dashboard-period'){ state.dashboardPeriod = el.getAttribute('data-value'); render(); }

  else if(action==='new-record'){
    const sectionId = el.getAttribute('data-section'); const section = getSection(sectionId);
    const savedDraft = getFormDraft(sectionId);
    state.currentRecord = savedDraft ? savedDraft.record : newRecord(section);
    state.draftRestored = !!savedDraft;
    if(!state.currentRecord.date) state.currentRecord.date = todayISO();
    state.view='form'; state.viewSectionId = sectionId; render();
    if(savedDraft) showToast(t(STR.draftRestored));
  }
  else if(action==='view-record'){
    const sectionId = el.getAttribute('data-section'); const id = el.getAttribute('data-id');
    const rec = getRecords(sectionId).find(r=>r.id===id);
    if(!rec){ showToast(t(STR.noRecords)); return; }
    state.detailSectionId = sectionId; state.detailRecord = JSON.parse(JSON.stringify(rec)); state.view='detail'; render();
  }
  else if(action==='back-to-list'){
    state.view='list'; state.viewSectionId=el.getAttribute('data-section'); state.detailRecord=null; render();
  }
  else if(action==='edit-record'){
    const sectionId = el.getAttribute('data-section'); const id = el.getAttribute('data-id');
    const rec = getRecords(sectionId).find(r=>r.id===id);
    if(!rec){ showToast(t(STR.noRecords)); return; }
    state.currentRecord = JSON.parse(JSON.stringify(rec));
    state.view='form'; state.viewSectionId = sectionId; render();
  }
  else if(action==='delete-record'){
    const sectionId = el.getAttribute('data-section'); const id = el.getAttribute('data-id');
    if(!confirm(t(STR.confirmDelete))) return;
    deleteRecordRemote(sectionId, id);
    showToast(t(STR.deletedOk));
  }
  else if(action==='save-record'){
    const sectionId = el.getAttribute('data-section'); const section = getSection(sectionId);
    const rec = state.currentRecord;
    const missing = section.fields.filter(f=> f.required && (rec[f.key]===undefined || rec[f.key]===null || rec[f.key]===''));
    if(missing.length){ showToast(t(STR.requiredMissing)); return; }
    
    updateAggregates(sectionId, rec);
    
    (async ()=>{
      try{
        await saveRecordRemote(sectionId, rec);
        clearFormDraft(sectionId);
        state.draftRestored = false;
        showToast(t(STR.savedOk));
        state.view='list'; render();
      }catch(err){
        console.error('save-record error:', err);
        showToast('Failed to save record. Check your internet connection.');
      }
    })();
  }

  else if(action==='add-group-item'){
    const key = el.getAttribute('data-group');
    const section = getSection(state.viewSectionId);
    const field = section.fields.find(f=>f.key===key);
    const item = {}; field.fields.forEach(sf=> item[sf.key] = sf.type==='image' ? [] : '');
    if(!state.currentRecord[key]) state.currentRecord[key]=[];
    state.currentRecord[key].push(item); saveCurrentDraft(state.viewSectionId); render();
  }
  else if(action==='remove-group-item'){
    const key = el.getAttribute('data-group'); const idx = parseInt(el.getAttribute('data-index'),10);
    state.currentRecord[key].splice(idx,1); saveCurrentDraft(state.viewSectionId); render();
  }
  else if(action==='add-multidate'){
    const key = el.getAttribute('data-group');
    if(!state.currentRecord[key]) state.currentRecord[key]=[];
    state.currentRecord[key].push({prod:'',exp:''}); saveCurrentDraft(state.viewSectionId); render();
  }
  else if(action==='remove-multidate'){
    const key = el.getAttribute('data-group'); const idx = parseInt(el.getAttribute('data-index'),10);
    state.currentRecord[key].splice(idx,1); saveCurrentDraft(state.viewSectionId); render();
  }
  else if(action==='remove-image'){
    const path = el.getAttribute('data-field'); const idx = parseInt(el.getAttribute('data-index'),10);
    const arr = getPath(state.currentRecord, path) || [];
    const imgId = arr[idx];
    deleteImageFromDB(imgId);
    arr.splice(idx,1);
    setPath(state.currentRecord, path, arr);
    saveCurrentDraft(state.viewSectionId);
    render();
  }

  else if(action==='discard-draft'){
    const sectionId = el.getAttribute('data-section');
    const section = getSection(sectionId);
    clearFormDraft(sectionId);
    state.currentRecord = newRecord(section);
    if(!state.currentRecord.date) state.currentRecord.date = todayISO();
    state.draftRestored = false;
    render();
    showToast(t(STR.draftDiscarded));
  }

  else if(action==='clear-section-filters'){ clearSectionFilters(el.getAttribute('data-section')); render(); }
  else if(action==='export-filtered-csv'){ const sectionId=el.getAttribute('data-section'); exportSectionCSV(sectionId, r=>recordMatchesSectionFilters(sectionId,r)); }
  else if(action==='export-filtered-xlsx'){ const sectionId=el.getAttribute('data-section'); exportSectionXLSX(sectionId, r=>recordMatchesSectionFilters(sectionId,r)); }
  else if(action==='export-csv'){ exportSectionCSV(el.getAttribute('data-section')); }
  else if(action==='export-xlsx'){ exportSectionXLSX(el.getAttribute('data-section')); }
  else if(action==='export-csv-month'){
    const {month,year}=state.monthly; const prefix = `${year}-${String(month).padStart(2,'0')}`;
    const sectionId=el.getAttribute('data-section'); exportSectionCSV(sectionId, r=> r.date && r.date.startsWith(prefix), `${sectionId}_Monthly_${prefix}.csv`);
  }
  else if(action==='export-xlsx-month'){
    const {month,year}=state.monthly; const prefix = `${year}-${String(month).padStart(2,'0')}`;
    const sectionId=el.getAttribute('data-section'); exportSectionXLSX(sectionId, r=> r.date && r.date.startsWith(prefix), `${sectionId}_Monthly_${prefix}.xlsx`);
  }
  else if(action==='export-combined-month'){ exportCombinedMonth(); }
  else if(action==='export-combined-month-pdf'){ exportCombinedMonthPDF(); }
  else if(action==='share-record-pdf'){ shareRecordAsPDF(el.getAttribute('data-section'), el.getAttribute('data-id')); }
  else if(action==='share-filtered-pdf'){ shareFilteredPDF(el.getAttribute('data-section')); }
  else if(action==='share-daily-pdf'){ shareDailyPDF(el.getAttribute('data-section'), todayISO()); }
  else if(action==='export-pdf-month'){ const {month,year}=state.monthly; shareMonthlyPDF(el.getAttribute('data-section'), year, month); }
  else if(action==='download-stored-file'){
    const f = FILES_CACHE.find(x=>x.id===el.getAttribute('data-id'));
    if(f) downloadDataUrlFile(f.filename, f.dataUrl);
  }
  else if(action==='view-stored-file'){
    const f = FILES_CACHE.find(x=>x.id===el.getAttribute('data-id'));
    if(f) viewDataUrlFile(f.dataUrl);
  }
  else if(action==='share-stored-file'){
    const f = FILES_CACHE.find(x=>x.id===el.getAttribute('data-id'));
    if(f) shareStoredFileMeta(f);
  }
  else if(action==='delete-stored-file'){
    const id = el.getAttribute('data-id');
    deleteExportedFile(id).then(()=>{ FILES_CACHE = FILES_CACHE.filter(x=>x.id!==id); render(); });
  }

  else if(action==='add-builder-field'){ state.builderFields.push({labelAr:'',labelEn:'',type:'text',optionsCsv:''}); render(); }
  else if(action==='toggle-builtin-editor'){
    const sid = el.getAttribute('data-section');
    state.builtinFieldTarget = (state.builtinFieldTarget===sid) ? null : sid;
    state.builderFields = [];
    render();
  }
  else if(action==='save-builtin-fields'){
    const sid = el.getAttribute('data-section');
    if(!state.builderFields.length){ showToast(t(STR.requiredMissing)); return; }
    state.builderFields.forEach((bf,i)=>{
      const key = 'ext'+Date.now().toString(36)+i+'_'+(bf.labelEn||bf.labelAr||'field').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,16);
      const field = {key: key, type: bf.type, label:{ar: bf.labelAr||bf.labelEn, en: bf.labelEn||bf.labelAr}};
      if(bf.type==='select'){
        field.options = (bf.optionsCsv||'').split(',').map(s=>s.trim()).filter(Boolean).map(v=>({value:v, label:{ar:v, en:v}}));
      }
      addFieldToBuiltinSection(sid, field);
    });
    state.builderFields = [];
    state.builtinFieldTarget = null;
    showToast(t(STR.savedOk));
    render();
  }
  else if(action==='remove-builtin-field'){
    const sid = el.getAttribute('data-section'); const fieldKey = el.getAttribute('data-fieldkey');
    if(!confirm(t(STR.deleteSectionConfirm))) return;
    removeFieldFromBuiltinSection(sid, fieldKey);
  }
  else if(action==='remove-builder-field'){ const idx=parseInt(el.getAttribute('data-index'),10); state.builderFields.splice(idx,1); render(); }
  else if(action==='delete-section'){
    if(!confirm(t(STR.deleteSectionConfirm))) return;
    const sid = el.getAttribute('data-section');
    deleteCustomSectionRemote(sid);
  }
  else if(action==='save-custom-section'){
    const nameAr = document.getElementById('newSecNameAr').value.trim();
    const nameEn = document.getElementById('newSecNameEn').value.trim();
    const icon = document.getElementById('newSecIcon').value.trim() || '📋';
    if(!nameAr && !nameEn){ showToast(t(STR.requiredMissing)); return; }
    const fields = [{key:'date', type:'date', label:{ar:'التاريخ', en:'Date'}, required:true}];
    state.builderFields.forEach((bf,i)=>{
      const key = 'f'+i+'_'+(bf.labelEn||bf.labelAr||'field').toLowerCase().replace(/[^a-z0-9]+/g,'').slice(0,16);
      const field = {key: key||('f'+i), type: bf.type, label:{ar: bf.labelAr||bf.labelEn, en: bf.labelEn||bf.labelAr}};
      if(bf.type==='select'){
        field.options = (bf.optionsCsv||'').split(',').map(s=>s.trim()).filter(Boolean).map(v=>({value:v, label:{ar:v, en:v}}));
      }
      fields.push(field);
    });
    const newSection = { id:'custom_'+uid(), builtin:false, icon, name:{ar:nameAr||nameEn, en:nameEn||nameAr}, listFields: fields.slice(0,4).map(f=>f.key), fields };
    saveCustomSection(newSection);
    state.builderFields = [];
    delete state.formTemp.newSecNameAr; delete state.formTemp.newSecNameEn; delete state.formTemp.newSecIcon;
    showToast(t(STR.savedOk));
    render();
  }
});

/* ===================== Init ===================== */
window.addEventListener('online', ()=>{ render(); retryPendingImageUploads(); });
window.addEventListener('offline', render);
window.addEventListener('beforeunload', ()=>{ if(state.view==='form') saveCurrentDraft(state.viewSectionId); });
window.addEventListener('load', ()=>{
  app.innerHTML = renderLoadingScreen();
  subscribeAllCoreData();
  setTimeout(()=>{ _metaReady = true; _usersReady = true; tryBootApp(); }, 6000);
});
