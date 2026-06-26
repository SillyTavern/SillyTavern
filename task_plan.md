# 任务计划：AI 酒馆市场与货币系统设计

## 目标
为托管版 AI 酒馆设计可落地的市场、货币、UGC 上传、创作者收益与审核安全系统，并形成后续开发可引用的设计文档。

## 当前阶段
阶段 43

## 各阶段

### 阶段 1：需求与发现
- [x] 理解用户意图：网页版/手机版 AI 酒馆，用户免部署即可使用
- [x] 确定新增需求：市场功能、货币系统、用户上传角色卡和世界书
- [x] 识别 SillyTavern 现有内容结构
- [x] 将发现记录到 findings.md
- **状态：** complete

### 阶段 2：产品与系统边界
- [x] 定义市场资产类型和用户流程
- [x] 定义货币、钱包、账本和创作者收益边界
- [x] 记录关键决策及理由
- **状态：** complete

### 阶段 3：技术设计
- [x] 设计数据库核心实体
- [x] 设计 API 模块边界
- [x] 设计上传、审核、购买、安装到酒馆的核心流程
- **状态：** complete

### 阶段 4：验证与风险
- [x] 检查和现有 SillyTavern 内容导入机制的贴合点
- [x] 记录移动端支付、UGC 安全、AGPL 等风险
- **状态：** complete

### 阶段 5：交付
- [x] 创建 docs/marketplace-currency-design.md
- [x] 检查输出文件
- [x] 交付给用户
- **状态：** complete

### 阶段 6：多 Agent 并发开发
- [x] 启动并发 agent 分工
- [x] 集成市场资产后端骨架
- [x] 集成钱包账本 MVP
- [x] 集成市场资产安装适配
- [x] 补充最小测试或静态验证
- [x] 更新开发进度和风险记录
- **状态：** complete

### 阶段 7：验证与交付
- [x] 运行 lint 或目标测试
- [x] 检查路由注册和导入错误
- [x] 汇总完成内容、限制和下一步
- **状态：** complete

### 阶段 8：正式测试与 GitHub 同步
- [x] 修复 Jest 环境下默认头像路径解析
- [x] 修复 node-persist 测试清理兼容性
- [x] 修复 listed 资产详情 payload 泄漏
- [x] 修复钱包 admin grant 空 body 500
- [x] 修复测试配置路径依赖本地 `config.yaml`
- [x] 补充审核权限、授权记录、安装记录和钱包 ledger 断言
- [x] 运行 marketplace/wallet 目标单测
- [x] 运行 endpoint 语法检查和 diff 空白检查
- [x] 创建开发分支并提交
- [x] 推送到 GitHub fork 仓库
- **状态：** complete

