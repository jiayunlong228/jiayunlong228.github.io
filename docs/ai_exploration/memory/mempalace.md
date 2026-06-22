# MemPalace/mempalace 调研

调研日期：2026-06-19  
仓库：<https://github.com/MemPalace/mempalace>  
项目主页/文档：<https://mempalaceofficial.com>  
PyPI：<https://pypi.org/project/mempalace/>  
调研方式：GitHub REST API 在调研中途触发 rate limit，`git clone --depth 1` 因网络 sideband disconnect 中断；本文结合已取得的 GitHub 元数据、`git ls-remote`、PyPI `mempalace==3.4.1` wheel 解包源码、GitHub raw 单文件和 changelog 完成调研。  
GitHub 默认分支：`develop`  
GitHub `HEAD/develop` 快照：`afa749c141e60cf9c797c602f0d667e722fa0a75`  
最新 release/tag：`v3.4.1`，tag/main sha `bc9c052b512e47123465e65c68b3ebe378985641`，GitHub release 发布时间 2026-06-15  
PyPI package：`mempalace==3.4.1`

## 信息源

- GitHub API：<https://api.github.com/repos/MemPalace/mempalace>
- GitHub 仓库：<https://github.com/MemPalace/mempalace>
- PyPI JSON：<https://pypi.org/pypi/mempalace/json>
- PyPI wheel：`mempalace-3.4.1-py3-none-any.whl`
- 包内 README/METADATA：`external/mempalace-pypi-3.4.1/mempalace/README.md`、`external/mempalace-pypi-3.4.1/mempalace-3.4.1.dist-info/METADATA`
- 项目指导文档：`CLAUDE.md`
- 核心模块：`mempalace/cli.py`、`mempalace/mcp_server.py`、`mempalace/miner.py`、`mempalace/convo_miner.py`、`mempalace/searcher.py`
- 存储抽象：`mempalace/backends/base.py`
- 配置：`mempalace/config.py`
- 分层上下文：`mempalace/layers.py`
- 知识图谱：`mempalace/knowledge_graph.py`
- 图导航：`mempalace/palace_graph.py`、`mempalace/hallways.py`
- AAAK 指针层：`mempalace/dialect.py`
- embedding：`mempalace/embedding.py`
- 查询净化：`mempalace/query_sanitizer.py`
- Codex plugin manifest：<https://github.com/MemPalace/mempalace/blob/develop/.codex-plugin/plugin.json>
- changelog：<https://github.com/MemPalace/mempalace/blob/develop/CHANGELOG.md>

## 项目定位

MemPalace 是一个 local-first 的 AI memory 系统，目标是把项目文件、对话记录、文档和 agent diary 按“记忆宫殿”结构组织起来，并通过 CLI / MCP / hooks 给 AI coding tools 检索。它最核心的设计主张是：

- 原文保存：conversation/project 内容以 verbatim drawer 保存，不依赖摘要作为真相源。
- 本地优先：默认 ChromaDB 本地存储，SQLite 本地知识图谱；核心路径不需要 API key。
- 可检索：用向量检索、BM25、closet 指针、知识图谱、hallways/tunnels 组织召回。
- 多工具接入：提供 `mempalace` CLI、`mempalace-mcp` server、Claude/Codex/Cursor/Antigravity plugin 与 hooks。

一句话：MemPalace 是“本地原文记忆宫殿 + MCP 工具 + auto-save hooks”，比 ai-memory 更偏 ChromaDB/原文抽屉和图导航，而不是 Markdown wiki；比 mem0 更偏 local-first 和 verbatim retrieval，而不是云端/SDK/API 平台。

## GitHub / 版本快照

- 创建时间：2026-04-05。
- GitHub API 快照：55971 stars，7246 forks，578 open issues。
- 语言：Python 为主，另有 Shell、HTML、CSS、Vue、JavaScript、TypeScript、Dockerfile。
- LICENSE：MIT。
- topics：`ai`、`chromadb`、`llm`、`mcp`、`memory`、`python`。
- PyPI classifier：Development Status 为 Beta，Python 3.9 到 3.14。
- CLI entry points：`mempalace = mempalace.cli:main`，`mempalace-mcp = mempalace.mcp_server:main`。
- backend entry points：`chroma`、`pgvector`、`qdrant`、`sqlite_exact`。

