# 公开动态监测器

`scripts/collect_watch.py` 使用 Python 标准库抓取 `sources.json` 中的公开网页，并写入 `dist/watch.json`，供 GitHub Pages 的静态页面读取。每个来源只做一次正常 GET，最多 2 MB、12 秒超时，最多 4 个并发；先读取 robots.txt，明确禁止时跳过。不会登录、绕过反爬或重复重试。

运行：

```sh
python3 web/scripts/collect_watch.py
python3 -m unittest web/scripts/test_collect_watch.py
```

输出 schema 为 `schema_version`、`generated_at`、`sources`、`failures`、`changes`、`history`。`sources` 是数组，每项含 `id`、URL、名称、分类、`data_role`（`list` 或 `site_snapshot`）、状态、检查/成功时间、内容 hash、页面日期、标题、摘要和 `change_type`（`initial`、`unchanged`、`content_changed`、`error`）。错误时保留上一次成功快照字段，并在 `failures` 显式列出；`changes` 累计保留最近 100 条正文变化并带 `before_hash`/`after_hash`，不把首次抓取列为变化。`history` 保存最近 30 次实际运行及成功、失败、未变化、变化、初始基线计数。

页面日期只抽取明确的年月日。来源给出价格时，业务展示必须同时保留原页面的日期、单位和市场范围；监测器本身只做内容变化提示，不能由页脚日期变化推导降价或涨价。
