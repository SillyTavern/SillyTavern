# 进度日志

## 会话：2026-06-26

### 阶段 1：需求与发现
- **状态：** complete
- 执行的操作：
  - 读取 mem0 项目记忆，确认此前目标是托管版 Web/移动 AI 酒馆。
  - 读取本地 SillyTavern 关键文件，确认现有用户、角色卡、世界书和内容类型结构。
  - 识别市场、货币、UGC 上传需要新增控制平面。
- 创建/修改的文件：
  - findings.md

### 阶段 2：产品与系统边界
- **状态：** complete
- 执行的操作：
  - 设计市场资产类型、上传流程、购买/安装流程。
  - 设计消费币、赠送币、创作者收益账户和不可变账本。
- 创建/修改的文件：
  - task_plan.md
  - docs/marketplace-currency-design.md

### 阶段 3：技术设计
- **状态：** complete
- 执行的操作：
  - 设计数据库核心实体、API 模块和服务边界。
  - 设计资产审核、版本、购买授权、安装到用户空间流程。
- 创建/修改的文件：
  - docs/marketplace-currency-design.md

### 阶段 4：测试与验证
- **状态：** complete
- 执行的操作：
  - 验证设计与现有角色卡/世界书导入逻辑相容。
  - 检查 Markdown 设计文档已创建。
- 创建/修改的文件：
  - progress.md

### 阶段 5：多 Agent 并发开发
- **状态：** complete
- 执行的操作：
  - 启动 Explorer A 调查 Express 路由、鉴权、用户目录和持久化接入点。
  - 启动 Worker B 实现钱包账本 MVP。
  - 启动 Worker C 实现市场资产后端骨架。
  - 启动 Explorer D 调查角色卡/世界书安装适配。
  - 主 agent 读取 server-main.js、server-startup.js、users-admin.js、users.js 和测试结构，准备集成。
  - 集成 Worker B 的钱包账本 MVP，并收紧 admin grant 为管理员专用。
  - 集成 Worker C 的市场资产 MVP，并补充审核通过后才可购买的状态机。
  - 根据 Explorer D 建议补充 `POST /api/market/assets/:id/install`，安装角色卡和世界书到用户私有目录。
  - 执行 market/wallet 冒烟测试，覆盖创建、提交、审核、免费领取、安装、管理员赠币。
- 创建/修改的文件：
  - task_plan.md
  - progress.md
  - src/endpoints/market.js
  - src/endpoints/wallet.js
  - src/server-startup.js

### 阶段 6：验证与交付
- **状态：** complete
- 执行的操作：
  - 运行 `node --check src/endpoints/market.js && node --check src/endpoints/wallet.js && node --check src/server-startup.js`。
  - 运行 `git diff --check`。
  - 运行临时 Express 冒烟测试。
- 创建/修改的文件：
  - progress.md

### 阶段 7：GitHub 同步
- **状态：** complete
- 执行的操作：
  - 创建分支 `codex/marketplace-wallet-mvp`。
  - 提交 `4a711de82 Add marketplace and wallet MVP endpoints`。
  - 上游 `SillyTavern/SillyTavern` 对当前账号无写权限，改为创建 fork `Angelidiot/SillyTavern`。
  - 推送分支到 `fork/codex/marketplace-wallet-mvp`。
- 创建/修改的文件：
  - task_plan.md
  - progress.md

### 阶段 8：固定价格购买闭环
- **状态：** complete
- 执行的操作：
  - 扩展 `wallet.js`，导出余额查询、ledger 查询、扣款规划、管理员赠币复用和市场购买结算 helper。
  - 扩展 `market.js`，允许 `fixed_price` 资产，购买时按 `bonus -> paid` 扣款并给创作者写入 `earnings`。
  - 为同一用户购买同一资产添加稳定 `purchase_id` 和同进程购买锁，减少重复扣款、重复 entitlement 和销量重复增加。
  - 扩展 Jest 测试，覆盖余额不足无副作用、免费领取不写账、重复购买幂等、创作者收益和价格校验。
- 创建/修改的文件：
  - src/endpoints/market.js
  - src/endpoints/wallet.js
  - tests/market-wallet.test.js
  - docs/marketplace-currency-design.md
  - task_plan.md
  - progress.md

