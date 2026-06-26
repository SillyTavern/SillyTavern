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
- **状态：** complete
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
- **状态：** complete
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
- **状态：** complete
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

### 阶段 16：管理员举报处理队列
- **状态：** complete
- 执行的操作：
  - 选择 report queue + resolve 作为举报入口后的最小管理闭环，暂不做自动处罚、封禁或申诉流。
  - 新增 `GET /api/market/reports/admin`，仅管理员可查看 open reports，并附带最小资产摘要。
  - 新增 `POST /api/market/reports/:id/resolve`，仅管理员可将 open report 标记为 resolved。
  - marketplace-wallet 管理员面板增加 Report Queue 和 Resolve 操作。
  - 前端使用独立 `busyReportIds`、`data-report-id` 和 report queue click handler，避免和资产 action 混用。
  - 扩展后端测试，覆盖普通用户禁止查看/resolve、管理员查看、resolve 持久化、重复 resolve 400。
  - 扩展前端契约测试，覆盖 Report Queue 容器、admin reports 请求、resolve endpoint 和独立事件绑定。
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

### 阶段 17：管理员审核内容预览
- **状态：** complete
- 执行的操作：
  - 选择 Inspect 作为审核队列的最小预览入口，避免管理员盲批 submitted 资产。
  - 复用 `GET /api/market/assets/:id` 的管理员 payload 读取权限，不新增后端路由。
  - Review Queue 增加 Inspect 按钮，点击后拉取 asset detail。
  - 使用 `POPUP_TYPE.TEXT`、安全 DOM 和 `.text(JSON.stringify(...))` 展示资产摘要与 JSON payload。
  - 增加预览弹窗 CSS，使 meta 和 payload 在桌面/手机上可滚动、不撑破布局。
  - 扩展后端测试，确认管理员可读取 payload，普通公开详情仍不泄漏 payload。
  - 扩展前端契约测试，覆盖 inspect action、detail fetch、TEXT popup、安全 JSON 展示和预览 CSS。
- 创建/修改的文件：
  - README.md
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/style.css
  - tests/market-wallet.test.js
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 18：创作者修订与重新提交
- **状态：** complete
- 执行的操作：
  - 选择 creator revise 作为被拒资产后的最小闭环，避免创作者只能看拒绝原因而不能修改重提。
  - 新增 `PATCH /api/market/assets/:id`，仅创建者可修改 draft/rejected 资产。
  - PATCH 成功后统一回到 `draft/private`，清理旧 `review_notes`、`reviewed_by` 和 `submitted_at`。
  - 禁止 submitted/listed/delisted 原地修改，避免 live payload 对已授权用户静默变化。
  - PATCH 复用创建体校验，并额外验证 normalized payload 形状，避免保存无效草稿。
  - marketplace-wallet 增加 Revise 操作，拉取资产详情并复用上传表单编辑。
  - 上传表单增加编辑状态提示和 Cancel 按钮；编辑时 Save/Submit 改走 PATCH 后复用 `/submit`。
  - 扩展后端测试，覆盖非 owner、无效价格/载荷、字段篡改、各状态限制、rejected 修改后重新提交。
  - 扩展前端契约测试，覆盖 Revise action、编辑状态、PATCH、表单填充、取消和 CSS。
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

### 阶段 19：用户资产库
- **状态：** complete
- 执行的操作：
  - 选择 My Library 作为购买/领取后的最小找回入口，避免用户只能从市场列表找已拥有资产。
  - 新增 `GET /api/market/library`，返回当前用户 active entitlements 对应资产。
  - Library 响应包含授权来源、资产摘要、用户安装次数和最近安装摘要，不返回 payload、ledger ids 或绝对路径。
  - 已下架但仍授权资产会继续保留在 Library 中，可重新安装。
  - marketplace-wallet 增加 My Library 面板，放在 Creator Center 与市场筛选之间。
  - Library 后台降级加载，失败只 warn，不阻塞钱包和市场主列表。
  - Library 安装按钮复用现有 install action，安装成功后后台刷新 Library 计数。
  - 扩展后端测试，覆盖当前用户隔离、下架后可见、排序、安装摘要和敏感字段不泄漏。
  - 扩展前端契约测试，覆盖 Library 模板、加载、降级、安装事件和移动样式。
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

