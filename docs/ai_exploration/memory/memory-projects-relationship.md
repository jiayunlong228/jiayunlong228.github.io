# 五个 Memory 项目的关系与选型

调研日期：2026-06-19  
对象：

1. Codex 自身 memory。
2. TencentDB-Agent-Memory：<https://github.com/Tencent/TencentDB-Agent-Memory>，当前 canonical：<https://github.com/TencentCloud/TencentDB-Agent-Memory>
3. ai-memory：<https://github.com/akitaonrails/ai-memory>
4. mem0：<https://github.com/mem0ai/mem0>
5. MemPalace：<https://github.com/MemPalace/mempalace>

## 一句话关系

- Codex memory 是 Codex 产品内的原生上下文/偏好层。
- TencentDB-Agent-Memory 是面向 Agent runtime 的分层记忆与上下文压缩引擎。
- ai-memory 是跨 Agent 的外置项目 wiki 记忆层和 handoff server。
- mem0 是面向 AI 应用的 memory SDK/API/平台，强调用户、会话、agent 和组织记忆。
- MemPalace 是本地优先的原文记忆宫殿，强调 verbatim storage、ChromaDB/SQLite 图结构、MCP 和 auto-save hooks。

它们不是同一层的竞争品，而是分布在不同控制面、真相源和运维边界上的 memory 基础设施。

## 对比表

| 维度 | Codex memory | TencentDB-Agent-Memory | ai-memory | mem0 | MemPalace |
|---|---|---|---|---|---|
| 产品形态 | Codex 内置能力 | OpenClaw/Hermes 插件 + Gateway/service 线 | Rust server + CLI + MCP + hooks | Python/TS SDK + cloud/self-host server + CLI + MCP/plugin | Python CLI + MCP server + local ChromaDB/SQLite + plugins/hooks |
| 主要目标 | 让 Codex 记住用户/项目上下文 | 提升长程 agent 成功率、降低 token、分层人格/场景记忆 | 跨 Agent 共享项目记忆与交接 | 给 AI 应用和 agent 提供可 API 化的长期记忆 | 本地保存项目/对话原文，让 agent 可检索和回读 |
| 记忆对象 | 偏好、背景、近期任务、活动摘要 | L0 对话、L1 atom、L2 scene、L3 persona、Mermaid offload | Markdown wiki page、session、observation、handoff | user/session/agent/org memory、facts、preferences、entities | wings/rooms/drawers、对话 transcript、项目文件、diary、KG triples |
| 存储形态 | `~/.codex/memories/` 本地 Markdown/摘要；产品内状态 | SQLite/sqlite-vec/FTS、TCVDB、Markdown persona/scene、refs/MMD | Markdown wiki in git 是 source of truth；SQLite 是派生索引 | Vector store + SQLite history；self-host 用 Postgres/pgvector；cloud 托管 | ChromaDB 默认 + SQLite knowledge graph；可选 Qdrant/pgvector/sqlite_exact |
| 检索/注入 | Codex 上下文编排 | auto-recall：FTS/embedding/hybrid + persona + scene navigation | MCP tools：query/read/briefing/recent/handoff | semantic + BM25 + entity boost + rerank；MCP/API/SDK | BM25 + vector hybrid + closet pointers + wing/room filter + graph/KG |
| 短期上下文压缩 | 产品内部上下文管理 | 强项：tool log offload、Mermaid 符号图、node_id 回溯 | 不是重点；主要做 session/handoff/wiki | 不是重点；主要做应用记忆检索 | 有 L0-L3 wake-up，但更偏本地召回和原文归档 |
| 长期记忆 | 用户和 Codex 之间 | 用户 persona/scene/atom | 项目 wiki、规则、决策、gotcha、procedure | 用户偏好、交互事实、agent 行为、组织知识 | 项目文件、历史对话、agent diary、实体关系、原文 drawers |
| 跨 Agent | 弱，主要服务 Codex | 取决于 Gateway/SDK/宿主适配 | 强，明确支持 Codex、Claude Code、Cursor 等 | 强，提供 MCP/plugin/CLI，支持 Codex、Claude、Cursor、OpenCode 等 | 强，提供 MCP/plugin/hooks，支持 Claude/Codex/Cursor/Antigravity 等 |
| 可审计性 | 本地 Markdown 可读，但控制面较产品化 | 分层可回溯，低层保留证据 | 很强，wiki/git/audit/checkpoint | 中等到强，dashboard/API/history；cloud 形态取决于平台治理 | 强在原文可回读；但真相源是 ChromaDB/SQLite，不是 Markdown wiki |
| 运维成本 | 低 | 中到高，视 0.x 插件或 1.x service | 中，需要 server + hooks/MCP | 低到高，取决于 cloud、SDK 本地、self-host server | 中，需要本地包、embedding、ChromaDB/repair、hooks |
| Codex 直接集成 | 原生 | 默认分支没有 Codex hook；可通过 Gateway/HTTP 自行接入 | 原生支持 Codex hooks + MCP | 支持 Direct MCP 和 Codex sideload plugin；hooks 为 opt-in | 支持 Codex plugin，`mempalace-mcp` 和 hooks |

