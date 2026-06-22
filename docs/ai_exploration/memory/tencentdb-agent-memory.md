# TencentDB-Agent-Memory 调研

调研日期：2026-06-19  
用户提供仓库：<https://github.com/Tencent/TencentDB-Agent-Memory>  
当前 canonical 仓库：<https://github.com/TencentCloud/TencentDB-Agent-Memory>  
本地 clone commit：`ee76536f30ae49e598ad43f472da7e09f4155b8a`  
本地 clone 最近提交：2026-06-17 `Update README_CN.md (#229)`  
默认分支 package 版本：`@tencentdb-agent-memory/memory-tencentdb@0.3.6`  
最新公开 release 快照：`v1.0.0`，GitHub 标记为 prerelease，目标分支 `feat/server`

## 信息源

- README_CN：`external/TencentDB-Agent-Memory/README_CN.md`
- README：`external/TencentDB-Agent-Memory/README.md`
- package：`external/TencentDB-Agent-Memory/package.json`
- 核心入口：`external/TencentDB-Agent-Memory/src/core/tdai-core.ts`
- 类型边界：`external/TencentDB-Agent-Memory/src/core/types.ts`
- 自动捕获：`external/TencentDB-Agent-Memory/src/core/hooks/auto-capture.ts`
- 自动召回：`external/TencentDB-Agent-Memory/src/core/hooks/auto-recall.ts`
- pipeline：`external/TencentDB-Agent-Memory/src/utils/pipeline-manager.ts`
- store 抽象：`external/TencentDB-Agent-Memory/src/core/store/types.ts`
- offload 入口：`external/TencentDB-Agent-Memory/src/offload/index.ts`
- GitHub API：<https://api.github.com/repos/TencentCloud/TencentDB-Agent-Memory>
- GitHub releases：<https://github.com/TencentCloud/TencentDB-Agent-Memory/releases>

## 项目定位

TencentDB-Agent-Memory 是一个面向 AI Agent 的分层记忆系统。默认分支的主要形态是 OpenClaw 插件，并同时支持 Hermes / Gateway 路径；`v1.0.0` 预发布线进一步强调独立 Memory Gateway、HTTP v2 API 和 TypeScript/Python SDK。

它有两条核心能力线：

1. 短期记忆：上下文卸载，把工具日志、长对话和中间过程压缩成可追溯的 Mermaid 符号图。
2. 长期记忆：L0 到 L3 的分层语义金字塔，把原始对话沉淀为 atom、scene、persona。

一句话：它不是“给 agent 存几条笔记”，而是在 agent runtime 旁边加一套分层记忆和上下文压缩引擎。

## GitHub / 版本快照

- 创建时间：2026-04-07。
- 语言：TypeScript 为主，另有 Python、Shell、JavaScript。
- GitHub API 快照：5896 stars，510 forks，99 open issues。
- LICENSE 文件为 MIT；GitHub API 目前未识别出 SPDX，因此 API 中显示 `NOASSERTION`。
- 默认分支 `main` 的 package 版本是 `0.3.6`。
- `v1.0.0` release 是 prerelease，说明其从 OpenClaw 嵌入式插件演进为独立 Gateway 服务，并把 0.x 与 1.x 描述为并行维护版本线。

## 架构拆解

### 1. Host-neutral core

`src/core/types.ts` 定义了 `HostAdapter`、`RuntimeContext`、`LLMRunner`、`LLMRunnerFactory` 等抽象。`TdaiCore` 依赖这些接口，而不是直接依赖 OpenClaw 或 Hermes。

这使它可以在不同宿主环境中复用同一套记忆逻辑：

- OpenClaw：通过插件 API 和 OpenClaw host adapter。
- Hermes / Gateway：通过 standalone host adapter 和 HTTP 请求上下文。
- CLI / standalone：通过直接 LLM runner 或本地数据目录。

### 2. L0 捕获

`auto-capture.ts` 会在 turn 结束后：

- 从 host messages 中过滤并记录新消息。
- 写入 L0 conversation 文件。
- 如果 store 和 embedding 服务可用，同步或后台写入 L0 vector index。
- 通知 `MemoryPipelineManager`，由 pipeline 决定何时触发 L1/L2/L3。

它的设计重点是“不阻塞主 agent”：SQLite 类后端支持先写 metadata/FTS，再异步补 embedding。

### 3. L1/L2/L3 pipeline

`pipeline-manager.ts` 把分层管线写得很清楚：

- L0：原始对话捕获。
- L1：批量抽取结构化记忆，支持阈值触发、idle timeout、warm-up。
- L2：按 session 聚合场景，带 min/max interval 和 delay-after-L1。
- L3：全局串行 persona 生成，避免并发写画像。

该 pipeline 用 `SerialQueue` 控制各层串行执行，用 timer 机制减少长会话中的重复处理。

### 4. 自动召回

`auto-recall.ts` 在模型 turn 前注入相关上下文：

- L1：根据当前用户输入做 keyword / embedding / hybrid 检索。
- L3：读取 `persona.md`，放入 system context。
- L2：读取 scene index 并生成 scene navigation。
- 工具指南：告诉 agent 何时主动调用 `tdai_memory_search` / `tdai_conversation_search` 深挖细节。

召回输出分为：