### 阶段 20：托管健康检查
- **状态：** complete
- 执行的操作：
  - 选择公开 `GET /api/health` 作为托管 Web/PWA 的最小探活端点。
  - 将 health 路由放在 `requireLoginMiddleware` 之前，避免部署平台未登录探活失败。
  - Health 响应只返回 `ok/status/service/version/uptime/timestamp`，不包含用户、市场、钱包或 git 细节。
  - 新增 `tests/health.test.js` 契约测试，确认 health 路由公开且字段稳定。
  - 将 health 契约测试纳入根目录 `npm run test:marketplace`。
  - 更新 README 和设计文档中的 API/脚本说明。
- 创建/修改的文件：
  - README.md
  - docs/marketplace-currency-design.md
  - package.json
  - src/server-main.js
  - tests/health.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 21：资产详情弹窗
- **状态：** complete
- 执行的操作：
  - 选择 Details 作为购买前和 Library 中查看资产元数据的最小入口。
  - marketplace 列表和 My Library 条目增加 Details 操作。
  - Review Queue 的 Inspect 复用同一 asset detail 弹窗逻辑。
  - Details 复用 `GET /api/market/assets/:id`；未授权用户只看到元数据，已授权/创建者/管理员可看到 payload。
  - 调整预览渲染，未授权时显示 payload 获取条件，不再渲染空 JSON。
  - 扩展前端契约测试，覆盖 details action、统一详情函数和 payload gate。
  - 扩展后端测试，覆盖 fixed_price 购买后详情可读取 payload。
- 创建/修改的文件：
  - README.md
  - docs/marketplace-currency-design.md
  - public/scripts/extensions/marketplace-wallet/index.js
  - tests/market-wallet.test.js
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 23：市场浏览筛选与排序
- **状态：** complete
- 执行的操作：
  - 选择客户端筛选/排序作为当前 JSON-store MVP 的最小浏览增强。
  - 市场筛选条新增价格筛选：任意、免费、付费。
  - 新增访问状态筛选：全部、可获取、已入库、我的上传。
  - 新增排序：最新、热门、价格低到高、价格高到低。
  - 扩展 `getFilteredAssets()`，按类型、价格、访问状态、搜索词和排序组合过滤。
  - 调整筛选控件 CSS，保证移动端可换行且控件不挤压。
  - 扩展前端契约测试，覆盖新增控件、过滤分支、排序分支和事件绑定。
- 创建/修改的文件：
  - README.md
  - docs/marketplace-currency-design.md
  - public/scripts/extensions/marketplace-wallet/window.html
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/style.css
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 24：市场基础脚本语法门禁
- **状态：** complete
- 执行的操作：
  - 新增 `scripts/check-marketplace-syntax.mjs`，集中检查 marketplace/wallet/PWA/health 相关 JS 文件是否存在并通过 `node --check`。
  - 新增根命令 `npm run test:marketplace:syntax`。
  - 更新 `npm run test:marketplace`，先运行语法门禁，再运行市场、钱包、PWA、health Jest 契约测试。
  - 更新 README Useful Scripts，补充 syntax gate 用法。
- 创建/修改的文件：
  - scripts/check-marketplace-syntax.mjs
  - package.json
  - README.md
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 25：PWA 缓存清单完整性
- **状态：** complete
- 执行的操作：
  - 扩展 `tests/pwa.test.js`，在 VM sandbox 中读取 service worker 的 `SHELL_ASSETS`。
  - 断言预缓存清单包含 `/`、`/manifest.json` 和 `/scripts/pwa.js` 等核心 shell 资源。
  - 逐项检查预缓存资源对应的 `public/` 文件存在，其中 `/` 映射为 `public/index.html`。
