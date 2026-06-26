# AI 酒馆市场与货币系统设计

## 目标

把托管版 AI 酒馆从“能聊天”升级为“有内容生态”的产品：用户可以打开网页或手机 App，直接选择角色、世界书和预设开始玩；创作者可以上传作品、获得曝光和收益；平台可以通过订阅、模型消耗和市场抽成形成收入。

## MVP 范围

当前本地 MVP 已落地这些能力：

- 市场浏览：角色卡、世界书。
- 用户上传：提交已经规范化的 JSON payload，不做 multipart 文件解析。
- 审核发布：上传后进入草稿/待审核/上架/下架状态。
- 购买安装：免费领取或用站内币购买，一键安装到用户自己的酒馆空间。
- 钱包账本：运营赠币、购买扣款、创作者收益入账。
- 创作者中心：查看作品、领取/销量、安装数、收入和审核状态聚合。
- 管理员工具：审核、拒绝、下架、赠币、举报队列和举报 resolve。
- 手机入口：响应式 Web/PWA 安装壳，静态 shell 缓存不缓存业务 API，并有浏览器级 service worker E2E 覆盖。

正式 SaaS 第一版可以继续扩展：

- 预设包、资源包和组合场景包。
- 角色卡 PNG/JSON、世界书 JSON、预设 JSON 的文件上传解析。
- 充值、退款、提现、KYC 和税务流程。
- 独立 Creator API、Admin API、推荐位和精选运营。
- 用户评分、文字评论和收藏。

暂不建议第一版做：

- 用户之间直接转币。
- 复杂竞价广告。
- 创作者自动实时提现。
- 任意 HTML/JS 扩展市场。
- 完全开放的成人内容市场。

## 角色

| 角色 | 能力 |
|------|------|
| 游客 | 访问公开页面、安装 PWA、注册登录；游客公开市场浏览属于 Future SaaS |
| 普通用户 | 领取/购买资产、安装到酒馆、举报；评分属于 Future SaaS |
| 创作者 | 上传资产、修订草稿/拒绝资产、查看收益；版本化发布属于 Future SaaS |
| 审核员 | 审核资产、处理举报、下架违规内容；当前本地 MVP 由管理员工具承担 |
| 管理员 | 审核、拒绝、下架、赠币、处理举报；封禁、退款、推荐位属于 Future SaaS |

## 市场资产

### 资产类型

| 类型 | MVP | 说明 |
|------|-----|------|
| character_card | 是 | 角色卡，兼容 SillyTavern PNG/JSON |
| world_book | 是 | 世界书 JSON |
| preset_pack | 后续 | 模型预设、上下文模板、系统提示词组合 |
| asset_pack | 后续 | 背景图、头像、音效等静态资源 |
| scenario_pack | 后续 | 角色 + 世界书 + 开场白 + 玩法说明 |
| extension | 后续 | 风险高，需要独立沙箱和代码审核 |

### 资产状态

```text
draft -> submitted -> approved -> listed
                    -> rejected
listed -> delisted
listed -> suspended
```

### 资产详情页需要展示

- 名称、封面、作者、类型、标签、语言。
- 价格、销量、评分、收藏数。
- 简介、预览图、开场白示例、世界书条目摘要。
- 兼容模型建议：通用、OpenAI、Claude、本地模型等。
- 内容等级：全年龄、敏感、成人，仅在合规策略允许时启用。
- 更新日志、版本号、最近更新时间。
- 举报入口。

## 上传流程

```text
创作者选择资产类型
  -> 上传文件
  -> 服务端解析和校验
  -> 自动提取元数据
  -> 创作者补充介绍、标签、价格
  -> 提交审核
  -> 机器审核
  -> 人工审核或自动通过
  -> 上架
```

当前本地 MVP 不做 multipart 服务端文件上传解析；内置 marketplace-wallet 扩展可读取本地 JSON 文件或粘贴的 JSON，把内容写入 `normalized_payload`，并按 payload 形状自动选择角色卡或世界书类型。上传表单会提交最多 20 个、每个 40 字符以内的 `tags`，资产卡片和搜索也会使用这些标签。正式 SaaS 再补角色卡 PNG/JSON、世界书 JSON、预设 JSON 的解析、对象存储和安全扫描流水线。

### 上传校验

角色卡：

