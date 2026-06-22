# akitaonrails/ai-memory 调研

调研日期：2026-06-19  
仓库：<https://github.com/akitaonrails/ai-memory>  
本地 clone commit：`af933be1a24669fd7ea0972da6bfdd0bfbad4c9e`  
本地 clone 最近提交：2026-06-18 `test(llm): lock Gemini embedContent API-key auth`  
Cargo workspace 版本：`1.1.1`  
最新 release：`v1.1.1`，发布时间 2026-06-18

## 信息源

- README：`external/ai-memory/README.md`
- 架构文档：`external/ai-memory/docs/ARCHITECTURE.md`
- 设计决策：`external/ai-memory/docs/design-decisions.md`
- Cargo workspace：`external/ai-memory/Cargo.toml`
- hook router：`external/ai-memory/crates/ai-memory-hooks/src/router.rs`
- hook payload：`external/ai-memory/crates/ai-memory-hooks/src/payload.rs`
- MCP server：`external/ai-memory/crates/ai-memory-mcp/src/server.rs`
- store reader/writer：`external/ai-memory/crates/ai-memory-store/src/reader.rs`、`writer.rs`
- wiki 写入路径：`external/ai-memory/crates/ai-memory-wiki/src/wiki.rs`
- Codex hooks：`external/ai-memory/hooks/codex/*.sh`
- GitHub API：<https://api.github.com/repos/akitaonrails/ai-memory>
- GitHub releases：<https://github.com/akitaonrails/ai-memory/releases>

## 项目定位

ai-memory 是一个面向 AI coding agents 的长期记忆 sidecar。它的核心主张是：不同 agent CLI 之间可以共享同一个项目记忆库，例如从 Claude Code 退出后，在同一目录打开 OpenAI Codex，可以不用重新解释架构、失败尝试和未解决问题。

它的记忆载体不是隐藏数据库优先，而是一个可读、可 grep、可 git 版本化的 Markdown wiki；SQLite 负责派生索引、sessions、observations、handoffs、audit、embeddings 等运行时数据。

一句话：ai-memory 是“跨 Agent 的项目 wiki + MCP 工具 + lifecycle hooks + handoff 协议”。

## GitHub / 版本快照

- 创建时间：2026-05-21。
- 语言：Rust 为主，另有 Shell、PowerShell、HTML、Dockerfile。
- GitHub API 快照：759 stars，80 forks，2 open issues。
- LICENSE：MIT。
- 最新 release `v1.1.1` 提供多平台二进制资产，例如 Linux/macOS/Windows 归档。
- README 支持矩阵显示：Codex、Claude Code、OpenCode、Cursor、Gemini CLI、OpenClaw、Antigravity CLI、Grok Build CLI 等均有不同程度支持。

## 架构拆解

### 1. 单 Rust binary + HTTP/MCP server

Cargo workspace 包含：

- `ai-memory-core`：领域类型、ID、sanitizer、handoff、page 等。
- `ai-memory-store`：SQLite、单 writer actor、reader pool、decay、FTS。
- `ai-memory-wiki`：Markdown 原子写、watcher、git、admission。
- `ai-memory-mcp`：MCP server 和工具路由。
- `ai-memory-hooks`：hook payload、router、sanitizer、事件入口。
- `ai-memory-llm`：LLM 与 embedding provider。
- `ai-memory-consolidate`：consolidation、lint、sweep、auto-improve。
- `ai-memory-web`：只读 web UI。
- `ai-memory-cli`：CLI 和安装命令。

CLI 被设计成 thin HTTP client：状态读写通过运行中的 server，不直接改 SQLite 或 wiki 文件。

### 2. Hook 捕获

`ai-memory-hooks` 暴露 `POST /hook`。`router.rs` 中说明：

- hook 请求立即返回 202，满载时返回 429。
- 重活在响应后处理，但写入会走 writer ack，避免索引和数据脱节。
- 支持 `session-start`、`user-prompt`、`pre-tool-use`、`post-tool-use`、`pre-compact`、`stop`、`session-end` 等规范事件。
- 支持 extension namespace，但核心 observation enum 保持闭合。

Codex hook 示例：

- `session-start.sh`：把事件发到 `/hook?event=session-start&agent=codex`，然后同步 fetch `/handoff`，把 pending handoff 打到 stdout，让新 session 自动看到交接内容。
- `post-tool-use.sh` / `session-end.sh`：fire-and-forget 发事件到 server。

这使 ai-memory 能在 Codex 之外记录 Codex 的生命周期事件。

### 3. Wiki source of truth

`docs/ARCHITECTURE.md` 和 `wiki.rs` 都强调 Markdown wiki 是 source of truth：

