# knowledge-graph

Query and traverse an Obsidian vault as a knowledge graph. Semantic search, path finding, community detection, and graph analysis — all local, no cloud APIs.

## What it does

Parses an Obsidian vault into an untyped graph (files = nodes, wiki links = edges), indexes it into SQLite with vector embeddings and full-text search, and exposes 10 operations via CLI and MCP server.

**Search:** Semantic search via local embeddings, full-text keyword search via FTS5.

**Traverse:** Find paths between nodes, shared connections, N-hop neighborhoods, local subgraphs.

**Analyze:** Community detection (Louvain), bridge nodes (betweenness centrality), central nodes (PageRank).

## Install

```bash
git clone https://github.com/obra/knowledge-graph.git
cd knowledge-graph
npm install
```

Set your vault path:

```bash
export KG_VAULT_PATH=/path/to/your/obsidian/vault
```

Optionally set the data directory (defaults to `~/.local/share/knowledge-graph`):

```bash
export KG_DATA_DIR=/path/to/data
```

## CLI usage

Index your vault (first run downloads a 22MB embedding model):

```bash
npx tsx src/cli/index.ts index
```

Then query:

```bash
# Look up a node (brief mode — metadata + connections)
npx tsx src/cli/index.ts node "Alice Smith"

# Full content + edge context
npx tsx src/cli/index.ts node "Alice Smith" --full

# Semantic search
npx tsx src/cli/index.ts search "distributed systems framework"

# Full-text keyword search
npx tsx src/cli/index.ts search "distributed systems" --fulltext

# Find paths between two nodes
npx tsx src/cli/index.ts paths "Alice Smith" "Widget Theory"

# Shared connections
npx tsx src/cli/index.ts common "Alice Smith" "Bob Jones"

# Local neighborhood
npx tsx src/cli/index.ts neighbors "Alice Smith" --depth 2

# Subgraph extraction
npx tsx src/cli/index.ts subgraph "Widget Theory" --depth 1

# Community detection
npx tsx src/cli/index.ts communities

# Bridge nodes (connectors between clusters)
npx tsx src/cli/index.ts bridges --limit 10

# Central nodes (PageRank)
npx tsx src/cli/index.ts central --limit 10
```

All commands return JSON. Names are fuzzy-matched (title, aliases, substring). You can also pass full node IDs (file paths).

## Claude Code plugin

This repo is also a Claude Code plugin. Add it to your plugins and the MCP server starts automatically, exposing all 10 operations as tools (`kg_node`, `kg_search`, `kg_paths`, etc.).

The `prove-claim` skill teaches the agent a structured workflow for investigating claims: decompose into entities, find them via search, trace connections via path traversal, read the evidence, assess and report with citations.

No LLM inside the tool — the agent does the reasoning, the tool provides the data infrastructure.

## How it works

- **Parser:** Walks the vault for `.md` files, extracts YAML frontmatter (via gray-matter), wiki links, inline `#tags`, and enclosing paragraphs as edge context. Handles malformed YAML gracefully.
- **Store:** SQLite with sqlite-vec for vector search and FTS5 for full-text search. Single file database.
- **Embedder:** `Xenova/all-MiniLM-L6-v2` via @huggingface/transformers. Runs locally, 22MB quantized model, 384-dimensional embeddings computed from title + tags + first paragraph.
- **Graph:** graphology for in-memory graph algorithms — Louvain community detection, betweenness centrality, PageRank (with degree centrality fallback for disconnected graphs), BFS traversal, all-simple-paths via DFS.
- **Indexing:** Incremental by default — tracks file mtimes, only reprocesses changed files. Community detection re-runs on the full graph. Use `--force` for a full rebuild.

## Tech stack

| Role | Package |
|------|---------|
| Graph algorithms | graphology |
| Persistence | better-sqlite3 |
| Vector search | sqlite-vec |
| Full-text search | SQLite FTS5 |
| Embeddings | @huggingface/transformers |
| MCP server | @modelcontextprotocol/sdk |
| Tests | vitest (76 tests) |

## Known quirks

- **sqlite-vec requires BigInt rowids** when used with better-sqlite3.
- **sqlite-vec KNN queries** use `WHERE embedding MATCH ? AND k = ?`, not `LIMIT`.
- **PageRank** may fail to converge on large graphs with many disconnected components. Falls back to degree centrality automatically.
- **Wiki link resolution** uses Obsidian's "shortest unique path" algorithm. Ambiguous links (same filename in multiple directories) resolve to the first match with a warning.

## License

MIT