- 允许 PNG/JSON。
- 解析 Tavern Card 数据，校验必要字段。
- 提取 name、description、personality、scenario、first_mes、alternate_greetings。
- 清理危险 HTML、外链、过长字段。
- 生成安全预览，不直接信任原始内容。

世界书：

- 允许 JSON。
- 必须包含 entries。
- 限制条目数量、单条长度、总 token 估算。
- 标记可能的越狱提示、仇恨、侵权、隐私数据。

资源包：

- 图片限制格式、尺寸和大小。
- 音频限制格式和长度。
- 禁止可执行文件、脚本、宏和压缩包内嵌套可执行内容。

## 购买与安装

### 购买模型

支持三种价格：

- free：免费领取。
- fixed_price：固定站内币价格。
- subscription_included：会员可免费使用或折扣购买。

购买后产生授权记录，用户可以重复安装同一资产，不重复扣费。

当前后端 MVP 已支持 `free` 和 `fixed_price`：

- `free` 只创建 entitlement，不写 0 金额钱包账本。
- `fixed_price` 会先消耗 `bonus`，再消耗 `paid`，不足时返回 402 且不创建 entitlement。
- 购买成功后给创作者写入 `earnings` 账本，购买 ledger 共享 `purchase_id`，并记录资产、购买者、创作者和扣款拆分。
- 同一用户重复购买同一资产返回已有 entitlement，不重复扣款或增加销量。

### 安装模型

购买不是直接修改聊天上下文，而是生成一个“安装副本”：

```text
market_asset_version
  -> entitlement 授权检查
  -> copy/import 到 user private data
  -> 创建 installed_asset 记录
  -> 用户在酒馆里选择使用
```

这样做的好处：

- 用户可以编辑自己的副本，不影响市场原件。
- 创作者更新版本时，用户可以选择是否升级。
- 下架资产时，不会突然删除用户已有聊天体验，除非涉及严重违规。

## 货币系统

### 货币命名

建议先使用中性名字，例如：

- `Tavern Coins`：付费购买的消费币。
- `Bonus Coins`：活动、签到、补偿赠送币。
- `Creator Earnings`：创作者可结算收益。

中文产品名可以后续再定，比如“酒币”“星火币”“灵感币”。底层不要把展示名写死。

### 钱包账户

每个用户至少有三个余额：

| 账户 | 可购买内容 | 可提现 | 说明 |
|------|------------|--------|------|
| paid_coin | 是 | 否 | 用户充值获得 |
| bonus_coin | 是 | 否 | 平台赠送，通常优先或最后消耗由策略决定 |
| creator_earning | 否 | 是/后续 | 创作者销售收益，满足条件后结算 |

MVP 可以先不开提现，只显示“创作者收益待结算”。一旦开放提现，需要处理 KYC、税务、拒付、平台风控和地区限制。

### 账本原则

钱包不能只存余额，必须有不可变账本：

```text
wallet_balance = sum(wallet_ledger.amount where status = posted)
```

所有动作都生成 ledger：

- recharge：充值入账。
- grant：运营赠送。
- purchase：购买扣款。
- refund：退款。
- creator_share：创作者分成。
- platform_fee：平台抽成。
- adjustment：人工调整。
- chargeback_hold：拒付冻结。

### 消耗顺序

建议默认：

1. 先消耗即将过期的 bonus_coin。
2. 再消耗 paid_coin。
3. 不足则提示充值。

如果涉及退款：

- paid_coin 原路退回到 paid_coin。
- bonus_coin 退回 bonus_coin，但保留原过期时间或按活动规则处理。

## 定价和分成

### 市场定价

创作者可选：

- 免费。
- 固定价格：例如 10、30、99、199 coins。
- 限时免费或折扣。
- 会员免费，非会员付费。

平台应设置最低价、最高价和敏感内容限制。

### 分成建议

Web 端：

```text
用户支付 100 coins
平台服务费 30 coins
创作者收益 70 coins
```

App Store / Google Play 端：

- 如果通过 App 内购买购买数字内容或站内币，通常需要遵守平台支付规则。
- 平台抽成之后再给创作者分账，否则毛利可能被吃空。
- 推荐第一版让 App 只消费已购余额，充值和创作者提现优先放 Web 端设计，具体上架前再按平台政策调整。

## 数据模型草案

### users

已有 SillyTavern 用户体系可以作为运行态用户基础，但 SaaS 版建议新增统一账号表。

