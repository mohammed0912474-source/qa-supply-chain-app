

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
    if(!user){ showToast(LANG==='ar'?'لا يوجد مستخدم مسجّل الدخول':'No signed-in user'); return; }
    const nameEl = document.getElementById('profileName');
    const phoneEl = document.getElementById('profilePhone');
    const emailEl = document.getElementById('profileEmail');
    if(!nameEl){ showToast(LANG==='ar'?'تعذّر قراءة حقول الملف الشخصي':'Could not read the profile fields'); return; }
    const name = (nameEl.value||'').trim();
    const phone = ((phoneEl&&phoneEl.value)||'').trim();
    const email = ((emailEl&&emailEl.value)||'').trim();
    if(!name){ showToast(t(STR.requiredMissing)); return; }
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ showToast(LANG==='ar'?'صيغة البريد الإلكتروني غير صحيحة':'Invalid email format'); return; }
    if(phone && !/^[+]?[\d\s()-]{6,20}$/.test(phone)){ showToast(LANG==='ar'?'صيغة رقم الهاتف غير صحيحة':'Invalid phone number'); return; }
    // Keep the previous values so a failed write does not leave the UI lying.
    const prev = {name:user.name, phone:user.phone, email:user.email};
    user.name = name; user.phone = phone; user.email = email;
    saveUserRemote(user).then(()=>{
      document.querySelectorAll('.modal-overlay').forEach(m=>m.remove());
      render();
      showToast(t(STR.savedOk));
    }).catch(()=>{
      user.name = prev.name; user.phone = prev.phone; user.email = prev.email;
      showToast(LANG==='ar'?'تعذر حفظ الملف الشخصي':'Could not save profile');
    });
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
          // Rebuild the account modal so the new picture is actually visible;
          // re-rendering alone left the open modal showing the old image.
          const wasOpen = !!document.querySelector('.modal-overlay');
          document.querySelectorAll('.modal-overlay').forEach(m=>m.remove());
          render();
          if(wasOpen) showAccountModal();
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
  else if(action==='toggle-work-status'){
    // Manual status control — the only thing that sets an operation's status.
    const sectionId = el.getAttribute('data-section');
    const id = el.getAttribute('data-id');
    const next = el.getAttribute('data-next')==='completed' ? 'completed' : 'working';
    const rec = getRecords(sectionId).find(r=>r.id===id);
    if(!rec){ showToast(t(STR.noRecords)); return; }
    const previous = workStatusOf(rec);
    if(previous===next) return;
    // Optimistic update so the row recolours instantly, rolled back on failure.
    rec.workStatus = next;
    rec._updated = new Date().toISOString();
    if(state.detailRecord && state.detailRecord.id===id) state.detailRecord.workStatus = next;
    render();
    saveRecordRemote(sectionId, rec).then(()=>{
      showToast(next==='completed'
        ? (LANG==='ar'?'تم وضع العملية كمنتهية':'Operation marked completed')
        : (LANG==='ar'?'أُعيدت العملية إلى قيد العمل':'Operation moved back to in progress'));
    }).catch(()=>{
      rec.workStatus = previous;
      if(state.detailRecord && state.detailRecord.id===id) state.detailRecord.workStatus = previous;
      render();
      showToast(LANG==='ar'?'تعذر حفظ حالة العملية':'Could not save the operation status');
    });
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
