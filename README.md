# 集刻 · 经营研究台

面向集团运营与门店店长的静态研究工作台。目标域名：https://jike-data.sailinglabs.cn 。

## 运行

全部网页源码、样式与公开研究数据快照位于 `dist/`，无安装或编译步骤：

```sh
python3 -m http.server 4173 --directory dist
```

打开 http://localhost:4173/ 。页面包含经营总览、商品与价格、品类规划、竞对档案、供应渠道、门店执行及研究资料库。

## 部署

GitHub 仓库 Settings → Pages → Source 选择 **GitHub Actions**。推送 `main` 自动将 `dist/` 发布到 GitHub Pages。

在 Pages 中将 Custom domain 设置为 `jike-data.sailinglabs.cn`，DNS 添加 CNAME `jike-data` → `0xbigotry7.github.io`（DNS only），证书就绪后启用 Enforce HTTPS。

## 数据说明

当前快照含 1,480 条研究记录及 115 份报告。记录数量不等于去重 SKU 数量；其中包含历史观察、规格与待核验信息，价格应结合来源日期、规格、区域与证据状态使用。

`dist/*.json` 和 `dist/reports/` 已包含网站运行需要的全部数据。`scripts/build_library.py` 是原研究工作区的汇总辅助脚本，需要上级目录的研究输入文件，部署不运行该脚本。后续数据更新可在研究工作区汇总后提交新的静态数据快照。

网站不依赖 ChatGPT Sites。公开研究资料的原始来源与相关权利归各来源方所有。
