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
| GitHub Demo Seed Checks | `gh run watch 28237551217 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions marketplace workflow 通过 | 通过：Marketplace Wallet MVP job 39s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |
| E2E server wrapper discovery | `npm run test:marketplace:e2e:server -- --list` | 临时 server 启动后 Playwright 能发现 marketplace browser 用例 | 通过：4 tests listed | 通过 |
| E2E server wrapper 本地实跑 | `npm run test:marketplace:e2e:server` | 本机真实浏览器 E2E 通过 | 未通过：本机 Playwright cache 缺 `chromium_headless_shell-1194/chrome-mac/headless_shell`；CI 已改为先安装 chromium-headless-shell 再实跑 | 环境阻塞 |
| GitHub E2E headless-shell 安装 | `gh run watch 28237783793` | CI 安装 chromium-headless-shell 后实跑 E2E | 已取消：runner 长时间停在 `Install Playwright browser`；改用 Chromium channel + `--no-shell` 策略 | 环境阻塞 |
| Chromium channel E2E discovery | `npm run test:marketplace:e2e:server -- --list` | `channel: chromium` 配置下 wrapper 仍能启动临时 server 并发现用例 | 通过：4 tests listed | 通过 |
| GitHub Chromium install 策略 | `gh run watch 28238257185` | CI 安装 `chromium --no-shell` 后实跑 E2E | 已取消：runner 仍长时间停在 `Install Playwright browser`；改为使用 runner 自带 Chrome channel | 环境阻塞 |
| Runner Chrome E2E discovery | `npm run test:marketplace:e2e:server -- --list` | `PLAYWRIGHT_BROWSER_CHANNEL` 支持后，wrapper discovery 仍正常 | 通过：4 tests listed | 通过 |
| Runner Chrome GitHub E2E 初跑 | `gh run watch 28238485632` | 使用 runner 自带 Chrome 跑真实 browser E2E | 未通过：3 个用例因 Extensions/inline drawer hidden 或 admin state 未准备而不可点击；mobile layout 通过 | 待修复 |
| E2E UI 状态修复 syntax | `npm run test:marketplace:syntax` | E2E admin mock、onboarding 和 drawer helper 语法门禁 | 通过：19 files checked | 通过 |
| E2E UI 状态修复 marketplace 回归 | `npm run test:marketplace` | syntax gate + marketplace/PWA/health/seed 契约 | 通过：6 suites / 22 tests | 通过 |
| E2E UI 状态修复 discovery | `npm run test:marketplace:e2e:server -- --list` | 临时 server 能发现 4 个 browser E2E 用例 | 通过：4 tests listed | 通过 |
| 本机 Chrome 单 worker E2E | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1` | 用系统 Chrome 验证 admin queue、report resolve、free claim/install 和 mobile layout | 通过：4 passed (1.5m)；本机 Chrome channel 在测试结束后父进程延迟退出，手动 Ctrl-C 后清理，无残留 server | 通过 |
| GitHub Runner Chrome E2E 修复验证 | `gh run watch 28239958010 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions syntax、Jest、runtime smoke、runner Chrome 和真实 browser E2E 全链路 | 通过：Marketplace Wallet MVP job 1m2s，browser E2E step 成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |
| Wallet Activity 目标验证 | `npm --prefix tests run test:unit -- market-wallet.test.js marketplace-wallet-ui.test.js` | 钱包流水 UI 契约和固定价并发购买幂等测试通过 | 通过：2 suites / 13 tests | 通过 |
| 阶段 38 syntax gate | `npm run test:marketplace:syntax` | ledger UI、runtime smoke 和并发测试语法门禁 | 通过：19 files checked | 通过 |
| 阶段 38 marketplace 聚合 | `npm run test:marketplace` | syntax + marketplace/PWA/health/seed/filter/UI 契约通过 | 通过：6 suites / 23 tests | 通过 |
| 阶段 38 runtime smoke | `npm run test:marketplace:smoke` | 真实 server 校验 health/PWA/wallet/assets/free purchase/install/library/文件落盘 | 通过 | 通过 |
| Wallet ledger E2E 修复目标验证 | `npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js` | `loadWalletLedger()` 不覆盖主钱包余额 | 通过：1 suite / 5 tests | 通过 |
| Wallet ledger E2E 修复 marketplace 回归 | `npm run test:marketplace` | syntax + marketplace/PWA/health/seed/filter/UI 契约通过 | 通过：6 suites / 23 tests | 通过 |
| Wallet ledger E2E 修复 runtime smoke | `npm run test:marketplace:smoke` | 真实 server free purchase/install/library/文件落盘仍通过 | 通过 | 通过 |
| Wallet ledger E2E 修复本机 Chrome | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1` | 真实浏览器 admin/report/free-claim/mobile 四用例 | 通过：4 passed (1.7m)；本机父进程延迟退出后 Ctrl-C 清理 | 通过 |
| GitHub Wallet ledger E2E 修复验证 | `gh run watch 28240992614 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions syntax、Jest、runtime smoke、runner Chrome 和真实 browser E2E 全链路 | 通过：Marketplace Wallet MVP job 1m38s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |
| 阶段 39 wallet 权限坏输入目标测试 | `npm --prefix tests run test:unit -- market-wallet.test.js` | 普通用户跨钱包读取禁止、管理员可读、invalid bucket/amount/unknown user 明确失败 | 通过：1 suite / 9 tests | 通过 |
| 阶段 39 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/PWA/health/seed/filter/UI 契约通过 | 通过：6 suites / 24 tests | 通过 |
| 阶段 39 marketplace workflow YAML 解析 | `node --input-type=module -e 'import YAML from "yaml"; ...'` | workflow 支持 `workflow_dispatch`，push 分支为 `codex/**`，且 marketplace job 存在 | 通过 | 通过 |
| 阶段 39 README diff 检查 | `node --input-type=module -e '... git diff -- README.md ...'` | README diff 包含验证矩阵和 4 个 marketplace 验证命令 | 通过 | 通过 |
| GitHub 阶段 39 权限测试验证 | `gh run watch 28241497439 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions syntax、Jest、runtime smoke、runner Chrome 和真实 browser E2E 全链路 | 通过：Marketplace Wallet MVP job 1m4s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |
| 阶段 40 snapshot export 目标测试 | `npm --prefix tests run test:unit -- marketplace-snapshot-export.test.js` | 显式 dataRoot、stdout、--out、只读 data root、隐私字段过滤和空 store 行为 | 通过：1 suite / 5 tests | 通过 |
| 阶段 40 syntax gate | `npm run test:marketplace:syntax` | snapshot 脚本和测试纳入 marketplace 语法门禁 | 通过：21 files checked | 通过 |
| 阶段 40 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 29 tests | 通过 |
| 阶段 40 runtime smoke | `npm run test:marketplace:smoke` | 真实 server health/PWA/wallet/assets/free purchase/install/library 仍通过 | 通过 | 通过 |
| 阶段 40 snapshot CLI smoke | `node scripts/export-marketplace-snapshot.mjs --dataRoot "$tmp_data" --out "$tmp_out/snapshot.json"` | 空 dataRoot 可导出到外部文件，且不泄露 data_root | 通过 | 通过 |
| 阶段 40 diff 空白检查 | `git diff --check` | 当前补丁无 trailing whitespace 或 whitespace error | 通过 | 通过 |
| 阶段 41 wallet purchase 目标测试 | `npm --prefix tests run test:unit -- market-wallet.test.js` | paid purchase 响应不返回 creator_balance/full ledger entries，账本仍可从 wallet ledger 验证 | 通过：1 suite / 9 tests | 通过 |
| 阶段 41 syntax gate | `npm run test:marketplace:syntax` | market endpoint 和测试语法门禁 | 通过：21 files checked | 通过 |
| 阶段 41 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 29 tests | 通过 |
| 阶段 41 runtime smoke | `npm run test:marketplace:smoke` | 真实 server health/PWA/wallet/assets/free purchase/install/library 仍通过 | 通过 | 通过 |
| 阶段 42 runtime smoke 固定价闭环 | `npm run test:marketplace:smoke` | 真实 server fixed-price purchase、admin grant、buyer debit、creator earning、响应隐私、安装和 Library | 通过 | 通过 |
| 阶段 42 syntax gate | `npm run test:marketplace:syntax` | 扩展后的 runtime smoke 脚本语法门禁 | 通过：21 files checked | 通过 |
| 阶段 42 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 29 tests | 通过 |
| 阶段 43 syntax gate | `npm run test:marketplace:syntax` | fixed-price browser E2E mock 语法门禁 | 通过：21 files checked | 通过 |
| 阶段 43 E2E discovery | `npm run test:marketplace:e2e:server -- --list` | 临时 server 能发现 5 个 marketplace 浏览器用例 | 通过：5 tests listed | 通过 |
| 阶段 43 本机 Chrome E2E | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1` | admin、report、free、fixed-price buy/install/wallet activity、mobile 五个用例 | 通过：5 passed；本机父进程延迟退出后 Ctrl-C 清理 | 通过 |
| 阶段 43 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 29 tests | 通过 |
| 阶段 43 runtime smoke | `npm run test:marketplace:smoke` | 真实 server fixed-price purchase runtime smoke 仍通过 | 通过 | 通过 |
| 阶段 44 syntax gate | `npm run test:marketplace:syntax` | creator upload browser E2E mock 语法门禁 | 通过：21 files checked | 通过 |
| 阶段 44 E2E discovery | `npm run test:marketplace:e2e:server -- --list` | 临时 server 能发现 6 个 marketplace 浏览器用例 | 通过：6 tests listed | 通过 |
| 阶段 44 本机 Chrome E2E | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1` | admin、report、free、fixed-price、creator upload submit、mobile 六个用例 | 通过：6 passed (2.4m) | 通过 |
| 阶段 44 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 29 tests | 通过 |
| 阶段 44 runtime smoke | `npm run test:marketplace:smoke` | 真实 server fixed-price purchase runtime smoke 仍通过 | 通过 | 通过 |
| 阶段 45 syntax gate | `npm run test:marketplace:syntax` | creator upload runtime smoke 脚本语法门禁 | 通过：21 files checked | 通过 |
| 阶段 45 runtime smoke | `npm run test:marketplace:smoke` | 真实 server creator upload/create/submit/detail/approve/list/install 与既有 purchase/install 闭环 | 通过 | 通过 |
| 阶段 45 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 29 tests | 通过 |
| 阶段 46 角色隔离目标单测 | `npm --prefix tests run test:unit -- market-wallet.test.js` | submitted/private asset 对非 owner 隐藏、owner 自审批禁止、非 admin 不可 approve、owner/admin payload 权限、公开后只返回元数据 | 通过：1 suite / 10 tests | 通过 |
| 阶段 46 syntax gate | `npm run test:marketplace:syntax` | market-wallet 新增测试语法门禁 | 通过：21 files checked | 通过 |
| 阶段 46 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 30 tests | 通过 |
| 阶段 47 syntax gate | `npm run test:marketplace:syntax` | rejected revise/resubmit browser E2E mock 语法门禁 | 通过：21 files checked | 通过 |
| 阶段 47 E2E discovery | `npm run test:marketplace:e2e:server -- --list` | 临时 server 能发现 7 个 marketplace 浏览器用例 | 通过：7 tests listed | 通过 |
| 阶段 47 本机 Chrome E2E | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1` | admin、report、free、fixed-price、creator upload、rejected revise/resubmit、mobile 七个用例 | 通过：7 passed (2.8m)；本机父进程延迟退出后 Ctrl-C 清理 | 通过 |
| 阶段 47 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 通过：7 suites / 30 tests | 通过 |
| 阶段 48 syntax gate | `npm run test:marketplace:syntax` | report runtime smoke 脚本语法门禁 | 通过：21 files checked | 通过 |
| 阶段 48 runtime smoke | `npm run test:marketplace:smoke` | 真实 server report create/admin queue/resolve/queue clear 与既有 purchase/install 闭环 | 通过 | 通过 |
| 阶段 48 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/filter/UI 契约 | 初次与 smoke 并行运行时出现一次 delist 404；随后单独 `market-wallet.test.js` 和串行 `test:marketplace` 均通过：7 suites / 30 tests | 通过 |
| 阶段 49 API reference 目标测试 | `npm --prefix tests run test:unit -- marketplace-api-reference.test.js` | API reference Markdown 生成、`--out` 写文件、未知参数和缺失 `--out` 路径校验 | 通过：1 suite / 4 tests | 通过 |
| 阶段 49 syntax gate | `npm run test:marketplace:syntax` | API reference 脚本和测试纳入 marketplace 语法门禁 | 通过：23 files checked | 通过 |
| 阶段 49 API reference CLI smoke | `npm run marketplace:export:api > /tmp/st-marketplace-api-reference.md && rg ...` | 生成 Markdown 包含 market report、wallet admin grant 和 public health 端点 | 通过 | 通过 |
| 阶段 49 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/API reference/filter/UI 契约 | 通过：8 suites / 34 tests | 通过 |
| 阶段 49 diff 空白检查 | `git diff --check` | 当前补丁无 trailing whitespace 或 whitespace error | 通过 | 通过 |
| GitHub 阶段 49 API reference 验证 | `gh run watch 28246518305 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions syntax、Jest、runtime smoke、runner Chrome 和真实 browser E2E 全链路 | 通过：Marketplace Wallet MVP job 1m38s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |
| 阶段 50 syntax gate | `npm run test:marketplace:syntax` | PWA browser E2E 用例和脚本入口语法门禁 | 通过：23 files checked | 通过 |
| 阶段 50 PWA 静态契约 | `npm run test:pwa` | manifest、PWA 注册脚本、SW API 排除和预缓存清单仍通过 | 通过：1 suite / 4 tests | 通过 |
| 阶段 50 PWA browser E2E | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:pwa:e2e` | 真实 Chrome 验证 service worker activated、shell CacheStorage 和 `/api/health` 不缓存 | 通过：1 passed | 通过 |
| 阶段 50 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/API reference/filter/UI 契约 | 通过：8 suites / 34 tests | 通过 |
| 阶段 50 runtime smoke | `npm run test:marketplace:smoke` | 真实 server health/PWA/wallet/market/creator/report/free/fixed-price/library 闭环仍通过 | 通过 | 通过 |
| 阶段 50 E2E discovery | `npm run test:marketplace:e2e:server -- --list` | 临时 server 能发现 PWA + marketplace 8 个浏览器用例 | 通过：8 tests listed | 通过 |
| 阶段 50 本机 Chrome E2E | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1` | PWA service worker、admin、report、free、fixed-price、creator upload、rejected revise/resubmit、mobile 八个用例 | 通过：8 passed (2.2m)；本机父进程延迟退出后 Ctrl-C 清理，无残留 server | 通过 |
| 阶段 50 diff 空白检查 | `git diff --check` | 当前补丁无 trailing whitespace 或 whitespace error | 通过 | 通过 |
| GitHub 阶段 50 PWA browser E2E 验证 | `gh run watch 28247412731 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions syntax、Jest、runtime smoke、runner Chrome 和真实 browser E2E 全链路 | 通过：Marketplace Wallet MVP job 1m37s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |
| 阶段 51 脚本契约测试 | `npm --prefix tests run test:unit -- marketplace-scripts.test.js` | `test:marketplace:all` 串起 contract、runtime smoke 和 E2E，且 fast `test:marketplace` 不递归慢速脚本 | 通过：1 suite / 2 tests | 通过 |
| 阶段 51 syntax gate | `npm run test:marketplace:syntax` | marketplace scripts 测试纳入语法门禁 | 通过：24 files checked | 通过 |
| 阶段 51 marketplace 聚合回归 | `npm run test:marketplace` | syntax + marketplace/wallet/PWA/health/seed/snapshot/API reference/scripts/filter/UI 契约 | 通过：9 suites / 36 tests | 通过 |
| 阶段 51 慢速全闭环脚本 | `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:all` | 顺序运行 `test:marketplace`、runtime smoke 和临时 server browser E2E | 通过：contract 9 suites / 36 tests、runtime smoke ok、browser E2E 8 passed | 通过 |
| GitHub 阶段 51 全闭环脚本验证 | `gh run watch 28247839474 --repo Angelidiot/SillyTavern --exit-status` | GitHub Actions syntax、Jest、runtime smoke、runner Chrome 和真实 browser E2E 全链路 | 通过：Marketplace Wallet MVP job 1m25s，全步骤成功；actions 注解提示 pinned actions 内部 Node 20 deprecated 但 runner 强制 Node 24 | 通过 |

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
| 2026-06-26 | Runner Chrome 真实 E2E 中 admin、report、purchase 按钮隐藏或不可点击 | 1 | E2E helper 打开外层 Extensions drawer、展开内层 Marketplace inline drawer，并 mock admin 当前用户 |
| 2026-06-26 | 临时 data root 首次启动 onboarding 弹窗遮挡测试交互 | 1 | E2E helper 等待欢迎弹窗并点击 Save |
| 2026-06-26 | 本机 Chrome channel E2E 通过后父进程延迟退出 | 1 | 手动 Ctrl-C 后 wrapper 清理 server；以 GitHub runner 作为并行 E2E 退出行为最终裁决 |
| 2026-06-26 | Wallet ledger 降级请求覆盖 E2E mock 钱包余额，导致真实 Chrome E2E 看到 0 而非 175 | 1 | `loadWalletLedger()` 只更新最近流水，不再用 `/api/wallet/ledger` 响应覆盖 `state.wallet.balance` |
| 2026-06-26 | YAML workflow 检查脚本把空 `workflow_dispatch:` 当成缺失 | 2 | 改用 `Object.hasOwn(triggers, 'workflow_dispatch')` 检查键存在，而不是检查 truthy 值 |
| 2026-06-26 | snapshot export 测试在未初始化 node-persist 的用例后调用 `storage.clear` 抛 `storage.clear is not a function` | 1 | afterEach 中先判断 `typeof storage.clear === 'function'`，只在存在时执行清理 |
| 2026-06-26 | 阶段 48 并行跑 runtime smoke 和 marketplace Jest 聚合时，`market-wallet.test.js` delist 断言短暂返回 404 | 1 | 单独复跑 `market-wallet.test.js` 和串行 `npm run test:marketplace` 均通过；后续避免将真实 server smoke 与 Jest 聚合并行执行 |
| 2026-06-26 | 阶段 49 API reference 测试最初按 3 空格断言 `GET` 对齐 | 1 | 脚本按 6 字符 method column 输出，测试改为断言 `GET    /...` 并新增缺失 `--out` 路径校验 |
| 2026-06-26 | 阶段 50 PWA browser E2E 首跑时 active service worker 短暂为 `activating` | 1 | 改用 `expect.poll` 等待 `readyRegistration.active.state === 'activated'` 后再断言和 reload |

## 2026-06-26 阶段 38：钱包流水 UI 与真实运行闭环
- 启动并行 worker `019f040f-2485-7a31-9e82-15ca33bfc3fe`，限定其只补测试/文档契约，主线程负责 UI/样式/runtime smoke。
- Explorer `019f040c-2e25-7113-96c4-e05768f0562b` 完成只读审查，推荐优先补 runtime smoke 的真实免费领取/安装/文件落盘闭环，并补固定价购买并发幂等测试。
- 新开阶段 38，目标是让钱包流水在 UI 可见，同时强化真实 server smoke 和钱包双扣风险回归。
- marketplace-wallet 新增 Wallet Activity 面板，降级加载 `/api/wallet/ledger` 的最近 6 条流水，展示正负金额、bucket、类型和时间；manifest 升到 `0.2.2`。
- runtime smoke 增加 `--disableCsrf` 并实际 POST 免费领取、安装，随后校验 Library 和临时 dataRoot 内 world book 文件。
- `market-wallet.test.js` 新增固定价并发购买测试：两次并发 purchase 只生成一条 entitlement、一笔 buyer debit 和一笔 creator earning。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- market-wallet.test.js marketplace-wallet-ui.test.js`、`npm run test:marketplace`、`npm run test:marketplace:smoke`、`git diff --check`。
- GitHub run `28240670891` 的真实 Chrome E2E 暴露 ledger 降级请求会用真实 `/api/wallet/ledger` 的 0 余额覆盖 mocked `/api/wallet` 的 175 余额；已修复为 ledger 请求只更新最近流水，余额继续由 `/api/wallet` 和 grant/purchase 主流程返回维护。
- GitHub run `28240992614` 已确认修复有效，Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 39：权限坏输入与验证入口补强
- 启动 worker `019f041d-ef72-77d3-a4f4-b78ff0e21bbf` 负责 workflow 手动触发和 README 验证矩阵，主线程负责钱包/市场权限坏输入测试。
- `market-wallet.test.js` 新增 wallet read scope/admin grant input 回归：普通用户不能用 `handle` query 读别人钱包或 ledger，管理员可读指定用户，invalid bucket、0 amount、unknown user 分别返回 400/400/404。
- `.github/workflows/marketplace-wallet-checks.yml` 增加 `workflow_dispatch`，并将 push 分支从 `codex/marketplace-wallet-mvp` 放宽到 `codex/**`，继续依赖 path filter 限制无关改动。
- README 新增 marketplace 本地验证矩阵，覆盖 syntax、contract、runtime smoke 和临时 server E2E 命令。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js`、`npm run test:marketplace`、workflow YAML 键存在性检查、`git diff --check`。
- GitHub run `28241497439` 已确认阶段 39 权限坏输入测试和 workflow/README 改动通过 Marketplace Wallet Checks 全链路。

## 2026-06-26 阶段 40：市场与钱包导出快照脚本
- Explorer `019f0426-8600-7843-bff6-d98443e5a18c` 完成只读审查，建议用 node-persist API 读 ledger，并默认导出白名单字段，避免 payload、举报正文、本地路径、完整 ledger reason/metadata 和绝对 data root 泄漏。
- 新增 `scripts/export-marketplace-snapshot.mjs` 和 `npm run marketplace:export:snapshot`，要求显式 `--dataRoot`，支持 stdout JSON 和 `--out` 文件输出。
- 快照输出包含 `market.summary/assets/entitlements/installs/reports` 与 `wallet.summary/ledger`；wallet ledger 只读取 `wallet:ledger:v1:`，并过滤合法 bucket 与 safe integer amount。
- `--out` 指向 data root 内部时会拒绝执行，保证导出动作不修改用户数据目录。
- 新增 `tests/marketplace-snapshot-export.test.js`，覆盖缺失 dataRoot、stdout 摘要、隐私字段过滤、外部 `--out`、dataRoot 内 `--out` 拒绝和无 `_storage` 时不创建钱包目录。
- README Useful Scripts 和验证矩阵加入 snapshot export；设计文档记录它作为迁移演练和备份检查工具。
- 已通过 `npm --prefix tests run test:unit -- marketplace-snapshot-export.test.js`、`npm run test:marketplace:syntax`、`npm run test:marketplace`、`npm run test:marketplace:smoke`、snapshot CLI smoke、`git diff --check`。

## 2026-06-26 阶段 41：购买响应隐私收紧
- 选择下一个低风险交付缺口：paid purchase 响应之前会把 `purchase.ledger_entries` 和 `purchase.creator_balance` 返回给买家，账务边界偏宽。
- `src/endpoints/market.js` 新增 `toPurchaseResult()`，购买响应只保留 purchase id 和 buyer balance；entitlement 内部仍保存 `ledger_entry_ids`，用于审计和后续迁移。
- `tests/market-wallet.test.js` 改为断言购买响应不含完整 ledger entries 或 creator balance；买家扣款和创作者 earnings 继续通过各自 `/api/wallet/ledger` 响应验证。
- README 和设计文档补充 paid purchase 响应边界：完整账本、创作者余额和收益明细由 Wallet API / Creator Center 读取。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js`、`npm run test:marketplace:syntax`、`npm run test:marketplace`、`npm run test:marketplace:smoke`。

## 2026-06-26 阶段 42：付费购买 runtime smoke 闭环
- Explorer `019f0433-3fd1-7b51-b21f-42187fe1e917` 建议最优先补真实 server 固定价购买 smoke，防止 paid purchase 只在单测中可用。
- `scripts/smoke-marketplace-runtime.mjs` 的临时 market store 增加 `smoke_asset_paid_world` fixed_price world book，保留原 free world book。
- smoke 通过真实 `/api/wallet/grants/admin` 给 `default-user` 发 paid 余额，再购买 fixed-price 资产，验证 purchase response 不含 `ledger_entries`/`creator_balance`。
- smoke 继续通过 `/api/wallet/ledger` 验证买家 paid 扣到 0，并通过 admin query 读取 `smoke-creator` earnings ledger 为 7。
- smoke 安装 free 和 paid world book，验证两个文件都写入临时 dataRoot，Library 中两个资产均可见且 install_count 为 1。
- README 验证矩阵和设计文档已更新 runtime smoke 覆盖范围。
- 已通过 `npm run test:marketplace:smoke`、`npm run test:marketplace:syntax`、`npm run test:marketplace`、`git diff --check`。

## 2026-06-26 阶段 43：浏览器固定价购买与钱包活动 E2E
- 按 Gibbs 的第二推荐补 fixed-price Buy & Install 浏览器路径，让 UI 自动化覆盖余额刷新和 Wallet Activity，而不是只依赖后端单测/runtime smoke。
- `tests/marketplace-wallet.e2e.js` 的 mock 现在维护可变 `wallet`、`ledger` 和 `library`，`/api/wallet` 与 `/api/wallet/ledger` 会随 purchase/grant 更新。
- 新增浏览器用例 `buys a fixed-price asset, refreshes wallet activity, and installs it`：点击 125 coins 资产后断言 purchase/install API 调用、总额 50、bonus 0、paid 25、earnings 25、Wallet Activity 显示 Purchase/-100/-25，Library 显示 Purchased/1 installs。
- README 验证矩阵更新 `test:marketplace:e2e:server` 覆盖范围，包含 fixed-price buy/install、wallet activity 和 Library。
- 已通过 `npm run test:marketplace:syntax`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1`（5 passed，父进程延迟退出后 Ctrl-C 清理）、`npm run test:marketplace`、`npm run test:marketplace:smoke`。

## 2026-06-26 阶段 44：Creator 上传到审核队列浏览器闭环
- 按 Gibbs 的第三候选补 creator upload browser path，覆盖 marketplace-wallet 表单从粘贴 JSON 到 Save & Submit 的完整前端路径。
- `tests/marketplace-wallet.e2e.js` 的 mock 新增 create/submit 路由，支持 POST `/api/market/assets` 创建 draft、POST submit 后改成 submitted，并让 creator summary 动态读取当前用户资产。
- 新增浏览器用例 `submits a world book upload into the review queue and creator center`：填写 world_book JSON、提交审核、断言 create payload、submit 调用、Review Queue 出现新资产、Creator Center total assets 为 1 且列表显示 submitted。
- README 验证矩阵更新 `test:marketplace:e2e:server` 覆盖范围，包含 creator upload/submit。
- 已通过 `npm run test:marketplace:syntax`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1`（6 passed）、`npm run test:marketplace`、`npm run test:marketplace:smoke`。

## 2026-06-26 阶段 45：Creator 上传审核 runtime smoke 闭环
- 启动只读 explorer `019f0451-68d3-7243-b9a9-7f189727da6f` 复核真实 market API 上传、提交、审批和 smoke 断言边界，主线程并行实现脚本增强。
- `scripts/smoke-marketplace-runtime.mjs` 在真实临时 server 中 POST 创建 world_book draft，验证 creator_id、private/draft、free pricing 和 normalized payload 保留。
- smoke 随后验证 Creator Center draft 统计、POST submit 后 review/submitted、creator detail 可读 payload、POST approve 后 listed/public 与 review metadata。
- smoke 再验证公开市场列表包含 approved upload 但不泄漏 `normalized_payload`，创作者可安装该世界书并让 Creator Center install_count/total_installs 刷新。
- README 验证矩阵和设计文档已更新 runtime smoke 覆盖范围，明确 creator upload/submit/approve 已纳入真实 server 闭环。
- 已通过 `npm run test:marketplace:syntax`、`npm run test:marketplace:smoke` 和 `npm run test:marketplace`。

## 2026-06-26 阶段 46：Creator/Admin 角色隔离后端契约
- 启动只读 explorer `019f0458-acc4-77d2-b61e-50734d66c322` 复核 market endpoint 与测试 helper 的角色隔离缺口，主线程先补现有单测覆盖。
- `tests/market-wallet.test.js` 新增 `keeps submitted creator assets hidden from non-owners until admin approval`，使用 Charlie 普通创作者、Bob 普通旁观者、Alice 管理员三类身份。
- 新测试断言 Bob 看不到 Charlie 的 draft/submitted asset 列表和详情，不能 purchase，且非管理员 approve 返回 403。
- 新测试断言 Charlie 作为 owner 可读取 submitted detail payload 但不能自审批，Alice 作为 admin 可读取 payload 并 approve，approve 后 Bob 只能看到公开元数据且拿不到 normalized payload。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js`、`npm run test:marketplace:syntax` 和 `npm run test:marketplace`。

## 2026-06-26 阶段 47：Rejected 资产修订重提浏览器闭环
- 启动只读 explorer `019f045e-7b65-7761-8b9e-4ea06cd97143` 复核 marketplace-wallet revision UI 与 Playwright mock 缺口。
- `tests/marketplace-wallet.e2e.js` 的 mock 新增 asset detail GET 和 PATCH revision 路由，并记录 `apiCalls.details` 与 `apiCalls.revisions`。
- 新增浏览器用例 `revises a rejected creator asset and resubmits it for review`：owned rejected world_book 点击 Revise 后填充上传表单，修改 title/summary/payload 后 Save & Submit。
- 用例断言 PATCH payload、submit 调用、Review Queue 出现 revised asset、Creator Center 列表显示 submitted，上传表单清空。
- README E2E 验证矩阵已更新 rejected asset revise/resubmit 覆盖范围。
- 已通过 `npm run test:marketplace:syntax`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1`（7 passed，本机父进程延迟退出后 Ctrl-C 清理）和 `npm run test:marketplace`。

## 2026-06-26 阶段 48：举报处理 runtime smoke 闭环
- 启动只读 explorer `019f0467-6760-7311-8106-b1513f3f55d0` 复核真实 report API shape、resolve 响应和 smoke 断言边界。
- `scripts/smoke-marketplace-runtime.mjs` 在真实临时 server 中对 `smoke_asset_demo` 创建 open report，断言 reporter、reason、body 和 status。
- smoke 随后读取管理员 report queue，断言能找到 open report，asset 摘要只包含白名单字段，不泄漏 payload 或 metadata。
- smoke 通过真实 `POST /api/market/reports/:id/resolve` 写入 resolution note，断言 resolved_by、resolved_at、resolution_note，并确认再次读取 admin queue 时该 report 已消失。
- README 验证矩阵和设计文档已更新 runtime smoke 覆盖范围，明确 report create/queue/resolve 已纳入真实 server 闭环。
- 已通过 `npm run test:marketplace:syntax`、`npm run test:marketplace:smoke`、`npm --prefix tests run test:unit -- market-wallet.test.js` 和串行 `npm run test:marketplace`。

## 2026-06-26 阶段 49：Marketplace API reference 导出脚本
- 启动只读 explorer `019f0471-97ac-74f3-b15a-1a478dd5a0aa` 复核下一阶段交付缺口；其首要建议是收尾 API reference README/文档闭环，后续建议是浏览器级 PWA/service worker E2E 和慢速全闭环脚本。
- 新增 `scripts/export-marketplace-api-reference.mjs` 和 `npm run marketplace:export:api`，从 `src/endpoints/market.js`、`src/endpoints/wallet.js` 与公开 health route 生成 Markdown API reference。
- CLI 支持 stdout、`--out <file>`、`--out=<file>`、环境变量输出路径、`--help`，并对未知参数和缺失 `--out` 路径明确报错。
- 新增 `tests/marketplace-api-reference.test.js`，覆盖 Market API、Wallet API、Public health API 端点输出、显式 `--out` 写文件和参数错误。
- README Useful Scripts、验证矩阵和设计文档已加入 API reference 导出命令，说明它用于发布前核对当前本地 MVP 路由。
- 已通过 `npm --prefix tests run test:unit -- marketplace-api-reference.test.js`、`npm run test:marketplace:syntax`、`npm run marketplace:export:api` CLI smoke、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28246518305` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 50：PWA service worker 浏览器 E2E
- 启动只读 explorer `019f0479-b6aa-7621-b7ca-7d74958342c6` 复核 PWA/Service Worker E2E 风险，确认应避免 API mock、等待 `navigator.serviceWorker.ready`、reload 后确认 controller，并清理 CacheStorage/registrations。
- `tests/marketplace-wallet.e2e.js` 新增 `hosted tavern PWA browser shell` 用例，打开 `/login.html` 触发真实 `scripts/pwa.js` 注册 `/service-worker.js`。
- 用例会清理当前 context 的 service worker 和 cache，等待 active state 进入 `activated`，reload 后确认页面受 `/service-worker.js` controller 控制。
- 用例断言 `sillytavern-shell-v1` 包含 `/`、`/login.html`、`/manifest.json`、`/style.css` 和 `/scripts/pwa.js`，然后请求真实 `/api/health` 并确认 CacheStorage 不包含 `/api/health`。
- 新增根脚本 `npm run test:pwa:e2e`，默认使用临时 server、grep PWA 用例并固定 `--workers=1`，减少同 origin Service Worker 并行串扰。
- README 验证矩阵和设计文档已更新，说明浏览器级 PWA E2E 覆盖 service worker 激活、shell cache 和 API cache exclusion。
- 已通过 `npm run test:marketplace:syntax`、`npm run test:pwa`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:pwa:e2e`、`npm run test:marketplace`、`npm run test:marketplace:smoke`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1`（8 passed，本机父进程延迟退出后 Ctrl-C 清理）和 `git diff --check`。
- GitHub run `28247412731` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 51：Marketplace 慢速全闭环脚本
- 新增 `npm run test:marketplace:all`，顺序执行 `test:marketplace`、`test:marketplace:smoke` 和 `test:marketplace:e2e:server`。
- 新增 `tests/marketplace-scripts.test.js`，锁定慢速全闭环脚本的命令顺序，并断言日常 `test:marketplace` 不递归 slow loop 或直接跑 browser E2E。
- 将脚本契约测试纳入 `scripts/check-marketplace-syntax.mjs` 和 `npm run test:marketplace`。
- 补齐 `.github/workflows/marketplace-wallet-checks.yml` path filter 中的 API reference/snapshot 脚本和新增测试文件，避免纯测试或导出脚本变更漏跑 marketplace CI。
- README 验证矩阵和设计文档已补充 `test:marketplace:all` 作为发布前慢速验证入口。
- 已通过 `npm --prefix tests run test:unit -- marketplace-scripts.test.js`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:all`。
- GitHub run `28247839474` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 52：创作者上传 tags 与 JSON 类型识别
- 启动只读 explorer `019f048f-c9f5-7420-bc03-223f8f3dfdbf` 复核 tags 后端约束、测试落点和文档落点，确认后端已有 `tags` 字段、最多 20 个、每个 40 字符，不需要后端改动。
- marketplace-wallet 上传表单新增 `Tags, comma separated` 输入，提交 draft、submit 或 revise 时把 tags 数组写入现有 Market API body。
- 市场资产卡片新增 tags chips，详情弹窗继续显示 tags，筛选搜索明确覆盖 tags 命中。
- Load JSON 现在会读取本地 JSON 文件后按 payload 形状自动设置 `character_card` 或 `world_book`，并优先用 payload name 填标题。
- `marketplace-wallet` manifest bump 到 `0.2.3`，避免浏览器缓存旧 JS/CSS。
- `tests/marketplace-wallet-ui.test.js` 锁定 tags 输入、提交 payload、回填/清空、tags chips 和 JSON 类型识别代码；`tests/marketplace-wallet-filters.test.js` 补 tags 搜索断言。
- `tests/marketplace-wallet.e2e.js` 的 creator upload 用例覆盖角色卡 JSON 自动识别、世界书 JSON 自动识别、tags 去重提交和列表 tags 展示。
- README 验证矩阵和设计文档已更新 tags 上传、列表展示、搜索命中和 JSON type auto-detect 的当前 MVP 边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-filters.test.js marketplace-wallet-ui.test.js`、`npm run test:marketplace`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'submits a world book upload'`、`npm run test:marketplace:smoke`、`npm run test:marketplace:e2e:server -- --list` 和 `git diff --check`。
- 完整本机 Chrome E2E 已通过 8 个用例；父进程延迟退出后 Ctrl-C 清理，临时 server 无残留。
- GitHub run `28248891425` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 53：举报详情正文前端闭环
- 启动只读 explorer `019f049e-fecd-7a90-ac02-728e3203b64f` 复核 report 前端、E2E mock、UI contract 和文档落点，确认后端已有 `{ reason, body }` 支持且管理员队列已显示 `body`。
- marketplace-wallet Report 操作改为两步输入：先填短 reason，再填可选 details/body；提交时按后端上限写入 `reason` 和 `body`。
- Report 提交成功后后台刷新管理员 Report Queue；普通用户没有 admin 队列时仍保持降级无感。
- `tests/marketplace-wallet.e2e.js` 增加 `POST /api/market/assets/*/report` mock，记录 report payload 并把新 report 放入 admin queue。
- 新增浏览器用例覆盖点击 Report、填写 reason/body、断言 POST payload 和管理员队列显示详细正文。
- README 和设计文档已补充 report body 当前 API/前端边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'submits a report with reviewer details'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list` 和 `git diff --check`。
- 完整本机 Chrome E2E 已通过 9 个用例；父进程延迟退出后 Ctrl-C 清理，临时 server 无残留。
- GitHub run `28249528500` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 54：粘贴 JSON 自动识别上传类型
- 根据只读 explorer `019f049c-2eb8-7190-bae4-70e52d162886` 的前端体验建议，补齐 textarea 粘贴 JSON 与 Load JSON 文件导入之间的体验差异。
- 抽出 `applyUploadPayloadHints()` 和 `applyUploadPayloadTextHints()`，文件导入和 textarea `change/blur` 共用角色卡/世界书类型识别与标题提示逻辑。
- 粘贴合法 world book JSON 后会自动切换为 `world_book` 并在标题为空时填 payload name；粘贴角色卡 JSON 会切换为 `character_card`，但不覆盖用户已有标题。
- UI contract 锁定粘贴识别 helper 和事件绑定；浏览器 E2E 的 creator upload 用例覆盖粘贴 world book、粘贴 character card、已有标题不覆盖，以及原有文件导入提交路径。
- README、设计文档和 findings 已补充文件/粘贴 JSON 都支持 type auto-detect。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'submits a world book upload'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list` 和 `git diff --check`。
- GitHub run `28249861787` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 55：余额不足购买提示
- 根据前端体验 explorer 的建议，补齐固定价资产余额不足时只依赖按钮 `title` 的移动端可见性缺口。
- marketplace-wallet 在不可购买的 fixed-price 资产动作区显示 `Need X more bonus or paid coins`，并通过 `aria-describedby` 关联 disabled 购买按钮。
- 可消费余额继续只计算 `bonus + paid`，不把 `earnings` 计入买家购买力。
- 新增 `.marketplace-wallet-affordability` 样式，桌面靠右、移动端居中，避免窄屏溢出。
- 浏览器 E2E 新增 unaffordable fixed-price 用例，断言按钮 disabled、缺口金额、aria 关联和不会触发 purchase；移动布局用例加入 affordability 文案无溢出检查。
- README、设计文档和 findings 已补充余额不足提示和 bonus/paid 消费边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'missing spendable balance'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28250265735` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 56：市场筛选无结果清空入口
- 根据前端体验 explorer 的建议，补齐市场筛选/搜索无结果时无法快速回到默认浏览的移动端体验缺口。
- marketplace-wallet 筛选条新增 `Clear filters` 按钮，默认 hidden；仅当当前存在 search/type/price/access/sort 条件且结果为空时显示。
- 点击 Clear filters 会清空搜索、类型、价格、访问状态，并将排序恢复到 `recent`，随后重新渲染资产列表。
- 移动端样式让筛选条按钮和输入控件一样全宽，避免窄屏横向溢出。
- UI contract 锁定 Clear filters 模板、显示逻辑和事件绑定；浏览器 E2E 覆盖空结果、按钮显示、清空后资产恢复和控件默认值。
- README、设计文档和 findings 已补充 clear-filter 浏览体验。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'clears active marketplace filters'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28250680898` 已确认 Marketplace Wallet Checks 全链路通过。

## 2026-06-26 阶段 57：资产详情元数据补齐
- 启动只读 explorer `019f04bd-a0fe-7bb3-9ee7-555e92ef1dc7` 复核 Details/Inspect 入口、E2E 落点和 UI contract 字符串，确认市场卡片 Details 与审核 Inspect 都复用 `viewAssetDetails()`。
- marketplace-wallet Details 弹窗新增语言、内容分级、创建日期、上架日期和更新日期。
- 新增 `formatAssetDate()`，把资产生命周期时间格式化为稳定 `YYYY-MM-DD`，避免浏览器 locale 造成测试漂移。
- `marketplace-wallet` manifest bump 到 `0.2.4`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 新增详情元数据用例，点击资产卡片 Details 后断言 language/content rating/created/listed/updated 出现在弹窗中。
- README、设计文档和 findings 已补充详情元数据展示边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'shows asset detail metadata'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list` 和 `git diff --check`。
- 完整本机 Chrome E2E 已通过 12 个用例；父进程延迟退出后 Ctrl-C 清理，临时 server 无残留。
- GitHub run `28251336091` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 58：用户库详情入口补齐
- 启动只读 explorer `019f04c7-7ac8-78e1-9500-dc3ac2c56965` 扫描下一步低风险候选；它建议优先补 My Library 细节、Creator Center 细分统计和 Review Queue 元信息。
- 发现阶段 22/文档已记录“Marketplace 和 Library 条目增加 Details”，但当前 `renderLibrary()` 只渲染 Install，属于实现漂移。
- marketplace-wallet My Library 条目新增 Details + Install action 组，Details 继续复用 `viewAssetDetails()` 和现有 payload 权限。
- 移动端 `.marketplace-wallet-library-actions` 采用两列按钮网格，避免 Details/Install 在窄屏横向溢出。
- `marketplace-wallet` manifest bump 到 `0.2.5`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 在免费领取进入 Library 后，从库条目点击 Details 并断言详情弹窗出现；移动布局用例加入 library action 两列断言。
- README、设计文档和 findings 已补充 Library details/reinstall 当前边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'claims and installs a free asset'`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list` 和 `git diff --check`。
- 首次 `npm run test:marketplace` 中 `market-wallet.test.js` 的 `requires review before purchase...` 出现一次 `TypeError: fetch failed / SocketError: other side closed`；同用例单独复跑通过，完整聚合随后复跑通过，判断为瞬时本地 socket 抖动。
- 完整本机 Chrome E2E 已通过 12 个用例；父进程延迟退出后 Ctrl-C 清理，临时 server 无残留。
- GitHub run `28251992376` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 59：用户库安装摘要补齐
- 根据 explorer 的 Library 细节建议，继续补齐 My Library 中已有后端字段的前端展示。
- marketplace-wallet My Library 条目现在展示授权日期 `added YYYY-MM-DD`。
- 若存在 `last_install`，My Library 额外展示最近安装日期、本地引用和安装类型摘要。
- 新增 `.marketplace-wallet-library-install`，长 `local_ref` 使用 `overflow-wrap: anywhere`，避免移动端横向溢出。
- `marketplace-wallet` manifest bump 到 `0.2.6`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 的免费领取/安装用例断言 Library 显示授权日期和最近安装路径。
- README、设计文档和 findings 已补充 Library 授权日期和最近安装摘要边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'claims and installs a free asset'`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list` 和 `git diff --check`。
- GitHub run `28252365512` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 60：创作者中心细分统计
- 根据 explorer 的 Creator Center 细分统计建议，补齐后端 summary 已返回但前端未展示的聚合字段。
- Creator Center 统计网格新增 drafts、submitted、rejected、paid sales、installs 和 earnings balance。
- marketplace-wallet E2E mock 的 creator summary 现在返回 draft/submitted/rejected、paid_sales、total_installs 和 earnings_balance，贴近真实后端响应。
- `marketplace-wallet` manifest bump 到 `0.2.7`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 的 creator upload 流程断言提交后 assets=1、submitted=1、其他状态为 0、paid sales/install 为 0，以及 earnings balance 保持 25。
- README、设计文档和 findings 已补充 Creator Center 细分统计当前边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'submits a world book upload'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28252716889` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 61：审核队列元信息摘要
- 根据 explorer 的 Review Queue 元信息建议，补齐管理员审核列表中已有安全字段的前端展示。
- Review Queue 现在展示创作者 handle、价格、更新时间、最多 3 个标签和摘要片段。
- payload 继续只在点击 Inspect 时通过 asset detail 权限懒加载，队列本身不展示 `normalized_payload`。
- 新增 `.marketplace-wallet-review-summary`，摘要使用可换行文本避免移动端溢出。
- `marketplace-wallet` manifest bump 到 `0.2.8`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 的 admin review 用例断言 creator/price/updated/tags/summary 可见，并继续覆盖 approve/grant。
- README、设计文档和 findings 已补充 Review Queue 元信息边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'renders admin review queue'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28253068352` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 62：创作者资产审核状态细节
- 启动只读 explorer `019f04e5-2eac-7e31-8967-f885e88a08df` 复核 Creator Center 资产列表的审核字段来源和测试落点。
- marketplace-wallet Creator Center 资产列表新增 audit 行，显示 submitted 日期、approved 日期和 rejected 原因摘要。
- rejected 原因截断到 120 字符并使用 `.marketplace-wallet-creator-audit` 可换行样式，避免移动端溢出。
- `marketplace-wallet` manifest bump 到 `0.2.9`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 的 creator upload 用例断言 submitted 日期；rejected revision 用例断言修订前能看到 rejected 原因摘要。
- README、设计文档和 findings 已补充 Creator Center 审核状态细节。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'submits a world book upload'`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'revises a rejected creator asset'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28253684795` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 63：详情弹窗授权信息摘要
- 根据只读 explorer `019f04ea-a25b-7df1-9393-5b99bc4ce616` 的候选建议，补齐 asset detail API 已返回但前端未展示的 entitlement。
- marketplace-wallet Details 弹窗新增当前用户 entitlement 来源、授权日期和购买引用摘要；未授权资产显示 not in library/not entitled/none。
- `marketplace-wallet` manifest bump 到 `0.2.10`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E mock 的 asset detail 现在从 Library 状态返回 entitlement，贴近真实后端 `/api/market/assets/:id`。
- README、设计文档和 findings 已补充 Details entitlement 展示边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'shows asset detail metadata'`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'claims and installs a free asset'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28254083806` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 64：举报队列创建日期摘要
- 根据 explorer 的低风险候选，补齐 admin report item 已返回但 Report Queue 未展示的 `created_at`。
- marketplace-wallet Report Queue 元信息新增 `reported YYYY-MM-DD`，帮助管理员判断 open reports 积压时间。
- `marketplace-wallet` manifest bump 到 `0.2.11`，避免浏览器缓存旧 JS/CSS。
- 浏览器 E2E 的 report resolve 和 report submit 流程均断言队列显示举报日期。
- README、设计文档和 findings 已补充 Report Queue reported date 边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'reports'`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'submits a report'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28254397838` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 65：市场搜索元数据覆盖
- 根据只读 explorer `019f04f6-ba7c-7960-b4bc-4e7f65fef03f` 的候选建议，补齐前端搜索未覆盖但后端列表已返回的 `language` 和 `content_rating` 字段。
- marketplace-wallet 的 `filterAndSortAssets()` 搜索文本池新增 language/content_rating，用户可按语言或内容分级查找资产。
- `marketplace-wallet` manifest bump 到 `0.2.12`，避免浏览器缓存旧 JS/CSS。
- filters Jest 单测新增 `ja` 和 `teen` 搜索断言，锁定元数据搜索行为。
- README、设计文档和 findings 已补充 language/rating search 边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-filters.test.js`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28254669365` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 66：快照导出审核生命周期字段
- 根据 explorer 的候选建议，补齐 snapshot export 未包含但市场资产已有的审核生命周期字段。
- `scripts/export-marketplace-snapshot.mjs` 的 asset 白名单新增 `submitted_at`、`approved_at` 和 `delisted_at`，保留既有 `listed_at`。
- snapshot export 单测 fixture 和断言新增 submitted/approved/listed/delisted lifecycle 字段，同时继续确认 payload、举报正文、本地路径和私有 metadata 不导出。
- README、设计文档和 findings 已补充 snapshot asset lifecycle 白名单边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-snapshot-export.test.js`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28254941882` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 67：API reference 路由覆盖锁定
- 根据 explorer 的候选建议，补齐 API reference 单测对当前 MVP 路由集合的覆盖。
- `tests/marketplace-api-reference.test.js` 现在断言 assets detail、creator summary、library、reports admin、asset create/submit/approve/reject/delist/report/purchase/install、report resolve、wallet ledger 和 admin grant 都出现在导出的 Markdown 中。
- README、设计文档和 findings 已补充 API reference 测试锁定完整 MVP 路由集合的边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-api-reference.test.js`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28255165232` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 68：详情弹窗下架日期
- marketplace-wallet Details 弹窗新增 `Delisted` 行，显示 `delisted_at` 的稳定 `YYYY-MM-DD` 日期；未下架资产显示 `not delisted`。
- `marketplace-wallet` manifest bump 到 `0.2.13`，避免浏览器缓存旧 JS/CSS。
- UI contract 锁定 Delisted 元信息行，浏览器详情 E2E 覆盖 delisted 日期可见。
- README、设计文档和 findings 已补充 Details delisted date 边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-wallet-ui.test.js`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'shows asset detail metadata'`、`npm run test:marketplace`、`npm run test:marketplace:e2e:server -- --list`、`PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:e2e:server -- --workers=1 -g 'keeps review controls compact'` 和 `git diff --check`。
- GitHub run `28255464078` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 69：API reference 权限隐私标注
- 根据只读 explorer `019f0509-4be1-7bc3-a5d6-1e4fcd3ccbb1` 的候选建议，给 API reference 导出增加关键权限/隐私 notes。
- `scripts/export-marketplace-api-reference.mjs` 新增 route notes 映射，继续从源码解析路由，同时在 Markdown 中标注 payload redaction、Library scope、admin-only reports/review/delist/grant、Wallet read scope 和 grant alias。
- API reference 单测新增 notes 断言，锁定这些权限/隐私边界。
- README、设计文档和 findings 已补充 API reference permission/privacy notes 边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-api-reference.test.js`、`npm run marketplace:export:api -- --out <tmpfile>` smoke、`npm --prefix tests run test:unit -- market-wallet.test.js -t 'requires review before purchase'`、`npm run test:marketplace` 复跑和 `git diff --check`。
- 首次 `npm run test:marketplace` 中 `market-wallet.test.js` 的 `requires review before purchase...` 出现一次 `TypeError: fetch failed / SocketError: other side closed`；该用例单独复跑通过，完整聚合随后复跑通过，判断为瞬时本地 socket 抖动。
- GitHub run `28255738939` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 70：市场扩展静态资产门禁
- 根据只读 explorer 的候选建议，扩展 `scripts/check-marketplace-syntax.mjs`，在 JS `node --check` 之外检查 marketplace-wallet 静态资产。
- syntax gate 现在会确认 `manifest.json`、`window.html` 和 `style.css` 存在且非空，并对 manifest 执行 JSON parse。
- `tests/marketplace-scripts.test.js` 新增契约断言，锁定静态资产门禁目标。
- README 和 findings 已补充 syntax gate 覆盖 marketplace-wallet 静态资产的边界。
- 已通过 `npm run test:marketplace:syntax`、`npm --prefix tests run test:unit -- marketplace-scripts.test.js`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28255982574` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 71：钱包管理员发放别名覆盖
- 根据 API reference 已标注的 admin grant alias，补齐后端契约测试覆盖。
- `allows only admins to grant wallet balance` 现在依次通过 `targetHandle`、`handle` 和 `userHandle` 给 bob 发放 bonus/paid/earnings。
- 测试断言三次 grant 响应都返回顶层 `handle: bob`，并写入 bob 的余额分桶与三条 actor 为 alice 的 wallet ledger 记录。
- README 和 findings 已补充 admin grant 收款人字段别名边界。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js -t 'allows only admins to grant wallet balance'`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28256378537` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 72：举报处理备注长度边界
- 在举报处理后端用例中补齐 resolve note 长度边界。
- 1001 字符 note 现在断言返回 `400 Invalid report resolution` 和 `note must be 1000 characters or less`，并确认 admin queue 中 report 仍保持 open。
- 正好 1000 字符 note 断言可成功 resolve 并原样保存到 `resolution_note`。
- README 和 findings 已补充 Report Queue resolution note 长度边界。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js -t 'requires review before purchase'`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28256650347` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 73：README 可运行脚本同步契约
- `tests/marketplace-scripts.test.js` 新增 README/package 脚本同步契约。
- 测试确认 `start:no-csrf`、marketplace seed/export/test 脚本、marketplace browser E2E 脚本和 PWA/mobile 测试脚本都存在于 `package.json` 且在 README 中有 `npm run ...` 用法。
- 根据只读 explorer 复核，README 检查限制在 Useful Scripts/Validation matrix 段落，并使用命令边界正则，避免短脚本被长脚本假命中。
- README Development Notes 已说明该契约用于防止托管版 marketplace/PWA 命令与文档漂移。
- 已通过 `npm --prefix tests run test:unit -- marketplace-scripts.test.js`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28257000239` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 74：举报提交长度边界
- 新增 `validates marketplace report reason and body length` 后端契约测试。
- 121 字符 reason 加 2001 字符 body 断言返回 `400 Invalid market report`，错误详情包含 reason/body 长度限制，并确认管理员 reports 队列仍为空。
- 120 字符 reason 加 2000 字符 body 断言可成功创建 open report，且管理员队列中 reason/body 原样可见。
- README 和 findings 已补充 Report reason/body 长度边界。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js -t 'validates marketplace report reason and body length'`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28257310065` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 75：快照举报处理生命周期覆盖
- `tests/marketplace-snapshot-export.test.js` 的 fixture 新增 open 与 resolved 两条 report。
- snapshot summary 现在测试 `reports_by_status.open/resolved`，report 明细测试 resolved report 会导出 `resolved_at`。
- redaction 断言确认 snapshot 不包含 report body、resolved report body、private moderation note 或 `resolved_by` 字段。
- README 和 findings 已补充 snapshot report lifecycle/redaction 边界。
- 已通过 `npm --prefix tests run test:unit -- marketplace-snapshot-export.test.js`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28257569504` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 76：API reference 举报边界标注
- `scripts/export-marketplace-api-reference.mjs` 的 route notes 新增 report 创建和 resolve 长度边界。
- API reference 现在标注 `POST /api/market/assets/:id/report` 的 reason 120 字符、body 2000 字符限制。
- API reference 现在标注 `POST /api/market/reports/:id/resolve` 的 note 1000 字符限制。
- `tests/marketplace-api-reference.test.js` 已锁定这两条 notes，README 和 findings 已同步说明。
- 已通过 `npm --prefix tests run test:unit -- marketplace-api-reference.test.js`、`npm run marketplace:export:api -- --out <tmpfile>` smoke、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28257786482` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 77：市场资产 tags 后端边界
- 新增 `validates and normalizes marketplace asset tags` 后端契约测试。
- 测试覆盖 tags 非数组返回 `tags must be an array`，超过 20 个返回 `tags must contain 20 items or less`。
- 测试覆盖非字符串 tag 和超过 40 字符 tag 的错误详情。
- 测试覆盖成功创建时 tags 会 trim、过滤空字符串、去重，并保留正好 40 字符的 tag。
- 根据只读 explorer 复核，同一用例补充 PATCH 入口最小覆盖，确认 draft asset 修订时 bad tags 返回同样 error shape，valid tags 会重新归一化写入资产。
- README 和 findings 已补充 bounded tags 后端边界。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js -t 'validates and normalizes marketplace asset tags'`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28258052271` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 78：市场资产文本元数据边界
- 新增 `validates and normalizes marketplace asset text metadata` 后端契约测试。
- 测试覆盖 title 121、summary 501、description 10001、language 17、content_rating 41 字符时返回对应长度错误。
- 测试覆盖 title 120、summary 500、description 10000、language 16、content_rating 40 字符可创建，并确认后端 trim 后原样保存。
- 根据只读 explorer 复核，PATCH 已由 tags 用例证明走同一验证入口，本阶段保持最小 POST 文本元数据覆盖。
- README 和 findings 已补充 bounded metadata 后端边界。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js -t 'validates and normalizes marketplace asset text metadata'`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28258315683` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 2026-06-26 阶段 79：市场资产创建 payload shape
- 新增 `validates marketplace asset create payload shape` 后端契约测试。
- 测试覆盖非 object JSON 请求体返回 `JSON body is required`。
- 测试覆盖未知 asset type、空标题、未知 price_type、非 object metadata 和非 object normalized_payload 聚合返回对应错误详情。
- README 和 findings 已补充 payload shape validation 后端边界。
- 首次目标测试用 JSON primitive 字符串请求体尝试触达 `JSON body is required`，但 `express.json()` strict parser 会在路由前返回 HTML 400；已改用 JSON array 请求体触达后端 shape 校验分支。
- 目标测试第二次暴露同一 invalid shape 还会返回 `price_coins must be a positive safe integer for fixed_price assets`，已把该聚合错误固定进契约测试。
- 已通过 `npm --prefix tests run test:unit -- market-wallet.test.js -t 'validates marketplace asset create payload shape'`、`npm run test:marketplace:syntax`、`npm run test:marketplace` 和 `git diff --check`。
- GitHub run `28258662835` 已确认 Marketplace Wallet Checks 全链路通过；仅有 GitHub Actions Node 20 runner deprecation annotation，不影响本次门禁结果。

## 五问重启检查
| 问题 | 答案 |
|------|------|
| 我在哪里？ | 已完成市场/钱包后端、前端、管理员入口、基础脚本、Creator Center summary、PWA 安装壳、市场下架闭环、举报处理队列、审核预览、创作者修订重提、用户资产库、托管健康检查、资产详情弹窗、市场筛选排序、marketplace 语法门禁、PWA 缓存清单完整性检查、设计文档 MVP/API 边界校准、运行态 smoke 脚本、筛选排序可执行测试、Report Queue resolve 前端覆盖、GitHub Actions 门禁、fork CI 凭证噪音修复、真实 Chrome E2E UI 状态修复、市场/钱包只读快照导出脚本、购买响应隐私收紧、固定价购买 runtime smoke 闭环、固定价购买浏览器 E2E、Creator 上传到审核队列浏览器闭环、Creator 上传审核 runtime smoke 闭环、Creator/Admin 角色隔离后端契约、Rejected 资产修订重提浏览器闭环、举报处理 runtime smoke 闭环、Marketplace API reference 导出脚本、PWA service worker 浏览器 E2E、Marketplace 慢速全闭环脚本、创作者上传 tags 与 JSON 类型识别、举报详情正文前端闭环、粘贴 JSON 自动识别上传类型、余额不足购买提示，以及市场筛选无结果清空入口 |
| 我要去哪里？ | 下一步继续数据库迁移、真实支付、搜索审核和原生移动封装 |
| 目标是什么？ | 让托管版 AI 酒馆支持用户上传、购买和安装角色卡/世界书等资产 |
| 我学到了什么？ | 见 findings.md |
| 我做了什么？ | 创建规划文件、设计文档、后端 MVP、前端 marketplace-wallet 扩展、管理员审核/赠币入口、Creator Center、PWA 安装壳、市场下架闭环、举报处理闭环、审核预览、创作者修订闭环、用户资产库、托管健康检查、资产详情弹窗、市场筛选排序、README、基础测试脚本、PWA 缓存完整性测试、文档边界校准、运行态 smoke 脚本、筛选排序可执行测试、Report Queue resolve 前端覆盖、GitHub Actions 门禁、fork CI 凭证噪音修复、真实 Chrome E2E UI 状态修复、marketplace/wallet 快照导出脚本、购买响应隐私收紧、固定价购买 runtime smoke 闭环、固定价购买浏览器 E2E、Creator 上传到审核队列浏览器闭环、Creator 上传审核 runtime smoke 闭环、Creator/Admin 角色隔离后端契约、Rejected 资产修订重提浏览器闭环、举报处理 runtime smoke 闭环、Marketplace API reference 导出脚本、PWA service worker 浏览器 E2E、Marketplace 慢速全闭环脚本、创作者上传 tags/JSON 类型识别、举报详情正文前端闭环、粘贴 JSON 自动识别上传类型、余额不足购买提示和市场筛选无结果清空入口 |

---
*每个阶段完成后或遇到错误时更新此文件*
