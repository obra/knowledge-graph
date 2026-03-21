export interface ParsedNode {
  id: string;           // path relative to vault root
  title: string;        // from frontmatter or filename
  content: string;      // full markdown
  frontmatter: Record<string, unknown>;
}

export interface ParsedEdge {
  sourceId: string;
  targetId: string;     // resolved path
  context: string;      // enclosing paragraph
}

export interface StoredNode extends ParsedNode {
  embedding: Float32Array | null;
}

export interface StoredEdge extends ParsedEdge {
  id: number;
}

export interface Community {
  id: number;
  label: string;
  summary: string;
  nodeIds: string[];
}

export interface SearchResult {
  nodeId: string;
  title: string;
  score: number;
  excerpt: string;
}

export interface PathResult {
  nodes: string[];       // ordered node IDs along the path
  edges: Array<{         // edge context for each hop
    sourceId: string;
    targetId: string;
    context: string;
  }>;
  length: number;
}

export interface SubgraphResult {
  nodes: Array<{ id: string; title: string; frontmatter: Record<string, unknown> }>;
  edges: Array<{ sourceId: string; targetId: string; context: string }>;
}

export interface NameMatch {
  nodeId: string;
  title: string;
  matchType: 'exact' | 'case-insensitive' | 'alias' | 'substring';
}