### 阶段 9：固定价格购买闭环
- [x] 扩展钱包 helper，支持余额查询、扣款规划、管理员赠币复用和市场购买结算
- [x] 支持 `fixed_price` 市场资产创建、提交、购买和 entitlement 记录
- [x] 购买时按 `bonus -> paid` 扣款，并给创作者写入 `earnings`
- [x] 对同一资产和用户增加购买幂等与同进程串行化保护
- [x] 补充余额不足、免费领取不写账、重复购买、创作者收益和价格校验测试
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 10：前端市场与钱包入口
- [x] 使用多 agent 并发复核前端挂载点和 API 契约
- [x] 新增内置扩展 `marketplace-wallet`，挂载到 Extensions 面板
- [x] 展示钱包总额、bonus/paid/earnings 分桶和市场资产列表
- [x] 支持搜索、类型过滤、购买/领取并安装、创作者安装和草稿提交审核
- [x] 支持上传/粘贴 JSON payload 创建角色卡或世界书市场草稿
- [x] 增加本地 payload 形状校验、固定价格校验和按钮忙碌态
- [x] 运行目标语法检查、空白检查和市场/钱包单测
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 11：管理员审核与赠币入口
- [x] 使用并发 agent 复核 admin UI、审核队列和移动端风险
- [x] 新增管理员面板，支持 Review Queue 审核入口和 admin grant 表单
- [x] 管理员可在审核队列中批准或拒绝 submitted 资产
- [x] 管理员可按用户 handle 发放 bonus/paid/earnings 余额
- [x] 将 admin 可见性收紧到 `isAdmin()`，避免仅靠 handle 推断权限
- [x] 增加扩展 manifest 版本化入口，避免前端模块缓存旧脚本
- [x] 补充 grant bucket/reason 本地校验和移动端 review 按钮布局
- [x] 运行目标语法检查、manifest JSON 检查、空白检查、市场/钱包单测和浏览器 smoke
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 12：仓库交付闭环与基础测试
- [x] 明确持续目标：代码、README、基础测试和可运行脚本形成可交付闭环
- [x] 新增 marketplace-wallet Playwright E2E 测试，覆盖 admin queue、grant POST 和移动布局
- [x] 新增 marketplace-wallet Jest 前端契约测试，覆盖 manifest、模板、admin gate、grant 校验和移动 CSS
- [x] 新增根目录测试脚本 `test:marketplace` 和 `test:marketplace:e2e`
- [x] 扩展 README，写明市场钱包功能、安装启动、测试命令和生产化边界
- [x] 运行基础测试和可运行脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 13：创作者中心与收益概览
- [x] 使用多 agent 并发复核 creator API 和前端入口边界
- [x] 新增创作者资产/收益 API，返回我的上传资产、统计和 earnings 余额
- [x] 在 marketplace-wallet 扩展增加 Creator 面板，展示上传数、上架数、claims、安装数和 earned coins
- [x] 将 creator summary 设为前端降级加载，避免附属请求阻断钱包和市场列表
- [x] 补充创作者中心单测和前端契约测试
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 14：网页版/手机版 PWA 安装壳
- [x] 复用现有 web manifest 和移动 meta，不引入原生 App 壳
- [x] 补充 manifest `id`、`scope` 和描述，满足安装型 PWA 基础元数据
- [x] 在主页面和登录页注册 service worker
- [x] 新增保守静态 shell service worker，只缓存静态壳，跳过 `/api/*` 和非 GET 请求
- [x] 新增 PWA 契约测试和根目录 `test:pwa` 脚本
- [x] 将 PWA 测试纳入 `test:marketplace`
- [x] 更新 README 和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 15：市场资产下架闭环
- [x] 确认 delist 是当前市场生命周期里最小且无需产品拍板的缺口
- [x] 新增管理员下架 listed 资产 API
- [x] 保持已授权用户可继续查看和安装下架资产
- [x] 在 marketplace-wallet 增加管理员 Delist 操作
- [x] 补充后端和前端契约测试
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 16：市场资产举报入口
- [x] 确认 report 是 UGC 安全里无需产品拍板的最小补齐项
- [x] 新增用户举报 listed/owned/entitled 资产 API
- [x] 在 marketplace-wallet 增加 Report 操作
- [x] 补充后端和前端契约测试
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 17：管理员举报处理队列
- [x] 确认 report queue + resolve 是举报入口后的最小管理闭环
- [x] 新增管理员 open report 队列 API
- [x] 新增管理员 resolve report API
- [x] 在 marketplace-wallet 管理员面板增加 Report Queue
- [x] 将 report resolve 使用独立 busy/report action 状态，避免和资产操作混淆
- [x] 补充后端和前端契约测试
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 18：管理员审核内容预览
- [x] 确认审核队列不能盲批，需要最小 Inspect 入口
- [x] 复用管理员资产详情权限，不新增后端路由
- [x] 在 Review Queue 增加 Inspect 操作
- [x] 使用安全 DOM + TEXT popup 展示资产摘要和 JSON payload
- [x] 补充管理员可读取 payload 的后端断言和前端契约测试
- [x] 更新 README 和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 19：创作者修订与重新提交
- [x] 确认 rejected 资产需要修改后重提，不能只显示拒绝原因
- [x] 新增创作者 PATCH draft/rejected asset API
- [x] PATCH 后统一回到 draft/private，并清理旧 review 状态
- [x] 禁止 submitted/listed/delisted 原地修改，避免 live payload 静默变化
- [x] 在 marketplace-wallet 增加 Revise 编辑态，复用上传表单和取消按钮
- [x] 补充后端和前端契约测试
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 20：用户资产库
- [x] 确认购买/领取后需要 My Library 视图，避免资产只能从市场列表找回
- [x] 新增 `GET /api/market/library`，返回当前用户 active entitlements
- [x] Library 只返回资产摘要、授权来源和安装摘要，不返回 payload、ledger 明细或绝对路径
- [x] 已下架但仍授权的资产保留在 Library，可继续安装
- [x] 在 marketplace-wallet 增加 My Library 面板和 Install 操作
- [x] Library 后台降级加载，不阻塞钱包和市场主列表
- [x] 安装成功后后台刷新 Library 安装计数
- [x] 补充后端和前端契约测试
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 21：托管健康检查
- [x] 确认托管 Web/PWA 需要无需登录的轻量探活端点
- [x] 新增 `GET /api/health`
- [x] Health 响应只返回服务状态、版本、uptime 和时间戳，不返回用户或业务数据
- [x] 将 health 契约测试纳入 `test:marketplace`
- [x] 更新 README、设计文档和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 22：资产详情弹窗
- [x] 确认购买前和 Library 中需要轻量详情查看入口
- [x] 复用 `GET /api/market/assets/:id`，不新增后端路由
- [x] marketplace 和 Library 条目增加 Details 操作
- [x] Review Queue 的 Inspect 复用同一详情弹窗
- [x] 未授权详情只显示元数据，不显示空 payload 误导用户
- [x] 补充前端契约测试和文档
- [x] 更新规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 23：市场浏览筛选与排序
- [x] 确认市场列表需要更实用的前端浏览控制
- [x] 新增价格筛选
- [x] 新增访问状态筛选：可获取、已入库、我的上传
- [x] 新增排序：最新、热门、价格低到高、价格高到低
- [x] 保持当前 MVP 为客户端筛选排序，不引入后端搜索索引
- [x] 补充前端契约测试和文档
- [x] 更新规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 24：市场基础脚本语法门禁
- [x] 确认根目录需要更稳定的一键验证脚本
- [x] 新增 `scripts/check-marketplace-syntax.mjs`
- [x] 覆盖 market/wallet/PWA/health 相关服务端、前端和测试文件的 `node --check`
- [x] 新增 `npm run test:marketplace:syntax`
- [x] 让 `npm run test:marketplace` 先运行语法门禁再运行 Jest 契约测试
- [x] 更新 README 和规划记录
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 25：PWA 缓存清单完整性
- [x] 确认 mobile/PWA 安装壳需要验证 service worker 预缓存路径
- [x] 扩展 `tests/pwa.test.js`，解析 `SHELL_ASSETS`
- [x] 断言每个预缓存资源都存在于 `public/`
- [x] 保持 `/` 映射到 `public/index.html`
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 26：设计文档 MVP/API 边界校准
- [x] 对照当前 market/wallet/health 实现梳理已实现 API
- [x] 将当前本地 MVP API 与 Future SaaS API 拆分
- [x] 将 preset_pack、asset_pack、版本、评论、充值、退款、独立 Creator/Admin API 标为后续
- [x] 说明当前上传端点接收规范化 JSON payload，不做 multipart 文件解析
- [x] 校准角色能力中的当前能力与 Future SaaS 能力
- [x] 运行文档和基础验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 27：托管运行态 Smoke 脚本
- [x] 确认需要从根目录验证真实 server 可启动
- [x] 新增 `scripts/smoke-marketplace-runtime.mjs`
- [x] 使用临时 `configPath` 和 `dataRoot`，避免触碰本地用户数据
- [x] 自动分配本地端口并只启用 IPv4 localhost
- [x] 校验 `/api/health`、`/manifest.json`、`/service-worker.js`
- [x] 新增 `npm run test:marketplace:smoke`
- [x] 将 smoke 脚本纳入 `test:marketplace:syntax`
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 28：市场筛选排序可执行测试
- [x] 确认当前筛选排序测试过于依赖源码字符串
- [x] 抽出 `filterAndSortAssets()` 纯函数
- [x] 前端 `index.js` 继续从 DOM 收集筛选条件并调用纯函数
- [x] 新增 Jest 测试覆盖类型、价格、访问状态、搜索、排序和不变性
- [x] 将新文件纳入 syntax gate 和 `npm run test:marketplace`
- [x] 提升扩展 manifest 版本，避免旧模块缓存
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 29：Report Queue Resolve 前端覆盖
- [x] 确认 Report Queue 后端已有测试，前端缺少 resolve 流程覆盖
- [x] 扩展 Playwright mock，支持 reports/admin 和 reports/:id/resolve
- [x] 新增浏览器级 Report Queue resolve 用例
- [x] 前端契约测试锁定 resolve 后本地移除 report
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 30：Marketplace Wallet GitHub Actions 门禁
- [x] 确认当前本地脚本已覆盖 syntax、Jest、runtime smoke 和 E2E discovery
- [x] 新增 marketplace-wallet 专用 workflow
- [x] PR 仅在 marketplace/wallet/PWA/health 相关路径变更时触发
- [x] 当前 MVP 分支 push 时触发
- [x] workflow 安装 root/tests 依赖并运行 marketplace 脚本闭环
- [x] 运行 workflow 语法和基础验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 31：Fork CI 凭证噪音修复
- [x] 确认 `Marketplace Wallet Checks` 已在 GitHub fork 上通过
- [x] 定位 fork 上失败的是既有 merge-conflict bot workflow
- [x] 确认失败原因是 fork 缺少官方 `ST_BOT_APP_ID`/private key 凭证
- [x] 将 merge-conflict bot job 限制为官方仓库运行
- [x] 运行 workflow 语法和基础验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 32：Marketplace Demo Seed 脚本
- [x] 确认本地新市场首屏需要可体验示例资产
- [x] 新增 `scripts/seed-marketplace-demo.mjs`
- [x] 要求显式 `--dataRoot`，避免默认污染用户数据
- [x] 写入一张免费角色卡和一本文付费世界书
- [x] 保持脚本幂等，二次运行 upsert 不重复创建
- [x] 新增 Jest 测试覆盖 seed 输出、store 结构和状态保留
- [x] 将 seed 脚本纳入 README、syntax gate、`test:marketplace` 和 CI path filter
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 33：Runtime Smoke 与 CI 收尾补强
- [x] 使用并行审查代理检查交付闭环缺口
- [x] 扩展 runtime smoke，真实访问 `/api/wallet`
- [x] 扩展 runtime smoke，预置并读取 `/api/market/assets`
- [x] 补齐 marketplace workflow path filter 中的 PWA/E2E 依赖文件
- [x] 补充 README E2E 运行前置条件
- [x] 补充 mocked E2E buyer 主路径，覆盖 free asset claim/install 后进入 Library
- [x] 将 marketplace E2E 文件纳入 syntax gate
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 34：真实浏览器 E2E CI 闭环
- [x] 新增临时 server E2E wrapper `scripts/run-marketplace-e2e.mjs`
- [x] Playwright config 支持 `PLAYWRIGHT_BASE_URL`
- [x] 新增根脚本 `test:marketplace:e2e:server`
- [x] 将 wrapper 和 Playwright config 纳入 syntax gate
- [x] CI 安装 `chromium-headless-shell`
- [x] CI 从 E2E discovery 升级为真实运行 marketplace browser E2E
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 35：Playwright CI 安装策略修复
- [x] 确认 GitHub runner 卡在 `chromium-headless-shell` 安装步骤
- [x] 将 Playwright 配置切到 `channel: chromium`
- [x] 将 CI 安装命令切到 `playwright install --with-deps --no-shell chromium`
- [x] 更新 README 的本地浏览器安装说明
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 36：CI 使用 Runner Chrome 跑 E2E
- [x] 确认 `--no-shell chromium` 在 GitHub runner 上仍停留在浏览器安装步骤
- [x] Playwright config 支持 `PLAYWRIGHT_BROWSER_CHANNEL`
- [x] workflow 改为验证并使用 runner 自带 Chrome
- [x] 删除 CI 中 Playwright 浏览器下载步骤
- [x] 更新 README，说明可用 `PLAYWRIGHT_BROWSER_CHANNEL=chrome`
- [x] 运行基础测试和脚本验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 37：真实浏览器 E2E UI 状态修复
- [x] 定位 Runner Chrome E2E 已进入真实浏览器，但失败在隐藏抽屉、admin 可见性和首启 onboarding 状态
- [x] 在 E2E 夹具中 mock admin 当前用户，避免账号配置漂移
- [x] 在 E2E helper 中处理首次启动 onboarding 弹窗
- [x] 在 E2E helper 中打开外层 Extensions drawer，再展开 Marketplace Wallet inline drawer
- [x] 等待钱包总额渲染完成，避免只等 DOM attached 的竞态
- [x] 运行 syntax、marketplace Jest 契约、E2E discovery 和本机 Chrome 单 worker 实跑
- [x] 提交并推送到 GitHub fork
- [x] 等待 GitHub Actions 真实 Chrome E2E 通过
- **状态：** complete