- 创建/修改的文件：
  - tests/pwa.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 26：设计文档 MVP/API 边界校准
- **状态：** complete
- 执行的操作：
  - 根据并行 agent 只读扫描结果，校准 `docs/marketplace-currency-design.md` 的当前 MVP 范围。
  - 将 API 模块拆成当前本地 MVP 已实现 API 和 Future SaaS API。
  - 把版本、评论、充值、退款、独立 Creator/Admin API、preset_pack、asset_pack 标为后续。
  - 明确当前 marketplace-wallet 上传端点提交规范化 JSON payload，不做 multipart 文件解析。
  - 校准角色能力表，区分当前管理员工具能力和 Future SaaS 能力。
- 创建/修改的文件：
  - docs/marketplace-currency-design.md
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 27：托管运行态 Smoke 脚本
- **状态：** complete
- 执行的操作：
  - 新增 `scripts/smoke-marketplace-runtime.mjs`，从仓库根目录临时启动真实 `server.js`。
  - 脚本自动分配 `127.0.0.1` 端口，并传入临时 `configPath` 和 `dataRoot`。
  - 启动参数禁用浏览器自动打开、SSL、heartbeat、IPv6、whitelist 和 basic auth，降低 smoke 环境噪音。
  - 轮询 `/api/health` 到 ready，再校验 `/manifest.json` 和 `/service-worker.js`。
  - 新增根命令 `npm run test:marketplace:smoke`，并把 smoke 脚本加入 syntax gate。
- 创建/修改的文件：
  - scripts/smoke-marketplace-runtime.mjs
  - scripts/check-marketplace-syntax.mjs
  - package.json
  - README.md
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 28：市场筛选排序可执行测试
- **状态：** complete
- 执行的操作：
  - 新增 `public/scripts/extensions/marketplace-wallet/filters.js`，将市场列表筛选排序抽为纯函数。
  - 更新 `index.js`，由 DOM 控件读取条件后调用 `filterAndSortAssets()`。
  - 新增 `tests/marketplace-wallet-filters.test.js`，覆盖类型、价格、访问状态、搜索、排序和不修改原数组。
  - 将 filters 和新测试文件加入 `scripts/check-marketplace-syntax.mjs`。
  - 将新测试纳入 `npm run test:marketplace`。
  - 将 marketplace-wallet manifest 版本提升到 `0.2.1`，避免旧 ESM 模块缓存。
- 创建/修改的文件：
  - public/scripts/extensions/marketplace-wallet/filters.js
  - public/scripts/extensions/marketplace-wallet/index.js
  - public/scripts/extensions/marketplace-wallet/manifest.json
  - tests/marketplace-wallet-filters.test.js
  - tests/marketplace-wallet-ui.test.js
  - scripts/check-marketplace-syntax.mjs
  - package.json
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 29：Report Queue Resolve 前端覆盖
- **状态：** complete
- 执行的操作：
  - 在 `tests/marketplace-wallet.e2e.js` 中新增 `makeOpenReport()` fixture。
  - 扩展 `mockMarketplaceApis()`，支持 report 列表、resolve POST 记录和本地 report 移除。
  - 新增浏览器级用例，等待 Report Queue 渲染后点击 Resolve，断言 POST 和空队列文案。
  - 在 `tests/marketplace-wallet-ui.test.js` 中补充契约，确认 resolve 成功后从 `state.reports` 本地移除记录。
- 创建/修改的文件：
  - tests/marketplace-wallet.e2e.js
  - tests/marketplace-wallet-ui.test.js
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 30：Marketplace Wallet GitHub Actions 门禁
- **状态：** complete
- 执行的操作：
  - 新增 `.github/workflows/marketplace-wallet-checks.yml`。
  - workflow 在 PR 相关路径变化时运行，并在 `codex/marketplace-wallet-mvp` 分支 push 时运行。
  - workflow 使用 Node 24，安装根依赖和 `tests/` 依赖。
  - workflow 执行 `npm run test:marketplace:syntax`、`npm run test:marketplace`、`npm run test:marketplace:smoke` 和 `npm run test:marketplace:e2e -- --list`。