## 关系图

```text
                          +-----------------------------+
                          |       Codex 原生上下文       |
                          | memories / AGENTS / skills  |
                          | plugins / MCP / Chronicle   |
                          +--------------+--------------+
                                         |
                   prompt/context       |       MCP/hooks/API
                                         |
        +--------------------------------+--------------------------------+
        |                                |                                |
+-------v----------------------+ +-------v----------------------+ +-------v----------------------+
| ai-memory                    | | mem0                         | | TencentDB-Agent-Memory      |
| project wiki + handoff       | | app/user memory platform     | | L0-L3 + offload engine      |
| hooks + MCP                  | | SDK/API/MCP/plugin           | | OpenClaw/Hermes/Gateway     |
+------------------------------+ +--------------+---------------+ +------------------------------+
                                               |
                                +--------------v---------------+
                                | MemPalace                    |
                                | local verbatim palace        |
                                | ChromaDB/SQLite + MCP/hooks  |
                                +------------------------------+
```

## 互补关系

### Codex + ai-memory

这是最自然的跨 coding agent 项目 wiki 组合。

ai-memory 已经提供 `hooks/codex/*.sh`，可以在 Codex session start / post tool use / session end 时捕获事件，并通过 MCP 工具让 Codex 查询项目 wiki。它还可以把 routing snippet 写进 `AGENTS.md`，让 Codex 在需要 prior context 时主动调用 memory tools。

适合：

- 用户经常在 Claude Code、Codex、Cursor 之间切换。
- 项目记忆需要团队或多工具共享。
- 需要可读、可版本化、可人工修正的长期项目知识。

### Codex + mem0

这是“Codex 接入外部 semantic memory 服务”的组合。

mem0 提供两条 Codex 路径：

- Direct MCP：在 `~/.codex/config.toml` 中配置 `https://mcp.mem0.ai/mcp` 和 `MEM0_API_KEY`。
- Sideload plugin：安装 mem0 Codex plugin，获得 MCP、skills 和 opt-in hooks。

适合：

- 希望 Codex 使用远端或统一的 memory API。
- 希望把 coding preferences、project decisions、session notes 等放到 Mem0 Platform 或 self-hosted memory 服务中。
- 团队未来还想把同一套 memory 接入产品 agent、CLI 或其他 editor。

### Codex + MemPalace

这是“Codex 接入本地原文 memory palace”的组合。

MemPalace 的 Codex plugin manifest 声明了 `mempalace-mcp`、skills 和 hooks。它更适合把项目文件、Claude/Codex/Cursor 对话、agent diary 等存成可检索 drawer，然后让 Codex 通过 MCP 搜索和回读原文。

适合：

- 不想把记忆默认放到云端。
- 希望保留 conversation transcript 原文，而不是只保存 LLM 抽取事实。
- 希望在 Codex 中能 `search/read/mine` 本地记忆宫殿。

注意：

- 它需要本地 embedding/ChromaDB 栈，运维比 Codex 原生 memory 更重。
- hooks auto-save 可能捕获敏感 transcript，需要明确开启/关闭策略。
- 如果需要 Markdown wiki 人工维护，ai-memory 更贴合。

### Codex + TencentDB-Agent-Memory

默认分支下这不是开箱即用组合。TencentDB-Agent-Memory 的成熟集成主要在 OpenClaw/Hermes；Codex 要使用它通常需要：

