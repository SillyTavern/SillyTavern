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

### 阶段 10：管理员审核与赠币入口
- **状态：** complete
- 执行的操作：
  - 启动并发审查 agent，复核 admin UI 显示、审核队列、grant 表单和移动端风险。
  - 在 `marketplace-wallet` 扩展中新增管理员面板，包含赠币表单和 Review Queue。
  - 支持管理员从 Review Queue 直接 approve/reject submitted 资产，拒绝时填写原因。
  - 支持管理员按用户 handle、金额、余额 bucket 和 reason 发放站内币。
  - 将 admin 前端 gate 收紧为 `isAdmin()`，避免用 `default-user` handle 推断管理员权限。
  - 对 grant bucket 增加本地白名单校验，并将空 reason 规范为 `Admin grant`。
  - 将扩展 manifest 升级到 `0.2.0`，JS/CSS 入口加入版本 query，避免浏览器 ESM 模块缓存旧逻辑。
  - 使用本地 `http://localhost:8000/` 做浏览器 smoke test，确认新版脚本/CSS 加载、admin 面板移除 `hidden`、grant 控件和 review queue 存在。
- 创建/修改的文件：
  - public/scripts/extensions/marketplace-wallet/manifest.json
  - public/scripts/extensions/marketplace-wallet/window.html
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/style.css
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 11：仓库交付闭环与基础测试
- **状态：** complete
- 执行的操作：
  - 将用户目标明确为持续推进仓库，直到代码、README、基础测试和可运行脚本形成可交付闭环。
  - 新增 `tests/marketplace-wallet.e2e.js`，覆盖 admin review queue、approve 调用、admin grant POST 和移动端 review 布局。
  - 新增 `tests/marketplace-wallet-ui.test.js`，用稳定的 Jest 契约测试覆盖 manifest 版本化、admin 模板、`isAdmin()` gate、grant 校验和移动 CSS。
  - 在根 `package.json` 增加 `test:marketplace` 和 `test:marketplace:e2e` 脚本。
  - 扩展 `README.md`，补充 Hosted AI Tavern MVP 功能、安装、启动、测试和生产化限制。
  - 验证 `npm run test:marketplace` 可从仓库根目录运行并通过 10 个 marketplace/wallet 测试。
  - 验证 `npm run test:marketplace:e2e -- --list` 可列出 2 个 browser E2E 测试。
  - 验证 `npm run start -- --help` 可运行并输出服务器 CLI 帮助。
- 创建/修改的文件：
  - README.md
  - package.json
  - tests/marketplace-wallet-ui.test.js
  - tests/marketplace-wallet.e2e.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 12：创作者中心与收益概览
- **状态：** complete
- 执行的操作：
  - 启动两个并发 agent 复核 creator API 与前端入口边界，采纳“summary 只返回聚合视图”和“creator 请求可降级”的反馈。
  - 新增 `GET /api/market/creator/summary`，返回当前创作者自己的资产、草稿/待审核/上架/拒绝数量、claims、paid sales、installs、gross revenue 和 earnings balance。
  - 收紧 creator summary 边界，不返回原始 `wallet`、`recent_earnings` ledger 或资产 `normalized_payload`。
  - 在 `marketplace-wallet` 扩展中新增 Creator Center，放在余额区下方，展示 assets/listed/claims/earned 和最近资产状态。
  - 将 Creator Center summary 改为后台降级加载，钱包和市场列表只依赖 `/api/wallet` 与 `/api/market/assets`。
  - 将公开市场和创作者资产里的计数文案从混用 installs 改为 claims + installs。
  - 扩展后端 Jest 测试，覆盖 creator draft/submitted/listed/rejected 状态、收益聚合、buyer 空 summary 和 payload/ledger 隐私边界。
  - 扩展前端契约测试，覆盖 Creator Center 模板、`total_claims`/`gross_revenue_coins` 绑定、降级加载函数和 responsive stats grid。
  - 更新 `README.md` 和 `docs/marketplace-currency-design.md`，记录 Creator Center API 与 Wallet API 的职责边界。
- 创建/修改的文件：
  - README.md
  - docs/marketplace-currency-design.md
  - src/endpoints/market.js
  - public/scripts/extensions/marketplace-wallet/window.html
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/style.css
  - tests/market-wallet.test.js
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 13：网页版/手机版 PWA 安装壳
- **状态：** in_progress
- 执行的操作：
  - 复用现有 web manifest、移动 viewport meta 和 Apple touch icons，不引入原生 App 壳。
  - 补充 PWA manifest `id`、`scope` 和描述，明确安装入口。
  - 新增 `public/scripts/pwa.js`，在主页面和登录页注册 service worker。
  - 新增 `public/service-worker.js`，只缓存静态 shell，跳过 `/api/*` 和非 GET 请求，避免钱包/市场/聊天请求被缓存。
  - 新增 `tests/pwa.test.js` 和根目录 `test:pwa` 脚本，并将 PWA 契约测试纳入 `test:marketplace`。
  - 更新 README，说明手机浏览器 Add to Home Screen / Install 路径和 service worker 边界。
- 创建/修改的文件：
  - README.md
  - package.json
  - public/manifest.json
  - public/index.html
  - public/login.html
  - public/scripts/pwa.js
  - public/service-worker.js
  - tests/pwa.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 14：市场资产下架闭环
- **状态：** in_progress
- 执行的操作：
  - 选择 delist 作为市场生命周期最小补齐项，暂不做退款、举报、suspend 或搜索排序。
  - 新增 `POST /api/market/assets/:id/delist`，仅管理员可下架 listed 资产。
  - 将下架资产从公开浏览和新购买中移除，但保留已有 entitlement 用户的详情读取和安装能力。
  - 列表资产增加 `entitled` 标记，前端可给已授权用户展示 Install。
  - marketplace-wallet 增加管理员 Delist 按钮和确认弹窗。
  - 更新 README 与设计文档，记录 delist API 和“不撤销既有授权”的边界。
