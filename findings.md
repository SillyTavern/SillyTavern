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

## 资源
- 本地文件：package.json、default/config.yaml、src/users.js、src/server-main.js
- 本地文件：src/endpoints/characters.js、src/endpoints/worldinfo.js、src/endpoints/content-manager.js

## 视觉/浏览器发现
- 未进行 UI 截图验证；本次输出为产品与技术设计文档。

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*