这个项目创建时间很新但 star/fork 极高，且 open issues 较多。选型时建议把 popularity 当作信号之一，而不是稳定性证明。

## 核心概念

MemPalace 把记忆组织成几层隐喻结构：

- Palace：整套本地 memory store。
- Wing：顶层分区，通常是人、项目、主题或 agent。
- Room：wing 内的主题/时间/文件夹/会话分组。
- Drawer：保存原文 chunk，是主要真相载体。
- Closet：AAAK / pointer 层，用 compact symbolic index 指向 drawer。
- Hallway：同一 wing 内实体共现关系。
- Tunnel：跨 wing 的连接。
- Knowledge graph：SQLite 中的实体-关系-时间有效性图谱。

项目文档反复强调 drawer 是 verbatim content，AAAK 不是无损压缩，而是一个指针/索引层；需要精确信息时回到 drawer 读原文。

## 架构拆解

### 1. CLI / MCP / 本地存储

MemPalace 的主入口是 CLI 和 MCP server：

- CLI：`mempalace init/mine/search/wake-up/status/mcp/repair/sweep/sync/hook/instructions` 等。
- MCP：`mempalace-mcp`，面向 Claude Code、Codex、Cursor 等客户端暴露工具。
- 默认存储：ChromaDB palace collection `mempalace_drawers`。
- 知识图谱：SQLite `~/.mempalace/knowledge_graph.sqlite3`。
- 默认 palace path：`~/.mempalace/palace`。

PyPI wheel 中的 `mempalace/README.md` 列出了核心模块：`miner.py`、`convo_miner.py`、`searcher.py`、`layers.py`、`dialect.py`、`knowledge_graph.py`、`palace_graph.py`、`mcp_server.py`、`onboarding.py`、`entity_registry.py` 等。

### 2. Ingest / mining

`mempalace mine` 有三类主要模式：

- `projects`：挖项目文件、代码、notes，默认 readable extensions 包括 `.txt/.md/.py/.js/.ts/.json/.jsonl/.yaml/.html/.css/.java/.go/.rs/.rb/.sh/.csv/.sql/.toml`。
- `convos`：挖 Claude Code、Claude.ai、ChatGPT、Slack、plain text 等对话导出。
- `extract`：挖 PDF、DOCX、PPTX、XLSX、RTF、EPUB，需要 `mempalace[extract]`。

项目文件 miner 的策略是读取 `mempalace.yaml`，按 wing/room 路由，按 paragraph chunking，存入 ChromaDB。conversation miner 会先 normalize，再按 exchange pair（用户 turn + AI response）切 chunk，尽量保留对话结构。

几个工程细节值得注意：

- 文件大小上限默认 500 MB，适合大 transcript。
- chunk 默认 800 chars，overlap 100，min chunk 50。
- 对已经 mined 的文件有 sentinel / deterministic ID / idempotent 路径。
- 使用 mine lock / palace lock 避免并发写入。
- `.git`、`node_modules`、`.venv`、build/cache 等目录默认跳过。

### 3. Search / retrieval

`searcher.py` 明确写着 hybrid search：BM25 keyword matching + vector semantic similarity。核心逻辑包括：

- 对 query tokenize，计算候选文档 BM25。
- 从 vector backend 获得距离，再按 metric 映射为 similarity。
- 用 `vector_weight=0.6`、`bm25_weight=0.4` 做混合排序。
- closet hits 是 ranking signal，不是 gate，避免弱摘要层隐藏原文 drawer。
- 支持 wing/room filter。
- 返回 verbatim drawer content 和 similarity / BM25 等信号。

`query_sanitizer.py` 还专门处理 agent 把系统提示词拼进 search query 的问题：短 query 直接通过，长 query 尝试抽取问题、尾句或尾部截断，避免 embedding 被 system prompt 污染。源码注释称未净化会导致检索 R@10 从 89.8% 掉到 1.0%，净化后至少可恢复到 70%-80% 级别；这些数字属于项目方注释，本文未复现。

