# 发现与决策

## 需求
- 用户要做托管版 AI 酒馆，网页版和手机版都能打开即用，不需要自行部署。
- 新增市场功能，用户可以上传自己设计的角色卡、世界书等内容。
- 新增货币系统，用于购买市场内容、消耗模型服务、奖励创作者。

## 研究发现
- 当前 SillyTavern 仓库是 Node/Express 应用，版本 1.18.0，许可证为 AGPL-3.0。
- 当前仓库已有用户账号、多用户数据目录、Session/CSRF 等基础，但仍偏自托管工具。
- 角色卡已有 PNG 卡片读写与导入逻辑，世界书已有 JSON 导入、编辑、列表和删除逻辑。
- 现有内容类型包括 character、world、avatar、theme、workflow、preset、instruct、context、quick replies、sysprompt、reasoning 等。
- 公开市场需要新增 SaaS 控制平面：注册登录、支付、钱包账本、审核、风控、对象存储、搜索推荐、创作者中心。

## 技术决策
| 决策 | 理由 |
|------|------|
| 市场资产入库，不直接把用户上传文件暴露为可执行内容 | 便于审核、版本管理、搜索、购买授权和下架 |
| 安装市场资产时复制到用户私有 SillyTavern 数据空间 | 保持用户运行态隔离，符合现有 per-user directory 模型 |
| 使用不可变 ledger 记录货币变动 | 支持对账、退款、争议处理和风控 |
| 创作者收益账户和消费币账户分离 | 避免把用户充值币直接等同于可提现余额 |
| MVP 阶段先限制资产类型和脚本能力 | 降低 UGC 安全风险和审核成本 |
| submitted 资产不允许普通用户购买 | 避免未经审核内容直接进入市场 |
| 钱包 admin grant 必须管理员调用 | 避免普通用户刷赠送币 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
| 移动端内购规则可能限制第三方支付 | 先做 Web/PWA 支付；App 内数字商品按平台内购规则规划 |
| AGPL 许可证对托管修改有开源义务 | 保留许可证合规项，商业化前做法律确认 |
| UGC 资产可能包含侵权、恶意提示词或违法内容 | 引入上传校验、机器审核、人工复审、举报和下架机制 |
| 现有角色导入函数会删除上传源文件 | 市场安装不直接复用导入函数，改为在 market endpoint 中生成安装副本 |
| JSON 文件市场存储无法防止并发覆盖 | MVP 可用于单进程验证；正式 SaaS 需要数据库事务、append-only ledger 或按 store path 串行化写入 |
| listed 资产详情不能泄漏 `normalized_payload` | 未购买用户只能看元数据；创建者、管理员或已授权用户才能读取 payload |
| 市场/钱包前端适合作为 SillyTavern 内置扩展 | 复用 extension manifest、模板渲染、CSS 加载和 Extensions 面板，避免污染主入口脚本 |
| 市场列表的 `owned` 只代表创建者身份 | 前端不能把它当成已购买状态；普通用户购买后再安装，重复购买依赖后端幂等返回 |
| 购买按钮不能使用 `balance.total` 判定可消费余额 | `total` 包含 earnings，购买只消耗 bonus 和 paid，因此前端使用 `bonus + paid` |
| 管理员前端 gate 必须和后端 admin 模型一致 | 后端按 `request.user.profile.admin` 授权，前端应使用 `isAdmin()`，不能根据 `default-user` handle 推断 |
| 扩展 JS/CSS 入口需要版本化 | 浏览器会复用 ESM 模块；manifest 中加入 `?v=0.2.0` 可以让刷新加载新 admin UI |
| 基础交付需要根目录可运行脚本 | `npm run test:marketplace` 聚合后端和前端契约测试，方便从仓库根目录验证市场/钱包闭环 |
| Creator Center summary 应是聚合读模型 | 市场 summary 只返回创作者资产和统计，完整 wallet balance/ledger 继续由 Wallet API 负责，避免前端误用流水明细 |
| Creator summary 前端请求必须可降级 | 钱包和市场资产是主体验，创作者面板失败不能阻断刷新、购买和安装流程 |
| claims 和 installs 需要分开展示 | `sales_count` 当前代表免费领取和付费购买的总 claims，`install_count` 才代表安装次数 |
| 手机端 MVP 优先走 PWA | 现有 HTML 已有移动 meta、manifest 和 touch icons；补 service worker 比原生壳更小、更快可验证 |
| PWA 缓存只覆盖静态壳 | `/api/*`、POST 和动态业务请求不能进 shell cache，避免钱包、市场、聊天出现旧数据 |
| PWA 预缓存资源需要文件存在性测试 | `cache.addAll(SHELL_ASSETS)` 是全有或全无，任一路径丢失都会影响手机安装壳离线缓存 |
| 设计文档需要拆分当前 MVP 与 Future SaaS | 当前代码只实现本地 market/wallet/health 路由；充值、退款、版本、评论、独立 Creator/Admin API 都应明确为后续 |
| 运行态 smoke 使用临时 config/data | 从根目录启动真实 server 验证公开端点时，必须传入临时 `configPath` 和 `dataRoot`，避免污染仓库或用户数据 |
| 筛选排序逻辑适合抽成纯函数测试 | marketplace-wallet 的 DOM 只负责读取控件值，核心筛选排序可在 Jest 里直接用资产样本断言 |
| Report Queue resolve 需要前端流程测试 | 管理员队列点击 Resolve 后应 POST resolve endpoint 并从本地队列移除 report |
| Marketplace CI 适合路径触发 | 专用 GitHub Actions workflow 只在 marketplace/wallet/PWA/health 相关文件变化时运行，减少普通 PR 负担 |
| merge-conflict bot workflow 需要官方仓库凭证 | fork 缺少 `ST_BOT_APP_ID` / private key 时会在 token mint 阶段失败，适合限制为官方仓库运行 |
| 下架不等于撤销授权 | delisted 资产不再公开售卖，但已领取/购买用户仍可查看 payload 并安装副本，避免破坏已有体验 |
| 举报入口先不做自动处罚 | 先留下 open report 审计记录；封禁、自动处罚和申诉流会牵涉策略，后续再加 |
| 举报处理先做管理员队列和 resolve | 让人工审核可以清理 open reports，同时避免提前固化处罚规则 |
| 审核预览必须按详情懒加载 payload | 市场列表不带 payload；管理员 Inspect 时再取详情，减少列表泄漏面 |
| 用户上传 JSON 预览用 DOM text 渲染 | payload 不能拼成 HTML；使用 `.text(JSON.stringify(...))` 降低 XSS 风险 |
| 创作者只能修订 draft/rejected 资产 | submitted/listed/delisted 不允许原地 PATCH，避免审核中或已售内容静默变化 |
| 用户库只基于 active entitlements | My Library 展示已领取/购买资产和安装摘要，包含已下架但仍授权内容，不返回 payload 或账本明细 |
| Health endpoint 只做 liveness | `/api/health` 公开且无需登录，但只报告服务存活，不检查数据库、插件或外部模型 readiness |
| 资产详情弹窗复用详情权限 | 购买前只显示元数据；创建者、管理员和已授权用户才看到 `normalized_payload` |
| 市场浏览 MVP 使用客户端筛选排序 | 当前数据量小，先用前端组合筛选；正式 SaaS 需要服务端搜索、分页和排序索引 |
| marketplace 验证入口应先跑语法门禁 | 服务端 endpoint、PWA、扩展脚本和 Jest 契约文件分散在不同目录，集中 `node --check` 能更早暴露破损 |
| Demo seed 应只写市场 store | 开箱体验需要示例资产；钱包余额仍通过 admin grant 流程验证，避免 seed 脚本绕过 ledger |
| Runtime smoke 需要覆盖业务路由 | health/PWA 只能证明服务启动；`/api/wallet` 和 `/api/market/assets` 能验证登录中间件、默认用户和 market/wallet 路由注册 |
| 钱包最近流水适合作为前端降级视图 | marketplace-wallet 可展示当前用户最近 ledger 帮助核对余额，但完整审计仍以 `/api/wallet/ledger` 为准 |
| Runtime smoke 应覆盖真实安装落盘 | 真实 server 验证需要包含 free purchase、install、Library 和文件存在性，才能证明市场最小闭环可运行 |
| 固定价购买必须防并发双扣 | 同一用户同一资产并发 purchase 应只结算一次，重复请求返回 already_owned 并复用 entitlement |

