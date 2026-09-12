const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Exercise the real loader with one large archive failing, then recovering.
const source = fs.readFileSync('dist/workbench.js','utf8').split('let essentialsReady=')[1];
const files = {
  'incremental.json': [{id:'incremental',origin:'round6'}],
  'checklist.json': [{SKU:'sample'}], 'reports-incremental.json': [{id:116}],
  'data.json': [{id:'current'}], 'legacy.json': [{id:'legacy'}],
  'reports.json': [{id:1}], 'round5.json': [{id:'round5'}]
};
let fail = true, routes = 0;
const requests = [], about = {};
const context = {
  records:[], reports:[], checklist:[], main:{innerHTML:'preserve active form'},
  location:{hash:'#overview'}, document:{getElementById:()=>about,addEventListener:()=>{}},
  openReport:()=>{}, intelligenceNotice:()=>{}, escapeHtml:String,
  route:()=>routes++, AbortController, setTimeout, clearTimeout,
  fetch:async path=>{
    requests.push(path);
    return {ok:!(fail&&path==='reports.json'),json:async()=>files[path]};
  }
};
vm.createContext(context);
vm.runInContext('let essentialsReady='+source,context);
(async()=>{
  await context.loadEssentials();
  assert.equal(vm.runInContext('essentialsReady',context),true);
  assert.equal(requests.length,3,'The homepage must not request full archives');
  assert.equal(context.records.length,1);
  const initialRoutes=routes;
  await assert.rejects(context.ensureLibrary());
  assert.equal(context.main.innerHTML,'preserve active form');
  assert.equal(context.records.length,1,'Failed archives must retain essential records');
  assert.equal(routes,initialRoutes,'Background loading must not redraw an active form');
  fail=false;
  await Promise.all([context.ensureLibrary(),context.ensureLibrary()]);
  assert.equal(context.records.length,4);
  assert.equal(context.reports.length,2);
  assert.equal(requests.filter(x=>x==='reports.json').length,2,'Concurrent archive loads must be deduplicated');
  await context.ensureLibrary();
  assert.equal(context.records.length,4,'Repeated opens must not duplicate records');
  assert.equal(routes,initialRoutes);
  console.log('Essential-first loading, failure isolation, retry and deduplication passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
