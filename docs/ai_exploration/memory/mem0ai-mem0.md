# mem0ai/mem0 调研

调研日期：2026-06-19  
仓库：<https://github.com/mem0ai/mem0>  
项目主页：<https://mem0.ai>  
文档：<https://docs.mem0.ai>  
调研方式：`git clone` 在本机因网络 sideband disconnect 中断，本文改用 GitHub API / Contents API 读取 README、源码、文档和插件配置。  
GitHub `main` 快照：`bd7ce2c13cd60c77e1cd7b9f6db34139d42ce632`，提交时间 2026-06-19 `fix(vector_stores): drop stray print in Weaviate list_cols (#5637)`  
Python package：`mem0ai==2.0.7`  
TypeScript package：`mem0ai==3.0.9`  
Codex plugin：`mem0==0.2.10`

## 信息源

- GitHub API：<https://api.github.com/repos/mem0ai/mem0>
- README：<https://github.com/mem0ai/mem0/blob/main/README.md>
- Python package：<https://github.com/mem0ai/mem0/blob/main/pyproject.toml>
- 仓库说明：<https://github.com/mem0ai/mem0/blob/main/AGENTS.md>
- LLM 参考说明：<https://github.com/mem0ai/mem0/blob/main/LLM.md>
- 文档入口：<https://github.com/mem0ai/mem0/blob/main/docs/introduction.mdx>
- memory 类型：<https://github.com/mem0ai/mem0/blob/main/docs/core-concepts/memory-types.mdx>
- add/search 文档：`docs/core-concepts/memory-operations/add.mdx`、`search.mdx`
- 核心实现：<https://github.com/mem0ai/mem0/blob/main/mem0/memory/main.py>
- 配置模型：<https://github.com/mem0ai/mem0/blob/main/mem0/configs/base.py>
- extraction prompt：<https://github.com/mem0ai/mem0/blob/main/mem0/configs/prompts.py>
- vector store 抽象：<https://github.com/mem0ai/mem0/blob/main/mem0/vector_stores/base.py>
- self-host server：`server/README.md`、`server/main.py`、`server/docker-compose.yaml`
- CLI：<https://github.com/mem0ai/mem0/blob/main/cli/README.md>
- Codex/Claude/Cursor 插件：`integrations/mem0-plugin/README.md`、`.codex-plugin/plugin.json`、`hooks/codex-hooks.json`
- benchmark 子模块：<https://github.com/mem0ai/memory-benchmarks>

## 项目定位

mem0 是面向 AI 应用和 Agent 的通用 memory layer。它的目标不是给某一个 coding agent 做内部上下文续接，而是为 AI 产品提供可嵌入、可托管、可自部署的长期记忆能力：记住用户偏好、会话状态、agent 行为、组织知识，并通过检索把相关记忆交还给应用。

它同时有几种产品形态：

- Library：Python / TypeScript SDK，适合在应用代码里直接集成。
- Self-hosted server：FastAPI + PostgreSQL/pgvector + dashboard。
- Cloud Platform：托管 API、dashboard、MCP endpoint。
- CLI：`mem0 init/add/search/list/update/delete`，支持 agent mode JSON 输出。
- Agent/editor plugin：支持 Claude Code、Cursor、Codex、OpenCode、Antigravity 等，通过 MCP、skills 和 lifecycle hooks 接入。

一句话：mem0 是“应用/产品层的 memory SDK + API + 平台”，而不是单纯的项目 wiki、Codex 原生 memory，或长工具日志 offload 引擎。

## GitHub / 版本快照

- 创建时间：2023-06-20。
- GitHub API 快照：58895 stars，6782 forks，354 open issues。
- 语言：Python 和 TypeScript 为主，另有 Shell、JavaScript、CSS、Dockerfile。
- LICENSE：Apache-2.0。
- topics 包含 `ai-agents`、`long-term-memory`、`memory-management`、`rag`、`state-management` 等。
- Python SDK 当前 `pyproject.toml` 版本为 `2.0.7`。
- TypeScript SDK `mem0-ts/package.json` 版本为 `3.0.9`。
- GitHub latest release 当前指向 `opencode-v0.2.0` 这类集成插件 release，不应直接等同于 SDK 主版本。
- `evaluation/` 是指向 `mem0ai/memory-benchmarks` 的 submodule。

## 架构拆解

### 1. 核心 SDK

Python SDK 的核心类是 `Memory` / `AsyncMemory`。初始化时会创建：

- LLM：用于 memory extraction、procedural memory 等。
- embedder：用于 add/search 的向量化。
- vector store：默认和可选后端承载 memories。
- SQLite history DB：记录 message history 和 memory change history。
- reranker：可选，用于 search 后二次排序。
- entity store：懒加载，用于实体链接和 entity boost。

`MemoryConfig` 暴露 `vector_store`、`llm`、`embedder`、`history_db_path`、`reranker`、`custom_instructions` 等配置。README 中写明默认 LLM 是 `gpt-5-mini`，默认 embedding 是 `text-embedding-3-small`。

