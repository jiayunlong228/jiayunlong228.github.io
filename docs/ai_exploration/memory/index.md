# Memory 项目调研

生成日期：2026-06-19

这组笔记整理了几个 memory 相关项目的定位、架构、适用场景和选型边界。它们都围绕“记忆”展开，但承担的职责并不相同：Codex memory 处理 Codex 内的上下文和偏好；ai-memory 处理跨 Agent 的项目 wiki 和 handoff；mem0 面向 AI 应用提供 memory SDK/API；MemPalace 侧重本地原文保存与检索；TencentDB-Agent-Memory 则把重点放在长程 agent runtime 的上下文压缩和分层记忆上。

建议先读整体关系，再按项目细看：

- [五者关系与选型](./memory-projects-relationship.md)：先建立整体地图，理解它们分别处在哪一层。
- [Codex Memory 调研](./codex-memory.md)：Codex 原生 memory、`AGENTS.md`、skills、plugins、Chronicle/Skysight 之间的关系。
- [akitaonrails/ai-memory 调研](./akitaonrails-ai-memory.md)：跨 Agent 项目 wiki、handoff、MCP 和 lifecycle hooks。
- [mem0ai/mem0 调研](./mem0ai-mem0.md)：面向 AI 应用的 memory SDK、API、平台和 Codex 插件。
- [MemPalace/mempalace 调研](./mempalace.md)：本地优先的原文记忆宫殿、ChromaDB/SQLite、MCP 和 auto-save hooks。
- [TencentDB-Agent-Memory 调研](./tencentdb-agent-memory.md)：面向长程 Agent runtime 的 L0-L3 分层记忆与上下文 offload。

## 核心结论

- Codex memory 是 Codex 产品内置的上下文/偏好层。
- TencentDB-Agent-Memory 服务 Agent runtime，负责分层记忆和上下文压缩。
- ai-memory 服务跨 Agent 协作，负责项目 wiki、handoff 和 MCP memory sidecar。
- mem0 服务 AI 应用，提供覆盖用户、会话、agent 和组织记忆的 SDK/API/平台。
- MemPalace 服务本地原文检索，把项目、对话和文档整理成可搜索的 drawers，并通过 MCP/hooks 接入 coding agents。

## 推荐使用边界

- 只服务 Codex 自己：优先 Codex memory + `AGENTS.md`。
- 跨 Codex/Claude/Cursor/Gemini 共享项目 wiki 和 handoff：优先 ai-memory。
- 长 session、工具日志巨大、需要 token/offload 和 L0-L3 分层：评估 TencentDB-Agent-Memory。
- 构建 AI 产品、客服/教育/陪伴/工作流 agent，需要用户个性化记忆服务：评估 mem0。
- 想把项目文件和 agent 对话原文保存在本地、可检索、可通过 MCP 查询：评估 MemPalace。