- `prependContext`：动态的 L1 相关记忆，前置到用户 prompt。
- `appendSystemContext`：相对稳定的 persona、scene navigation、工具指南，适合 prompt caching。

### 5. 存储层

`src/core/store/types.ts` 定义了统一 `IMemoryStore`：

- L1/L0 upsert、query、FTS、vector、hybrid search。
- capability flags：`vectorSearch`、`ftsSearch`、`nativeHybridSearch`、`sparseVectors`。
- profile sync：L2/L3 profile row。

默认本地路径是 SQLite + sqlite-vec + FTS5；也支持 Tencent Cloud VectorDB / TCVDB 路径。BM25 sparse encoding 由 `@tencentdb-agent-memory/tcvdb-text` 支持。

### 6. 短期记忆 Offload

`src/offload/index.ts` 是 context offload 入口。它围绕工具调用和长上下文压力工作：

- after-tool-call 捕获重型工具结果。
- L1/L1.5/L2 处理工具调用摘要、关系和 Mermaid 图。
- L3 压缩与 context budget 控制。
- MMD 注入：把历史 Mermaid 符号图注入上下文。
- `node_id` 用于从符号图回溯到原始 `refs/*.md`。

这是 Tencent 项目相对 ai-memory 最独特的部分：它不仅做长期记忆，还专门解决“单个长任务上下文膨胀”的问题。

## 项目自述的评测结果

README 报告了以下结果，应视为项目方指标，尚未在本文中独立复现：

- WideSearch：OpenClaw 成功率从 33% 到 50%，token 从 221.31M 到 85.64M。
- SWE-bench：成功率从 58.4% 到 64.2%，token 从 3474.1M 到 2375.4M。
- AA-LCR：成功率从 44.0% 到 47.5%，token 从 112.0M 到 77.3M。
- PersonaMem：准确率从 48% 到 76%。

这些数字说明项目重点不是单纯记住事实，而是试图同时提升长程任务成功率和 token efficiency。

## 集成方式

### OpenClaw

默认路径是 OpenClaw 插件：

- `openclaw plugins install @tencentdb-agent-memory/memory-tencentdb`
- 插件配置开启 `memory-tencentdb.enabled`
- optional offload 需要注册 `contextEngine` slot。
- README 中要求执行 `scripts/openclaw-after-tool-call-messages.patch.sh`，以保证工具调用结果可被卸载和回溯。

### Hermes

项目包含 `hermes-plugin/`，并提供 Docker 方式把 Hermes 与 memory provider 聚合。Gateway 默认监听 `:8420`。

### Gateway / v1.0.0 线

GitHub release `v1.0.0` 表明项目正在服务化：

- 独立 Memory Gateway。
- v2 HTTP API。
- TypeScript / Python SDK。
- OpenTelemetry / Langfuse 等可观测性。
- Offload Server V2。

但该 release 是 prerelease，且默认分支仍以 0.3.6 插件线为主；两条线需要分开评估。

## 优势

- 分层设计完整：L0 原始证据、L1 原子事实、L2 场景、L3 persona。
- 同时覆盖短期上下文卸载和长期个性化记忆。
- 召回具备 hybrid 检索、persona 注入、scene navigation 和工具深挖路径。
- 强调可追溯：高层摘要可下钻到 L0 或 refs 原文。
- OpenClaw / Hermes 集成较深，适合长程 agent runtime。
- 1.x 线显示出服务化、多语言 SDK、多 Agent 接入的方向。

## 风险与限制

- 项目迭代很快，0.x 和 1.x 形态并存，选型前必须明确部署线。
- 默认 OpenClaw 插件路径需要 host 特定能力和 patch 脚本，集成耦合度高。
- 直接服务化的 v1.0.0 仍是 prerelease。
- benchmark 结果需要自行复现，尤其是与目标 agent、模型、任务集相关。
- LLM、embedding、vector backend、offload 压缩策略都会引入调优成本。
- 如果和 Codex 内置 memory 或 ai-memory 同时启用，可能出现重复捕获、重复注入和上下文污染，需要明确分工。

## 适用场景

- OpenClaw / Hermes 长程 agent 场景。
- 工具调用结果巨大、长 session 容易爆上下文的任务。
- 需要 persona / scene / atom 多层抽象，而不是简单笔记。
- 希望引入独立 Memory Gateway 和 SDK 的 Agent 平台。
- 对 token 成本和长程成功率有明确优化目标。

## 不适用场景

- 只想给 Codex 轻量记住几个个人偏好。
- 只需要跨 Claude/Codex/Cursor 的项目 handoff。
- 不希望运行额外 LLM/embedding/数据库后端。
- 对 prerelease 服务架构风险无法接受。

## 关键判断

TencentDB-Agent-Memory 是五个项目中最像“Agent memory engine”的项目：它不仅持久化记忆，还主动参与 agent 的上下文压缩、召回和分层推理。它与 Codex 内置 memory 的关系不是替代，而是更重的外置 runtime 层；与 ai-memory 的关系是部分重叠但重心不同，Tencent 更偏“分层记忆 + token/offload”，ai-memory 更偏“跨 Agent wiki + handoff”；与 mem0 相比，Tencent 更靠近 agent runtime，mem0 更靠近应用 memory SDK/API/platform；与 MemPalace 相比，Tencent 更偏执行期 offload，MemPalace 更偏本地原文归档和检索。