### 2. Add pipeline

`Memory.add()` 要求至少提供 `user_id`、`agent_id`、`run_id` 之一来限定 scope。它有两条路径：

- `infer=False`：按原始 message 存储，跳过 LLM extraction 和冲突/去重逻辑。
- `infer=True`：默认路径，使用 LLM 从对话中抽取结构化 memory。

当前源码中的 add pipeline 很明确：

1. 收集当前 session scope 下最近消息。
2. 通过 embedding 在已有 memory 中找相关项。
3. 使用 `ADDITIVE_EXTRACTION_PROMPT` 做单次 ADD-only extraction。
4. 对抽取出的 memory 批量 embedding。
5. 用 hash 做批内和既有 memory 去重。
6. 批量写入 vector store。
7. 写入 SQLite history。
8. 抽取实体，写入 entity store，并把实体和 memory id 关联。
9. 保存原始 messages 到 history。

`ADDITIVE_EXTRACTION_PROMPT` 的设计重点是“只做 ADD，不在同一次 LLM extraction 里 UPDATE/DELETE”。已有 memories 主要用于 dedupe 和 linking；新 memories 必须来自新消息。prompt 还要求把相对时间锚定到 observation date，例如把 “last week” 落成具体日期范围。

### 3. Search pipeline

`Memory.search()` 也要求通过 `filters` 提供至少一个 `user_id`、`agent_id`、`run_id`，以避免跨用户或跨 session 污染。它支持：

- `top_k`、`threshold`、`rerank`、`explain`。
- metadata filter operators：`eq/ne/in/nin/gt/gte/lt/lte/contains/icontains`。
- `AND`、`OR`、`NOT` 逻辑。

核心 `_search_vector_store()` 不是单一向量检索，而是多信号融合：

1. query lemmatization，用于 keyword/BM25。
2. query entity extraction。
3. semantic vector search。
4. 如果后端支持，执行 keyword search。
5. 将 BM25 分数归一化。
6. 通过 entity store 计算 entity boost。
7. 将 semantic、BM25、entity boost 融合排序。
8. 可选 reranker 二次排序。
9. `explain=True` 时返回 score details，便于调试排序原因。

这说明 mem0 的 OSS 检索已经超过“向量库 wrapper”，更接近一个应用 memory retrieval layer。

### 4. 存储和 provider 生态

`VectorStoreBase` 抽象了 collection、insert、search、update、delete、list、reset，以及可选的 `keyword_search()` 和 `search_batch()`。

Python optional dependencies 显示它支持大量后端和 provider：

- vector stores：Qdrant、Chroma、Cassandra、Weaviate、Pinecone、FAISS、Azure AI Search、pgvector、MongoDB、Milvus、Redis/Valkey、Elasticsearch、OpenSearch、Databricks 等。
- LLM providers：OpenAI、Groq、Together、LiteLLM、Ollama、Vertex AI、Google Generative AI / GenAI 等。
- extras：LangChain、sentence-transformers、fastembed、Boto3、OpenSearch 等。

它的强项之一是 provider 覆盖面和迁移路径，而不是某个单一数据库后端。

### 5. Self-hosted server

`server/` 提供 FastAPI server 和 Next.js dashboard。`server/main.py` 暴露的主要 API 包括：

- `POST /memories`
- `GET /memories`
- `GET /memories/{memory_id}`
- `POST /search`
- `PUT /memories/{memory_id}`
- `GET /memories/{memory_id}/history`
- `DELETE /memories/{memory_id}`
- `DELETE /memories`
- `POST /reset`
- `GET/POST /configure`

`server/README.md` 显示 self-hosted 默认开启认证：

- dashboard login 使用 JWT。
- API 访问使用 `X-API-Key`。
- `AUTH_DISABLED=true` 仅用于本地开发。
- dashboard 可以查看 requests、memories、entities、API keys、configuration、settings。

Docker Compose 使用 `pgvector/pgvector:pg17`，dashboard 默认 `http://localhost:3000`，API 默认 `http://localhost:8888`。

### 6. CLI / MCP / Codex 插件

CLI 支持 Python 和 Node 两套实现，命令包括：

- `mem0 init`
- `mem0 add`
- `mem0 search`
- `mem0 list`
- `mem0 get`
- `mem0 update`
- `mem0 delete`
- `mem0 import`
- `mem0 entity`
- `mem0 event`
- `mem0 status`

`--agent` / `--json` 会输出稳定 JSON envelope，适合 agent tool loop 使用。

`integrations/mem0-plugin/` 是 mem0 面向 AI editor / coding agent 的插件包。对 Codex 有两种路径：

- Direct MCP：在 `~/.codex/config.toml` 中配置 `mcp.mem0.ai/mcp` 和 `MEM0_API_KEY`。
- Sideload plugin：通过 Codex plugin marketplace 注册本地 `integrations/mem0-plugin/`，获得 MCP + skills + opt-in hooks。