- 创建/修改的文件：
  - README.md
  - docs/marketplace-currency-design.md
  - src/endpoints/market.js
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/style.css
  - tests/market-wallet.test.js
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 15：市场资产举报入口
- **状态：** in_progress
- 执行的操作：
  - 选择 report 作为 UGC 安全最小补齐项，暂不做自动处罚或完整处理后台。
  - market store 增加 `reports` 数组，并在读取旧 store 时兜底为空数组。
  - 新增 `POST /api/market/assets/:id/report`，可见资产才允许举报，举报记录为 `open`。
  - marketplace-wallet 增加 Report 操作，提交短 reason。
  - 扩展后端测试，覆盖公开资产举报、空 reason 400、下架后无授权用户不可举报、已授权用户仍可举报。
  - 扩展前端契约测试，覆盖 Report 按钮和 report POST。
- 创建/修改的文件：
  - README.md
  - docs/marketplace-currency-design.md
  - src/endpoints/market.js
  - public/scripts/extensions/marketplace-wallet/index.js
  - tests/market-wallet.test.js
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

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
| admin UI 语法检查 | `node --check public/scripts/extensions/marketplace-wallet/index.js` | 无语法错误 | 通过 | 通过 |
| marketplace-wallet manifest 校验 | 解析 `manifest.json` | JSON 有效 | 通过 | 通过 |
| admin UI diff 空白检查 | `git diff --check` | 无空白错误 | 通过 | 通过 |
| admin UI 回归单测 | `npm --prefix tests run test:unit -- market-wallet.test.js` | 5 个用例通过 | 通过：5 passed | 通过 |
| admin UI 浏览器 smoke | 打开 `http://localhost:8000/` | 加载 `v=0.2.0` 脚本/CSS，admin 面板可见，grant 和 review queue 存在 | 通过 | 通过 |
| admin UI 移动端检查 | 窄屏 viewport 验证 | 控件不溢出 | 未完整执行：in-app browser 未暴露 viewport 设置，本地无 Playwright 包；已做 CSS 结构调整 | 部分 |
| marketplace 根脚本基础测试 | `npm run test:marketplace` | backend + frontend contract 测试通过 | 通过：2 suites / 11 tests | 通过 |
| marketplace E2E 列表 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| 启动脚本帮助 | `npm run start -- --help` | 服务器 CLI 正常输出帮助 | 通过 | 通过 |
| Creator Center 语法检查 | `node --check src/endpoints/market.js && node --check public/scripts/extensions/marketplace-wallet/index.js && node --check tests/market-wallet.test.js && node --check tests/marketplace-wallet-ui.test.js` | 无语法错误 | 通过 | 通过 |
| Creator summary API 回归 | `npm run test:marketplace` | 资产状态、claims、paid sales、installs、earnings、payload/ledger 隐私边界通过 | 通过：新增 creator summary 用例 | 通过 |
| Creator Center E2E 列表 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| PWA 契约测试 | `npm run test:pwa` | manifest 可安装、页面注册 SW、SW 不缓存 API/非 GET | 通过：1 suite / 3 tests | 通过 |
| marketplace + PWA 根脚本 | `npm run test:marketplace` | 市场/钱包/PWA 契约测试通过 | 通过：3 suites / 14 tests | 通过 |
| delist 生命周期回归 | `npm run test:marketplace` | admin 下架、非 admin 禁止、下架后新用户不可买、已授权用户可安装 | 通过：3 suites / 14 tests | 通过 |
| report 入口回归 | `npm run test:marketplace` | 可见资产可举报、空 reason 拒绝、下架后只允许已授权用户举报 | 通过：3 suites / 14 tests | 通过 |
| marketplace E2E 实跑 | `npm run test:marketplace:e2e` | 浏览器 E2E 通过 | 未通过：本机 Playwright browser cache 半安装，缺 `chromium_headless_shell` / Chromium Framework | 环境阻塞 |

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
| 2026-06-26 | admin 面板 DOM 已渲染但仍保留 `hidden` 属性 | 1 | 改为显式移除/恢复 `hidden` 属性，并给扩展 JS/CSS 入口加版本 query 避免旧 ESM 模块缓存 |
| 2026-06-26 | admin 前端 gate 曾尝试用 `default-user` handle 兜底 | 1 | 按并发审查反馈改回仅使用 `isAdmin()`，与后端 admin 权限模型一致 |
| 2026-06-26 | Playwright Chromium 下载被中断后留下半安装缓存 | 2 | 不再阻塞基础交付；保留 E2E 测试与脚本，新增稳定 Jest UI 契约测试，E2E 需完整安装 `chromium-headless-shell` 后运行 |

## 五问重启检查
| 问题 | 答案 |
|------|------|
| 我在哪里？ | 已完成市场/钱包后端、前端、管理员入口、基础脚本、Creator Center summary、PWA 安装壳、市场下架闭环，并正在补举报入口 |
| 我要去哪里？ | 下一步完成 report 基础验证、提交推送，然后继续数据库迁移、真实支付、搜索审核和原生移动封装 |
| 目标是什么？ | 让托管版 AI 酒馆支持用户上传、购买和安装角色卡/世界书等资产 |
| 我学到了什么？ | 见 findings.md |
| 我做了什么？ | 创建规划文件、设计文档、后端 MVP、前端 marketplace-wallet 扩展、管理员审核/赠币入口、Creator Center、PWA 安装壳、市场下架闭环、举报入口、README 和基础测试脚本 |

---
*每个阶段完成后或遇到错误时更新此文件*
