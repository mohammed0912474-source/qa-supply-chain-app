

function renderTabbar(){
  const items = [
    {id:'home', view:'home', icon:NAV_ICONS.home, label:STR.home},
    {id:'dashboard', view:'dashboard', icon:NAV_ICONS.dashboard, label:STR.dashboard},
    {id:'chat', view:'chat', icon:NAV_ICONS.chat, label:STR.chat},
    ...getAllSections().map(s=>({id:s.id, view:'list', sectionId:s.id, icon:SECTION_ICONS[s.id]||s.icon, label:s.name})),
    {id:'monthly', view:'monthly', icon:NAV_ICONS.monthly, label:STR.monthly},
    {id:'files', view:'files', icon:NAV_ICONS.files, label:STR.filesTab},
    ...(isAdmin() ? [{id:'builder', view:'builder', icon:NAV_ICONS.builder, label:STR.builder}] : [])
  ];
  return `<div class="tabbar">${items.map(it=>{
    const active = (state.view===it.view && (it.view!=='list' || state.viewSectionId===it.sectionId)) || (state.view==='form' && it.view==='list' && state.viewSectionId===it.sectionId);
    return `<button class="tab-btn ${active?'active':''}" data-action="nav" data-view="${it.view}" data-section="${it.sectionId||''}">
      <span class="ico">${it.icon}</span><span>${esc(t(it.label))}</span>
    </button>`;
  }).join('')}</div>`;
}

function renderHome(){
  const sections = getAllSections();
  const user = getCurrentUser();
  const totalRecords = sections.reduce((sum,s)=>sum+getRecords(s.id).length,0);
  const currentPrefix = todayISO().slice(0,7);
  const monthRecords = sections.reduce((sum,s)=>sum+getRecords(s.id).filter(r=>(r.date||'').startsWith(currentPrefix)).length,0);
  const recent = sections.flatMap(s=>getRecords(s.id).map(r=>({section:s,record:r}))).sort((a,b)=>`${b.record.date||''}${b.record._created||''}`.localeCompare(`${a.record.date||''}${a.record._created||''}`)).slice(0,5);
  const WORKSPACE_IMAGES = {containers:'containers.jpg',trucks:'trucks.jpg',rebacking:'rebacking.jpg'};
  const sectionCards = sections.map(s=>{
    const count=getRecords(s.id).length;
    const caption=s.id==='containers'?(LANG==='ar'?'متابعة البوالص وحالة التوزيع':'Bills of lading and dispatch readiness'):s.id==='trucks'?(LANG==='ar'?'فحص المركبات والمنتجات المحمّلة':'Vehicle and loaded-product inspection'):(LANG==='ar'?'تسجيل المعالجة والكميات والتالف':'Processing, quantities, and damage');
    const visual = WORKSPACE_IMAGES[s.id];
    return `<article class="section-overview-card${visual?' section-overview-card--visual':''}">${visual?`<div class="section-card-photo" style="background-image:url('${visual}')"></div>`:''}<div class="section-card-overlay"><div class="section-overview-top"><div class="section-overview-icon">${SECTION_ICONS[s.id]||s.icon}</div><div class="section-overview-count">${count}<span>${LANG==='ar'?'سجل':'records'}</span></div></div><h4>${esc(t(s.name))}</h4><div class="caption">${caption}</div><div class="section-overview-actions"><button class="btn btn-quiet btn-sm" data-action="nav" data-view="list" data-section="${s.id}">${LANG==='ar'?'فتح السجل':'Open register'}</button><button class="btn btn-primary btn-sm" data-action="new-record" data-section="${s.id}">${LANG==='ar'?'سجل جديد':'New'}</button></div></div></article>`;
  }).join('');
  const recentRows = recent.map(item=>{
    const title=item.section.id==='containers'?item.record.blNumber:item.section.id==='trucks'?item.record.truckNo:(item.record.blNumber||item.record.product);
    return `<div class="activity-row"><div><div class="activity-title">${esc(title||t(item.section.name))}</div><div class="activity-meta">${esc(t(item.section.name))}</div></div><div class="activity-date">${esc(item.record.date||'—')}</div></div>`;
  }).join('');
  return `<div class="home-shell"><section class="home-hero"><div><div class="home-hero-kicker">${LANG==='ar'?'مساحة العمليات':'OPERATIONS WORKSPACE'}</div><h2>${LANG==='ar'?'مرحبًا'+(user?'، '+esc(user.name):''):'Welcome'+(user?', '+esc(user.name):'')}</h2><p>${LANG==='ar'?'سجّل عمليات الجودة، راقب الفحوصات، وراجع النتائج من مساحة عمل واحدة.':'Record quality operations, monitor inspections, and review results from one workspace.'}</p></div><button class="btn btn-primary" data-action="nav" data-view="dashboard">${LANG==='ar'?'فتح لوحة التحليلات':'Open analytics'}</button></section><section class="home-kpis"><div class="home-kpi"><span class="value">${totalRecords}</span><span class="label">${LANG==='ar'?'إجمالي سجلات العمليات':'Total operation records'}</span></div><div class="home-kpi"><span class="value">${monthRecords}</span><span class="label">${LANG==='ar'?'سجلات هذا الشهر':'Records this month'}</span></div><div class="home-kpi"><span class="value">${sections.length}</span><span class="label">${LANG==='ar'?'مساحات العمل النشطة':'Active workspaces'}</span></div></section><section><div class="home-section-head"><div><h3>${LANG==='ar'?'مساحات العمل':'Workspaces'}</h3><p>${LANG==='ar'?'اختر السجل أو ابدأ عملية جديدة.':'Open a register or start a new operation.'}</p></div></div><div class="section-overview-grid">${sectionCards}</div></section><section class="home-activity"><div class="home-activity-head">${LANG==='ar'?'آخر النشاط':'Recent activity'}</div>${recentRows||`<div class="empty-state">${LANG==='ar'?'لا توجد عمليات مسجلة حتى الآن':'No operations have been recorded yet'}</div>`}</section></div>`;
}