- 通过 Tencent v1 Gateway / SDK / HTTP API 做自定义桥接。
- 或在 Codex 的 MCP/插件能力中封装相应客户端。
- 或把 Codex 放到已有 OpenClaw/Hermes 生态之外的 agent runtime 中，这需要额外工程。

适合：

- 你要解决的是长工具日志、超长 session、上下文压缩和多层 persona/scene，而不是普通项目 handoff。
- 你已经使用 OpenClaw/Hermes，或愿意采用 Tencent 的独立 Gateway 线。

### mem0 + ai-memory

两者都能服务 coding agent，但 source of truth 不同。

- mem0：API/platform 优先，擅长 semantic memory、用户个性化、多语言 SDK、MCP/plugin 分发。
- ai-memory：local-first wiki 优先，擅长项目决策、handoff、Markdown/git 审计。

组合时建议：mem0 管用户偏好、跨应用个性化和产品 agent memory；ai-memory 管当前代码项目的架构、规则、失败尝试和 handoff。

### mem0 + MemPalace

这组可以按“应用 memory 服务 + 本地原文归档”分工。

- mem0 适合产品里可 API 化的 user/session/agent memory。
- MemPalace 适合个人/团队本地保存项目文件和 agent 对话原文。

组合风险是同一事实既被 mem0 抽取成 memory，又被 MemPalace 原文召回。需要明确：mem0 是产品可查询事实层，MemPalace 是本地原文证据层。

### ai-memory + MemPalace

这是两种 local-first coding memory 的对照：

- ai-memory：Markdown wiki 是 source of truth，适合人工编辑、git diff、handoff。
- MemPalace：ChromaDB/SQLite 中的原文 drawers 是 source of truth，适合 transcript retention 和原文检索。

如果组合，建议 ai-memory 管“整理后的项目知识”，MemPalace 管“原始证据和完整对话”。不要让两者都自动注入大段上下文。

### mem0 + TencentDB-Agent-Memory

这组可以按“应用记忆平台 + runtime context engine”分工。

- mem0 负责应用层 user/session/agent memory，通过 SDK/API 服务产品功能。
- Tencent 负责 agent runtime 内的 L0-L3、scene/persona 和 tool log offload。

适合构建自有 agent 平台时分层使用：mem0 对外提供产品 memory API，Tencent 在 agent 执行框架内部优化长程任务上下文。

### TencentDB-Agent-Memory + ai-memory / MemPalace

Tencent 与 ai-memory / MemPalace 都可能捕获 session，但重心不同：

- Tencent：agent runtime 内的分层推理和上下文 offload。
- ai-memory：外部项目 wiki、跨 agent handoff、可审计持久知识。
- MemPalace：本地原文归档、hybrid search、KG/tunnel 导航。

最大风险：

- 双重捕获同一 session。
- 双重注入 memory context，导致上下文臃肿或冲突。
- 多套“长期事实”没有同步治理。

如果要同时用，应明确边界：Tencent 管 runtime memory/offload，ai-memory 管 project wiki，MemPalace 管原文证据和 transcript retention。

## 选型建议

### 只想让 Codex 少问重复背景

优先用 Codex memory + `AGENTS.md`。

理由：无需额外服务，和 Codex 上下文优先级天然兼容。把明确规则写入 `AGENTS.md`，把偏好和历史上下文交给 memories。

### 想跨 Claude Code / Codex / Cursor 共享项目 wiki 和 handoff

优先用 ai-memory。

理由：它已支持 Codex hooks/MCP，核心资产是 Markdown wiki，适合项目决策、规则、gotcha、handoff。

### 想本地保存 agent 对话和项目文件原文，并能按语义检索

优先评估 MemPalace。

理由：它的核心承诺是 local-first、verbatim drawers、ChromaDB/SQLite、MCP tools 和 auto-save hooks；适合 conversation retention 和原文证据回读。

### 想给 AI 产品增加个性化长期记忆

优先评估 mem0。

理由：它提供 Python/TypeScript SDK、Cloud Platform、self-hosted server、dashboard、CLI 和 MCP，定位就是应用侧 user/session/agent/org memory。

### 想给 Codex 接一个远端 memory 服务

评估 mem0 plugin / Direct MCP。

理由：mem0 已有 Codex MCP 配置、sideload plugin、skills 和 opt-in hooks；比自己封装 memory API 更快。

