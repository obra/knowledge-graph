import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Store } from '../src/lib/store.js';
import { resolveNodeName } from '../src/lib/resolve.js';

describe('resolveNodeName', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store(':memory:');
    store.upsertNode({
      id: 'People/Alice Smith.md', title: 'Alice Smith',
      content: '', frontmatter: { aliases: ['A. Smith'] },
    });
    store.upsertNode({
      id: 'Concepts/Widget Theory.md', title: 'Widget Theory',
      content: '', frontmatter: { aliases: ['Widget Framework', 'WT'] },
    });
  });

  afterEach(() => store.close());

  it('matches exact title', () => {
    const matches = resolveNodeName('Alice Smith', store);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('exact');
  });

  it('matches case-insensitively', () => {
    const matches = resolveNodeName('alice smith', store);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('case-insensitive');
  });

  it('matches aliases', () => {
    const matches = resolveNodeName('WT', store);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('alias');
    expect(matches[0].nodeId).toBe('Concepts/Widget Theory.md');
  });

  it('matches substrings', () => {
    const matches = resolveNodeName('Widget', store);
    expect(matches).toHaveLength(1);
    expect(matches[0].matchType).toBe('substring');
  });

  it('returns empty for no match', () => {
    const matches = resolveNodeName('Nonexistent', store);
    expect(matches).toHaveLength(0);
  });

  it('prefers exact over case-insensitive', () => {
    const matches = resolveNodeName('Alice Smith', store);
    expect(matches[0].matchType).toBe('exact');
  });
});
