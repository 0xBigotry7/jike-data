'use strict';
// Published research deliverables. This interface does not simulate a live model session.
let missionCatalogue = [], missionLoadState = 'loading';
let selectedMissionId = new URL(location.href).searchParams.get('case') || '';
let missionPane = 'summary';
const missionNotesKey = 'everymart-mission-notes-v1';
let missionNotes = readLocalObject(missionNotesKey, {});
const agentSymbol = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 4v24M4 16h24M7.5 7.5l17 17m0-17-17 17" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const missionNav = {overview:['AI 工作台','工作台'],products:['采购核价','核价'],watch:['持续跟踪','跟踪'],store:['现场验证','验证'],reports:['证据档案','档案']};
Object.entries(missionNav).forEach(([id,names])=>{
  labels[id]=names[0];
  const link=document.querySelector('[data-nav="'+id+'"]');
  if(link){link.setAttribute('aria-label',names[0]);link.querySelector('.nav-full').textContent=names[0];link.querySelector('.nav-short').textContent=names[1];}
});

function missionIntegrity(m, observations=records, signals=editorialData.items||[], now=Date.now(), failed=signalsFetchFailed){
  const changed=[],missing=[];
  for(const [kind,expected,pool] of [['record',m.expected_records||{},observations],['signal',m.expected_signals||{},signals]]){
    for(const [id,fields] of Object.entries(expected)){
      const item=pool.find(r=>r.id===id);
      if(!item){missing.push(kind+':'+id);continue;}
      if(Object.entries(fields).some(([key,value])=>JSON.stringify(item[key]??null)!==JSON.stringify(value??null)))changed.push(kind+':'+id);
    }
  }
  const date=Date.parse(m.reviewed_at||'');
  const stale=!Number.isFinite(date)||now-date>7*86400000||date>now+86400000;
  const refreshFailed=Boolean(failed&&(m.signal_ids||[]).length);
  return {valid:!changed.length&&!missing.length&&!stale&&!refreshFailed,changed,missing,stale,refreshFailed};
}
function availableMissions(){return role==='store'?missionCatalogue.filter(m=>m.audience!=='group'):missionCatalogue;}
function selectedMission(){const list=availableMissions();return list.find(m=>m.id===selectedMissionId)||list[0];}
function missionNote(m){const note=missionNotes[m.id];return note&&typeof note==='object'?note:{};}
function sourceDateText(date){return date||'来源日期未明示';}
function missionObservation(m){return (m.record_ids||[]).map(id=>records.find(r=>r.id===id)).filter(Boolean);}
function missionSignals(m){return (m.signal_ids||[]).map(id=>(editorialData.items||[]).find(r=>r.id===id)).filter(Boolean);}
function safeMissionState(m){const check=missionIntegrity(m);return check.valid?m.state:check.stale?'历史交付':'证据待复核';}
function focusMission(id){
  const m=missionCatalogue.find(x=>x.id===id);if(!m)return;
  selectedMissionId=id;missionPane='summary';
  const url=new URL(location.href);url.searchParams.set('case',id);history.replaceState(null,'',url);
  overview();
  if(matchMedia('(max-width:820px)').matches)document.getElementById('mission-output')?.scrollIntoView({block:'start'});
  document.getElementById('mission-title')?.focus({preventScroll:true});
}
function saveMissionNote(m,state){
  const next={...missionNotes,[m.id]:{state,at:new Date().toISOString()}};
  try{localStorage.setItem(missionNotesKey,JSON.stringify(next));missionNotes=next;return true;}catch{return false;}
}
function missionStatusLabel(m){if(!missionIntegrity(m).valid)return safeMissionState(m);const state=missionNote(m).state;return state==='queued'?'已列入我的待办':state==='deferred'?'我已暂缓':safeMissionState(m);}
function missionProgress(m){
  const draft=m.sku?costSession.drafts[m.sku]:null;
  if(!draft||!['goods','freight','discount','current'].some(k=>String(draft[k]??'').trim()))return '';
  const result=costResult(draft),comparison=comparisonState(localDateTime().slice(0,10),draft);
  return '<section class="mission-progress"><span>你的后续补充 · 本设备核价草稿</span><strong>'+(result.error?'报价已保留，继续补齐条件':'按你填写的条件：¥ '+fmt(result.unit)+' / 瓶')+'</strong><p>'+escapeHtml(result.error?result.error:comparison.allowed&&result.delta!=null?'较现行单价'+(result.delta>=0?'低 ':'高 ')+'¥ '+fmt(Math.abs(result.delta))+' / 瓶。用户填写结果，凭证未独立核验。':comparison.reason)+'</p></section>';
}
function missionQueue(){return '<aside class="mission-queue" aria-label="已整理的经营任务"><div class="queue-heading"><h2>本期工作交付</h2><span>'+availableMissions().length+'</span></div>'+availableMissions().map((m,i)=>'<button type="button" class="mission-option '+(m.id===selectedMission()?.id?'selected':'')+'" data-mission-case="'+escapeHtml(m.id)+'" aria-pressed="'+(m.id===selectedMission()?.id)+'"><span class="mission-option-meta"><span>0'+(i+1)+' · '+escapeHtml(m.kind)+'</span><span>'+escapeHtml(missionStatusLabel(m))+'</span></span><strong>'+escapeHtml(m.title)+'</strong><span class="mission-option-summary">'+escapeHtml(missionIntegrity(m).valid?m.short:'原交付待复核，先看引用与待核条件。')+'</span><span class="mission-option-date">'+escapeHtml(m.reviewed_at)+' 整理 <b>↗</b></span></button>').join('')+'<a class="all-evidence" href="#reports">展开完整研究与历史版本 ↗</a></aside>';}
function missionEvidenceSummary(m){
  const quotes=missionObservation(m);
  if(quotes.length)return '<div class="mission-quote-pair">'+quotes.map(o=>'<button type="button" data-key="'+escapeHtml(keyOf(o))+'"><span>'+escapeHtml(o.supplier)+'</span><strong>¥ '+fmt(o.raw_price)+'<small> / '+escapeHtml(o.raw_unit.replace('元/',''))+'</small></strong><span>'+escapeHtml(o.region)+'</span><small>异地挂牌参考 · 非成都到店价 ↗</small></button>').join('')+'</div>';
  return '<div class="mission-source-snippet">'+missionSignals(m).map(s=>'<span class="source-stamp">'+escapeHtml(s.source_date)+' 发布 · '+escapeHtml(s.region)+'</span><p>'+escapeHtml(s.evidence)+'</p>').join('')+'</div>';
}
function renderMissionPane(m){
  const integrity=missionIntegrity(m);
  if(missionPane==='trace')return '<div class="mission-trace"><p class="pane-intro">以下是 '+escapeHtml(m.reviewed_at)+' 已整理的工作记录，不是此刻正在运行的任务。</p>'+m.traces.map((t,i)=>'<div class="trace-step '+t.status+'"><span>'+ (t.status==='done'?'✓':String(i+1))+'</span><div><strong>'+escapeHtml(t.title)+'</strong><p>'+escapeHtml(t.body)+'</p></div><small>'+ (t.status==='done'?'已整理':'待补条件')+'</small></div>').join('')+'</div>';
  if(missionPane==='sources')return '<div class="mission-citations"><p class="pane-intro">版本与日期分别保留。来源有变化时，旧判断先标记待复核。</p>'+missionObservation(m).map(o=>'<article><span>'+escapeHtml(o.id)+' · '+escapeHtml(o.collected_at)+' 检索</span><strong>'+escapeHtml(o.source_title)+'</strong><p>'+escapeHtml(o.spec)+' · '+escapeHtml(sourceDateText(o.source_date))+'</p><p>'+escapeHtml(o.conditions)+'</p>'+(o.duplicate_of?'<p class="memory-link">关联历史 '+escapeHtml(o.duplicate_of)+' · 本次为重访</p>':'')+'<div><a href="'+escapeHtml(safeUrl(o.source_url))+'" target="_blank" rel="noopener noreferrer">打开公开来源 ↗</a><button type="button" class="text-button" data-key="'+escapeHtml(keyOf(o))+'">查看完整记录 ↗</button></div></article>').join('')+missionSignals(m).map(s=>'<article><span>'+escapeHtml(s.source_date)+' 发布 · '+escapeHtml(s.collected_at)+' 检索</span><strong>'+escapeHtml(s.title)+'</strong><p>'+escapeHtml(s.boundary)+'</p><a href="'+escapeHtml(safeUrl(s.source_url))+'" target="_blank" rel="noopener noreferrer">打开公开来源 ↗</a></article>').join('')+'</div>';
  if(missionPane==='next')return '<div class="mission-next"><h3>什么新证据会改变这次判断？</h3><p>'+escapeHtml(m.next_trigger)+'</p><ol>'+m.checklist.map(t=>'<li>'+escapeHtml(t)+'</li>').join('')+'</ol><button type="button" class="btn" data-mission-export="'+escapeHtml(m.id)+'">导出这份工作提纲 ↓</button><p class="pane-intro">人工回填在当前设备保存；尚未接入跨门店共享与自动执行回执。</p></div>';
  return '<div class="mission-reasoning"><h3>'+(integrity.valid?'这次判断基于什么':'原交付的判断依据')+'</h3><ul>'+m.facts.map(t=>'<li>'+escapeHtml(t)+'</li>').join('')+'</ul><p class="mission-boundary">'+escapeHtml(m.boundary)+'</p></div>';
}
function missionOutput(m){
  const integrity=missionIntegrity(m),note=missionNote(m);
  const currentTitle=integrity.valid?m.headline:integrity.stale?'这份交付需要重新复核，\n先确认条件仍然有效。':'引用证据已变化或未载入，\n原判断暂不作为当前建议。';
  return '<article class="mission-output" id="mission-output"><div class="agent-message-meta"><span class="agent-glyph">'+agentSymbol+'</span><div><strong>集刻 AI 研究交付</strong><span>'+escapeHtml(m.kind)+' · '+escapeHtml(m.reviewed_at)+' 复核</span></div><span class="mission-state">'+escapeHtml(safeMissionState(m))+'</span></div><h2 id="mission-title" tabindex="-1">'+escapeHtml(currentTitle).replace(/\n/g,'<br>')+'</h2><p class="mission-summary">'+escapeHtml(integrity.valid?m.summary:'已保留原记录与来源。查看引用和复核条件后，再继续核价或现场验证。')+'</p>'+missionEvidenceSummary(m)+missionProgress(m)+
    '<section class="handoff-card"><div><span class="handoff-eyebrow">下一步 / '+(integrity.valid?'补齐决策条件':'先复核证据')+'</span><p>'+escapeHtml(m.request)+'</p></div><div class="handoff-actions"><button type="button" class="btn primary" data-mission-action="'+escapeHtml(m.id)+'">'+escapeHtml(integrity.valid?m.action_label:'查看待核条件')+' <span>↗</span></button><button type="button" class="mission-secondary" data-mission-note="queued">'+(note.state==='queued'?'已列入待办 ✓':'列入我的待办')+'</button></div></section>'+
    '<div class="mission-pane-tabs" role="group" aria-label="交付详情">'+[['summary','判断依据'],['trace','已完成的工作'],['sources','引用与版本'],['next','下一步条件']].map(([key,label])=>'<button type="button" aria-pressed="'+(missionPane===key)+'" data-mission-pane="'+key+'">'+label+'</button>').join('')+'</div><div id="mission-pane">'+renderMissionPane(m)+'</div>'+
    '<div class="mission-personal"><span id="mission-local-status" role="status">'+(note.state?(note.state==='queued'?'已列入我的待办':'已暂缓')+' · '+escapeHtml(shortDate(note.at))+' · 仅本设备':'我的处理状态仅保存在本设备，不会下达后台任务。')+'</span><button type="button" data-mission-note="'+(note.state==='deferred'?'clear':'deferred')+'">'+(note.state==='deferred'?'恢复待处理':'暂不处理')+'</button></div></article>';
}
function continuityProof(){
  const h=monitorHealth(),runs=runWindow(),revisits=records.filter(r=>r.origin==='round6'&&(r.record_status==='revisit'||r.duplicate_of));
  return '<section class="continuity-proof"><div class="continuity-heading"><div><span class="native-eyebrow">持续积累的工作</span><h2>下一次打开，沿着这次的证据继续。</h2></div><a href="#watch">实际运行记录 ↗</a></div><div class="continuity-columns"><article><span>01 / 跟踪</span><h3>按计划检查变化</h3><p>最近 24 小时实际检查 <b>'+runs.count+' 轮</b>；固定公开来源本轮 <b>'+(h.total?h.good+'/'+h.total:'—')+'</b> 成功。</p><a href="#watch">'+escapeHtml(h.text)+' ↗</a></article><article><span>02 / 记忆</span><h3>对照历史，识别重复</h3><p>本期保留 <b>'+revisits.length+' 条重访关联</b>。同一商品的多次发现，继续沿用已有证据。</p><button type="button" class="text-button" data-mission-memory>看一次实际重访 ↗</button></article><article><span>03 / 交付</span><h3>把缺口变成下一步</h3><p>公开证据已整理成核价与现场观察提纲；补齐实际条件后，再继续作判断。</p><a href="#store">接着做现场验证 ↗</a></article></div></section>';
}
function serviceScope(){return '<details class="service-scope"><summary>当前服务范围与下一阶段能力 <span>公开情报已接入 · 门店经营系统待接入</span></summary><div><section><h3>现在可以交付</h3><p>公开来源按计划检查、AI 检索后发布复核结果、来源版本与重复关联、核价和现场验证工具。</p><p>固定检查计划每 6 小时；AI 检索计划每日一次，依赖本机与调度可用。页面展示已发布交付，不是实时对话。</p></section><section><h3>形成更强经营优势，还要补齐</h3><p>经授权接入门店 ERP / POS、集团共享的经营记忆、任务回收与执行回执；用实际节约工时、有效报价和经营结果验证价值。</p><p>当前未提供自由对话、自动下单或经验证的利润提升。</p></section></div></details>';}
overview=function(){
  main.className='decision-page native-workspace';
  if(missionLoadState!=='ready'){
    main.innerHTML='<section class="agent-welcome"><span class="agent-glyph">'+agentSymbol+'</span><h1>'+(missionLoadState==='error'?'工作交付暂未载入':'正在打开本期工作交付')+'</h1><p>采购核价、现场验证与完整证据仍可单独访问。</p><div class="native-fallback-links"><a class="btn" href="#products">采购核价</a><a class="btn" href="#watch">持续跟踪</a>'+(missionLoadState==='error'?'<button class="btn" data-retry-missions>重试载入</button>':'')+'</div></section>';return;
  }
  const m=selectedMission();if(!m){main.innerHTML='<section class="agent-welcome"><h1>这一视角暂无已发布交付</h1><a class="btn" href="#watch">查看持续跟踪</a></section>';return;}
  selectedMissionId=m.id;
  main.innerHTML='<div class="agent-welcome"><div class="agent-welcome-top"><span class="native-eyebrow">EVERY MART / 你的经营研究助理</span><a class="native-check-stamp" href="#watch"><span class="native-status-dot"></span>监测截至 '+escapeHtml(shortDate(watchData?.generated_at))+' ↗</a></div><h1>先看值得你决策的事。</h1><p>AI 持续跟踪经营线索，带着证据和下一步来找你。</p><div class="business-context"><span>集刻 · 成都</span><span>约 400 SKU 精选店型</span><span>同规格 · 同税运 · 到店成本</span></div></div><div class="mobile-mission-picker"><label>切换工作交付<select id="mission-picker">'+availableMissions().map(x=>'<option value="'+escapeHtml(x.id)+'" '+(x.id===m.id?'selected':'')+'>'+escapeHtml(x.kind+' · '+x.title)+'</option>').join('')+'</select></label></div><div class="mission-layout">'+missionQueue()+missionOutput(m)+'</div>'+continuityProof()+serviceScope();
};
function missionBriefText(m){
  const now=new Date().toISOString(),valid=missionIntegrity(m).valid;
  return '# '+m.handoff_title+'\n\n集刻 every mart · 已发布研究交付\n复核日期：'+m.reviewed_at+'\n导出时间：'+now+'\n状态：'+safeMissionState(m)+'\n\n## '+(valid?'本次判断':'原交付判断（待复核，不作为当前建议）')+'\n'+m.short+'\n\n## 下一步清单\n'+m.checklist.map((t,i)=>(i+1)+'. '+t).join('\n')+'\n\n## 适用边界\n'+m.boundary+'\n\n## 引用\n'+[...missionObservation(m).map(o=>'- '+o.id+' '+o.source_title+' / '+o.source_url+' / 来源日期 '+escapeHtml(sourceDateText(o.source_date))+' / 检索 '+o.collected_at),...missionSignals(m).map(o=>'- '+o.id+' '+o.title+' / '+o.source_url+' / 发布 '+o.source_date+' / 检索 '+o.collected_at)].join('\n')+'\n\n此文件供人工执行与回收，不代表已联系供应商、执行调价或下达后台任务。\n';
}
function exportMission(m){const url=URL.createObjectURL(new Blob(['\ufeff'+missionBriefText(m)],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='集刻-'+m.handoff_title+'.md';document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1000);const status=document.getElementById('mission-local-status');if(status)status.textContent='工作提纲已生成；供人工执行，尚未发送给其他人。';}
const costViewBeforeMissions=products;
products=function(){costViewBeforeMissions();const m=missionCatalogue.find(x=>x.id===selectedMissionId&&x.action==='cost'&&x.sku===costSession.selected);if(!m)return;main.insertAdjacentHTML('afterbegin','<div class="mission-context"><span>'+agentSymbol+'</span><div><strong>接着完成：'+escapeHtml(m.title)+'</strong><p>已整理公开货源。下面只填写本次实际报价，草稿按商品保留。</p></div><a href="#overview">回到工作交付 ↗</a></div>');};
document.addEventListener('click',event=>{
  const picked=event.target.closest('[data-mission-case]');if(picked){focusMission(picked.dataset.missionCase);return;}
  const pane=event.target.closest('[data-mission-pane]');if(pane){missionPane=pane.dataset.missionPane;document.querySelectorAll('[data-mission-pane]').forEach(b=>b.setAttribute('aria-pressed',String(b===pane)));document.getElementById('mission-pane').innerHTML=renderMissionPane(selectedMission());return;}
  const note=event.target.closest('[data-mission-note]');if(note){const m=selectedMission();if(!saveMissionNote(m,note.dataset.missionNote==='clear'?'':note.dataset.missionNote)){document.getElementById('mission-local-status').textContent='浏览器未允许保存；本次处理状态没有持久化。';return;}overview();document.getElementById('mission-local-status')?.scrollIntoView({block:'nearest'});return;}
  const action=event.target.closest('[data-mission-action]');if(action){const m=missionCatalogue.find(x=>x.id===action.dataset.missionAction);if(!m)return;if(!missionIntegrity(m).valid){missionPane='next';overview();return;}if(m.action==='cost'){costSession.selected=m.sku;selectedMissionId=m.id;location.hash='products';}else exportMission(m);return;}
  const exported=event.target.closest('[data-mission-export]');if(exported){const m=missionCatalogue.find(x=>x.id===exported.dataset.missionExport);if(m)exportMission(m);return;}
  if(event.target.closest('[data-mission-memory]')){const record=records.find(x=>x.id==='116-02');if(record)showRecord(keyOf(record));return;}
  if(event.target.closest('[data-retry-missions]'))loadMissions();
  if(event.target.closest('[data-refresh-view]'))loadMissions();
});
async function loadMissions(){
  missionLoadState='loading';
  try{const data=await fetchJSON('missions.json');if(!validMissionData(data))throw Error('Invalid mission schema');missionCatalogue=data.missions;missionLoadState='ready';}
  catch{missionLoadState='error';}
  if(essentialsReady&&['','overview'].includes(location.hash.slice(1)))route();
}
function validMissionData(data){
  if(!data||data.schema_version!==1||!Array.isArray(data.missions)||new Set(data.missions.map(m=>m?.id)).size!==data.missions.length)return false;
  return data.missions.every(m=>m&&['id','kind','state','title','short','headline','summary','reviewed_at','request','action_label','handoff_title','next_trigger','boundary'].every(k=>typeof m[k]==='string'&&m[k].trim())&&['group','both','store'].includes(m.audience)&&['cost','brief'].includes(m.action)&&(m.action!=='cost'||Object.hasOwn(quoteUnits,m.sku))&&Array.isArray(m.traces)&&m.traces.every(t=>t&&typeof t.title==='string'&&typeof t.body==='string'&&['done','waiting'].includes(t.status))&&['facts','checklist','record_ids','signal_ids'].every(k=>Array.isArray(m[k])&&m[k].every(t=>typeof t==='string'))&&(m.record_ids.length+m.signal_ids.length>0)&&m.record_ids.every(id=>m.expected_records?.[id]&&Object.keys(m.expected_records[id]).length>0)&&m.signal_ids.every(id=>m.expected_signals?.[id]&&Object.keys(m.expected_signals[id]).length>0));
}
document.addEventListener('change',e=>{if(e.target.id==='mission-picker')focusMission(e.target.value)});
loadMissions();