- Wiki 根目录是 `<data_dir>/wiki/`。
- 每个 workspace/project 使用 UUID 目录隔离。
- 写入必须走 `Wiki::write_page` / batch / destructive helpers，以保证 sanitizer、admission、attribution、rollback 和 store update 一起执行。
- git2 负责 checkpoint，可恢复单页版本。
- 外部编辑由 watcher/reindex 路径同步。

这点是 ai-memory 与 Tencent 的一个明显区别：ai-memory 的顶层持久资产就是人类可读的 wiki，而不是 agent 内部 persona/scene 文件为主。

### 4. SQLite 派生索引

SQLite 保存：

- `pages` / `pages_fts`：wiki page 版本和全文索引。
- `sessions` / `observations` / `observations_fts`：hook 捕获和原始观察。
- `links`：wiki link / markdown cross-reference。
- `handoffs`：跨 agent handoff。
- `page_embeddings`：可选向量。
- `audit_log`：所有 mutation。

`writer.rs` 用单 OS thread 持有 SQLite writer connection，所有 mutation 通过 `WriteCmd` 队列，目标是避免 `database is locked`。

### 5. MCP 工具面

`ai-memory-mcp/src/server.rs` 定义了较完整但仍受控的工具面。架构文档列出 16 个工具：

- 查询：`memory_query`、`memory_recent`、`memory_read_page`
- 状态：`memory_status`、`memory_briefing`、`memory_explore`
- handoff：`memory_handoff_begin`、`memory_handoff_accept`、`memory_handoff_cancel`
- 写入：`memory_write_page`、`memory_delete_page`
- 维护：`memory_consolidate`、`memory_auto_improve`、`memory_forget_sweep`、`memory_lint`
- 自路由：`memory_install_self_routing`

MCP server instructions 明确要求默认作用于当前项目；只有用户明确提到其他项目时才传 workspace/project/cwd。

### 6. Memory tiers 与 decay

ai-memory 的 memory 模型是时间分层：

- Working：当前 session，有效期到 session end。
- Episodic：session summaries，热 30 天、冷 180 天后按 decay 规则清理。
- Semantic：长期知识、决策、规则、架构说明，可 supersede。
- Procedural：重复出现的模式和流程。

Pinned pages 和 `_slots/` 会被保护，避免被 decay sweep 清掉。

## 优势

- 跨 agent 目标明确，Codex 支持是第一等集成之一。
- Markdown wiki + git 作为 source of truth，可读、可 diff、可备份。
- MCP + lifecycle hooks 同时覆盖“主动查询”和“自动捕获”。
- handoff 是一等协议，而不是临时总结。
- SQLite 单 writer、WAL reader pool、审计日志和 checkpoint 体现了较强的工程治理意识。
- LLM 是 opt-in；没有 provider 时仍有 FTS5 和规则化摘要，降低使用门槛。
- 多项目、多用户、远端 server、bearer auth、web UI、backup/restore 等运维面较完整。

## 风险与限制

- 项目很新，创建于 2026-05-21；虽然 release 很活跃，但稳定性仍需实测。
- 需要运行本地或远端 server；这比 Codex 内置 memory 多一个运维面。
- Hook 捕获依赖各 agent CLI 的生命周期接口；MCP-only 客户端没有自动捕获。
- 远端或 LAN 暴露必须配置 token 和 allowed hosts，否则存在隐私风险。
- Markdown wiki 作为 source of truth 便于人读，但也要求处理文件系统、watcher、git、SQLite 同步边界。
- 如果与 Codex 内置 memory、Tencent offload 同时启用，需要避免重复注入或把低信号日志永久化。

## 适用场景

- 希望 Claude Code、Codex、Cursor、Gemini CLI 等共享同一项目上下文。
- 需要“昨天从哪儿停下”的跨 agent handoff。
- 希望记忆以 Markdown / git 方式长期保留，可在 Obsidian 或编辑器里直接看。
- 希望自建 local-first memory server，而不是依赖某个单一 agent 产品。
- 需要 MCP 工具让 agent 主动查询、读取、写入项目记忆。

## 不适用场景

- 只想开启 Codex 的个人偏好记忆。
- 主要问题是长工具日志压缩和 token offload，而不是跨 agent 项目 wiki。
- 无法接受运行额外 server 或维护 hook/MCP 配置。
- 对隐私隔离和认证配置缺乏治理。

## 关键判断

ai-memory 是五个项目中最适合“跨 Agent 长期项目 wiki / handoff”的项目。它不会替代 Codex 内置 memory，也不会像 TencentDB-Agent-Memory 那样深入 agent runtime 做 Mermaid offload；和 mem0 相比，它更偏 local-first Markdown wiki 与 handoff，而不是 SDK/API/platform；和 MemPalace 相比，它更偏整理后的 Markdown 知识源，而不是本地原文 drawer 检索。它的价值在于建立一个 agent-agnostic、可审计、可手工编辑的项目记忆层，并通过 hooks/MCP 与 Codex 等 agent 连接起来。