### 阶段 38：钱包流水 UI 与真实运行闭环
- [x] 使用多 agent 并发审查下一步交付缺口
- [x] 在 marketplace-wallet UI 展示最近钱包流水
- [x] 从 `/api/wallet/ledger` 降级加载账本，不阻断市场主列表
- [x] 扩展 runtime smoke，覆盖免费领取、安装、Library 可见和文件落盘
- [x] 补充固定价购买并发幂等回归测试
- [x] 更新 README、设计文档、规划记录
- [x] 运行基础测试、smoke 和 CI 相关验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 39：权限坏输入与验证入口补强
- [x] 使用多 agent 并发补强测试和 CI/README 验证说明
- [x] 补充 wallet/market 权限与坏输入基础测试
- [x] 增加 marketplace workflow 手动触发或更通用分支触发
- [x] 增加 README 本地验证矩阵
- [x] 运行基础测试、workflow 解析和 diff 检查
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 40：市场与钱包导出快照脚本
- [x] 使用多 agent 并发审查导出边界
- [x] 新增只读 marketplace/wallet 导出脚本
- [x] 支持显式 `--dataRoot`、stdout 和 `--out` 文件输出
- [x] 导出 market store 摘要和 wallet ledger，避免修改用户数据
- [x] 补充脚本测试、README 和设计文档说明
- [x] 将脚本纳入 syntax gate 和 marketplace 聚合测试
- [x] 运行基础测试和 smoke 验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 41：购买响应隐私收紧
- [x] 使用多 agent 并发审查下一阶段交付缺口
- [x] 将 paid purchase API 响应改为买家可见摘要
- [x] 不在购买响应中返回创作者余额或完整 ledger entries
- [x] 保留 entitlement 内部 ledger ids 和买家余额摘要
- [x] 补充后端契约测试和 README/设计文档说明
- [x] 运行基础测试和 smoke 验证
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 42：付费购买 runtime smoke 闭环
- [x] 按并发审查建议补齐真实 server 固定价购买 smoke
- [x] 在 runtime smoke 临时 market store 中加入 fixed_price 资产
- [x] 通过真实 admin grant 给默认用户 paid 余额
- [x] 验证 paid purchase 响应隐私 shape、买家扣款和创作者收益账本
- [x] 验证付费资产可安装、Library 可见和文件落盘
- [x] 更新 README、设计文档和规划记录
- [x] 运行 syntax、marketplace 聚合和 runtime smoke
- [x] 提交并推送到 GitHub fork
- **状态：** complete