```text
id
email
phone
display_name
avatar_url
role
status
created_at
updated_at
```

### creator_profiles

```text
id
user_id
display_name
bio
status
verified_at
created_at
```

### market_assets

```text
id
creator_id
type
slug
title
summary
description
cover_url
language
tags
visibility
status
content_rating
price_type
price_coins
sales_count
rating_avg
rating_count
created_at
updated_at
listed_at
```

### market_asset_versions

```text
id
asset_id
version
source_file_url
normalized_payload_url
metadata_json
checksum
review_status
review_notes
created_at
approved_at
```

### market_entitlements

```text
id
user_id
asset_id
asset_version_id
source
purchase_id
created_at
revoked_at
```

### installed_assets

```text
id
user_id
asset_id
asset_version_id
installed_type
local_ref
installed_at
updated_at
```

### wallet_accounts

```text
id
user_id
account_type
currency
balance_cached
created_at
updated_at
```

### wallet_ledger

```text
id
user_id
account_id
transaction_group_id
event_type
amount
currency
status
reference_type
reference_id
metadata_json
created_at
posted_at
```

### purchases

```text
id
buyer_id
asset_id
asset_version_id
price_coins
paid_coin_amount
bonus_coin_amount
status
created_at
refunded_at
```

### creator_payouts

```text
id
creator_id
amount
currency
status
period_start
period_end
provider
provider_ref
created_at
paid_at
```

### reviews

```text
id
asset_id
user_id
rating
body
status
created_at
updated_at
```

### reports

```text
id
asset_id
reporter_id
reason
body
status
assigned_to
created_at
resolved_at
```

## API 模块

### 当前本地 MVP 已实现 API

除 `GET /api/health` 外，以下接口均运行在当前 SillyTavern 登录会话之后。

Market API：

```text
GET    /api/market/assets
GET    /api/market/assets/:id
GET    /api/market/library
GET    /api/market/creator/summary
GET    /api/market/reports/admin
POST   /api/market/assets
PATCH  /api/market/assets/:id
POST   /api/market/assets/:id/submit
POST   /api/market/assets/:id/approve
POST   /api/market/assets/:id/reject
POST   /api/market/assets/:id/delist
POST   /api/market/assets/:id/purchase
POST   /api/market/assets/:id/install
POST   /api/market/assets/:id/report
POST   /api/market/reports/:id/resolve
```

Wallet API：

```text
GET    /api/wallet
GET    /api/wallet/ledger
POST   /api/wallet/grants/admin
```

marketplace-wallet 钱包面板展示当前用户的最近流水，包含运营赠币、购买扣款、创作者收益等正负金额记录；完整账本仍以 `GET /api/wallet/ledger` 为准。
付费购买响应只返回 entitlement、`already_owned`、purchase id 和买家余额摘要；完整 ledger entries、创作者余额和收益明细需要通过 Wallet API 或 Creator Center 读取，避免市场购买接口扩大账务数据暴露面。
前端只把 `bonus + paid` 视为可消费余额；固定价资产余额不足时，购买按钮保持禁用，并显示还差多少可消费 coins，不把 `earnings` 计入买家消费能力。
`npm run test:marketplace:smoke` 会临时启动真实 server，覆盖 creator 上传、提交、审批、Creator Center 统计、举报创建/队列/resolve、免费领取/安装和固定价购买的 admin grant、买家扣款、创作者收益、响应隐私 shape、Library 和文件落盘。

Public health API：

```text
GET    /api/health
```

可用 `npm run marketplace:export:api` 从 `src/endpoints/market.js`、`src/endpoints/wallet.js` 和公开 health route 重新生成 Markdown 版 API reference，减少手写端点清单漂移：

```bash
npm run marketplace:export:api -- --out ./marketplace-api-reference.md
```

