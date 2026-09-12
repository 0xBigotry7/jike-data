const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const noop = () => {};
const events = {}, inputs = {};
let downloaded;
const context = {
  products: noop, reportLibrary: noop, overview: noop, store: noop, route: noop,
  labels: {}, records: JSON.parse(fs.readFileSync('dist/incremental.json', 'utf8')),
  checklist: JSON.parse(fs.readFileSync('dist/checklist.json', 'utf8')),
  document: {addEventListener: (name, cb) => (events[name] ??= []).push(cb), getElementById: id => inputs[id]},
  fetch: () => new Promise(noop), fetchJSON: () => new Promise(noop), setInterval: noop, location: {hash: '#products'},
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('dist/decision.js', 'utf8'), context);
function calculate(values) {
  for (const key of ['goods','freight','discount','units','current','selling']) inputs['cost-'+key] = {value: values[key] ?? ''};
  return context.costResult();
}
let result=calculate({goods:'980',freight:'40',discount:'20',units:'300',current:'4',selling:'5'});
assert.ok(Math.abs(result.unit-10/3)<1e-9);
assert.ok(Math.abs(result.delta-2/3)<1e-9);
assert.ok(Math.abs(result.margin-1/3)<1e-9);
for (const bad of [
  {goods:'10',discount:'0',units:'5'}, // Unknown freight is not free freight.
  {goods:'10',freight:'0',discount:'11',units:'5'},
  {goods:'10',freight:'0',discount:'0',units:'0'},
  {goods:'10',freight:'0',discount:'0',units:'1.5'},
  {goods:'10',freight:'-1',discount:'0',units:'5'},
  {goods:'1e308',freight:'1e308',discount:'0',units:'1'},
]) assert.ok(calculate(bad).error);
context.downloadCSV = (name, rows) => downloaded = {name, rows};
for (const [kind,count,columns] of [['inquiry',4,14],['visit',51,15],['fresh',22,17]]) {
  for(const callback of events.click)callback({target:{closest: selector => selector==='[data-download]' ? {dataset:{download:kind}} : null}});
  assert.equal(downloaded.rows.length,count);
  assert.ok(downloaded.rows.every(row=>row.length===columns));
  assert.ok(downloaded.rows.slice(1).every(row=>kind!=='visit'||row[2]));
}
console.log('Cost validation and three worksheet exports passed.');

const now=Date.parse('2026-09-12T05:00:00Z');
const localPast=new Date(now-3600000);
const observedLocal=new Date(localPast.getTime()-localPast.getTimezoneOffset()*60000).toISOString().slice(0,16);
const sample={sku:'P01',shop:'验证门店',area:'验证地址',collector:'QA',observed:observedLocal,barcode:'6901234567890',price:'3',promo:'',terms:'',proof:'IMG-01',matched:true};
assert.ok(context.validateVisit(sample,now).ok);
for(const patch of [{shop:''},{barcode:'abcd'},{price:'0'},{promo:'2',terms:''},{observed:'2099-01-01T10:00'},{matched:false},{proof:''}]) assert.ok(context.validateVisit({...sample,...patch},now).error);
const good={status:'success'},bad={status:'blocked_by_robots'};
assert.equal(context.monitorHealth({generated_at:'2026-09-12T04:00:00Z',sources:[good]},false,now).tone,'ok');
assert.equal(context.monitorHealth({generated_at:'2026-09-12T04:00:00Z',sources:[good,bad]},false,now).tone,'warning');
assert.equal(context.monitorHealth({generated_at:'2026-09-11T04:00:00Z',sources:[good]},false,now).tone,'warning');
assert.equal(context.monitorHealth({generated_at:'2026-09-12T04:00:00Z',sources:[good]},true,now).tone,'warning');
console.log('Store observation validation and monitor freshness checks passed.');

// A checked checkbox alone cannot turn an incomplete or expired quote into a comparison.
for(const [key,value] of Object.entries({'current':'5','supplier':'QA supplier','validity':'2026-09-13','quote-proof':'Q-01','current-proof':'C-01'})) inputs['cost-'+key]={value};
inputs['cost-confirmed']={checked:true};
assert.equal(context.comparisonState('2026-09-12').allowed,true);
inputs['cost-quote-proof'].value=''; assert.equal(context.comparisonState('2026-09-12').allowed,false);
inputs['cost-quote-proof'].value='Q-01'; inputs['cost-validity'].value='2026-09-11'; assert.equal(context.comparisonState('2026-09-12').allowed,false);
inputs['cost-validity'].value='2026-09-13'; inputs['cost-confirmed'].checked=false; assert.equal(context.comparisonState('2026-09-12').allowed,false);
console.log('Comparable cost gating checks passed.');

const csv=context.serializeCSV([['数值','文本'],[-0.5,'=1+1'],[-10,'  =HYPERLINK("https://example.com")']]);
assert.ok(csv.includes('"-0.5"'));
assert.ok(!csv.includes('"\'-0.5"'));
assert.ok(csv.includes('"\'=1+1"'));
assert.ok(csv.includes('"\'  =HYPERLINK'));
assert.ok(csv.startsWith('\ufeff'));
console.log('CSV numeric preservation and formula escaping passed.');
