

/* ===================== Section Builder ===================== */
function renderAdminPanel(){
  const users = getUsers();
  const rows = users.map(u=>`
    <div class="record-card">
      <div class="top">
        <div><div class="main">${esc(u.name)} ${u.isAdmin?'👑':''}</div><div class="meta">${esc(u.role||'')} ${u.biometricCredId?'· 🔒':''} ${u.isAdmin?'· '+esc(t(STR.roleAdmin)):''}</div></div>
        <div class="actions">
          <button class="btn ${u.isAdmin?'btn-outline':'btn-success'} btn-sm" data-action="toggle-user-admin" data-id="${u.id}">${u.isAdmin? esc(t(STR.removeAdmin)) : esc(t(STR.makeAdmin))}</button>
          <button class="btn btn-danger btn-sm" data-action="revoke-user" data-id="${u.id}">${esc(t(STR.revokeUser))}</button>
        </div>
      </div>
    </div>`).join('');
  return `
  <div class="card">
    <h2>🛡️ ${esc(t(STR.adminPanelTitle))}</h2>
    <div class="stats-grid" style="margin-bottom:12px;">
      <div class="stat-card"><div class="ico">🔑</div><div class="num">${adminLoginCount()}</div><div class="lbl">${esc(t(STR.adminLoginCount))}</div></div>
      <div class="stat-card"><div class="ico">👥</div><div class="num">${users.length}</div><div class="lbl">${esc(t(STR.registeredUsers))}</div></div>
    </div>
    <div class="field" style="margin-bottom:12px;">
      <label>${esc(t(STR.masterCodeLabel))}</label>
      <input type="text" id="masterCodeInput" value="${esc(state.formTemp.masterCodeInput!=null ? state.formTemp.masterCodeInput : getMasterCode())}">
      <div class="hint">${esc(t(STR.masterCodeHint))}</div>
      <button class="btn btn-primary btn-sm" style="margin-top:8px;" data-action="save-master-code">${esc(t(STR.saveCode))}</button>
    </div>
    ${RESET_REQUESTS_CACHE.list.length ? `
    <div class="field" style="margin-bottom:12px;">
      <label>🔓 ${esc(t(STR.pendingResetRequests))}</label>
      ${RESET_REQUESTS_CACHE.list.map(r=>`
        <div class="record-card">
          <div class="top">
            <div><div class="main">${esc(r.name)}</div><div class="meta">${r.time? new Date(r.time).toLocaleString(LANG==='ar'?'ar-EG':'en-GB') : ''}</div></div>
            <div class="actions"><button class="btn btn-primary btn-sm" data-action="open-reset-modal" data-userid="${r.userId}" data-reqid="${r.id}" data-name="${esc(r.name)}">${esc(t(STR.resetPasswordAction))}</button></div>
          </div>
        </div>`).join('')}
    </div>` : ''}
    <div class="desc">${esc(t(STR.registeredUsers))}</div>
    ${rows || `<div class="empty-state">${esc(t(STR.noUsers))}</div>`}

    <div class="section-title" style="margin-top:20px;"><h3>🛡️ ${esc(t(STR.monitoring))}</h3></div>
    <div class="desc" style="margin-bottom:10px;">${esc(t(STR.recentActivity))}</div>
    <div style="max-height:300px; overflow-y:auto; background:#f9f9f9; padding:10px; border-radius:8px; border:1px solid var(--border);">
      ${ACCESS_LOG_CACHE.list.slice(0, 50).map(l => `
        <div style="font-size:12px; padding:8px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:700; color:var(--navy);">${esc(l.name)} <span style="font-weight:400; opacity:.7;">(${esc(l.role)})</span></div>
            <div style="opacity:.6;">${esc(l.type)} · ${new Date(l.time).toLocaleString()}</div>
          </div>
          <div class="status-dot" style="background:${l.type==='login'?'var(--success)':'var(--accent)'}"></div>
        </div>
      `).join('') || '<div class="empty-state">No activity yet</div>'}
    </div>
  </div>`;
}

