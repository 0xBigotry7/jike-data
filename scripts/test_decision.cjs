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
  fetch: () => new Promise(noop), setInterval: noop, location: {hash: '#products'},
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
  events.click[0]({target:{closest: selector => selector==='[data-download]' ? {dataset:{download:kind}} : null}});
  assert.equal(downloaded.rows.length,count);
  assert.ok(downloaded.rows.every(row=>row.length===columns));
  assert.ok(downloaded.rows.slice(1).every(row=>kind!=='visit'||row[2]));
}
console.log('Cost validation and three worksheet exports passed.');