Codex plugin manifest 声明：

- MCP server：`.codex-mcp.json`
- skills：`./skills/`
- hooks：`./hooks/codex-hooks.json`

Codex hooks 覆盖 `SessionStart`、`UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop`、`PreCompact` 等事件，用于加载上下文、相关记忆检索、metadata enforcement、Bash 输出处理和 session 结束总结。

插件内置 skills 包括 `remember`、`peek`、`tour`、`stats`、`dream`、`pin`、`forget`、`export`、`import`、`memory-reviewer`、`context-loader` 等。

### 7. Benchmark 和项目方声明

README 提到 2026 年 4 月的新 memory algorithm，并列出 LOCOMO、LongMemEval、BEAM 等评测结果，例如 LOCOMO 从 71.4 到 91.6、LongMemEval 从 67.8 到 94.8。README 也说明 evaluation framework 已开源到 `mem0ai/memory-benchmarks`。

这些指标应视为项目方声明；本文没有独立复现 benchmark。

## 优势

- 产品形态完整：SDK、server、cloud、dashboard、CLI、MCP、agent plugin 都有。
- 比单纯 RAG wrapper 更完整：add 时有 LLM extraction、hash dedupe、history、entity linking；search 时有 semantic + BM25 + entity boost + rerank。
- provider 覆盖面广，方便接入不同 LLM、embedding 和 vector database。
- 对 AI 应用开发者友好：Python / TypeScript SDK、托管 API 和 self-host 路径并存。
- 对 coding agent 生态已有实际集成，尤其是 Claude、Cursor、Codex、OpenCode。
- Self-hosted server 具备 dashboard、API key、JWT、request logs、runtime config 等运维面。
- Apache-2.0，适合商业项目评估。

## 风险与限制

- 仓库迭代快、形态多，Python SDK、TypeScript SDK、插件、server、OpenMemory 的版本节奏不完全一致，选型时要锁定具体入口。
- 文档和代码之间可能存在短期不一致。例如 search 文档部分段落仍保留旧式 top-level `user_id` 说法，而当前 Python `search()` 明确要求 entity ids 放进 `filters`。
- 插件默认连接 Mem0 Platform / remote MCP；隐私敏感场景要确认是否能使用 self-hosted 或自定义 MCP 路径。
- add pipeline 会抽取 user 和 assistant 双方信息，治理不当时可能把 assistant 推荐、临时计划或过期偏好固化为未来记忆。
- Self-hosted server 和 library 默认有 telemetry 逻辑，需要按环境确认 `MEM0_TELEMETRY=false` 等配置。
- benchmark 未复现前，不应只凭 README 数字做生产选型。
- 如果和 Codex 原生 memory、ai-memory、TencentDB-Agent-Memory 同时启用，容易出现重复捕获、重复注入和冲突记忆。

## 适用场景

- 构建有个性化需求的 AI 应用，例如客服、教育、陪伴、销售、工作流 agent。
- 需要用户级、session 级、agent 级 memory，并希望通过 SDK/API 管理。
- 希望从本地 SDK 快速试验，再迁移到 self-hosted 或 cloud。
- 需要托管 dashboard、API key、MCP endpoint 和多语言 SDK 的产品团队。
- 希望给 Codex / Claude / Cursor 接入一个远端 semantic memory 服务，并接受 Mem0 Platform 作为记忆后端。

## 不适用场景

- 只想让 Codex 少问重复背景：Codex 原生 memory + `AGENTS.md` 更轻。
- 需要可读 Markdown wiki 作为 source of truth、可 git 审计的跨 agent 项目记忆：ai-memory 更贴合。
- 核心问题是长工具日志、Mermaid offload、token 压缩和 runtime context budget：TencentDB-Agent-Memory 更贴合。
- 不能接受 LLM 自动抽取记忆，或没有明确的 memory 审核/删除/过期机制。
- 不希望引入额外云服务、API key 或数据库运维。

## 关键判断

mem0 是五个项目中最像“AI 应用 memory 基础设施”的项目。它适合被嵌入到产品和 agent 平台里，作为用户记忆、会话记忆、agent 记忆和组织记忆的统一服务。

它和 Codex memory 的关系不是替代，而是外接：Codex 原生 memory 管 Codex 产品内上下文；mem0 可以通过 MCP/plugin/hooks 给 Codex 增加一套可跨客户端、可 API 化的外部语义记忆。它和 ai-memory 的重叠主要在 coding agent 记忆，但 ai-memory 更偏 local-first project wiki，mem0 更偏 cloud/self-host semantic memory platform。它和 MemPalace 都支持 MCP/plugin，但 MemPalace 更偏本地原文 drawers 和 conversation retention，mem0 更偏应用 memory API。它和 TencentDB-Agent-Memory 的差异在于，mem0 更偏应用记忆和检索服务，Tencent 更偏 agent runtime 的分层记忆和上下文 offload。
