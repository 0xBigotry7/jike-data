import csv,json,re,pathlib,shutil
root=pathlib.Path(__file__).resolve().parents[2]; dest=root/'web/dist'
legacy=[]
for p in sorted((root/'sources/data').glob('*.csv')):
 n=int(p.name[:2])
 if n==12:continue
 for i,r in enumerate(csv.DictReader(p.open(encoding='utf-8-sig')),1):
  legacy.append(dict(id=f'legacy-{i}',task_id=n,origin='legacy',sku=r['SKU'],spec=r['规格'],category=r['品类'],supplier=r['来源'],source_date=r['日期'],price_type='historical',candidate_for_comparison=False,normalized_price=None,raw_prices={k:r[k] for k in ['批发价低','批发价高','零售价','促销低价']}))
reports=[]
paths=list((root/'sources').glob('*.md'))+list(root.glob('*.md'))+list((root/'research/round4/reports').glob('*.md'))+list((root/'research/round5/reports').glob('*.md'))
(dest/'reports').mkdir(exist_ok=True)
for p in paths:
 m=re.match(r'^(\d{2,3})-',p.name)
 if not m:continue
 n=int(m[1]); body=p.read_text(); title=p.stem[len(m[0]):]
 reports.append(dict(id=n,title=title,body=body,phase='基础研究' if n<=31 else '决策与核验' if n<=34 or n==75 else '第五轮深采' if n>=76 else '深入采集'))
 shutil.copyfile(p,dest/'reports'/f'{n:02d}.md')
assert len(legacy)==582,len(legacy)
assert len({r['id'] for r in reports})==len(reports),'Duplicate report IDs'
(dest/'legacy.json').write_text(json.dumps(legacy,ensure_ascii=False))
(dest/'reports.json').write_text(json.dumps(sorted(reports,key=lambda r:r['id']),ensure_ascii=False))
rows=list(csv.DictReader((dest/'store-price-check.csv').open(encoding='utf-8-sig')))
(dest/'checklist.json').write_text(json.dumps(rows,ensure_ascii=False))
print({'historical':len(legacy),'reports':len(reports),'field_checklist':len(rows)})

review=root/'research/round5/reviewed.json'
if review.exists():
 shutil.copyfile(review,dest/'round5.json')
 shutil.copyfile(root/'research/round5/review.json',dest/'review-summary.json')