### 4. Storage backend

`backends/base.py` 定义了 typed backend contract：

- `BaseCollection` / `BaseBackend`
- `QueryResult` / `GetResult`
- `PalaceRef`
- backend errors、health status、maintenance result
- embedder identity / dimension mismatch 检查

当前 package 暴露的 backend entry points：

- `chroma`：默认本地 ChromaDB。
- `sqlite_exact`：本地 exact-vector correctness checks。
- `qdrant`：REST backend。
- `pgvector`：Postgres/pgvector backend，需要可选依赖 `mempalace[pgvector]`。

README 明确提醒：当 Qdrant/pgvector 指向非本地或非可信服务时，MemPalace 会把 verbatim drawer text 和 metadata 发往并存储到该服务；这是显式 opt-in backend 选择，不是默认行为。

### 5. Knowledge graph / graph navigation

`knowledge_graph.py` 使用 SQLite 存实体和 triples：

- entities：name、type、properties。
- triples：subject、predicate、object、valid_from、valid_to、confidence、source_closet、source_file、source_drawer_id、adapter_name。
- 支持 `as_of` temporal query 和 invalidate。

`palace_graph.py` 则从 palace metadata 构建 room 图：

- 节点是 rooms。
- edges 是跨 wing 的 shared rooms / tunnels。
- 支持 BFS traversal。
- 另有 hallways / tunnels 用于 within-wing 和 cross-wing 的实体连接。

这让 MemPalace 不只是“搜向量”，而是把本地原文、实体、时间和跨项目连接组织成可导航结构。

### 6. Layered wake-up

`layers.py` 定义了 4 层 memory stack：

- L0 identity：读取 `~/.mempalace/identity.txt`。
- L1 essential story：从 palace 中取高重要性/近期 drawer，生成 compact wake-up。
- L2 on-demand：按 wing/room 过滤读取。
- L3 deep search：完整 semantic search。

项目注释估算 L0+L1 wake-up 大约 600-900 tokens，目标是只唤醒必要上下文，而不是全量塞入。

### 7. MCP tool surface

`mcp_server.py` 中当前工具面约 33 个，覆盖：

- 状态/浏览：`mempalace_status`、`mempalace_list_wings`、`mempalace_list_rooms`、`mempalace_get_taxonomy`
- 检索：`mempalace_search`、`mempalace_get_drawer`、`mempalace_list_drawers`
- 写入：`mempalace_add_drawer`、`mempalace_update_drawer`、`mempalace_delete_drawer`
- mining：`mempalace_mine`、`mempalace_sync`
- 知识图谱：`mempalace_kg_query`、`mempalace_kg_add`、`mempalace_kg_invalidate`、`mempalace_kg_timeline`、`mempalace_kg_stats`
- 图导航：`mempalace_traverse`、`mempalace_find_tunnels`、`mempalace_create_tunnel`、`mempalace_list_tunnels`、`mempalace_follow_tunnels`、`mempalace_list_hallways`
- agent diary：`mempalace_diary_write`、`mempalace_diary_read`
- hooks/settings：`mempalace_hook_settings`、`mempalace_memories_filed_away`、`mempalace_reconnect`

Codex plugin manifest 显示它直接声明：

- `mcpServers.mempalace.command = "mempalace-mcp"`
- `skills = "./skills/"`
- `hooks = "./hooks.json"`
- plugin description：33 MCP tools、auto-save hooks、guided setup。

### 8. Embedding 和 LLM

默认 embedding 相关信息：

- 新安装 onboarding 默认推荐 `embeddinggemma-300m` ONNX，约 300 MB，支持 100+ 语言，384 维。
- 另一个选项是 ChromaDB/MiniLM 形态，英文优先，约 30 MB。
- 支持 `MEMPALACE_EMBEDDING_DEVICE=auto|cpu|cuda|coreml|dml`，可选 GPU/CoreML/DirectML 加速。
- 切换 embedding model 后需要 `mempalace repair rebuild-index`。

LLM 不是核心路径必需：