/* ---- Dashboard / Analytics ---- */
function computeContainerAgg(records){
  // Only compute analytics based on "completed" records as per user request
  const completedRecords = records.filter(r => r.workStatus === 'completed');
  
  let totalNC=0, totalTreated=0, totalBillQty=0, totalContainers=0, totalLoss=0, totalReback=0;
  const conditionTally={};
  const ncTypeTally={from_container:0, handling:0, other:0};
  
  completedRecords.forEach(r=>{
    totalNC += metricOf(r,'totalNC','nc');
    totalTreated += parseFloat(r.ncTreated)||0;
    totalBillQty += metricOf(r,'billQty','qty');
    totalContainers += parseContainerCount(r);
    totalLoss += metricOf(r,'totalLoss','loss');
    totalReback += metricOf(r,'totalReback','reback');
    if(r.ncType) ncTypeTally[r.ncType] = (ncTypeTally[r.ncType]||0) + 1;
    (r.containerDetails||[]).forEach(cd=>{ if(cd.condition){ const normalized=['damaged','repair'].includes(cd.condition)?'bad':cd.condition; conditionTally[normalized]=(conditionTally[normalized]||0)+1; } });
  });
  
  return {
    totalNC, totalTreated, totalBillQty, totalContainers, totalLoss, totalReback,
    conditionTally, ncTypeTally,
    billsCount: completedRecords.length,
    count: completedRecords.length,
    allCount: records.length,
    workingCount: records.length - completedRecords.length,
    // Derived rates. pct() returns null on a zero/invalid denominator, which the
    // KPI renderer shows as "—" rather than a misleading 0%.
    readdressedPct: pct(totalReback, totalNC),
    loseOfReaddressedPct: pct(totalLoss, totalReback),
    totalLossPct: pct(totalLoss, totalBillQty)
  };
}
function computeTruckAgg(records){
  // Analytics count completed operations only.
  const completedRecords = completedOnly(records);
  const total = completedRecords.length;
  const accepted = completedRecords.filter(r=>r.inspectionResult==='accepted').length;
  const rejected = completedRecords.filter(r=>r.inspectionResult==='rejected').length;
  const pending = total - accepted - rejected;
  let loadedQty = 0;
  completedRecords.forEach(r=>{
    const rows = asArray(r.products);
    loadedQty += rows.length
      ? rows.reduce((sum,row)=> sum + (parseFloat(row && row.qty)||0), 0)
      : (parseFloat(r.qty)||0);
  });
  return {
    total, accepted, rejected, pending, loadedQty,
    transporters: uniqueNonEmpty(completedRecords,'transporter'),
    destinations: uniqueNonEmpty(completedRecords,'destination'),
    acceptRate: pct(accepted, total),
    rejectRate: pct(rejected, total),
    allCount: records.length,
    workingCount: records.length - total
  };
}
/* Product-processing aggregate — completed operations only, same contract. */
function computeRebackAgg(records){
  const completedRecords = completedOnly(records);
  const ncQty = sumField(completedRecords,'mergeQty');
  const processedQty = sumField(completedRecords,'processedQty');
  const damagedQty = sumField(completedRecords,'damagedQty');
  return {
    ncQty, processedQty, damagedQty,
    count: completedRecords.length,
    allCount: records.length,
    workingCount: records.length - completedRecords.length,
    processedRate: pct(processedQty, ncQty),
    lossRate: pct(damagedQty, ncQty)
  };
}
function lastMonths(n){
  const arr=[]; const now = new Date();
  for(let i=n-1;i>=0;i--){ const d=new Date(now.getFullYear(), now.getMonth()-i, 1); arr.push({year:d.getFullYear(), month:d.getMonth()+1, key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}); }
  return arr;
}
function trendData(metricKey, months){
  const monthsArr = lastMonths(months);
  // Trend reflects completed operations only, consistent with every other metric.
  const allContainers = completedOnly(getRecords('containers'));
  const detailKey = {totalNC:'nc', totalLoss:'loss', totalReback:'reback', billQty:'qty'}[metricKey];
  return monthsArr.map(m=>{
    const recs = allContainers.filter(r=>r.date && r.date.startsWith(m.key));
    const sum = recs.reduce((a,r)=>a+(detailKey?metricOf(r,metricKey,detailKey):(parseFloat(r[metricKey])||0)),0);
    return {label:`${m.month}/${String(m.year).slice(2)}`, value:Math.round(sum*100)/100};
  });
}
function renderBarChart(items, color){
  const max = Math.max(1, ...items.map(i=>i.value));
  const bars = items.map(i=>{
    const h = Math.max(2, Math.round((i.value/max)*100));
    return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;">
      <div style="font-size:11px;font-weight:700;color:var(--navy2);margin-bottom:4px;">${i.value}</div>
      <div style="width:70%;background:${color};border-radius:6px 6px 0 0;height:${h}px;max-height:110px;transition:height .3s;"></div>
      <div style="font-size:10px;color:var(--muted);margin-top:6px;text-align:center;">${esc(i.label)}</div>
    </div>`;
  }).join('');
  return `<div style="display:flex;align-items:flex-end;height:150px;gap:6px;padding:6px 2px 0;">${bars}</div>`;
}
function renderDonut(parts){
  const total = parts.reduce((a,p)=>a+p.value,0);
  let acc=0;
  const stops = total>0 ? parts.map(p=>{
    const start = acc/total*100; acc+=p.value; const end=acc/total*100;
    return `${p.color} ${start}% ${end}%`;
  }).join(', ') : '#E3E9F1 0% 100%';
  const legend = parts.map(p=>`<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin-bottom:5px;"><span style="width:10px;height:10px;border-radius:3px;background:${p.color};display:inline-block;flex-shrink:0;"></span>${esc(p.label)}: <b>${p.value}</b>${total?` (${Math.round(p.value/total*100)}%)`:''}</div>`).join('');
  return `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <div style="width:96px;height:96px;border-radius:50%;background:conic-gradient(${stops});flex-shrink:0;position:relative;">
      <div style="position:absolute;inset:17px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:var(--navy);">${total}</div>
    </div>
    <div>${legend}</div>
  </div>`;
}
function renderChat() {
  const user = getCurrentUser();
  const messages = CHAT_CACHE.list;
  
  setTimeout(() => {
    const el = document.querySelector('.chat-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }, 100);

  const msgsHtml = messages.map(m => {
    const isMe = m.userId === user.id;
    const u = USERS_CACHE.list.find(u => u.id === m.userId);
    const pic = u && u.profilePic ? `<img src="${esc(u.profilePic)}" alt="" class="profile-pic-chat">` : '';
    return `
      <div class="chat-msg ${isMe ? 'me' : 'other'}">
        <span class="user">${pic}${esc(m.userName)}</span>
        <div class="text">${esc(m.text)}</div>
        <span class="time">${new Date(m.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="section-title"><h2>💬 ${esc(t(STR.chat))}</h2></div>
    <div class="chat-container">
      <div class="chat-messages">${msgsHtml}</div>
      <div class="chat-input-area">
        <input type="text" class="chat-input" placeholder="${esc(t(STR.chatPlaceholder))}" id="chatInput">
        <button class="chat-send-btn" data-action="send-chat">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  `;
}

function uniqueNonEmpty(records,key){ return new Set(records.map(r=>String(r[key]||'').trim()).filter(Boolean)).size; }
function sumField(records,key){ return records.reduce((sum,r)=>sum+(parseFloat(r[key])||0),0); }
function formatKpiValue(value, suffix=''){ return value==null || Number.isNaN(value) ? '—' : `${typeof value==='number' && !Number.isInteger(value) ? value.toFixed(1) : value}${suffix}`; }
function renderSectionKpiPanel(title, subtitle, kpis, note, chart){
  const cards = kpis.map(k=>`<div class="kpi-card ${k.tone||'neutral'}"><div class="kpi-val">${formatKpiValue(k.value,k.suffix||'')}</div><div class="kpi-lbl">${esc(k.label)}</div>${k.formula?`<div class="kpi-formula">${esc(k.formula)}</div>`:''}</div>`).join('');
  return `<section class="card analytics-section"><div class="section-title"><div><h3 style="margin:0;">${esc(title)}</h3><div class="hint">${esc(subtitle)}</div></div></div><div class="kpi-grid">${cards}</div>${chart||''}<div class="analytics-note">${esc(note)}</div></section>`;
}
function renderDashboard(){
  const period = state.dashboardPeriod;
  const prefix = period==='month' ? `${state.monthly.year}-${String(state.monthly.month).padStart(2,'0')}` : '';
  const byPeriod = records => period==='month' ? records.filter(r=>String(r.date||'').startsWith(prefix)) : records;
  const containers = byPeriod(getRecords('containers'));
  const trucks = byPeriod(getRecords('trucks'));
  const rebacking = byPeriod(getRecords('rebacking'));
  const cAgg = computeContainerAgg(containers);
  const tAgg = computeTruckAgg(trucks);
  const rAgg = computeRebackAgg(rebacking);
  const resolvedRate = cAgg.readdressedPct;
  const lossRate = cAgg.totalLossPct;
  const acceptRate = tAgg.acceptRate;
  const processedQty = rAgg.processedQty;
  const ncQty = rAgg.ncQty;
  const damagedQty = rAgg.damagedQty;
  const processedRate = rAgg.processedRate;
  const rebackLossRate = rAgg.lossRate;
  // Operations still in progress across every section — excluded from all figures.
  const excludedCount = cAgg.workingCount + tAgg.workingCount + rAgg.workingCount;
  const basisNote = LANG==='ar'
    ? `تُحتسب كل المؤشرات من العمليات المنتهية فقط${excludedCount?` — تم استبعاد ${excludedCount} عملية قيد العمل`:''}.`
    : `All indicators are calculated from completed operations only${excludedCount?` — ${excludedCount} in-progress operation(s) excluded`:''}.`;
  const ncTypeParts = [
    {label:'From Container', value:cAgg.ncTypeTally.from_container, color:'var(--accent)'},
    {label:'During Handling', value:cAgg.ncTypeTally.handling, color:'var(--gold)'},
    {label:LANG==='ar'?'أخرى':'Other', value:cAgg.ncTypeTally.other, color:'var(--teal)'}
  ].filter(p=>p.value>0);
  const transportTally = {};
  completedOnly(containers).forEach(r=>{ const k=r.transportMethod||'unknown'; transportTally[k]=(transportTally[k]||0)+1; });
  const transportLabels = {air:{ar:'عبر المطار',en:'By Air'},sea:{ar:'عبر الميناء',en:'By Sea/Port'},road:{ar:'عبر الطريق',en:'By Road'},unknown:{ar:'غير محدد',en:'Not specified'}};
  const transportParts = Object.keys(transportTally).map(k=>({label:t(transportLabels[k]||{ar:k,en:k}),value:transportTally[k],color:k==='air'?'var(--accent)':k==='road'?'var(--gold)':'var(--teal)'}));
  const truckParts = [{label:LANG==='ar'?'مقبولة':'Accepted',value:tAgg.accepted,color:'var(--success)'},{label:LANG==='ar'?'مرفوضة':'Rejected',value:tAgg.rejected,color:'var(--danger)'}];
  const rebackParts = [{label:LANG==='ar'?'معالجة':'Processed',value:processedQty,color:'var(--success)'},{label:LANG==='ar'?'تالفة':'Damaged',value:damagedQty,color:'var(--danger)'}];
  const years=[]; const curY=new Date().getFullYear(); for(let y=curY-2;y<=curY+1;y++) years.push(y);
  const monthOptions=Array.from({length:12},(_,i)=>i+1);
  const periodControls=`<div class="period-toggle"><button class="btn btn-sm ${period==='all'?'btn-primary active':'btn-outline'}" data-action="dashboard-period" data-value="all">${LANG==='ar'?'كل الفترة':'All time'}</button><button class="btn btn-sm ${period==='month'?'btn-primary active':'btn-outline'}" data-action="dashboard-period" data-value="month">${LANG==='ar'?'شهر محدد':'Specific month'}</button>${period==='month'?`<select data-action="monthly-month">${monthOptions.map(m=>`<option value="${m}" ${m==state.monthly.month?'selected':''}>${m}</option>`).join('')}</select><select data-action="monthly-year">${years.map(y=>`<option value="${y}" ${y==state.monthly.year?'selected':''}>${y}</option>`).join('')}</select>`:''}</div>`;
  return `<div class="card"><div class="section-title"><div><h2>📊 ${esc(t(STR.dashboard))}</h2><div class="hint">${LANG==='ar'?'تحليل مستقل لكل مساحة عمل باستخدام سجلاتها الفعلية':'Independent analytics for every workspace using its own records'}</div><div class="analytics-basis">${esc(basisNote)}</div></div></div>${periodControls}</div>
  ${renderSectionKpiPanel(LANG==='ar'?'تحليل الشحنات':'Shipment Analytics',LANG==='ar'?'صورة تشغيلية للشحنات وطرق النقل ومستوى المطابقة':'Operational view of shipments, transport methods, and conformity',[
    {label:LANG==='ar'?'عدد البواليص':'Bills Count',value:cAgg.billsCount},
    {label:LANG==='ar'?'عدد الحاويات':'Containers Count',value:cAgg.totalContainers},
    {label:LANG==='ar'?'الكميات في البواليص':'Quantities in Bills',value:cAgg.totalBillQty},
    {label:LANG==='ar'?'غير المطابق (NC)':'Non-Conforming (NC)',value:cAgg.totalNC,tone:cAgg.totalNC?'warn':'good'},
    {label:LANG==='ar'?'المعالج (Re-addressed)':'Re-addressed',value:cAgg.totalReback,tone:'good'},
    {label:LANG==='ar'?'الفاقد (Total Lose)':'Total Lose',value:cAgg.totalLoss,tone:cAgg.totalLoss?'bad':'good'},
    {label:LANG==='ar'?'نسبة المعالجة':'Re-addressed %',value:cAgg.readdressedPct,suffix:'%',formula:'Re-addressed ÷ NC',tone:cAgg.readdressedPct==null?'neutral':cAgg.readdressedPct>=80?'good':cAgg.readdressedPct>=50?'warn':'bad'},
    {label:LANG==='ar'?'نسبة فاقد المعالجة':'Lose of Re-addressed %',value:cAgg.loseOfReaddressedPct,suffix:'%',formula:'Lose ÷ Re-addressed',tone:cAgg.loseOfReaddressedPct==null?'neutral':cAgg.loseOfReaddressedPct<=5?'good':cAgg.loseOfReaddressedPct<=15?'warn':'bad'},
    {label:LANG==='ar'?'نسبة الفاقد الكلية في الشحنات':'Total Lose in Shipments %',value:cAgg.totalLossPct,suffix:'%',formula:'Total Lose ÷ Quantities',tone:cAgg.totalLossPct==null?'neutral':cAgg.totalLossPct<=2?'good':cAgg.totalLossPct<=5?'warn':'bad'}
  ],LANG==='ar'?'يُستخدم هذا القسم لمتابعة البوليصة من طريقة النقل حتى الكميات وNC والفاقد.':'Use this section to monitor each bill from transport method through quantities, NC, and loss.',transportParts.length?`<div class="chart-card"><h4>${LANG==='ar'?'توزيع طرق النقل':'Transport Method Mix'}</h4>${renderDonut(transportParts)}</div>`:'')}
  ${renderSectionKpiPanel(LANG==='ar'?'تحليل فحص الشاحنات':'Truck Inspection Analytics',LANG==='ar'?'مؤشرات مستقلة للقبول والناقلين والمنتجات المحملة':'Independent indicators for acceptance, transporters, and loaded products',[{label:LANG==='ar'?'الشاحنات المفحوصة':'Trucks Inspected',value:tAgg.total},{label:LANG==='ar'?'مقبولة':'Accepted',value:tAgg.accepted,tone:'good'},{label:LANG==='ar'?'مرفوضة':'Rejected',value:tAgg.rejected,tone:tAgg.rejected?'bad':'good'},{label:LANG==='ar'?'معدل القبول':'Acceptance Rate',value:acceptRate,suffix:'%',tone:acceptRate==null?'neutral':acceptRate>=95?'good':acceptRate>=85?'warn':'bad'},{label:LANG==='ar'?'عدد الناقلين':'Transporters',value:tAgg.transporters}],LANG==='ar'?'توضح هذه اللوحة جودة الاستلام الميداني، أداء الناقلين، ونسبة قبول الشاحنات.':'This panel shows field receiving quality, transporter coverage, and truck acceptance.',`<div class="chart-card"><h4>${LANG==='ar'?'نتيجة الفحص':'Inspection Result'}</h4>${renderDonut(truckParts)}</div>`)}
  ${renderSectionKpiPanel(LANG==='ar'?'تحليل معالجة المنتجات':'Product Processing Analytics',LANG==='ar'?'متابعة NC والكميات المعالجة والتالفة لكل سجل معالجة':'Track NC, processed quantities, and damaged quantities per processing record',[{label:LANG==='ar'?'سجلات المعالجة':'Processing Records',value:rAgg.count},{label:LANG==='ar'?'إجمالي NC':'Total NC Quantity',value:ncQty},{label:LANG==='ar'?'الكمية المعالجة':'Processed Quantity',value:processedQty,tone:'good'},{label:LANG==='ar'?'الكمية التالفة':'Damaged Quantity',value:damagedQty,tone:damagedQty?'bad':'good'},{label:LANG==='ar'?'معدل المعالجة':'Processing Rate',value:processedRate,suffix:'%',tone:processedRate==null?'neutral':processedRate>=80?'good':processedRate>=50?'warn':'bad'},{label:LANG==='ar'?'نسبة الفاقد':'Loss Rate',value:rebackLossRate,suffix:'%',tone:rebackLossRate<=2?'good':'warn'}],LANG==='ar'?'تساعد هذه اللوحة على قياس فعالية معالجة NC وتقليل الكميات التالفة.':'This panel measures NC processing effectiveness and damaged quantity reduction.',`<div class="grid-2"><div class="chart-card"><h4>${LANG==='ar'?'المعالجة مقابل التلف':'Processed vs Damaged'}</h4>${renderDonut(rebackParts)}</div>${ncTypeParts.length?`<div class="chart-card"><h4>${LANG==='ar'?'أنواع الـ NC':'NC Types'}</h4>${renderDonut(ncTypeParts)}</div>`:''}</div>`)}
  <div class="card chart-card"><div class="section-title"><h3 style="margin:0;">${LANG==='ar'?'الاتجاه العام للفاقد وNC':'Overall NC & Loss Trend'}</h3></div>${renderBarChart(trendData('totalNC',state.dashboardTrendMonths||6),'var(--accent)')}</div>`;
}

/* ---- Operations workspace helpers ---- */
function filterDefaults(sectionId){
  if(sectionId==='containers') return {blNumber:''};
  if(sectionId==='trucks') return {truckNo:'',product:''};
  if(sectionId==='rebacking') return {product:'',month:''};
  return {query:''};
}
function getSectionFilters(sectionId){
  if(!state.sectionFilters[sectionId]) state.sectionFilters[sectionId] = filterDefaults(sectionId);
  return state.sectionFilters[sectionId];
}
function setSectionFilter(sectionId, key, value){ getSectionFilters(sectionId)[key] = value; }
function clearSectionFilters(sectionId){ state.sectionFilters[sectionId] = filterDefaults(sectionId); }
function normalizedText(value){ return String(value==null?'':value).trim().toLowerCase(); }
function hasActiveSectionFilters(sectionId){ return Object.values(getSectionFilters(sectionId)).some(value=>String(value||'').trim()!==''); }
function productSearchText(record){
  const products = [];
  if(record.product) products.push(record.product);
  if(record.productDesc) products.push(record.productDesc);
  asArray(record.products).forEach(item=> products.push(item.product));
  asArray(record.productDetails).forEach(item=> products.push(item.product));
  return normalizedText(products.filter(Boolean).join(' '));
}
function selectLabel(section, key, value){
  const field = section.fields.find(f=>f.key===key);
  const option = field && (field.options||[]).find(o=>o.value===value);
  return option ? t(option.label) : (value||'');
}
function recordMatchesSectionFilters(sectionId, record){
  const filters = getSectionFilters(sectionId);
  if(sectionId==='containers'){
    if(filters.blNumber && !normalizedText(record.blNumber).includes(normalizedText(filters.blNumber))) return false;
    return true;
  }
  if(sectionId==='trucks'){
    if(filters.truckNo && !normalizedText(record.truckNo).includes(normalizedText(filters.truckNo))) return false;
    if(filters.product && !productSearchText(record).includes(normalizedText(filters.product))) return false;
    return true;
  }
  if(sectionId==='rebacking'){
    if(filters.product && !productSearchText(record).includes(normalizedText(filters.product))) return false;
    if(filters.month && (!record.date || !record.date.startsWith(filters.month))) return false;
    return true;
  }
  if(filters.query && !normalizedText(JSON.stringify(record)).includes(normalizedText(filters.query))) return false;
  return true;
}
function getFilteredRecords(sectionId){
  return getRecords(sectionId).filter(record=>recordMatchesSectionFilters(sectionId, record)).slice().sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (b._created||'').localeCompare(a._created||''));
}
function statusMeta(section, record){
  const key = section.id==='containers' ? 'readyForDispatch' : section.id==='trucks' ? 'inspectionResult' : '';
  const value = key ? record[key] : '';
  const label = key ? selectLabel(section, key, value) : '';
  const tone = ['yes','accepted'].includes(value) ? 'good' : ['no','rejected'].includes(value) ? 'bad' : value ? 'warn' : 'neutral';
  return {label:label || (LANG==='ar'?'غير محدد':'Not set'), tone};
}
function filteredRecordsMarkup(section, records){
  return records.length ? renderRecordTable(section,records) : `<div class="empty-state"><div class="ico">—</div>${LANG==='ar'?'لا توجد سجلات مطابقة للبحث الحالي':'No records match the current search'}</div>`;
}
function refreshSectionFilterPreview(sectionId){
  const section = getSection(sectionId); if(!section) return;
  const records = getFilteredRecords(sectionId); const active = hasActiveSectionFilters(sectionId);
  const metric = document.querySelector(`[data-filter-metric="${sectionId}"]`);
  if(metric){ metric.style.display = active ? '' : 'none'; const value=metric.querySelector('[data-filter-count]'); if(value) value.textContent=records.length; }
  const panelTitle = document.querySelector(`[data-record-panel-title="${sectionId}"]`);
  if(panelTitle) panelTitle.textContent = active ? (LANG==='ar'?'نتائج الفلترة':'Filtered records') : (LANG==='ar'?'سجل العمليات':'Operations register');
  const display = document.querySelector(`[data-records-display="${sectionId}"]`);
  if(display) display.innerHTML = filteredRecordsMarkup(section,records);
  const resultCount = document.querySelector(`[data-filter-result-count="${sectionId}"]`);
  if(resultCount){
    resultCount.textContent = records.length;
    if(resultCount.parentElement) resultCount.parentElement.style.display = active ? '' : 'none';
  }
}

/* ---- Professional operations workspace / List view ---- */
/* Manual work-status control. Identical markup and colour system in every
   section — the user is the only thing that changes an operation's status. */
function renderWorkStatusControl(sectionId, record){
  const status = workStatusOf(record);
  const next = status === 'completed' ? 'working' : 'completed';
  const title = LANG === 'ar'
    ? 'اضغط لتبديل حالة العملية يدويًا'
    : 'Tap to switch the operation status manually';
  return `<button type="button" class="work-toggle ${status}" data-action="toggle-work-status" data-section="${esc(sectionId)}" data-id="${esc(record.id)}" data-next="${next}" title="${esc(title)}" aria-pressed="${status==='completed'}"><span class="work-dot"></span><span class="work-text">${esc(workStatusLabel(status))}</span></button>`;
}
function renderRecordActions(sectionId, recordId){
  return `<div class="record-actions"><button class="btn btn-primary btn-sm" data-action="view-record" data-section="${sectionId}" data-id="${recordId}">${LANG==='ar'?'عرض':'View'}</button><button class="btn btn-quiet btn-sm" data-action="share-record-pdf" data-section="${sectionId}" data-id="${recordId}">PDF</button><button class="btn btn-quiet btn-sm" data-action="edit-record" data-section="${sectionId}" data-id="${recordId}">${LANG==='ar'?'تعديل':'Edit'}</button><button class="btn btn-danger btn-sm" data-action="delete-record" data-section="${sectionId}" data-id="${recordId}" title="${esc(t(STR.delete))}">×</button></div>`;
}
function detailValue(label, value, isHtml = false){
  const shown = value === 0 ? '0' : (value == null || value === '' ? '—' : String(value));
  return `<div class="detail-item"><span class="detail-label">${esc(label)}</span><strong class="detail-value">${isHtml ? shown : esc(shown)}</strong></div>`;
}
function renderDetailField(section, field, value){
  if(value == null || value === '' || (Array.isArray(value) && value.length===0)) return '';
  const label = t(field.label);
  if(field.type==='group'){
    const items = asArray(value).map((item, i)=>`<div class="detail-subcard"><div class="detail-subtitle">${LANG==='ar'?'البند':'Item'} ${i+1}</div>${field.fields.map(sf=>detailValue(t(sf.label), item[sf.key])).join('')}</div>`).join('');
    return items ? `<section class="detail-section"><h3>${esc(label)}</h3><div class="detail-subgrid">${items}</div></section>` : '';
  }
  if(field.type==='multiDate'){
    const dates = asArray(value).map((item,i)=>`<div class="detail-subcard"><div class="detail-subtitle">${LANG==='ar'?'دفعة':'Batch'} ${i+1}</div>${detailValue(LANG==='ar'?'تاريخ الإنتاج':'Production date', item.prod)}${detailValue(LANG==='ar'?'تاريخ الانتهاء':'Expiry date', item.exp)}</div>`).join('');
    return dates ? `<section class="detail-section"><h3>${esc(label)}</h3><div class="detail-subgrid">${dates}</div></section>` : '';
  }
  if(field.type==='image'){
    const imgs = asArray(value).filter(Boolean).map(src=>`<a href="${esc(src)}" target="_blank" class="detail-image-link"><img class="detail-image" src="${esc(src)}" alt="${esc(label)}"></a>`).join('');
    return imgs ? `<section class="detail-section"><h3>${esc(label)}</h3><div class="detail-images">${imgs}</div></section>` : '';
  }
  return `<section class="detail-section"><div class="detail-grid">${detailValue(label, field.type==='select' ? (selectLabel(section,field.key,value)||value) : value)}</div></section>`;
}
function renderRecordDetail(sectionId, record){
  const section = getSection(sectionId);
  if(!section || !record) return `<div class="empty-state">${LANG==='ar'?'تعذر العثور على السجل':'Record not found'}</div>`;
  const identity = sectionId==='containers' ? record.blNumber : sectionId==='trucks' ? record.truckNo : (record.product || record.blNumber);
  const fields = section.fields.map(field=>renderDetailField(section, field, record[field.key])).join('');
  return `<div class="detail-workspace"><div class="detail-header"><div><div class="form-workspace-kicker">${esc(t(section.name))}</div><h1>${esc(identity||t(section.name))}</h1><p>${LANG==='ar'?'عرض كامل لتفاصيل العملية وسجلها التشغيلي':'Complete operational record details'}</p></div><button class="btn" data-action="back-to-list" data-section="${sectionId}">${LANG==='ar'?'العودة إلى السجل':'Back to register'}</button></div><div class="detail-summary">${detailValue(LANG==='ar'?'التاريخ':'Date',record.date)}${detailValue(LANG==='ar'?'آخر تحديث':'Last updated',record._updated||record._created)}<div class="detail-item"><span class="detail-label">${LANG==='ar'?'حالة العملية':'Work status'}</span>${renderWorkStatusControl(sectionId, record)}</div></div>${fields}<div class="detail-footer"><button class="btn btn-quiet" data-action="edit-record" data-section="${sectionId}" data-id="${record.id}">${LANG==='ar'?'تعديل العملية':'Edit record'}</button><button class="btn btn-primary" data-action="share-record-pdf" data-section="${sectionId}" data-id="${record.id}">PDF</button></div></div>`;
}
function renderRecordTable(section, records){
  const isShipment = section.id==='containers';
  const isTruck = section.id==='trucks';
  const isRebacking = section.id==='rebacking';

  let headings = [];
  // Every section carries the same manual work-status column, in the same place.
  const workHead = LANG==='ar' ? 'حالة العملية' : 'Work status';
  const actionsHead = LANG==='ar' ? 'إجراءات' : 'Actions';
  if(isShipment) headings = LANG==='ar' ? ['التاريخ', 'رقم البوليصة', 'المنتج', 'الناقل', 'الحالة', workHead, actionsHead] : ['Date', 'BL Number', 'Product', 'Carrier', 'Status', workHead, actionsHead];
  else if(isTruck) headings = LANG==='ar' ? ['التاريخ', 'رقم العربة', 'المنتج', 'الوجهة', 'الحالة', workHead, actionsHead] : ['Date', 'Truck No', 'Product', 'Destination', 'Status', workHead, actionsHead];
  else if(isRebacking) headings = LANG==='ar' ? ['التاريخ', 'المنتج', workHead, actionsHead] : ['Date', 'Product', workHead, actionsHead];
  else headings = LANG==='ar' ? ['التاريخ', 'المعلومات', workHead, actionsHead] : ['Date', 'Info', workHead, actionsHead];

  const rows = records.map(record=>{
    const status = statusMeta(section, record);
    const workStatus = workStatusOf(record);
    const rowClass = workStatus==="completed"?"row-completed":"row-working";
    const workCell = renderWorkStatusControl(section.id, record);
    
    if(isShipment) return `<tr class="${rowClass}"><td>${esc(record.date||"—")}</td><td><div class="record-primary">${esc(record.blNumber||"—")}</div><div class="record-secondary">${record.containerCount?`${record.containerCount} ${LANG==="ar"?"حاوية":"containers"}`:""}</div></td><td><div class="record-product">${esc(record.productDesc||"—")}</div><div class="record-secondary">${esc(record.countryOfOrigin||"")}</div></td><td>${esc(selectLabel(section,"transportMethod",record.transportMethod)||record.transportMethod||"—")}</td><td><span class="status-badge ${status.tone}">${esc(status.label)}</span></td><td>${workCell}</td><td>${renderRecordActions(section.id,record.id)}</td></tr>`;
    if(isTruck) return `<tr class="${rowClass}"><td>${esc(record.date||"—")}</td><td><div class="record-primary">${esc(record.truckNo||"—")}</div><div class="record-secondary">${esc(record.transporter||"")}</div></td><td><div class="record-product">${esc(productSearchText(record)||"—")}</div></td><td>${esc(record.destination||"—")}</td><td><span class="status-badge ${status.tone}">${esc(status.label)}</span></td><td>${workCell}</td><td>${renderRecordActions(section.id,record.id)}</td></tr>`;
    
    const primary = (section.listFields || []).map(key=>record[key]).filter(Boolean).join(" · ");
    return `<tr class="${rowClass}"><td>${esc(record.date||"—")}</td><td><div class="record-primary">${esc(primary||"—")}</div></td><td>${workCell}</td><td>${renderRecordActions(section.id,record.id)}</td></tr>`;
  }).join("");
  
  return `<div class="records-table-wrap"><table class="records-table"><thead><tr>${headings.map(label=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function filterField(label, control){ return `<div class="filter-field"><label>${label}</label>${control}</div>`; }
function renderSectionFilters(section){
  const filters = getSectionFilters(section.id);
  if(section.id==='containers') return `<div class="filter-grid">${filterField(LANG==='ar'?'رقم البوليصة':'BL number',`<input type="text" autocomplete="off" placeholder="${LANG==='ar'?'ابحث برقم البوليصة':'Search BL number'}" value="${esc(filters.blNumber)}" data-section-filter="${section.id}" data-filter-key="blNumber">`)}</div>`;
  if(section.id==='trucks') return `<div class="filter-grid">
    ${filterField(LANG==='ar'?'رقم العربة':'Vehicle number',`<input type="text" autocomplete="off" placeholder="${LANG==='ar'?'ابحث برقم العربة':'Search vehicle'}" value="${esc(filters.truckNo)}" data-section-filter="${section.id}" data-filter-key="truckNo">`)}
    ${filterField(LANG==='ar'?'المنتج':'Product',`<input type="text" autocomplete="off" placeholder="${LANG==='ar'?'ابحث بالمنتج':'Search product'}" value="${esc(filters.product)}" data-section-filter="${section.id}" data-filter-key="product">`)}
  </div>`;
  if(section.id==='rebacking') return `<div class="filter-grid">${filterField(LANG==='ar'?'المنتج':'Product',`<input type="text" autocomplete="off" placeholder="${LANG==='ar'?'ابحث بالمنتج':'Search product'}" value="${esc(filters.product)}" data-section-filter="${section.id}" data-filter-key="product">`)}${filterField(LANG==='ar'?'الشهر':'Month',`<input type="text" inputmode="numeric" placeholder="YYYY-MM" value="${esc(filters.month)}" data-section-filter="${section.id}" data-filter-key="month">`)}</div>`;
  return `<div class="filter-grid">${filterField(LANG==='ar'?'بحث داخل السجلات':'Search records',`<input type="text" autocomplete="off" placeholder="${esc(t(STR.search))}" value="${esc(filters.query)}" data-section-filter="${section.id}" data-filter-key="query">`)}</div>`;
}
function renderList(sectionId){
  const section = getSection(sectionId); if(!section) return '';
  const allRecords = getRecords(sectionId); const records = getFilteredRecords(sectionId); const filtersActive = hasActiveSectionFilters(sectionId);
  const description = sectionId==='containers' ? (LANG==='ar'?'تابع الشحنات من مساحة عمل واحدة.':'Manage shipments from one workspace.') : sectionId==='trucks' ? (LANG==='ar'?'أدر فحوصات الشاحنات والمنتجات المحمّلة بوضوح وسرعة من سجل تشغيلي موحّد.':'Manage truck inspections and loaded products from one operational register.') : sectionId==='rebacking' ? (LANG==='ar'?'تابع عمليات معالجة المنتجات والكميات والفاقد من سجل تشغيلي منظم.':'Track product processing, quantities, and loss from an organized operational register.') : (LANG==='ar'?'استعرض السجلات ونظّم النتائج والتصدير من مكان واحد.':'Review records, organize results, and export from one place.');
  return `<div class="operations-shell"><section class="workspace-header"><div><div class="workspace-kicker">${LANG==='ar'?'سجل العمليات':'OPERATIONS REGISTER'}</div><h1 class="workspace-title">${esc(t(section.name))}</h1><p class="workspace-description">${description}</p></div><button class="btn btn-primary" data-action="new-record" data-section="${sectionId}">${LANG==='ar'?'سجل عملية جديدة':'New record'}</button></section>
    <section class="workspace-metrics"><div class="workspace-metric"><span class="value">${allRecords.length}</span><span class="label">${LANG==='ar'?'إجمالي السجلات':'Total records'}</span></div><div class="workspace-metric" data-filter-metric="${sectionId}" style="display:${filtersActive?'':'none'}"><span class="value" data-filter-count>${records.length}</span><span class="label">${LANG==='ar'?'نتائج الفلترة':'Filtered records'}</span></div></section>
    <section class="filter-panel"><div class="filter-panel-head"><div><h2 class="filter-panel-title">${LANG==='ar'?'بحث':'Search'}</h2><div class="filter-panel-note">${LANG==='ar'?'التصدير يعكس النتائج الظاهرة فقط.':'Exports include visible results only.'}</div></div></div>${renderSectionFilters(section)}<div class="filter-footer"><div class="filter-results" style="display:${filtersActive?'':'none'}"><b data-filter-result-count="${sectionId}">${records.length}</b> ${LANG==='ar'?'سجل مطابق':'matching records'}</div><div class="filter-actions"><button class="btn btn-quiet btn-sm" data-action="clear-section-filters" data-section="${sectionId}">${LANG==='ar'?'مسح البحث':'Clear search'}</button><button class="btn btn-quiet btn-sm" data-action="export-filtered-csv" data-section="${sectionId}">CSV</button><button class="btn btn-quiet btn-sm" data-action="export-filtered-xlsx" data-section="${sectionId}">Excel</button><button class="btn btn-primary btn-sm" data-action="share-filtered-pdf" data-section="${sectionId}">PDF</button></div></div></section>
    <section class="records-panel"><div class="records-panel-head"><div><div class="records-panel-title" data-record-panel-title="${sectionId}">${filtersActive?(LANG==='ar'?'نتائج الفلترة':'Filtered records'):(LANG==='ar'?'سجل العمليات':'Operations register')}</div><div class="records-panel-sub">${LANG==='ar'?'يدعم السجل عددًا كبيرًا من العمليات ويعرض الأحدث أولًا.':'The register supports a large number of operations and shows newest records first.'}</div></div></div><div data-records-display="${sectionId}">${filteredRecordsMarkup(section,records)}</div></section></div>`;
}

/* ---- Form view ---- */
function renderForm(sectionId){
  const section = getSection(sectionId);
  if(!section) return '';
  const record = state.currentRecord;
  const fieldsHtml = section.fields.map(f=> renderField(f, record)).join('');
  const draft = getFormDraft(sectionId);
  const time = draft && draft.savedAt ? formatDraftTime(draft.savedAt) : '';
  const draftMessage = `${t(STR.draftSaved)}${time ? ` · ${time}` : ''}`;
  const isEditing = !!state.editingRecordId;
  return `<div class="form-workspace"><section class="form-workspace-header"><div><div class="form-workspace-kicker">${LANG==='ar'?'إدارة السجل':'RECORD MANAGEMENT'}</div><h1>${isEditing?(LANG==='ar'?'تعديل سجل':'Edit record'):(LANG==='ar'?'سجل عملية جديدة':'New operation record')} — ${esc(t(section.name))}</h1><p>${LANG==='ar'?'أدخل البيانات الأساسية أولًا. تحفظ المسودة تلقائيًا على هذا الجهاز أثناء العمل.':'Enter the core information first. The draft is saved automatically on this device while you work.'}</p></div><button class="btn btn-outline btn-sm" data-action="nav" data-view="list" data-section="${sectionId}">${LANG==='ar'?'العودة إلى السجل':'Back to register'}</button></section><section class="form-panel"><div class="draft-strip"><div class="draft-meta"><span id="draftStatus">${esc(draftMessage)}</span></div><button class="btn btn-outline btn-sm" data-action="discard-draft" data-section="${sectionId}">${esc(t(STR.discardDraft))}</button></div><div class="form-grid">${fieldsHtml}</div><div class="form-actions"><button class="btn btn-outline" data-action="nav" data-view="list" data-section="${sectionId}">${esc(t(STR.cancel))}</button><button class="btn btn-primary" data-action="save-record" data-section="${sectionId}">${LANG==='ar'?'حفظ السجل':'Save record'}</button></div></section></div>`;
}

function renderImageField(path, arr, labelHtml){
  arr = asArray(arr);
  const thumbs = arr.map((imgId,idx)=>`<div class="img-thumb"><img data-imgid="${imgId}" loading="lazy" alt=""><button class="rm" data-action="remove-image" data-field="${esc(path)}" data-index="${idx}">✕</button></div>`).join('');
  return `<div class="field field-full">${labelHtml}
    <div class="img-grid">${thumbs}
      <label class="file-btn">📷 ${esc(t(STR.addPhotos))}<input type="file" accept="image/*" multiple data-action="add-image" data-field="${esc(path)}"></label>
    </div>
  </div>`;
}

function renderField(f, record){
  const val = getPath(record, f.key);
  const req = f.required ? '<span class="req">*</span>' : '';
  const label = `<label>${esc(t(f.label))} ${req}</label>`;
  const full = (f.type==='textarea'||f.type==='group'||f.type==='multiDate'||f.type==='image'||f.type==='computed') ? ' field-full' : '';

  if(f.type==='text'){
    return `<div class="field${full}">${label}<input type="text" data-field="${f.key}" value="${esc(val||'')}"></div>`;
  }
  if(f.type==='number'){
    return `<div class="field${full}">${label}<input type="text" inputmode="decimal" data-field="${f.key}" value="${esc(val!=null?val:'')}"></div>`;
  }
  if(f.type==='date'){
    return `<div class="field${full}">${label}<input type="text" inputmode="text" autocomplete="off" placeholder="YYYY-MM-DD" data-field="${f.key}" value="${esc(val||'')}"></div>`;
  }
  if(f.type==='textarea'){
    return `<div class="field${full}">${label}<textarea data-field="${f.key}">${esc(val||'')}</textarea></div>`;
  }
  if(f.type==='unit'){
    return `<div class="field${full}">${label}
      <input type="text" list="unitOptionsList" data-field="${f.key}" value="${esc(val||'')}">
    </div>`;
  }
  if(f.type==='select'){
    const opts = (f.options||[]).map(o=>`<option value="${esc(o.value)}" ${o.value===val?'selected':''}>${esc(t(o.label))}</option>`).join('');
    return `<div class="field${full}">${label}<select data-field="${f.key}"><option value="">--</option>${opts}</select></div>`;
  }
  if(f.type==='computed'){
    let cv; try{ cv = f.compute(record||{}); }catch(e){ cv=null; }
    const display = (cv==null || isNaN(cv)) ? '—' : cv.toFixed(2)+'%';
    return `<div class="field field-full">${label}
      <div class="computed-box" id="computed-${f.key}">${display}</div>
      <div class="hint">${LANG==='ar'?'يُحسب تلقائياً':'Calculated automatically'}</div>
    </div>`;
  }
  if(f.type==='multiDate'){
    const arr = asArray(val);
    const rows = arr.map((item,idx)=>`
      <div class="md-row">
        <input type="text" inputmode="text" autocomplete="off" data-field="${f.key}.${idx}.prod" value="${esc(item.prod||'')}" placeholder="${LANG==='ar'?'الإنتاج YYYY-MM-DD':'Production YYYY-MM-DD'}">
        <span>→</span>
        <input type="text" inputmode="text" autocomplete="off" data-field="${f.key}.${idx}.exp" value="${esc(item.exp||'')}" placeholder="${LANG==='ar'?'الانتهاء YYYY-MM-DD':'Expiry YYYY-MM-DD'}">
        <button class="btn btn-danger btn-sm" data-action="remove-multidate" data-group="${f.key}" data-index="${idx}">✕</button>
      </div>`).join('');
    return `<div class="field field-full">${label}
      <div class="group-block">${rows || `<div class="hint">${LANG==='ar'?'لا توجد تواريخ مضافة':'No dates added'}</div>`}
      <button class="btn btn-outline btn-sm" data-action="add-multidate" data-group="${f.key}">+ ${LANG==='ar'?'إضافة تاريخ':'Add date'}</button></div>
    </div>`;
  }
  if(f.type==='group'){
    const arr = asArray(val);
    const normalSubFields = f.fields.filter(sf=>sf.type!=='image');
    const imageSubFields = f.fields.filter(sf=>sf.type==='image');
    const items = arr.map((item,idx)=>{
      const subHtml = normalSubFields.map(sf=>{
        const rawValue = item[sf.key];
        const sval = sf.key==='condition' && ['damaged','repair'].includes(rawValue) ? 'bad' : rawValue;
        const subLabel = `<label>${esc(t(sf.label))}</label>`;
        if(sf.type==='select'){
          const opts = (sf.options||[]).map(o=>`<option value="${esc(o.value)}" ${o.value===sval?'selected':''}>${esc(t(o.label))}</option>`).join('');
          return `<div class="field">${subLabel}<select data-field="${f.key}.${idx}.${sf.key}"><option value="">--</option>${opts}</select></div>`;
        }
        if(sf.type==='textarea') return `<div class="field" style="grid-column:1/-1">${subLabel}<textarea data-field="${f.key}.${idx}.${sf.key}">${esc(sval||'')}</textarea></div>`;
        if(sf.type==='unit') return `<div class="field">${subLabel}<input type="text" list="unitOptionsList" data-field="${f.key}.${idx}.${sf.key}" value="${esc(sval||'')}"></div>`;
        const inputType = 'text';
        const extraAttrs = sf.type==='number' ? ' inputmode="decimal"' : '';
        const dateAttrs = sf.type==='date' ? ' inputmode="text" autocomplete="off" placeholder="YYYY-MM-DD"' : '';
        return `<div class="field">${subLabel}<input type="${inputType}"${extraAttrs}${dateAttrs} data-field="${f.key}.${idx}.${sf.key}" value="${esc(sval!=null?sval:'')}"></div>`;
      }).join('');
      const imageHtml = imageSubFields.map(sf=> renderImageField(`${f.key}.${idx}.${sf.key}`, item[sf.key], `<label>${esc(t(sf.label))}</label>`)).join('');
      return `<div class="group-item"><span class="chip">#${idx+1}</span>
        <div class="grid-mini" style="margin-top:8px;">${subHtml}</div>
        ${imageHtml}
        <div class="rm-row"><button class="btn btn-danger btn-sm" data-action="remove-group-item" data-group="${f.key}" data-index="${idx}">🗑️ ${esc(t(STR.delete))}</button></div>
      </div>`;
    }).join('');
    return `<div class="field field-full">
      <div class="group-block">
        <div class="group-header"><b>${esc(t(f.label))}</b>
        <button class="btn btn-primary btn-sm" data-action="add-group-item" data-group="${f.key}">+ ${esc(t(STR.add))}</button></div>
        ${items || `<div class="hint">${LANG==='ar'?'لا توجد عناصر بعد':'No items yet'}</div>`}
      </div>
    </div>`;
  }
  if(f.type==='image'){
    return renderImageField(f.key, val, label);
  }
  return '';
}

function unitDatalist(){
  return `<datalist id="unitOptionsList">${UNIT_OPTIONS.map(u=>`<option value="${esc(LANG==='ar'?u.ar:u.en)}">`).join('')}</datalist>`;
}

async function hydrateAllImages(){
  const imgs = document.querySelectorAll('img[data-imgid]');
  const promises = Array.from(imgs).map(async img=>{
    const id = img.getAttribute('data-imgid');
    if(/^https?:\/\//.test(id)){ img.src = id; return; }
    try{
      const url = await getImage(id);
      if(url) img.src = url;
    }catch(e){ console.warn('Image hydration failed:', e); }
  });
  await Promise.all(promises);
  const existingDatalist = document.getElementById('unitOptionsList');
  if(existingDatalist) existingDatalist.remove();
  const div = document.createElement('div'); div.innerHTML = unitDatalist(); document.body.appendChild(div.firstChild);
}

function updateComputedDisplays(section){
  if(!state.currentRecord) return;
  if(section.id==='containers'){
    const details = Array.isArray(state.currentRecord.containerDetails) ? state.currentRecord.containerDetails : [];
    const totalQty = details.reduce((s,c)=>s+(parseFloat(c.qty)||0),0);
    const totalNC = details.reduce((s,c)=>s+(parseFloat(c.nc)||0),0);
    const totalLoss = details.reduce((s,c)=>s+(parseFloat(c.loss)||0),0);
    /* totalReback كان يُحسب عند الحفظ فقط، فتظهر قيمة قديمة أثناء التعبئة — الآن يتزامن لحظياً */
    const totalReback = details.reduce((s,c)=>s+(parseFloat(c.reback)||0),0);
    state.currentRecord.billQty = totalQty;
    state.currentRecord.containerCount = details.length;
    state.currentRecord.totalNC = totalNC;
    state.currentRecord.totalLoss = totalLoss;
    state.currentRecord.totalReback = totalReback;
    const bqEl = document.getElementById('billQty'); if(bqEl) bqEl.value = totalQty;
    const ccEl = document.getElementById('containerCount'); if(ccEl) ccEl.value = details.length;
    const ncEl = document.getElementById('totalNC'); if(ncEl) ncEl.value = totalNC;
    const lsEl = document.getElementById('totalLoss'); if(lsEl) lsEl.value = totalLoss;
    const rbEl = document.getElementById('totalReback'); if(rbEl) rbEl.value = totalReback;
  }
  section.fields.filter(f=>f.type==='computed').forEach(f=>{
    const el = document.getElementById('computed-'+f.key);
    if(!el) return;
    let val; try{ val = f.compute(state.currentRecord); }catch(e){ val=null; }
    el.textContent = (val==null||isNaN(val)) ? '—' : val.toFixed(2)+'%';
  });
}

/* ===================== Files Library (local device) ===================== */
let FILES_CACHE = [];
async function refreshFilesCache(){
  const list = await getExportedFiles();
  FILES_CACHE = list.sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  if(state.view==='files') render();
}
function renderFilesView(){
  const kindIcon = {pdf:'📄', xlsx:'📊', csv:'📋'};
  const rows = FILES_CACHE.map(f=>`
    <div class="record-card">
      <div class="top">
        <div><div class="main">${kindIcon[f.kind]||'📁'} ${esc(f.filename)}</div><div class="meta">${f.createdAt? new Date(f.createdAt).toLocaleString(LANG==='ar'?'ar-EG':'en-GB'):''}</div></div>
      </div>
      <div class="actions" style="margin-top:8px;flex-wrap:wrap;">
        ${f.kind==='pdf' ? `<button class="btn btn-outline btn-sm" data-action="view-stored-file" data-id="${f.id}">👁️ ${esc(t(STR.viewFile))}</button>`:''}
        <button class="btn btn-outline btn-sm" data-action="share-stored-file" data-id="${f.id}">📤 ${esc(t(STR.shareFile))}</button>
        <button class="btn btn-outline btn-sm" data-action="download-stored-file" data-id="${f.id}">⬇️ ${esc(t(STR.downloadAgain))}</button>
        <button class="btn btn-danger btn-sm" data-action="delete-stored-file" data-id="${f.id}">🗑️</button>
      </div>
    </div>`).join('');
  return `
  <div class="card">
    <div class="section-title"><h2>📁 ${esc(t(STR.filesTab))}</h2></div>
    <div class="hint" style="margin-bottom:10px;">${esc(t(STR.filesHint))}</div>
    ${rows || `<div class="empty-state"><div class="ico">📭</div>${esc(t(STR.noRecords))}</div>`}
  </div>`;
}

/* ===================== Monthly Report ===================== */
function renderMonthly(){
  const sections = getAllSections();
  const {month, year} = state.monthly;
  const monthStr = String(month).padStart(2,'0');
  const prefix = `${year}-${monthStr}`;
  const summaries = sections.map(s=>{
    const recs = getRecords(s.id).filter(r=> r.date && r.date.startsWith(prefix));
    const numFields = s.fields.filter(f=>f.type==='number');
    const totals = numFields.map(f=>{
      const sum = recs.reduce((acc,r)=> acc + (parseFloat(r[f.key])||0), 0);
      return {label:f.label, sum};
    });
    return {section:s, count:recs.length, totals};
  });

  const rows = summaries.map(s=>`
    <tr>
      <td>${s.section.icon} ${esc(t(s.section.name))}</td>
      <td>${s.count}</td>
      <td>${s.totals.map(tt=>`${esc(t(tt.label))}: <b>${tt.sum}</b>`).join(' · ') || '—'}</td>
      <td>
        <button class="btn btn-outline btn-sm" data-action="export-csv-month" data-section="${s.section.id}">CSV</button>
        <button class="btn btn-outline btn-sm" data-action="export-xlsx-month" data-section="${s.section.id}">Excel</button>
        <button class="btn btn-outline btn-sm" data-action="export-pdf-month" data-section="${s.section.id}">PDF</button>
      </td>
    </tr>`).join('');

  const years = []; const curY = new Date().getFullYear(); for(let y=curY-2;y<=curY+1;y++) years.push(y);
  const monthOptions = Array.from({length:12},(_,i)=>i+1);

  return `
  <div class="card">
    <div class="section-title"><h2>🗓️ ${esc(t(STR.monthly))}</h2></div>
    <div class="toolbar">
      <select data-action="monthly-month">${monthOptions.map(m=>`<option value="${m}" ${m==month?'selected':''}>${m}</option>`).join('')}</select>
      <select data-action="monthly-year">${years.map(y=>`<option value="${y}" ${y==year?'selected':''}>${y}</option>`).join('')}</select>
      <button class="btn btn-primary btn-sm" data-action="export-combined-month">${LANG==='ar'?'حزمة Excel الشهرية':'Monthly Excel package'}</button>
      <button class="btn btn-outline btn-sm" data-action="export-combined-month-pdf">${LANG==='ar'?'تقرير PDF الموحد':'Combined PDF report'}</button>
    </div>
    <table class="summary-table">
      <thead><tr><th>${LANG==='ar'?'القسم':'Section'}</th><th>${esc(t(STR.recordsCount))}</th><th>${esc(t(STR.summary))}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}