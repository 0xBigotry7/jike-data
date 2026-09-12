const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const noop=()=>{};
const fixedNow=Date.parse('2026-09-12T07:00:00Z');
class TestDate extends Date { constructor(...args){super(...(args.length?args:[fixedNow]))} static now(){return fixedNow} }
const events={},storage={},elements={};
let requests=0,lastRecord='';
const observations=JSON.parse(fs.readFileSync('dist/incremental.json','utf8'));
const signals=JSON.parse(fs.readFileSync('dist/signals.json','utf8'));
const catalogue=JSON.parse(fs.readFileSync('dist/missions.json','utf8'));
const context={
  Date:TestDate,URL,console,records:observations,checklist:[],labels:{},role:'group',main:{innerHTML:'',className:''},
  products:noop,overview:noop,reportLibrary:noop,store:noop,route:noop,essentialsReady:false,
  location:{href:'https://example.test/#overview',hash:'#overview'},history:{replaceState:noop},
  document:{addEventListener:(name,cb)=>(events[name]??=[]).push(cb),querySelector:()=>null,querySelectorAll:()=>[],getElementById:id=>elements[id]},
  localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},
  fetchJSON:()=>{requests++;return new Promise(noop)},setInterval:noop,
  escapeHtml:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),safeUrl:s=>s,fmt:n=>Number(n).toFixed(2),keyOf:r=>r.task_id+':'+r.id,
  showRecord:k=>lastRecord=k,matchMedia:()=>({matches:false})
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/decision.js','utf8'),context);
vm.runInContext(fs.readFileSync('dist/agent-workspace.js','utf8'),context);
context.fixture=catalogue;context.signalFixture=signals;
vm.runInContext('editorialData=signalFixture; missionCatalogue=fixture.missions; missionLoadState="ready";',context);
const [tea,lawson]=catalogue.missions;
assert.equal(context.validMissionData(catalogue),true);
for(const m of catalogue.missions) assert.equal(context.missionIntegrity(m).valid,true,m.id);
const clone=x=>JSON.parse(JSON.stringify(x));
for(const field of ['raw_price','conditions','region','source_date','evidence','source_url','record_status']){
 const changed=clone(observations);changed.find(r=>r.id==='116-01')[field]='changed';
 assert.equal(context.missionIntegrity(tea,changed,signals.items).valid,false,field);
}
assert.equal(context.missionIntegrity(tea,[],signals.items).missing.length,2);
assert.equal(context.missionIntegrity(lawson,observations,[]).valid,false);
assert.equal(context.missionIntegrity(tea,observations,signals.items,fixedNow+8*86400000).stale,true);
assert.equal(context.missionIntegrity({...tea,reviewed_at:'2026-09-14'}).valid,false);
assert.equal(context.missionIntegrity(lawson,observations,signals.items,fixedNow,true).refreshFailed,true);
assert.equal(context.missionIntegrity(tea,observations,signals.items,fixedNow,true).valid,true);
console.log('Published judgments invalidate on source changes, missing evidence, refresh failure and expiry.');
for(const damage of [
 d=>d.missions.push(clone(d.missions[0])),
 d=>delete d.missions[0].expected_records['116-01'],
 d=>d.missions[0].facts='not an array',
 d=>d.missions[0].traces[0].status='running',
 d=>d.missions[0].record_ids=[],
 d=>d.missions[0].action='send_supplier_email'
]){const bad=clone(catalogue);damage(bad);assert.equal(context.validMissionData(bad),false);}
const exported=context.missionBriefText(tea);
assert.ok(exported.includes('36-02')===false || exported.includes('重访'));
assert.ok(exported.includes('来源日期 来源日期未明示'));
assert.ok(exported.includes('https://m.zongwang001.com/'));
assert.ok(exported.includes('复核日期：2026-09-12'));
const expired={...tea,reviewed_at:'2026-08-01'};
assert.ok(context.missionBriefText(expired).includes('不作为当前建议'));
assert.ok(context.missionOutput(expired).includes('查看待核条件'));
vm.runInContext('missionNotes["tea-sourcing"]={state:"queued"};',context);
assert.equal(context.missionStatusLabel(expired),'历史交付');
console.log('Invalid catalogues fail closed; stale judgments stay marked in UI and exported briefs.');
vm.runInContext('role="store"; selectedMissionId="tea-sourcing";',context);
assert.equal(context.selectedMission().id,'lawson-comiday');
assert.equal(context.availableMissions().length,2);
const beforeRequests=requests;
for(const cb of events.click)cb({target:{closest:selector=>selector==='[data-mission-memory]'?{}:null}});
assert.ok(lastRecord.endsWith(':116-02'));
assert.equal(requests,beforeRequests,'a click must not reload the catalogue');
vm.runInContext('role="group";',context);
assert.equal(context.saveMissionNote(tea,'queued'),true);
assert.equal(JSON.parse(storage['everymart-mission-notes-v1'])['tea-sourcing'].state,'queued');
context.localStorage.setItem=()=>{throw new Error('blocked')};
assert.equal(context.saveMissionNote(tea,'deferred'),false);
assert.equal(context.missionNote(tea).state,'queued');
console.log('Role switching, actual history links and device-only task persistence passed.');
context.draftFixture={goods:'60',freight:'',discount:'0',units:'15',current:'5'};
vm.runInContext('costSession.drafts["116-01"]=draftFixture;',context);
assert.ok(context.missionProgress(tea).includes('还需填写'));
context.draftFixture.freight='0';
assert.ok(context.missionProgress(tea).includes('¥ 4.00 / 瓶'));
assert.ok(!context.missionProgress(tea).includes('较现行单价'));
Object.assign(context.draftFixture,{confirmed:true,supplier:'测试供应商',validity:'2026-09-13','quote-proof':'Q1','current-proof':'C1'});
assert.ok(context.missionProgress(tea).includes('较现行单价低 ¥ 1.00'));
context.draftFixture.validity='2026-09-11';
assert.ok(!context.missionProgress(tea).includes('较现行单价'));
context.draftFixture.goods='1e309';
assert.ok(!context.missionProgress(tea).includes('¥ Infinity'));
console.log('Returning to a mission reuses actual quote input and preserves comparison gates.');
(async()=>{
 context.fetchJSON=async()=>{throw Error('offline')};
 await context.loadMissions();
 assert.equal(vm.runInContext('missionLoadState',context),'error');
 context.overview();assert.ok(context.main.innerHTML.includes('工作交付暂未载入'));
 context.fetchJSON=async()=>catalogue;
 await context.loadMissions();
 assert.equal(vm.runInContext('missionLoadState',context),'ready');
 console.log('Mission fetch failure and explicit retry recovery passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
