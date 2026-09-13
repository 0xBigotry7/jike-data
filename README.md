# 集刻 every mart · AI 经营助理

面向集团运营与门店店长的持续研究交付界面，采用静态网页发布。目标域名：https://jike-data.sailinglabs.cn 。

## 运行

全部网页源码、样式与公开研究数据快照位于 `dist/`，无安装或编译步骤：

```sh
python3 -m http.server 4173 --directory dist
```

打开 http://localhost:4173/ 。主入口为数据总览、采购核价、持续跟踪、现场验证和证据档案；首页直接展示商品库、品类分布、竞对矩阵、供应渠道与 AI 复核。

## 部署

GitHub 仓库 Settings → Pages → Source 选择 **GitHub Actions**。推送 `main` 自动将 `dist/` 发布到 GitHub Pages。

在 Pages 中将 Custom domain 设置为 `jike-data.sailinglabs.cn`，DNS 添加 CNAME `jike-data` → `0xbigotry7.github.io`（DNS only），证书就绪后启用 Enforce HTTPS。

## 数据说明

当前快照含 1,490 条研究记录及 119 份报告。记录数量不等于去重 SKU 数量；其中包含历史观察、规格与待核验信息，价格应结合来源日期、规格、区域与证据状态使用。

`dist/*.json` 和 `dist/reports/` 已包含网站运行需要的全部数据。`scripts/build_library.py` 是原研究工作区的汇总辅助脚本，需要上级目录的研究输入文件，部署不运行该脚本。后续数据更新可在研究工作区汇总后提交新的静态数据快照。

网站不依赖 ChatGPT Sites。公开研究资料的原始来源与相关权利归各来源方所有。

## 行动工具与验证

采购支持按商品保存本设备草稿。已选商品锁定最小零售单位；未知货款、运费、折让不自动当作零。同口径价差需要用户填写供货商、未过期有效日、两份报价凭证并确认口径；结果仍是用户填写测算，不是平台核验或供应商承诺。

门店可从 50 项清单录入现场价格，校验门店、地址、采集人、时间、条码、目标规格及证据编号；有促销价必须填条件。支持本设备保存、编辑恢复、撤销删除和 CSV 导出。没有后台、跨设备同步或集团自动回收；请将导出的 CSV 与照片另行交回集团。浏览器清理会丢失本地记录，最多保留 200 条。

首页等待完整研究库加载后计算覆盖指标，避免把部分记录显示为总量。手机保留商品表横向滚动与 AI 复核快捷入口；工具页面仍使用轻量核心数据，大资料加载失败不覆盖正在使用的工具，可重试。

验证命令：

```sh
python3 -m unittest discover -s scripts -p 'test_*.py'
node scripts/test_decision.cjs
node scripts/test_loading.cjs
node scripts/test_missions.cjs
```

持续采集机制与发布边界见 `monitor/OPERATIONS.md`。三轮优化记录见 `docs/UI-REVIEW-20260912.md`。

AI 工作交付与能力边界见 `docs/AI-NATIVE-PRODUCT.md`。首页只展示已发布研究，未连接实时模型对话后端。客户核价回填和个人待办仅保存在本设备；继续研究时需要按维护协议复核引用并更新交付。
