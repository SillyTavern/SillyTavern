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
| 下架不等于撤销授权 | delisted 资产不再公开售卖，但已领取/购买用户仍可查看 payload 并安装副本，避免破坏已有体验 |
| 举报入口先不做自动处罚 | 先留下 open report 审计记录；封禁、自动处罚和申诉流会牵涉策略，后续再加 |
| 举报处理先做管理员队列和 resolve | 让人工审核可以清理 open reports，同时避免提前固化处罚规则 |
| 审核预览必须按详情懒加载 payload | 市场列表不带 payload；管理员 Inspect 时再取详情，减少列表泄漏面 |
| 用户上传 JSON 预览用 DOM text 渲染 | payload 不能拼成 HTML；使用 `.text(JSON.stringify(...))` 降低 XSS 风险 |
| 创作者只能修订 draft/rejected 资产 | submitted/listed/delisted 不允许原地 PATCH，避免审核中或已售内容静默变化 |
| 用户库只基于 active entitlements | My Library 展示已领取/购买资产和安装摘要，包含已下架但仍授权内容，不返回 payload 或账本明细 |

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
- Creator Center 已移动到钱包余额下方，使用 assets/listed/claims/earned 四项自适应统计，最近资产列表显示 status、claims、installs 和价格。
- PWA 安装壳复用现有 mobile meta 和 icons；新增 service worker 只缓存静态页面壳，手机用户可通过浏览器 Add to Home Screen / Install 使用。
- marketplace-wallet 管理员操作新增 Delist；后端 `POST /api/market/assets/:id/delist` 只接受 listed 资产，返回 delisted/private 状态。
- marketplace-wallet 用户操作新增 Report；后端 `POST /api/market/assets/:id/report` 对可见资产创建 open report。
- marketplace-wallet 管理员工具新增 Report Queue；后端 `GET /api/market/reports/admin` 返回 open reports，`POST /api/market/reports/:id/resolve` 将举报标记为 resolved。
- marketplace-wallet Review Queue 新增 Inspect；管理员通过 asset detail 懒加载 payload，并在可滚动 TEXT popup 中预览。
- marketplace-wallet 创作者资产新增 Revise；后端 `PATCH /api/market/assets/:id` 只允许 owner 修改 draft/rejected，保存后回 draft 并可重新 submit。
- marketplace-wallet 新增 My Library；后端 `GET /api/market/library` 返回当前用户 active entitlements 的资产摘要、授权来源和安装摘要。

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*
