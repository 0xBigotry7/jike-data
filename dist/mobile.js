// Keep one accessible set of records; adapt their presentation on small screens.
function prepareMobileTables(root) {
  root.querySelectorAll('table').forEach(table => {
    if (table.closest('.report-document')) {
      const wrap = table.closest('.table-wrap');
      if (wrap && !wrap.classList.contains('mobile-scroll-table')) wrap.classList.add('mobile-scroll-table');
      return;
    }
    if (table.classList.contains('coverage-table')) return;
    const headings = Array.from(table.querySelectorAll('thead th'), cell => cell.textContent.trim());
    if (!headings.length) return;
    table.classList.add('mobile-cards');
    table.querySelectorAll('tbody tr').forEach(row => {
      Array.from(row.cells).forEach((cell, i) => cell.dataset.label = headings[i] || '');
    });
  });
}
const mobileObserver = new MutationObserver(() => {
  prepareMobileTables(document.getElementById('main'));
  prepareMobileTables(document.getElementById('dialog-body'));
});
mobileObserver.observe(document.getElementById('main'), {childList:true, subtree:true});
mobileObserver.observe(document.getElementById('dialog-body'), {childList:true, subtree:true});
prepareMobileTables(document);
function syncRolePressed() {
  document.querySelectorAll('[data-role]').forEach(button => {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });
}
syncRolePressed();
document.addEventListener('click', event => {
  if (event.target.closest('[data-role]')) requestAnimationFrame(syncRolePressed);
});
function alignMobileNavigation() {
  if (!matchMedia('(max-width: 820px)').matches) return;
  const nav = document.querySelector('.sidebar nav');
  const active = nav.querySelector('[aria-current="page"]');
  if (active) nav.scrollTo({left: active.offsetLeft - nav.offsetLeft - 16, behavior:'auto'});
}
window.addEventListener('hashchange', alignMobileNavigation);
window.addEventListener('load', alignMobileNavigation);
document.addEventListener('click', event => {
  if (!matchMedia('(max-width: 820px)').matches) return;
  const button = event.target.closest('#prev, #next, #competitor-prev, #competitor-next');
  if (button) document.querySelector('#results, #competitor-results')?.scrollIntoView({block:'start'});
});
document.getElementById('detail').addEventListener('close', () => document.body.classList.remove('reading-detail'));
const detailObserver = new MutationObserver(() => {
  const dialog = document.getElementById('detail');
  document.body.classList.toggle('reading-detail', dialog.open);
  if (dialog.open) dialog.scrollTop = 0;
});
detailObserver.observe(document.getElementById('detail'), {attributes:true, attributeFilter:['open']});
