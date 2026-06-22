# Codex Memory 调研

调研日期：2026-06-19  
对象：Codex 自身的 memory / persistent context 相关能力  
结论摘要：Codex 的 memory 更像“产品内置的上下文持久化与偏好层”，不是一个独立的可编程 memory server。它与 `AGENTS.md`、skills、plugins、MCP/connectors、session resume/archives、Chronicle/Skysight 等能力共同参与上下文构建。

## 信息源

- 官方文档：Codex Memories：<https://developers.openai.com/codex/memories>
- 官方文档：Codex Chronicle：<https://developers.openai.com/codex/chronicle>
- 官方文档：Codex Customization / AGENTS.md：<https://developers.openai.com/codex/concepts/customization#agents-guidance>
- 官方文档：Codex Config Reference：<https://developers.openai.com/codex/config-reference>
- 本机验证：`codex --help` 输出中没有单独的 `memory` 子命令，但有 `resume`、`archive`、`fork`、`mcp`、`plugin` 等上下文与扩展相关命令。
- 本机验证：`~/.codex/memories/` 下存在 `MEMORY.md`、`memory_summary.md`、`raw_memories.md`、`rollout_summaries/`、`extensions/`、`skills/` 等文件/目录。本文只讨论结构，不复述其中私人内容。
- 本机验证：Computer Use / Skysight 的本地提示词位于 `~/.codex/computer-use/.../SkysightMemoryInstructions.md` 与 `SkysightSummarizer.md`，显示它将活动事件流压缩成 10 分钟和 6 小时粒度的摘要，并明确把观察到的内容视为不可信证据。

## 定位

Codex memory 的核心目标不是把所有历史都塞回模型上下文，而是把“对未来任务有用的偏好、项目背景、工作习惯、近期活动摘要”等转为可复用上下文。它的形态包含三类：

1. 用户/项目级的显式或自动生成记忆。
2. 由 `AGENTS.md`、skills、plugins、MCP 等提供的长期规则与工具上下文。
3. 由 Chronicle/Skysight、session resume、archives 这类功能提供的工作连续性。

因此，Codex memory 应被理解为 Codex 产品上下文系统的一部分，而不是一个单独的 “Memory API” 或“记忆数据库产品”。

## 主要组成

### 1. Memories

官方 Memories 页面描述的是 Codex 对用户偏好和长期上下文的内置记忆能力。根据官方文档检索结果，这一能力默认关闭，可通过 `config.toml` 中的 memories 相关设置启用，例如 `use_memories`、`generate_memories`、`disable_on_external_context` 等。

本机可见的落盘目录是 `~/.codex/memories/`，当前环境中包含：

- `MEMORY.md`：主索引/中层整合记忆。
- `memory_summary.md`：压缩背景层。
- `raw_memories.md`：更细的历史任务归并层。
- `rollout_summaries/`：单次任务或线程级摘要。
- `extensions/`：扩展来源的记忆说明或资源。
- `skills/`：从记忆中沉淀出的可复用技能。
- `.git/`：说明该目录在本机以 git 方式保留变更历史。

这些文件表明当前 Codex 本地 memory 具备“可读 Markdown + 分层摘要 + 任务摘要归档”的特征。

### 2. `AGENTS.md`

`AGENTS.md` 是 Codex 的项目规则面：用于写入仓库级、团队级、目录级的稳定工作约定，例如测试命令、代码风格、审批规则、业务口径、不可触碰的路径等。

它和 Memories 的关系：

- `AGENTS.md` 更适合放“明确规则”和“团队共享约定”。
- Memories 更适合放“用户偏好、历史上下文、近期工作状态、经验型知识”。
- 当规则冲突时，显式用户指令和更高优先级系统/开发者规则优先；memory 不应成为当前事实或权限的来源。

### 3. Chronicle / Skysight

Chronicle 是官方文档中的 opt-in 上下文能力，偏向记录和总结用户近期活动，用于帮助 Codex 理解“你刚才在做什么”。本机的 Skysight 提示词进一步显示：

- 它基于后台事件流生成 10 分钟和 6 小时粒度的摘要。
- 它会把屏幕、窗口、命令、文档、聊天等观察内容视为不可信证据。
- 输出必须是描述性的 memory，而不是写给未来 agent 的指令。
- 它明确禁止保存 secrets、PII、在线页面内容、敏感内容细节等。

这说明 Codex 对“被动观察型 memory”有很强的安全边界：观察内容只能作为证据，不能自动升级为指令。

### 4. Session resume / archive / fork

`codex --help` 暴露了 `resume`、`archive`、`unarchive`、`fork` 等命令。这些能力解决的是“继续某个 Codex session”的问题，和长期 memory 相邻但不同：

- resume/fork 关注某条会话的连续上下文。
- Memories 关注跨会话可复用的偏好和经验。
- `AGENTS.md` 关注仓库内稳定规则。

## 数据流推断

一个 Codex turn 中，模型可见上下文大致来自以下层：

1. 当前用户 prompt 和会话历史。
2. 系统/开发者/仓库规则，例如本仓库的 `AGENTS.md`。
3. Codex memories 中与当前任务相关的摘要、偏好或历史上下文。
4. 已启用的 skills/plugins/MCP/connectors 提供的说明、工具或私有数据检索。
5. 如启用，Chronicle/Skysight 提供的近期活动摘要。

这是一套上下文编排系统，而不是简单的“向量检索后拼接结果”。

## 优势

- 与 Codex 产品深度集成，不需要用户单独部署服务。
- 本地目录以 Markdown 为主，具备一定可读性和可审计性。
- 能与 `AGENTS.md`、skills、plugins、MCP 形成多层 durable context。
- 对被动观察内容有明确安全边界，避免把屏幕文本中的恶意提示当作指令。
- 对普通用户而言摩擦最低，适合记录偏好、常用流程和近期任务状态。

## 局限

- 没有暴露为通用 memory server，也没有本机 `codex memory` 子命令。
- 可编程控制面弱于专门项目，难以作为跨 Agent 的统一记忆后端。
- 对外部事实、价格、文档、最新代码等不应依赖 memory，仍需实时检索或读取来源。
- 如果自动生成 memory 没有治理，可能积累过时偏好或低价值摘要。
- Chronicle/Skysight 这类被动观察能力需要额外关注隐私边界和本地数据保留策略。

## 适用场景

- 保存个人偏好、回答风格、常用工作流。
- 记住某些仓库或业务线的常见背景。
- 辅助 Codex 在同一用户的多次任务中减少重复解释。
- 与 `AGENTS.md` 配合，把“明确规则”与“经验上下文”分层管理。

## 不适用场景

- 作为多 Agent 共享的统一 memory backend。
- 需要显式 API、审计 UI、细粒度权限、多用户租户隔离的企业记忆服务。
- 需要严格可复现的 RAG / memory benchmark。
- 需要把 memory 同步给 Claude Code、Cursor、Gemini CLI 等非 Codex agent。

## 关键判断

Codex memory 是最自然的默认层：低摩擦、产品内置、适合“我和 Codex 之间”的长期上下文。但如果目标是跨 Agent 交接、团队共享、可审计 wiki、本地原文归档、应用级 memory API，或长程 agent runtime offload，就需要额外评估 ai-memory、MemPalace、mem0、TencentDB-Agent-Memory 这类外置系统。