- 默认 local Ollama provider。
- 支持 OpenAI-compatible endpoint。
- 支持 Anthropic opt-in。
- 使用外部 endpoint 时有 privacy warning / external-service heuristic。

### 9. Benchmark 声明

README/METADATA 提到：

- LongMemEval raw semantic search R@5：96.6%，500 questions，不需要 LLM。
- LongMemEval hybrid v4 held-out 450q R@5：98.4%。
- Hybrid + LLM rerank：>=99%。
- LoCoMo session top-10 no rerank：60.3%。
- LoCoMo hybrid v5 top-10 no rerank：88.9%。
- ConvoMem avg recall：92.9%。
- MemBench R@5：80.3%。

README 也主动说明不做与 Mem0、Mastra、Hindsight、Supermemory、Zep 的横向表格，因为指标和 split 不同。本文没有复现这些 benchmark，应视为项目方公开声明。

## 优势

- local-first 和 no API key required 是非常清晰的产品边界。
- 原文 drawer 作为主要真相源，比 LLM 摘要型 memory 更容易审计和纠错。
- 支持 project files、conversation exports、binary documents 三类 ingest。
- MCP 工具面很丰富，覆盖读、写、挖掘、图谱、diary、hook settings。
- 对 Codex/Claude/Cursor/Antigravity 生态有直接插件和 hooks 设计。
- 检索不是单纯向量库：BM25 + vector + closet pointer + wing/room + KG/tunnels 组合。
- backend contract 正在抽象化，已支持 Chroma、Qdrant、pgvector、sqlite_exact。
- 对隐私路径说得很明确：默认本地；外部 backend / LLM 是显式选择。

## 风险与限制

- 项目非常新，但 star/fork/open issues 极高；需要谨慎看待成熟度和社区信号。
- GitHub API 元数据中的默认分支是 `develop`，而 release/tag 在 `main`，评估时要明确读取哪条线。
- 核心依赖 ChromaDB / embedding model / ONNX runtime，安装和运行环境比纯 Markdown wiki 更重。
- 默认 embeddinggemma 首次使用要下载约 300 MB 模型；离线环境需提前准备。
- 原文全量保存意味着本地磁盘、隐私、备份和删除策略更重要。
- hook 自动保存 conversation transcript 很有价值，但也可能捕获不希望保存的敏感对话，需要配置 `hooks.auto_save` 或 kill switch。
- benchmark 未复现前，不应只凭 README 数字做生产结论。
- 与 Codex memory、ai-memory、mem0 同时启用时，很容易重复捕获和重复注入。

## 适用场景

- 想把 Claude Code / Codex / Cursor 对话长期保存到本地并可检索。
- 希望 AI 能查到原文，而不是只看摘要。
- 希望把项目文件、历史对话、agent diary、知识图谱放在一套本地 memory palace 中。
- 隐私优先，不希望默认把记忆交给云端服务。
- 需要 MCP 工具面让 agent 主动 search/read/add/mine。

## 不适用场景

- 只想让 Codex 记住少量个人偏好：Codex 原生 memory 更轻。
- 需要团队可编辑、git 可审计的 Markdown wiki source of truth：ai-memory 更贴合。
- 需要面向产品用户的托管 API / SDK / dashboard memory 服务：mem0 更贴合。
- 主要问题是 agent runtime token/offload、Mermaid 符号图、L0-L3 pipeline：TencentDB-Agent-Memory 更贴合。
- 不想维护 ChromaDB/embedding model/repair/rebuild-index 这类本地检索栈。

## 关键判断

MemPalace 是五个项目中最鲜明的“local-first verbatim memory palace”。它和 ai-memory 一样服务跨 agent / coding workflow，但 ai-memory 的真相源是 Markdown wiki + SQLite 派生索引，MemPalace 的真相源是本地 drawer 原文 + ChromaDB/SQLite 图结构。它和 mem0 都有 MCP/plugin 能力，但 mem0 更偏应用 memory SDK/API/platform，MemPalace 更偏个人/本地原文记忆和 conversation retention。它和 TencentDB-Agent-Memory 都强调分层召回，但 Tencent 更靠近 agent runtime offload，MemPalace 更靠近本地检索和原文归档。