function renderBuilder(){
  if(!isAdmin()){
    return `<div class="card"><div class="empty-state">🔒 ${esc(t(STR.adminOnlyNotice))}</div></div>`;
  }
  const customs = getCustomSections();
  const existingRows = customs.map(s=>`
    <div class="record-card">
      <div class="top">
        <div><div class="main">${s.icon} ${esc(t(s.name))}</div><div class="meta">${s.fields.length} ${LANG==='ar'?'حقول':'fields'}</div></div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-action="delete-section" data-section="${s.id}">🗑️</button></div>
      </div>
    </div>`).join('');

  const builderFieldRows = (target)=> state.builderFields.map((f,idx)=>`
    <div class="field-row-builder">
      <input type="text" placeholder="${esc(t(STR.fieldLabelAr))}" data-builder-field="labelAr" data-index="${idx}" value="${esc(f.labelAr||'')}">
      <input type="text" placeholder="${esc(t(STR.fieldLabelEn))}" data-builder-field="labelEn" data-index="${idx}" value="${esc(f.labelEn||'')}">
      <select data-builder-field="type" data-index="${idx}">
        ${['text','number','date','textarea','select','unit','image'].map(ty=>`<option value="${ty}" ${f.type===ty?'selected':''}>${ty}</option>`).join('')}
      </select>
      <button class="btn btn-danger btn-sm" data-action="remove-builder-field" data-index="${idx}">✕</button>
      ${f.type==='select' ? `<input type="text" style="grid-column:1/-1" placeholder="${esc(t(STR.optionsCsv))}" data-builder-field="options" data-index="${idx}" value="${esc(f.optionsCsv||'')}">` : ''}
    </div>`).join('');

  const builtinRows = BUILTIN_SECTIONS.map(s=>{
    const extraFields = BUILTIN_EXTENSIONS_CACHE.map[s.id] || [];
    const isEditing = state.builtinFieldTarget === s.id;
    const extraRows = extraFields.map(f=>`
      <div class="record-card">
        <div class="top">
          <div><div class="main">${esc(t(f.label))}</div><div class="meta">${f.type} · ${esc(t(STR.customFieldTag))}</div></div>
          <div class="actions"><button class="btn btn-danger btn-sm" data-action="remove-builtin-field" data-section="${s.id}" data-fieldkey="${esc(f.key)}">🗑️</button></div>
        </div>
      </div>`).join('');
    return `<div class="record-card">
      <div class="top">
        <div><div class="main">${s.icon} ${esc(t(s.name))}</div><div class="meta">${esc(t(STR.builtin))} · ${s.fields.length} ${LANG==='ar'?'حقل':'fields'}</div></div>
        <div class="actions"><button class="btn btn-outline btn-sm" data-action="toggle-builtin-editor" data-section="${s.id}">${isEditing? esc(t(STR.cancel)) : '➕ '+esc(t(STR.addField))}</button></div>
      </div>
      ${extraFields.length? `<div style="margin-top:8px;">${extraRows}</div>`:''}
      ${isEditing? `
        <div class="group-block" style="margin-top:10px;">
          <div class="hint" style="margin-bottom:8px;">${esc(t(STR.addFieldToSectionHint))}</div>
          ${builderFieldRows(s.id)}
          <button class="btn btn-outline btn-sm" data-action="add-builder-field">${esc(t(STR.addField))}</button>
          <button class="btn btn-primary btn-sm btn-block" style="margin-top:8px;" data-action="save-builtin-fields" data-section="${s.id}">${esc(t(STR.saveSection))}</button>
        </div>`:''}
    </div>`;
  }).join('');

  const fieldRows = builderFieldRows('newSection');

  return `
  ${isAdmin() ? renderAdminPanel() : ''}
  <div class="card">
    <h2>⚙️ ${esc(t(STR.builder))}</h2>
    <div class="desc">${LANG==='ar'?'الأقسام الأساسية (تقدر تضيف حقول جديدة لأي قسم منها)':'Built-in sections (you can add new fields to any of them)'}</div>
    ${builtinRows}
  </div>
  <div class="card">
    <div class="desc">${LANG==='ar'?'الأقسام المخصصة':'Custom sections'}</div>
    ${existingRows || `<div class="empty-state">${esc(t(STR.noRecords))}</div>`}
  </div>
  <div class="card">
    <h2>➕ ${esc(t(STR.newSection))}</h2>
    <div class="hint" style="margin-bottom:10px;">${LANG==='ar'?'يُضاف حقل "التاريخ" تلقائياً لدعم التقرير الشهري.':'A "Date" field is added automatically to support the monthly report.'}</div>
    <div class="form-grid">
      <div class="field"><label>${esc(t(STR.sectionNameAr))}</label><input type="text" id="newSecNameAr" value="${esc(state.formTemp.newSecNameAr||'')}"></div>
      <div class="field"><label>${esc(t(STR.sectionNameEn))}</label><input type="text" id="newSecNameEn" value="${esc(state.formTemp.newSecNameEn||'')}"></div>
      <div class="field"><label>${esc(t(STR.icon))}</label><input type="text" id="newSecIcon" value="${esc(state.formTemp.newSecIcon!=null?state.formTemp.newSecIcon:'📋')}"></div>
    </div>
    <div style="margin-top:12px;">
      <b>${esc(t(STR.fields))}</b>
      <div style="margin-top:8px;">${fieldRows}</div>
      <button class="btn btn-outline btn-sm" data-action="add-builder-field">${esc(t(STR.addField))}</button>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:14px;" data-action="save-custom-section">${esc(t(STR.saveSection))}</button>
  </div>`;
}

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