import type { Store } from './store.js';
import type { NameMatch } from './types.js';

export function resolveNodeName(name: string, store: Store): NameMatch[] {
  const allNodes = store.db.prepare(
    'SELECT id, title, frontmatter FROM nodes'
  ).all() as Array<{ id: string; title: string; frontmatter: string }>;

  // Priority 1: exact title match
  const exact = allNodes.filter(n => n.title === name);
  if (exact.length > 0) {
    return exact.map(n => ({ nodeId: n.id, title: n.title, matchType: 'exact' as const }));
  }

  // Priority 2: case-insensitive title match
  const lower = name.toLowerCase();
  const caseInsensitive = allNodes.filter(n => n.title.toLowerCase() === lower);
  if (caseInsensitive.length > 0) {
    return caseInsensitive.map(n => ({
      nodeId: n.id, title: n.title, matchType: 'case-insensitive' as const,
    }));
  }

  // Priority 3: alias match
  const aliasMatches: NameMatch[] = [];
  for (const n of allNodes) {
    const fm = JSON.parse(n.frontmatter);
    const aliases: string[] = fm.aliases ?? [];
    if (aliases.some(a => a.toLowerCase() === lower)) {
      aliasMatches.push({ nodeId: n.id, title: n.title, matchType: 'alias' });
    }
  }
  if (aliasMatches.length > 0) return aliasMatches;

  // Priority 4: substring match on title
  const substring = allNodes.filter(n => n.title.toLowerCase().includes(lower));
  return substring.map(n => ({
    nodeId: n.id, title: n.title, matchType: 'substring' as const,
  }));
}