### 阶段 43：浏览器固定价购买与钱包活动 E2E
- [x] 按并发审查建议补齐 fixed-price Buy & Install 浏览器路径
- [x] 让 Playwright mock 维护钱包余额、ledger、library 状态
- [x] 断言购买后 paid 余额刷新、Wallet Activity 出现 Purchase
- [x] 断言 Library 安装数刷新且购买响应不依赖完整 ledger entries
- [x] 更新 README/规划记录
- [x] 运行 syntax、marketplace 聚合和浏览器 E2E
- [x] 提交并推送到 GitHub fork
- **状态：** complete

## 关键问题
1. 是否优先做网页/PWA，再做 iOS/Android 上架包？
2. 创作者收益是否一开始允许提现，还是先做站内积分与免费市场？
3. 是否允许成人向内容？这会显著影响审核、支付和应用商店策略。

## 已做决策
| 决策 | 理由 |
|------|------|
| MVP 先做托管 Web/PWA 市场 | 最快验证免部署体验，避免一开始被应用商店支付和审核规则卡住 |
| 货币采用消费币、赠送币、创作者收益三类余额 | 清晰区分用户购买力、运营赠送、可结算收益，降低账务混乱 |
| 市场资产先支持角色卡、世界书、预设包、资源包 | 与 SillyTavern 现有内容类型贴合，能最快复用导入/安装逻辑 |
| 所有钱包变动必须走不可变账本 | 虚拟货币和分账系统不能只存余额，否则难以审计和修复问题 |
| 使用多 agent 并发切片开发 | 后端钱包、市场、安装适配和代码调查可以并行推进，主 agent 负责集成 |
| 市场资产必须审核后才能购买 | submitted 状态仅进入审核队列，listed 后才对普通用户可购买 |
| admin grant 只允许管理员调用 | 避免测试赠币接口成为公开刷币入口 |
| Creator Center summary 只返回聚合视图 | 钱包原始余额和 ledger 由 Wallet API 负责，市场接口不暴露流水明细或资产 payload |
| 默认角色卡头像路径使用 serverDirectory 解析 | Jest 和生产运行目录可能不同，不能依赖相对 cwd |
| listed 资产详情默认不返回 payload | 防止未购买用户绕过购买/安装直接获得角色卡或世界书正文 |
| fixed_price 购买按 bonus 后 paid 扣款 | 符合设计文档中赠送币优先消耗的产品策略 |
| 免费领取不写钱包账本 | 避免产生 0 金额账本噪音，付费购买才生成可审计 ledger |
| 市场/钱包前端做成内置扩展 | 复用 SillyTavern extension manifest、模板、CSS 加载和 Extensions 面板，避免继续膨胀主入口脚本 |
| 非创作者购买按钮采用“购买并安装” | 列表接口不暴露 entitlement，直接组合 purchase/install 可以兼容重复购买返回 already_owned |
| 管理员前端入口只使用 `isAdmin()` 判断 | 后端实际按 `request.user.profile.admin` 授权，前端不能用 `default-user` handle 推断权限 |
| `marketplace-wallet` manifest 使用版本化 JS/CSS URL | 避免浏览器复用旧 ESM 模块，保证 admin UI 修复刷新后生效 |
| 手机版先走 PWA 安装壳 | 最少代码满足手机打开即用；原生 iOS/Android 壳等支付、推送、商店策略明确后再做 |
| PWA service worker 不缓存 API | 钱包、市场、聊天和账号请求必须保持实时，静态壳缓存即可 |
| PWA 预缓存清单必须可验证 | `cache.addAll()` 遇到任一缺失资源会让 install 失败，基础测试要覆盖文件存在性 |
| 设计文档必须区分当前 MVP 与 Future SaaS | 避免 README/设计文档承诺当前代码尚未实现的充值、退款、版本、评论和独立后台 API |
| 运行态 smoke 必须隔离本地数据 | 临时启动真实 server 时使用临时 config/data，只请求公开 health/PWA 端点，避免写入用户工作数据 |
| 前端筛选排序应有可执行测试 | 筛选逻辑抽为纯函数后，Jest 能直接验证类型、价格、访问状态、搜索和排序，不依赖浏览器环境 |
| 举报队列前端需要覆盖 resolve 流程 | 后端 resolve 测试不足以保证管理员点击后 UI 队列清空，需要浏览器 mock 或契约测试覆盖 |
| Marketplace MVP 需要独立 CI 门禁 | 相关路径变更时自动跑 syntax、Jest、runtime smoke 和 E2E discovery，避免只依赖本地验证 |
| 官方 bot workflow 不应在 fork 缺凭证时失败 | fork 没有 `ST_BOT_APP_ID` 和 private key，merge-conflict bot 应只在官方仓库运行 |
| 下架不撤销既有 entitlement | 下架阻止新购买和公开浏览，但已购买用户的安装副本能力保留，避免破坏已有体验 |
| 举报先只创建 open report | MVP 需要可审计入口，自动处罚和处理队列等管理策略后续再加 |
| 举报处理先做队列和 resolve | 管理员需要能清理 open reports；封禁、自动处罚和申诉规则仍需产品策略 |
| 审核预览复用管理员 asset detail | 管理员已有 payload 读取权限，Inspect 只需要前端拉详情并用安全 DOM 展示 |
| 创作者修订只允许 draft/rejected | listed 资产已有购买/授权关系，原地改 payload 会破坏买家预期；后续需要版本化发布 |
| Library 基于 active entitlements | 用户库应展示已领取/购买资产，包含下架但仍授权的内容；payload 继续按详情懒加载 |
| Health endpoint 公开但不含用户数据 | 部署平台和移动壳需要未登录探活，响应只能包含服务级状态 |
| 资产详情复用 payload 权限 | Details 统一使用 asset detail API；未授权用户看元数据，已授权/创建者/管理员才看 payload |
| MVP 浏览先做客户端筛选排序 | 当前 JSON store 数据量有限，先补 UI 可用性；正式 SaaS 再上服务端搜索、排序和索引 |
| marketplace 根测试先跑语法门禁 | 低成本捕捉服务端、前端扩展、PWA 和测试文件语法破损，再进入较慢 Jest 契约 |
| Demo seed 必须显式指定 dataRoot | 本地体验需要可见市场内容，但脚本不应悄悄写入真实用户目录 |
| Runtime smoke 应触达私有 market/wallet API | 只测 health/PWA 无法发现 marketplace 路由注册、默认用户上下文或存储初始化问题 |
| 钱包流水 UI 是最近视图 | 前端展示最近 wallet ledger 方便用户核对余额；完整审计账本仍以 `/api/wallet/ledger` 为准 |
| Runtime smoke 应覆盖真实领取安装 | 真实 server smoke 需要验证 free purchase、install、Library 和文件落盘，避免只证明服务能启动 |
| 固定价购买必须有并发回归 | 同一用户同一资产并发购买只应结算一次，避免重复扣款和创作者重复入账 |
| Marketplace workflow push 分支放宽到 `codex/**` | 后续并行 Codex 工作分支仍应触发同一 marketplace 门禁；path filter 已限制只在相关文件变更时运行，避免扩大到无关分支 |
| 市场/钱包快照默认导出白名单字段 | 备份和迁移检查需要资产/授权/安装/举报/账本摘要，但不应默认导出 payload、举报正文、本地安装路径、完整 ledger reason/metadata 或绝对 dataRoot |
| 快照 `--out` 不允许写入 dataRoot | 导出命令应保持用户数据目录只读，避免备份检查动作改变正在运行的本地数据根 |
| 购买 API 响应应只返回买家需要的信息 | 买家需要 entitlement、是否已拥有和自己的余额摘要；创作者余额和完整 ledger entries 属于更敏感的账务审计数据，应通过各自 wallet/creator 接口读取 |
| runtime smoke 需要覆盖固定价货币闭环 | 免费领取能证明安装路径，固定价购买才能证明真实 server 下 admin grant、扣款、创作者收益和响应隐私 shape 同时可用 |

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| Jest 安装角色卡时找不到 `./public/img/ai4.png` | 1 | 在 market endpoint 中用 `serverDirectory` 解析默认头像绝对路径 |
| `storage.stop is not a function` | 1 | 移除 node-persist 测试清理中的不存在方法调用 |
| 未购买用户可从 listed 详情拿到 `normalized_payload` | 1 | 详情接口按创建者、管理员、授权用户过滤 payload |
| 钱包 admin grant 空 body 返回 500 | 1 | 使用 `request.body ?? {}` 后再解析字段 |
| admin 面板 DOM 已渲染但仍保留 `hidden` | 1 | 改为显式 `removeAttr('hidden')`/`attr('hidden', '')`，并提高扩展入口版本避免模块缓存 |
| Runner Chrome E2E 中 marketplace admin 和按钮不可见 | 1 | E2E helper 打开外层 Extensions drawer、展开内层 inline drawer，并 mock admin 用户 |
| Runner Chrome E2E 首次启动被 onboarding 弹窗遮挡 | 1 | E2E helper 等待并点击 onboarding Save |
| marketplace snapshot 测试未初始化 node-persist 时 `storage.clear` 不是函数 | 1 | afterEach 中先判断 `storage.clear` 是否存在，再执行清理 |

## 备注
- 设计文档阶段已完成。
- 后端 MVP 骨架和前端扩展入口已完成；暂不包含真实支付接入、数据库迁移和完整 UI 自动化测试。
