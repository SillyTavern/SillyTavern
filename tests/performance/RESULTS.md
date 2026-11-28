# 按需聊天与向量记忆：本机验证

日期：2026-11-28。基线提交：`82b64a45c34facbc98ff4b9f33c067d3ccab6a17`。

运行环境为 Apple M5 Pro、24 GiB RAM、macOS arm64、Node 26.13.1、Chromium 156。
所有测试使用独立临时数据目录，保留原来的模拟聊天文件和用户数据。

## 实现边界

- JSONL 旁建立 libSQL 索引，消息元数据与正文分表。首次流式导入；正常翻页按序号索引定位，再读取所需正文，没有全量读取后 slice。
- 浏览器只保留当前窗口，默认 100 条；生成时按实际提示词 token 预算补取近期历史，摘要从上次已处理的位置向前读取。
- 向量使用本地 DiskANN；先读取有界候选引用，再校验当前消息版本、隐藏状态和保护范围，最后仅取需要注入的消息正文。
- 向量同步以稳定消息 ID、版本和 swipe 为单位；普通同步处理已加载或明确变更的 ID，显式 Vectorize All 按元数据页寻找缺失版本。
- 保存使用聊天修订号、窗口原 ID 集和消息版本检查，保留未加载的前后缀。JSONL 仍作为兼容文件流式更新，因此写入字节数仍随完整文件大小增长。
- 用户可显式启用完整聊天兼容模式。它会下载全部历史，供依赖完整 `context.chat` 的扩展使用；默认关闭。

## 聊天实机结果

使用已有 `bench-heavy-9000rounds.jsonl.gz` 解压得到的 **254,328,387 字节**文件，包含 9,000 轮 / 18,000 条消息。消息正文和 reasoning 均保留。原版和优化版都显示最近 100 条，两者都运行真实 `getChat()`，没有替换应用源码来跳过功能。

每版 5 次，新建浏览器 context；不清空操作系统文件缓存。首屏时间从 `getChat()` 调用开始，到返回后两次动画帧结束；保留堆内存来自 CDP GC 后的 `JSHeapUsedSize`。

| 指标 | 原版 | 优化版 | 变化 |
| --- | ---: | ---: | ---: |
| 首屏耗时中位数 | 1,248.8 ms | 179.5 ms | 降低 85.6% |
| 浏览器保留 JS 堆中位数 | 214.09 MiB | 20.51 MiB | 降低 90.4% |
| 浏览器保留消息数 | 18,000 | 100 | 有界窗口 |
| 聊天响应解压后字节数 | 254,328,389 | 1,424,374 | 降低 99.44% |
| 最长主线程任务中位数 | 149 ms | 118 ms | 渲染仍有长任务 |

**首次无索引打开**另测一次：1,787.9 ms，其中 `/api/chats/page` 请求 1,608.2 ms。该次顺序导入完整 JSONL；后续不再重复导入。该时间不是冷磁盘测量。

单独进程调用真实后端 ChatStore 的结果：

| 操作 | 耗时 | 实际读取边界 |
| --- | ---: | --- |
| 首次索引 + 100 条正文 | 1,616.95 ms | 流式导入 254 MB 一次 |
| 随机位置 100 条分页，20 次 | 中位 4.44 ms / P95 4.97 ms | 每次正文 100 行，JSONL 导入 0 字节 |
| 按 10 个稳定 ID 取正文 | 0.31 ms | 正文 10 行 |
| 编辑 1 条并更新兼容 JSONL | 777.26 ms | 流式重写完整 JSONL |

聊天 sidecar 为 262,742,016 字节，WAL 运行期间可能另外占用导入高水位空间。导入、分页、写入组合进程峰值 RSS 为 204.91 MiB；这不是仅分页的峰值。

## 向量检索结果

用同一份模拟聊天构造 18,000 条 768 维确定性向量：64 个带噪声簇，20 个固定扰动查询。旧 Vectra 文件 363,259,594 字节。两版均以 cosine 距离取 top 10；旧版每次打开 LocalIndex 并精确扫描，优化版取 40 个 ANN 候选、重新计算候选距离、只读取 top 10 的正文。

计时包括打开存储、查询、读取正文及关闭；不包含 embedding 服务或 LLM 调用。每次计时前给 event loop 和 GC 机会完成上次原生 handle 的清理，模拟服务 worker 在独立请求之间的生命周期。

最终参数为 `search_l=512`、`compress_neighbors=float8`、`insert_l=70`、`alpha=1.2`；原始向量仍为 float32。

