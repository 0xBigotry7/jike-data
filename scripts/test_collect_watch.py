import json, os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(__file__))
import collect_watch
from unittest.mock import patch

class WatchTests(unittest.TestCase):
    source = {"id":"x","name":"测试","category":"test","url":"https://example.test/a"}
    html = "<html><head><title>成都日报</title></head><body><p>2026年9月10日 成都市场 价格 2.00 元/公斤</p><footer>2026-09-12</footer></body></html>"
    def fetch_ok(self, url): return self.html, None
    def test_initial_not_change_and_date(self):
        out = collect_watch.collect([self.source], fetcher=self.fetch_ok)
        self.assertEqual(out["sources"][0]["change_type"], "initial")
        self.assertEqual(out["sources"][0]["source_date"], "2026-09-10")
        self.assertEqual(out["changes"], [])
    def test_unchanged_dedup(self):
        first = collect_watch.collect([self.source], fetcher=self.fetch_ok)
        second = collect_watch.collect([self.source], old=first, fetcher=self.fetch_ok)
        self.assertEqual(second["sources"][0]["change_type"], "unchanged")
        self.assertEqual(first["sources"][0]["content_hash"], second["sources"][0]["content_hash"])
    def test_failure_preserves_good_snapshot(self):
        first = collect_watch.collect([self.source], fetcher=self.fetch_ok)
        def fail(url): raise OSError("offline")
        second = collect_watch.collect([self.source], old=first, fetcher=fail)
        self.assertEqual(second["sources"][0]["change_type"], "error")
        self.assertEqual(second["sources"][0]["content_hash"], first["sources"][0]["content_hash"])
        self.assertEqual(second["changes"], [])
    def test_content_change_only(self):
        first = collect_watch.collect([self.source], fetcher=self.fetch_ok)
        def changed(url): return self.html.replace("价格 2.00", "价格 2.10"), None
        second = collect_watch.collect([self.source], old=first, fetcher=changed)
        self.assertEqual(second["sources"][0]["change_type"], "content_changed")
        self.assertEqual(len(second["changes"]), 1)
    def test_invalid_date_is_null(self):
        self.assertIsNone(collect_watch.extract_date("发布日期：2026年2月31日"))
    def test_navigation_change_does_not_alert(self):
        first = collect_watch.collect([self.source], fetcher=self.fetch_ok)
        def changed_nav(url):
            return self.html.replace("<footer>", "<nav>新导航</nav><footer>"), None
        second = collect_watch.collect([self.source], old=first, fetcher=changed_nav)
        self.assertEqual(second["sources"][0]["change_type"], "unchanged")
    def test_extractor_version_change_is_new_baseline(self):
        first = collect_watch.collect([self.source], fetcher=self.fetch_ok)
        first["sources"][0]["extractor_version"] = "old"
        second = collect_watch.collect([self.source], old=first, fetcher=self.fetch_ok)
        self.assertEqual(second["sources"][0]["change_type"], "initial")
        self.assertEqual(second["changes"], [])
    def test_nested_div_navigation_does_not_swallow_article(self):
        text=collect_watch.clean_text('<head><title>导航</title></head><div class="nav"><div>菜单</div><img src="x"></div><main>2026年9月12日 正文价格20元</main>')
        self.assertEqual(text,'2026年9月12日 正文价格20元')
    def test_robots_network_failure_skips_source(self):
        with patch('urllib.request.urlopen',side_effect=OSError('network')):
            self.assertFalse(collect_watch.allowed_by_robots(self.source['url'])[0])
    def test_list_links_are_absolute_and_dated_footer_is_ignored(self):
        source={**self.source,'data_role':'list','date_mode':'none','item_pattern':'/news/'}
        html='<nav>导航</nav><main><a href="/news/321">成都罗森新商品试点活动 2026年9月11日</a></main><footer>2026-09-12</footer>'
        out=collect_watch.collect([source],fetcher=lambda url:(html,None))
        self.assertEqual(out['sources'][0]['items'][0]['url'],'https://example.test/news/321')
        self.assertIsNone(out['sources'][0]['source_date'])
        self.assertEqual(out['history'][0]['initial_count'],1)

if __name__ == "__main__": unittest.main()