- 创建/修改的文件：
  - .github/workflows/marketplace-wallet-checks.yml
  - task_plan.md
  - progress.md
  - findings.md

### 阶段 31：Fork CI 凭证噪音修复
- **状态：** complete
- 执行的操作：
  - 读取 GitHub run `28236597360` 失败日志，确认失败发生在 `actions/create-github-app-token`。
  - 失败原因是 fork 仓库缺少官方 bot 的 `ST_BOT_APP_ID`，导致 `appId option is required`。
  - 更新 `.github/workflows/pr-check-merge-conflicts.yaml`，让 merge-conflict bot job 只在 `SillyTavern/SillyTavern` 官方仓库运行。
- 创建/修改的文件：
  - .github/workflows/pr-check-merge-conflicts.yaml
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
| report queue 回归 | `npm run test:marketplace` | admin 可查看并 resolve open report，普通用户禁止，重复 resolve 400 | 通过：3 suites / 14 tests | 通过 |
| marketplace E2E 列表复核 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| admin inspect 回归 | `npm run test:marketplace` | 管理员可读取 payload，Review Queue 有 Inspect 预览契约 | 通过：3 suites / 14 tests | 通过 |
| creator revise 回归 | `npm run test:marketplace` | draft/rejected 可修订重提，submitted/listed/delisted 禁止原地改 | 通过：3 suites / 15 tests | 通过 |
| My Library 回归 | `npm run test:marketplace` | 用户库返回当前用户授权资产、下架后仍可见、安装摘要更新且不泄漏 payload | 通过：3 suites / 15 tests | 通过 |
| health endpoint 契约 | `npm run test:marketplace` | `/api/health` 公开且返回服务级状态字段 | 通过：4 suites / 16 tests | 通过 |
| asset details 回归 | `npm run test:marketplace` | 未授权详情不泄漏 payload，付费购买后详情可读 payload，前端 Details 走统一弹窗 | 通过：4 suites / 16 tests | 通过 |
| marketplace filters 回归 | `npm run test:marketplace` | 类型/价格/访问状态/排序控件与前端过滤分支存在 | 通过：4 suites / 16 tests | 通过 |
| marketplace syntax 门禁 | `npm run test:marketplace:syntax` | market/wallet/PWA/health 相关 JS 文件存在且无语法错误 | 通过：11 files checked | 通过 |
| marketplace 聚合脚本串联 | `npm run test:marketplace` | 先跑 syntax gate，再跑 Jest 契约测试 | 通过：syntax gate + 4 suites / 16 tests | 通过 |
| marketplace E2E 列表复核 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| PWA 缓存清单完整性 | `npm run test:pwa` | 预缓存资源均存在且 `/` 映射到 `index.html` | 通过：1 suite / 4 tests | 通过 |
| marketplace 聚合含 PWA 缓存检查 | `npm run test:marketplace` | syntax gate + marketplace/PWA/health 契约通过 | 通过：4 suites / 17 tests | 通过 |
| 文档边界校准基础验证 | `rg ... docs/marketplace-currency-design.md` | 当前 MVP 与 Future SaaS API 分区存在，关键 future 项仍保留但不混入 MVP | 通过 | 通过 |
| 文档阶段 marketplace 回归 | `npm run test:marketplace` | 代码基础闭环不受文档更新影响 | 通过：4 suites / 17 tests | 通过 |
| 文档阶段 E2E 列表 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| marketplace runtime smoke | `npm run test:marketplace:smoke` | 临时启动真实 server 并校验 health/PWA 公开端点 | 通过：`/api/health`、`/manifest.json`、`/service-worker.js` | 通过 |
| smoke 脚本语法门禁 | `npm run test:marketplace:syntax` | smoke 脚本纳入 marketplace syntax gate | 通过：12 files checked | 通过 |
| smoke 阶段 marketplace 回归 | `npm run test:marketplace` | syntax gate + marketplace/PWA/health 契约通过 | 通过：4 suites / 17 tests | 通过 |
| smoke 阶段 E2E 列表 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| marketplace filters 纯函数测试 | `npm --prefix tests run test:unit -- marketplace-wallet-filters.test.js marketplace-wallet-ui.test.js` | 筛选、搜索、排序和 UI 契约通过 | 通过：2 suites / 7 tests | 通过 |
| filters 阶段 marketplace 回归 | `npm run test:marketplace` | filters 测试纳入 marketplace 根命令 | 通过：5 suites / 19 tests | 通过 |
| filters 阶段 runtime smoke | `npm run test:marketplace:smoke` | 临时 server health/PWA 公开端点仍可访问 | 通过 | 通过 |
| filters 阶段 E2E 列表 | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：2 tests listed | 通过 |
| Report Queue UI 契约 | `npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js` | resolve endpoint、事件绑定和本地移除契约存在 | 通过：1 suite / 5 tests | 通过 |
| Report Queue E2E 列表 | `npm run test:marketplace:e2e -- --list` | 能发现新增 Report Queue resolve browser 用例 | 通过：3 tests listed | 通过 |
| Report Queue marketplace 回归 | `npm run test:marketplace` | frontend contract 与 marketplace 根测试通过 | 通过：5 suites / 19 tests | 通过 |
| Report Queue 指定 E2E 实跑 | `npm --prefix tests run test:e2e -- marketplace-wallet.e2e.js -g "resolves reports"` | 浏览器级 resolve 流程通过 | 未通过：本机 Playwright 缺 `chromium_headless_shell-1194/headless_shell`；尝试安装后进程卡在解压/注册阶段，已终止 | 环境阻塞 |
| Marketplace workflow YAML 解析 | `node --input-type=module -e "import YAML..."` | workflow 可被 YAML parser 解析 | 通过：`Marketplace Wallet Checks` / job `marketplace-wallet` | 通过 |
| Marketplace workflow syntax step | `npm run test:marketplace:syntax` | workflow 第一个脚本门禁通过 | 通过：14 files checked | 通过 |
| Marketplace workflow Jest step | `npm run test:marketplace` | workflow Jest/contract step 通过 | 通过：5 suites / 19 tests | 通过 |
| Marketplace workflow smoke step | `npm run test:marketplace:smoke` | workflow runtime smoke step 通过 | 通过 | 通过 |
| Marketplace workflow E2E discovery step | `npm run test:marketplace:e2e -- --list` | workflow E2E discovery step 通过 | 通过：3 tests listed | 通过 |
| GitHub Marketplace Wallet Checks | `gh run watch 28236597364 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions 新 workflow 通过 | 通过：Marketplace Wallet MVP job 47s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但被 runner 强制 Node 24 | 通过 |
| Fork bot workflow YAML 验证 | `node --input-type=module -e "import YAML..."` | merge-conflict 和 marketplace workflows 都可解析 | 通过 | 通过 |
| Fork bot workflow 基础回归 | `npm run test:marketplace:syntax` | 修改 workflow 不影响 marketplace syntax gate | 通过：14 files checked | 通过 |
| marketplace E2E 实跑 | `npm run test:marketplace:e2e` | 浏览器 E2E 通过 | 未通过：本机 Playwright browser cache 半安装，缺 `chromium_headless_shell` / Chromium Framework | 环境阻塞 |
| Demo seed 脚本 smoke | `npm run marketplace:seed:demo -- --dataRoot $(mktemp -d ...)` | 显式 data root 下生成 demo 市场资产 | 通过：2 个 listed demo assets | 通过 |
| Demo seed Jest 覆盖 | `npm --prefix tests run test:unit -- marketplace-demo-seed.test.js` | 覆盖必填 dataRoot、资产结构、幂等 upsert 和钱包存储隔离 | 通过：1 suite / 3 tests | 通过 |
| Demo seed syntax 门禁 | `npm run test:marketplace:syntax` | seed 脚本和测试纳入 syntax gate | 通过：16 files checked | 通过 |
| Demo seed marketplace 回归 | `npm run test:marketplace` | syntax gate + marketplace/PWA/health/seed 契约通过 | 通过：6 suites / 22 tests | 通过 |
| Demo seed runtime smoke | `npm run test:marketplace:smoke` | 临时 server health/PWA 公开端点仍可访问 | 通过 | 通过 |
| Demo seed E2E discovery | `npm run test:marketplace:e2e -- --list` | 能发现 browser E2E 用例 | 通过：3 tests listed | 通过 |
| Runtime smoke API 覆盖 | `npm run test:marketplace:smoke` | 真实 server 校验 health、PWA、wallet 和 marketplace assets | 通过：`/api/wallet`、`/api/market/assets` | 通过 |
| Buyer E2E discovery | `npm run test:marketplace:e2e -- --list` | 能发现新增 free asset claim/install/browser mock 用例 | 通过：4 tests listed | 通过 |
| 收尾阶段 syntax gate | `npm run test:marketplace:syntax` | seed、smoke、E2E 文件均纳入语法门禁 | 通过：17 files checked | 通过 |
| 收尾阶段 marketplace 回归 | `npm run test:marketplace` | syntax gate + marketplace/PWA/health/seed 契约通过 | 通过：6 suites / 22 tests；一次并发验证中 `market-wallet.test.js` 举报断言短暂 404，单测和串行全量复跑均通过 | 通过 |
| Workflow YAML 收尾验证 | `node --input-type=module -e "import YAML..."` | marketplace 和 merge-conflict workflows 都可解析 | 通过 | 通过 |

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
| 2026-06-26 | Playwright `chromium-headless-shell` 安装下载完成后长时间卡住 | 1 | 终止卡住的安装进程；保留 E2E 列表验证和 Jest 契约，完整 E2E 仍待本机浏览器缓存修复 |

## 五问重启检查
| 问题 | 答案 |
|------|------|
| 我在哪里？ | 已完成市场/钱包后端、前端、管理员入口、基础脚本、Creator Center summary、PWA 安装壳、市场下架闭环、举报处理队列、审核预览、创作者修订重提、用户资产库、托管健康检查、资产详情弹窗、市场筛选排序、marketplace 语法门禁、PWA 缓存清单完整性检查、设计文档 MVP/API 边界校准、运行态 smoke 脚本、筛选排序可执行测试、Report Queue resolve 前端覆盖、GitHub Actions 门禁和 fork CI 凭证噪音修复 |
| 我要去哪里？ | 下一步完成 report 基础验证、提交推送，然后继续数据库迁移、真实支付、搜索审核和原生移动封装 |
| 目标是什么？ | 让托管版 AI 酒馆支持用户上传、购买和安装角色卡/世界书等资产 |
| 我学到了什么？ | 见 findings.md |
| 我做了什么？ | 创建规划文件、设计文档、后端 MVP、前端 marketplace-wallet 扩展、管理员审核/赠币入口、Creator Center、PWA 安装壳、市场下架闭环、举报处理闭环、审核预览、创作者修订闭环、用户资产库、托管健康检查、资产详情弹窗、市场筛选排序、README、基础测试脚本、PWA 缓存完整性测试、文档边界校准、运行态 smoke 脚本、筛选排序可执行测试、Report Queue resolve 前端覆盖、GitHub Actions 门禁和 fork CI 凭证噪音修复 |

---
*每个阶段完成后或遇到错误时更新此文件*
