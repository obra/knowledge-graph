import type { Store } from './store.js';
import type { Embedder } from './embedder.js';
import type { SearchResult } from './types.js';

export class Search {
  constructor(
    private store: Store,
    private embedder: Embedder,
  ) {}

  async semantic(query: string, limit = 20): Promise<SearchResult[]> {
    const queryEmbedding = await this.embedder.embed(query);
    return this.store.searchVector(queryEmbedding, limit);
  }

  fulltext(query: string, limit = 20): SearchResult[] {
    return this.store.searchFullText(query).slice(0, limit);
  }
}
