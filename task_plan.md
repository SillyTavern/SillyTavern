# 任务计划：AI 酒馆市场与货币系统设计

## 目标
为托管版 AI 酒馆设计可落地的市场、货币、UGC 上传、创作者收益与审核安全系统，并形成后续开发可引用的设计文档。

## 当前阶段
阶段 19

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
| 下架不撤销既有 entitlement | 下架阻止新购买和公开浏览，但已购买用户的安装副本能力保留，避免破坏已有体验 |
| 举报先只创建 open report | MVP 需要可审计入口，自动处罚和处理队列等管理策略后续再加 |
| 举报处理先做队列和 resolve | 管理员需要能清理 open reports；封禁、自动处罚和申诉规则仍需产品策略 |
| 审核预览复用管理员 asset detail | 管理员已有 payload 读取权限，Inspect 只需要前端拉详情并用安全 DOM 展示 |
| 创作者修订只允许 draft/rejected | listed 资产已有购买/授权关系，原地改 payload 会破坏买家预期；后续需要版本化发布 |

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| Jest 安装角色卡时找不到 `./public/img/ai4.png` | 1 | 在 market endpoint 中用 `serverDirectory` 解析默认头像绝对路径 |
| `storage.stop is not a function` | 1 | 移除 node-persist 测试清理中的不存在方法调用 |
| 未购买用户可从 listed 详情拿到 `normalized_payload` | 1 | 详情接口按创建者、管理员、授权用户过滤 payload |
| 钱包 admin grant 空 body 返回 500 | 1 | 使用 `request.body ?? {}` 后再解析字段 |
| admin 面板 DOM 已渲染但仍保留 `hidden` | 1 | 改为显式 `removeAttr('hidden')`/`attr('hidden', '')`，并提高扩展入口版本避免模块缓存 |

## 备注
- 设计文档阶段已完成。
- 后端 MVP 骨架和前端扩展入口已完成；暂不包含真实支付接入、数据库迁移和完整 UI 自动化测试。