### 阶段 9：前端市场与钱包入口
- **状态：** complete
- 执行的操作：
  - 启动前端结构 scout agent，确认 Marketplace/Wallet 更适合作为内置扩展挂载到 Extensions 面板。
  - 启动 API 契约复核 agent，确认 `/api/market` 和 `/api/wallet` 字段、错误码、购买/安装边界。
  - 新增 `marketplace-wallet` 内置扩展 manifest、模板、脚本和样式。
  - 在 Extensions 面板加入 `#marketplace_wallet_container` 容器。
  - 实现钱包余额展示、市场资产列表、搜索/类型过滤、领取/购买并安装、创作者安装、草稿提交审核。
  - 实现 JSON 文件加载/粘贴创建市场草稿，并增加基础 payload 形状校验和固定价格本地校验。
  - 使用本地 `http://localhost:8000/` 做浏览器 smoke test，确认扩展容器、UI 标题、资产列表和刷新按钮成功加载。
- 创建/修改的文件：
  - public/index.html
  - public/scripts/extensions/marketplace-wallet/manifest.json
  - public/scripts/extensions/marketplace-wallet/window.html
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/style.css
  - task_plan.md
  - progress.md

## 测试结果
| 测试 | 输入 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 文档存在性检查 | docs/marketplace-currency-design.md | 文件存在 | 文件已创建 | 通过 |
| 新增 endpoint 语法检查 | market.js/wallet.js/server-startup.js | 无语法错误 | 通过 | 通过 |
| Diff 空白检查 | git diff --check | 无空白错误 | 通过 | 通过 |
| 市场/钱包冒烟 | 创建、提交、审核、领取、安装、赠币 | 流程成功且非 admin 不能赠币 | 通过 | 通过 |
| 市场/钱包 Jest 单测 | `npm --prefix tests run test:unit -- market-wallet.test.js` | 3 个用例通过 | 通过：3 passed | 通过 |
| 提交前语法与空白检查 | `node --check ... && git diff --check` | 无语法/空白错误 | 通过 | 通过 |
| payload 权限回归 | 未购买用户查看 listed 资产详情 | 不返回 `normalized_payload` | 通过 | 通过 |
| CI 配置路径回归 | 干净 checkout 中无根目录 `config.yaml` | 测试使用已跟踪 `default/config.yaml` | 通过 | 通过 |
| 审核与账本覆盖 | 非 admin 审核、entitlement/install 记录、wallet ledger | 关键字段均断言 | 通过 | 通过 |
| fixed_price 购买闭环 | 余额不足、扣 bonus/paid、creator earnings、重复购买、安装授权 | 5 个 Jest 用例通过 | 通过 | 通过 |
| marketplace-wallet 扩展语法 | `node --check public/scripts/extensions/marketplace-wallet/index.js` | 无语法错误 | 通过 | 通过 |
| 前端接入后端回归 | `node --check src/endpoints/market.js && node --check src/endpoints/wallet.js && node --check src/server-startup.js` | 无语法错误 | 通过 | 通过 |
| 前端与后端 diff 空白检查 | `git diff --check` | 无空白错误 | 通过 | 通过 |
| 前端阶段市场/钱包单测 | `npm --prefix tests run test:unit -- market-wallet.test.js` | 5 个用例通过 | 通过：5 passed | 通过 |
| marketplace-wallet 浏览器 smoke | 打开 `http://localhost:8000/` | 扩展容器、标题、资产列表和刷新按钮存在 | 通过 | 通过 |

## 错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 无 | 无 | 0 | 无 |
| 2026-06-26 | Jest 安装角色卡时找不到 `./public/img/ai4.png` | 1 | 用 `serverDirectory` 解析默认头像绝对路径 |
| 2026-06-26 | `storage.stop is not a function` | 1 | 移除测试清理里的不存在 API 调用 |
| 2026-06-26 | listed 资产详情泄漏 `normalized_payload` | 1 | 未授权详情响应删除 payload，只暴露 `payload_available` |
| 2026-06-26 | 钱包 admin grant 空 body 会抛 TypeError | 1 | 使用空对象兜底解析请求体 |
| 2026-06-26 | 测试依赖被忽略的根目录 `config.yaml` | 1 | 改为使用 `import.meta.url` 解析已跟踪的 `default/config.yaml` |
| 2026-06-26 | 列表接口 `owned` 不是“已购买”状态 | 1 | 前端非创作者只展示“购买/领取并安装”，重复购买交给后端 already_owned 幂等处理 |

## 五问重启检查
| 问题 | 答案 |
|------|------|
| 我在哪里？ | 已完成市场与货币系统设计 |
| 我要去哪里？ | 下一步可做审核后台、数据库迁移、真实支付和移动端封装 |
| 目标是什么？ | 让托管版 AI 酒馆支持用户上传、购买和安装角色卡/世界书等资产 |
| 我学到了什么？ | 见 findings.md |
| 我做了什么？ | 创建规划文件、设计文档、后端 MVP 和前端 marketplace-wallet 扩展 |

---
*每个阶段完成后或遇到错误时更新此文件*