下架只阻止新用户公开浏览和购买，不撤销既有 entitlement；已授权用户仍可查看 payload 并安装自己的副本。
举报会写入 market store 的 open report 记录，管理员可在 marketplace-wallet 的 Report Queue 中查看举报日期并 resolve；MVP 暂不做自动处罚。
`POST /api/market/assets/:id/report` 请求体使用必填 `reason` 和可选 `body`，前端 Report 操作会把短原因和详细正文一起提交给管理员队列。
创作者可修改自己的 draft/rejected 资产，修改后回到 draft/private，再重新 submit 进入审核；submitted/listed/delisted 资产不允许原地修改，后续应改走版本化发布。
Review Queue 展示资产类型、创作者、价格、更新时间、标签和安全摘要片段；payload 仍只在管理员点击 Inspect 后通过资产详情权限懒加载。
Library 接口只返回当前用户 active entitlements 对应的资产摘要、授权来源和安装记录摘要，不返回 `normalized_payload`；已下架但仍授权的资产也会保留在用户库中。marketplace-wallet 的 My Library 条目展示授权日期、最近安装日期和本地引用摘要，并提供 Details 和 Install，用户可从库里查看授权资产元数据并重新安装，不需要回到公开市场列表查找。
资产详情弹窗复用 `GET /api/market/assets/:id`；未授权用户只能看到元数据，创建者、管理员或已授权用户才会看到 payload。当前 marketplace-wallet 弹窗会显示类型、状态、创建者、语言、内容分级、价格、标签、稳定的创建/上架/更新时间，以及当前用户的 entitlement 来源、授权日期和购买引用摘要。
本地 MVP 的市场浏览先用客户端筛选和排序，支持类型、价格、访问状态、搜索、最新、热门和价格排序；正式 SaaS 需要服务端搜索与排序索引。
当前 marketplace-wallet 在筛选结果为空且存在激活筛选时显示 Clear filters，移动端也可以一键回到默认浏览状态。
托管探活使用公开 `GET /api/health`，返回 `ok/status/service/version/uptime/timestamp`，不需要登录、不返回用户或账务数据。
`npm run test:pwa:e2e` 会用临时 server 和真实浏览器验证 `/login.html` 注册 `/service-worker.js`、`sillytavern-shell-v1` 缓存包含静态 shell 资源，并确认 `/api/health` 不会进入 CacheStorage。
发布前慢速验证可运行 `PLAYWRIGHT_BROWSER_CHANNEL=chrome npm run test:marketplace:all`，它会顺序执行 marketplace contract/Jest、runtime smoke 和浏览器 E2E。

该接口只返回当前用户自己的资产列表和聚合统计，例如草稿/待审核/上架/拒绝数量、领取数、付费销量、安装数、销售收入和 earnings 当前余额。marketplace-wallet 的 Creator Center 会直接展示这些状态拆分、提交/通过日期、拒绝原因摘要和收益余额；完整钱包余额和 ledger 明细仍由 Wallet API 提供，市场 summary 不暴露原始 `wallet` 对象、`recent_earnings` 流水或资产 `normalized_payload`。

### Future SaaS API

```text
POST   /api/market/assets/:id/versions
POST   /api/market/assets/:id/reviews
POST   /api/wallet/recharge-session
POST   /api/wallet/refunds/admin
```

独立 Creator API：

```text
GET    /api/creator/profile
PUT    /api/creator/profile
GET    /api/creator/assets
GET    /api/creator/earnings
GET    /api/creator/payouts
POST   /api/creator/payouts
```

独立 Admin API：

```text
GET    /api/admin/review-queue
POST   /api/admin/assets/:id/approve
POST   /api/admin/assets/:id/reject
POST   /api/admin/assets/:id/suspend
POST   /api/admin/reports/:id/resolve
POST   /api/admin/users/:id/ban
```

当前本地 MVP 的 approve/reject 已在 `/api/market/assets/:id/approve|reject` 下实现；独立 `/api/admin/*` 路径、版本发布、评论、充值、退款、封禁和提现都属于 Future SaaS。

## 服务边界

```text
web/mobile client
  -> SaaS API Gateway
  -> auth service
  -> market service
  -> wallet service
  -> creator service
  -> moderation service
  -> SillyTavern runtime/import service
  -> PostgreSQL / Redis / object storage
```

MVP 可以先做单体模块化服务，不必一开始拆微服务。关键是数据库表和服务边界先按模块隔离。

当前本地 MVP 仍使用 JSON 文件保存 market store，并用 node-persist 保存 wallet ledger；同进程购买已按资产和用户做轻量串行化，但正式 SaaS 仍需要迁移到数据库事务，保证 entitlement、销量、扣款和创作者收益跨存储一致。

为迁移演练和备份检查，仓库提供只读快照命令：

```bash
npm run marketplace:export:snapshot -- --dataRoot ./data --out ./marketplace-snapshot.json
```