### 想给 Codex 接一个本地原文检索服务

评估 MemPalace plugin / `mempalace-mcp`。

理由：MemPalace 的 Codex plugin 直接声明 MCP server 和 hooks，且默认不需要云端 API。

### 想降低长程 Agent 的 token 消耗

优先评估 TencentDB-Agent-Memory。

理由：它的短期 offload、Mermaid 符号化、node_id 回溯和 L1/L2/L3 pipeline 直接围绕长 session 压力设计。

### 想建设统一 Memory Gateway / SDK

如果目标是产品应用 memory，优先 mem0；如果目标是 agent runtime offload 和分层上下文引擎，评估 TencentDB-Agent-Memory 1.x 线；如果目标是本地个人知识/对话归档，评估 MemPalace。

## 共同设计趋势

五者背后有几个共同方向：

1. 不再把 memory 等同于“扁平向量库”。
2. 都强调上下文选择，而不是全量历史回放。
3. 都在处理“记忆内容是否可信”的问题。
4. 都倾向保留某种可追溯证据：Codex 的本地 Markdown/摘要、Tencent 的 L0/refs、ai-memory 的 git wiki + observations、mem0 的 history/API/dashboard、MemPalace 的原文 drawers/KG。
5. 都需要与显式指令分层：memory 只能辅助，不能覆盖用户当前指令和项目规则。

## 主要差异

### 1. 记忆粒度不同

- Codex：用户和产品会话层。
- Tencent：agent runtime 推理层。
- ai-memory：项目知识库层。
- mem0：AI 应用的用户/会话/agent/组织记忆层。
- MemPalace：本地原文证据层和语义检索层。

### 2. 控制面不同

- Codex：配置项、内置 UI/CLI、`AGENTS.md`。
- Tencent：插件配置、Gateway API、host adapter、SDK。
- ai-memory：MCP tools、HTTP hooks、CLI、Markdown wiki。
- mem0：SDK、REST API、dashboard、CLI、MCP、agent plugin。
- MemPalace：CLI、MCP tools、hooks、local backend、repair/mine/sweep。

### 3. “真相源”不同

- Codex：产品内上下文系统，本地 memories 是证据之一。
- Tencent：低层 L0/refs 保留证据，高层 persona/scene/MMD 负责结构。
- ai-memory：Markdown wiki 是 source of truth，SQLite 是派生索引。
- mem0：memory service/vector store 是主存储，dashboard/API/history 负责管理和追踪。
- MemPalace：verbatim drawers 是 source of truth，ChromaDB/SQLite 负责检索和图关系。

## 风险清单

同时评估或组合这些系统时，建议重点检查：

- 隐私：是否捕获屏幕、工具输出、聊天、文件内容、私有路径。
- 注入：观察到的文本是否可能变成未来 agent 指令。
- 冲突：Codex memory、`AGENTS.md`、ai-memory `_rules/`、Tencent persona、mem0 memories、MemPalace drawers/KG 谁优先。
- 过期：长期记忆是否有 decay、supersession、lint、dashboard 审核或人工修订机制。
- 可回滚：错误记忆是否能定位、删除、恢复。
- 上下文预算：多套 memory 同时注入是否反而增加 token。
- 多用户/多项目：workspace/project/user/session/agent/org/wing 维度是否清晰。
- 数据路径：remote MCP、cloud API、self-host server、本地 SQLite/wiki/ChromaDB 分别保存了哪些数据。
- 自动捕获：hooks 是否会保存不该保存的 transcript、tool output 或敏感文件。

## 最终判断

默认建议是：

1. 先用 Codex 原生 memory + `AGENTS.md` 管好 Codex 内的个人和仓库上下文。
2. 如果需要跨 agent、跨工具、可审计项目 wiki，引入 ai-memory。
3. 如果需要本地保存和检索项目/对话原文，评估 MemPalace。
4. 如果是在 AI 产品里做用户个性化和长期记忆服务，评估 mem0。
5. 如果需要解决长程 agent 的上下文爆炸和 token/offload 问题，再评估 TencentDB-Agent-Memory。

这五个系统可以形成层次，但不建议无边界地全开。最佳组合不是“记得越多越好”，而是让每一层只记自己最擅长、最可审计、最少冲突的东西。