## 资源
- 本地文件：package.json、default/config.yaml、src/users.js、src/server-main.js
- 本地文件：src/endpoints/characters.js、src/endpoints/worldinfo.js、src/endpoints/content-manager.js

## 视觉/浏览器发现
- 新增 `marketplace-wallet` 扩展采用 Extensions 面板内联抽屉；本地浏览器 smoke test 已确认扩展容器、标题、资产列表和刷新按钮成功加载。
- admin 面板初始模板带 `hidden`，需要显式 `removeAttr('hidden')` 才能在真实浏览器里可靠显示。
- 浏览器 smoke test 已确认 `marketplace-wallet` 加载 `index.js?v=0.2.0` 和 `style.css?v=0.2.0` 后，admin 面板可见，grant 控件和 review queue 存在。
- in-app browser 当前未暴露 viewport 设置，本地也没有 Playwright 包；本轮移动端仅完成 CSS 结构调整，后续应补真实窄屏截图或 UI 自动化。
- 新增 Playwright E2E 覆盖 admin review/grant 和移动布局；当前本机 Playwright Chromium 缓存半安装，完整 E2E 需先成功安装 `chromium-headless-shell`。
- 新增 Jest UI 契约测试作为稳定基础测试，已覆盖 manifest 版本化、admin 模板、`isAdmin()` gate、grant 校验和移动 CSS。
- Creator Center 已移动到钱包余额下方，使用自适应统计网格展示 assets、drafts、submitted、listed、rejected、claims、paid sales、installs、earned 和 earnings balance；最近资产列表显示 status、claims、installs 和价格。
- Creator Center 资产列表现在显示 submitted/approved 日期和 rejected 原因摘要，帮助创作者判断下一步是否修订重提。
- PWA 安装壳复用现有 mobile meta 和 icons；新增 service worker 只缓存静态页面壳，手机用户可通过浏览器 Add to Home Screen / Install 使用。
- marketplace-wallet 管理员操作新增 Delist；后端 `POST /api/market/assets/:id/delist` 只接受 listed 资产，返回 delisted/private 状态。
- marketplace-wallet 用户操作新增 Report；后端 `POST /api/market/assets/:id/report` 对可见资产创建 open report。
- marketplace-wallet 管理员工具新增 Report Queue；后端 `GET /api/market/reports/admin` 返回 open reports，`POST /api/market/reports/:id/resolve` 将举报标记为 resolved。
- marketplace-wallet Review Queue 新增 Inspect；管理员通过 asset detail 懒加载 payload，并在可滚动 TEXT popup 中预览。
- marketplace-wallet Review Queue 展示创作者、价格、更新时间、标签和摘要片段，但仍不直接显示 payload。
- marketplace-wallet 创作者资产新增 Revise；后端 `PATCH /api/market/assets/:id` 只允许 owner 修改 draft/rejected，保存后回 draft 并可重新 submit。
- marketplace-wallet 新增 My Library；后端 `GET /api/market/library` 返回当前用户 active entitlements 的资产摘要、授权来源和安装摘要。
- marketplace-wallet My Library 条目现在同时提供 Details 和 Install；Details 复用 asset detail API，已授权用户可在库里查看 payload 权限内的详情，不必回公开市场列表。
- marketplace-wallet My Library 会显示授权日期和最近安装摘要；`local_ref` 使用可换行小字展示，避免手机窄屏被本地路径撑宽。
- 托管探活新增 `GET /api/health`；响应包含服务级状态、版本、uptime 和时间戳，不返回用户、市场或钱包数据。
- marketplace-wallet 新增 Details；市场列表、用户库和审核预览共用 asset detail 弹窗，未授权时不渲染 payload JSON。
- marketplace-wallet Details 弹窗现在展示 language、content rating 和创建/上架/更新时间；日期使用 `YYYY-MM-DD` 稳定格式，避免浏览器 locale 影响自动化断言。
- marketplace-wallet Details 弹窗现在展示 delisted 日期；未下架资产显示 not delisted。
- marketplace-wallet Details 弹窗现在展示当前用户 entitlement 来源、授权日期和购买引用；未授权资产显示 not in library/not entitled。
- marketplace-wallet 市场筛选条新增价格、访问状态和排序控件，继续使用本地列表做客户端过滤。
- marketplace-wallet 搜索现在会匹配资产 language 和 content_rating，和 Details 里已展示的元数据保持一致。
- marketplace-wallet 空结果且存在激活筛选时会显示 Clear filters，避免移动端用户被空搜索困住。
- 新增 `scripts/check-marketplace-syntax.mjs` 作为 marketplace/wallet/PWA/health 基础语法门禁，并接入根目录 `npm run test:marketplace`。
- PWA 契约测试新增 service worker 预缓存清单解析，确认 `/` 映射到 `index.html` 且所有 shell assets 都存在于 `public/`。
- 设计文档的 API 模块已拆为“当前本地 MVP 已实现 API”和“Future SaaS API”，并明确当前上传流接收规范化 JSON payload。
- 新增运行态 smoke 脚本，临时启动真实 SillyTavern server 并校验 `/api/health`、`/manifest.json`、`/service-worker.js`。
- marketplace-wallet 筛选排序逻辑抽为 `filters.js` 纯函数，新增 Jest 可执行测试覆盖筛选、搜索、排序和不变性。
- marketplace-wallet E2E mock 扩展 Report Queue resolve 流程，覆盖管理员点击 Resolve 后队列变空。
- 新增 Marketplace Wallet GitHub Actions 门禁，覆盖 syntax、Jest contract、runtime smoke 和 E2E discovery。
- 既有 merge-conflict bot workflow 已限制为官方仓库运行，避免 fork 缺 bot 凭证导致 push checks 失败。
- 新增 demo marketplace seed 脚本，显式指定 data root 后写入免费角色卡和付费世界书，并保持幂等 upsert。
- runtime smoke 现在会预置一条临时 listed 市场资产，并通过真实 server 校验 `/api/wallet` 与 `/api/market/assets` JSON shape。
- Runner Chrome 真实 E2E 会暴露两层可见性：SillyTavern 外层 Extensions drawer 需要打开，Marketplace Wallet 自身的 inline drawer 也需要展开，否则 admin、Report Queue 和购买按钮都在隐藏父级下。
- 临时 data root 首次启动会出现 onboarding persona 弹窗；浏览器 E2E 必须等待并确认 Save，避免欢迎弹窗遮挡 Extensions 面板点击。
- E2E 中 mock `/api/users/me` 为 admin 用户能防止账号配置漂移影响前端 `isAdmin()` gate；真实后端权限仍由接口单测覆盖。
- marketplace-wallet 新增 Wallet Activity 面板，最近流水从 `/api/wallet/ledger` 降级加载，正数用 `+` 标识，负数标为 purchase/debit。
- runtime smoke 现在会实际 POST 免费领取和安装 demo world book，并确认 Library 里 install_count 为 1 且文件写入临时用户 worlds 目录。
- 新增 `scripts/export-marketplace-snapshot.mjs`，用显式 `--dataRoot` 只读导出市场与钱包快照；stdout 输出 JSON，`--out` 写文件但拒绝写入 data root 内部。
- marketplace/wallet 快照默认只导出白名单字段：market assets 的生命周期摘要、entitlements/installs/reports 安全明细、wallet ledger 的 id/type/userHandle/actorHandle/bucket/amount/createdAt 和少量迁移 metadata；不导出 normalized payload、举报正文、本地安装路径、完整 ledger reason/metadata 或绝对 data root。
- wallet snapshot 使用和 wallet endpoint 一致的 node-persist key prefix，并过滤合法 bucket 与 safe integer amount，避免损坏或非钱包记录进入余额摘要。
- paid purchase API 响应现在只返回 entitlement、`already_owned`、purchase id 和 buyer balance；完整 ledger entries 与 creator balance 不再通过购买响应暴露，仍可由买家/创作者通过各自 Wallet API 和 Creator Center 查询。
- runtime smoke 现在同时覆盖免费和固定价 world book：真实 server 下执行 admin grant、fixed-price purchase、buyer paid debit、creator earnings ledger、purchase response 隐私 shape、安装落盘和 Library 可见性。
- marketplace-wallet 浏览器 E2E mock 现在维护可变 wallet/ledger/library 状态，覆盖 fixed-price Buy & Install 后余额刷新、Purchase 负流水、Library 安装数和移动布局。
- marketplace-wallet 固定价资产只按 bonus+paid 判断购买力；余额不足时卡片显示缺口金额，避免移动端只看到 disabled 按钮。
- marketplace-wallet 浏览器 E2E 现在覆盖创作者 world_book JSON 上传并 Save & Submit，断言新资产进入 Review Queue，Creator Center 统计和资产列表刷新。
- marketplace-wallet 上传表单现在复用后端 `tags` 约束，创作者可填逗号分隔标签；列表卡片展示标签，搜索可命中 tags。
- marketplace-wallet Load JSON 会按 payload 形状自动切换 `character_card` 或 `world_book`，减少用户上传角色卡/世界书时选错类型。
- marketplace-wallet 粘贴 JSON textarea 也复用同一类型/标题识别逻辑，且已有标题不会被 payload name 覆盖。
- runtime smoke 现在也覆盖真实 creator upload 状态机：POST 创建 draft world_book、Creator Center 看到 draft、submit 后进入 review、creator detail 可读 payload、approve 后 listed/public、市场列表不泄漏 payload、创作者可安装并刷新 install_count。
- 后端契约测试现在明确覆盖角色隔离：普通用户看不到他人的 draft/submitted asset，不能 purchase 或 approve；owner 可以读取 submitted detail payload 但不能自审批，admin 可以审核，approved 后普通用户只能看元数据。
- marketplace-wallet 浏览器 E2E 现在覆盖 rejected 资产修订重提：Revise 先 GET detail 填充表单，Save & Submit 走 PATCH 后 submit，Review Queue 和 Creator Center 刷新为 submitted。
- runtime smoke 现在覆盖举报处理真实闭环：用户对可见资产创建 open report，管理员队列可见但不带 asset payload/metadata，resolve 后记录 resolved metadata 且队列清空。
- marketplace-wallet Report 前端现在提交短 reason 和可选 body，管理员 Report Queue 会显示详细正文，避免审核员只看到一句原因。
- marketplace-wallet Report Queue 会显示举报创建日期，帮助管理员判断 open reports 的积压时间。
- API reference 导出脚本从当前 market/wallet endpoint 源码和公开 health route 生成 Markdown，适合作为发布前检查点，减少 README/设计文档里的端点清单和实现漂移。
- API reference 单测锁定当前完整 MVP 路由集合，包括 library、reports admin、submit/approve/reject/delist/purchase/install 和 wallet ledger。
- API reference 现在包含关键权限/隐私标注：payload redaction、admin-only 队列/审核/赠币、Library scope 和 Wallet read scope。
- PWA 浏览器 E2E 需要等待 service worker 从 `activating` 进入 `activated`，再 reload 确认页面受 controller 控制；这样才能稳定验证 shell cache 和 `/api/*` 不缓存。
- `test:marketplace:all` 作为慢速发布前闭环命令，顺序跑 contract/Jest、runtime smoke 和 browser E2E；日常快速反馈仍用 `test:marketplace`。

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*