该快照只导出市场资产、授权、安装、举报和钱包流水的白名单字段，不导出角色/世界书 payload、举报正文、安装本地路径、完整 ledger reason/metadata 或绝对 data root；`--out` 也会拒绝写入 data root 内部，避免备份动作修改用户数据目录。

仓库也提供 API reference 导出命令，用于发布前核对当前本地 MVP 暴露的市场、钱包和探活路由：

```bash
npm run marketplace:export:api -- --out ./marketplace-api-reference.md
```

## 和现有 SillyTavern 的接法

当前 SillyTavern 已经有用户目录模型，市场资产安装时可以适配到现有目录：

| 市场资产 | 安装目标 |
|----------|----------|
| character_card | 用户 characters 目录 |
| world_book | 用户 worlds 目录 |
| preset_pack | Future SaaS：用户 sysprompt/context/instruct/openAI_Settings 等目录 |
| asset_pack | Future SaaS：用户 backgrounds/assets/userImages 等目录 |

长期建议不要让市场直接写文件，而是做一个 `installMarketAsset(user, assetVersion)` 适配层：

1. 检查 entitlement。
2. 下载 normalized payload。
3. 根据 asset type 转换为 SillyTavern 目标格式。
4. 写入用户私有数据空间。
5. 记录 installed_assets。

## 审核与安全

### 必须有的防线

- 文件类型白名单。
- 文件大小限制。
- JSON schema 校验。
- 图片重新编码，去除异常元数据。
- 文本内容安全扫描。
- 提示词注入和越狱词风险标记。
- 版权/真人/商标举报通道。
- 创作者封禁和资产下架机制。
- 下载和安装限流。

### 内容分级

建议从一开始就保留字段：

```text
content_rating:
  general
  teen
  mature
  restricted
```

但 MVP 可以只开放 general/teen，避免支付和应用商店审核压力。

## 移动端策略

第一阶段：

- 做响应式 Web 和 PWA。
- 市场购买、充值都走 Web。
- 手机浏览器可完整使用。
- 浏览器级 E2E 验证 service worker 已激活、静态 shell 已缓存、`/api/*` 不进入缓存。

第二阶段：

- 用 Capacitor 包装成 iOS/Android。
- App 内保留浏览、聊天、安装已购资产。
- 充值和数字内容购买要按 Apple/Google 平台规则重新设计。

第三阶段：

- 如果留存和收入证明值得投入，再做原生体验优化。

## 关键风险

| 风险 | 影响 | 建议 |
|------|------|------|
| AGPL 许可证 | 托管修改可能需要开放源码 | 商业化前确认合规策略 |
| App 内支付规则 | iOS/Android 数字商品支付受限 | Web 先行，App 支付单独设计 |
| UGC 违法/侵权内容 | 下架、支付封禁、法律风险 | 审核、举报、分级、黑名单 |
| 钱包账务错误 | 资金损失和用户纠纷 | 不可变账本、幂等交易、对账任务 |
| 创作者提现合规 | KYC/税务/拒付复杂 | MVP 先不自动提现 |
| 模型成本失控 | 用户刷接口造成亏损 | 配额、限流、模型路由、风控 |

## 开发拆分建议

### Sprint 1：市场基础

- 新增市场资产表和版本表。
- 实现资产上传、解析、草稿保存。
- 实现市场列表和详情页。
- 支持免费资产领取和安装。

### Sprint 2：钱包账本

- 新增 wallet_accounts 和 wallet_ledger。
- 实现余额查询和账单列表。
- 实现运营赠币。
- 实现付费资产购买扣款。

### Sprint 3：创作者与审核

- 创作者中心。
- 审核队列。
- 上架/拒绝/下架。
- 举报处理。

### Sprint 4：支付和收益

- Web 充值。
- 购买退款。
- 创作者收益统计。
- 平台分成配置。

### Sprint 5：移动体验

- 市场移动端适配。
- PWA 安装体验。
- App 包装技术验证。

## 第一版成功标准

- 用户可以在 3 分钟内完成注册、领取/购买角色卡、安装并开始聊天。
- 创作者可以上传角色卡和世界书，并看到审核状态。
- 管理员可以审核和下架资产。
- 每笔货币变化都有 ledger，可追溯。
- 市场资产安装不会破坏用户已有本地数据。