| 指标 | Vectra 精确扫描 | DiskANN |
| --- | ---: | ---: |
| 查询耗时中位数 | 405.51 ms | 19.07 ms |
| P95 | 422.35 ms | 21.94 ms |
| 查询进程峰值 RSS | 1,216.63 MiB | 66.84 MiB |
| 相对精确 top 10 的 Recall@10 | 100% | 100% |

原版 20 次查询；优化版相同 20 个查询重复 5 轮，共 100 次，平均值和最差单次 Recall@10 均为 100%。**这是此合成向量数据上的近似索引召回率，不代表真实语义记忆质量或所有数据分布的保证。** 未采用默认参数下约 74% 召回率的快结果。

最终索引经 VACUUM 后占 1,449,701,376 字节（约 1.35 GiB）。从已存储向量正式重建该图耗时 101.7 秒；首次嵌入及增量建库耗时取决于模型和分块数。查询峰值不混入重建/VACUUM 阶段的内存。磁盘索引空间和首次构建成本是本方案的实际代价。

## 正确性与兼容性

真实 Chromium 功能检查确认单聊/群聊分页、旧页删除、编辑、swipe、追加、分支截止点、窗口外摘要写回、提示词缓存全局编号、未提交编辑草稿保护和兼容模式切换，并独立检查最终 JSONL 前后缀及消息数。浏览器没有 page error。

自动化回归覆盖修订冲突、并发保存/切换、过期请求、分页字节预算、旧群聊导入、工具调用边界、reasoning 的实际预算策略、全局编号命令、索引隔离、增量更新、worker 排队与事件循环响应。

最终检查：26 个 Jest suites / 480 项测试、30 项 Node 前端/集成测试全部通过；本次修改文件的 ESLint 和 `git diff --check` 通过。

浏览器中的明确变更/删除队列会在后续同步重试，但不跨刷新持久化。刷新或中断后的缺失向量可用 Vectorize All 重新扫描元数据补齐；检索会过滤已删除/过期版本，避免错误注入。外部修改 JSONL 会触发 sidecar 重建及稳定 ID 更新，相关聊天向量也需要重新同步。需要完整历史的旧扩展应启用兼容模式。

## 复现入口

`chat-loading.mjs`：对运行中的原版或修改版服务测真实浏览器加载。`--mode baseline` 校验载入完整数组，`--mode optimized` 校验有界数组；首次建索引与已建索引的重复测试应分别保存结果。

```sh
node tests/performance/chat-loading.mjs --url http://127.0.0.1:18767 --mode optimized --fixture bench-heavy-9000rounds --messages 18000 --page 100 --repeats 5 --output /tmp/chat-results.json --executable /absolute/path/to/chromium
node tests/performance/chat-functional.mjs --url http://127.0.0.1:18767 --data-root /absolute/path/to/isolated-data --output /tmp/chat-functional.json --executable /absolute/path/to/chromium
node --expose-gc tests/performance/chat-storage.mjs --fixture /absolute/path/to/synthetic.jsonl --scratch /tmp/new-storage-benchmark --output /tmp/storage-results.json
```

`chat-functional.mjs` 要求独立数据目录内有默认 Seraphina 角色和 `bench-heavy-100rounds.jsonl`（200 条消息），每次只创建新的测试聊天。不要对真实用户数据目录运行测试。

`vector-retrieval.mjs` 的 `prepare` / `build` / `baseline` / `optimized` 四个阶段可建立固定向量数据并比较。`vector-tuning.mjs` 对已建库的独立副本执行正式 DROP/CREATE INDEX 和 VACUUM，支持 `--reuse` 单独测查询；不会修改源索引。用生产目录结构里的副本做调参，避免复制活跃 WAL 数据库。

```sh
node --expose-gc tests/performance/vector-retrieval.mjs --phase prepare --root /tmp/new-vector-benchmark --fixture /absolute/path/to/synthetic.jsonl --output /tmp/vector-fixture.json
node --expose-gc tests/performance/vector-retrieval.mjs --phase build --root /tmp/new-vector-benchmark --fixture /absolute/path/to/synthetic.jsonl --output /tmp/vector-build.json
node --expose-gc tests/performance/vector-retrieval.mjs --phase baseline --root /tmp/new-vector-benchmark --output /tmp/vector-baseline.json
node --expose-gc tests/performance/vector-retrieval.mjs --phase optimized --root /tmp/new-vector-benchmark --output /tmp/vector-optimized.json
node --test tests/chat-store.test.mjs tests/group-chat-window.test.mjs tests/chat-window-editor.test.mjs
npm --prefix tests run test:unit -- --runInBand
```

最终测量数据见同目录 `measurements.json`。完整原始 JSON、截图、未采用的调参结果保存在本次 Codex 会话的 `on-demand-memory` artifact 目录；大样本和临时数据库不进入 Git。
