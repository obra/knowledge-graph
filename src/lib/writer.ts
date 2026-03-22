import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';
import type { Store } from './store.js';

export interface CreateNodeOptions {
  title: string;
  directory?: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export class VaultWriter {
  constructor(
    private vaultPath: string,
    private store: Store,
  ) {}

  createNode(opts: CreateNodeOptions): string {
    const dir = opts.directory
      ? join(this.vaultPath, opts.directory)
      : this.vaultPath;
    mkdirSync(dir, { recursive: true });

    const filename = `${opts.title}.md`;
    const relPath = opts.directory ? `${opts.directory}/${filename}` : filename;
    const absPath = join(dir, filename);

    if (existsSync(absPath)) {
      throw new Error(`File already exists: ${relPath}`);
    }

    const fm = { title: opts.title, ...opts.frontmatter };
    const fileContent = matter.stringify(opts.content, fm);
    writeFileSync(absPath, fileContent, 'utf-8');

    // Index in store
    this.indexFile(relPath);

    return relPath;
  }

  annotateNode(nodeId: string, content: string): void {
    const absPath = join(this.vaultPath, nodeId);
    if (!existsSync(absPath)) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    appendFileSync(absPath, content, 'utf-8');

    // Re-index
    this.indexFile(nodeId);
  }

  addLink(sourceId: string, targetRef: string, context: string): void {
    const absPath = join(this.vaultPath, sourceId);
    if (!existsSync(absPath)) {
      throw new Error(`Source node not found: ${sourceId}`);
    }

    const line = `\n${context} [[${targetRef}]]`;
    appendFileSync(absPath, line, 'utf-8');

    // Re-index source node
    this.indexFile(sourceId);

    // Add edge to store
    const targetId = targetRef.endsWith('.md') ? targetRef : targetRef + '.md';
    this.store.insertEdge({
      sourceId,
      targetId,
      context,
    });
  }

  private indexFile(relPath: string): void {
    const absPath = join(this.vaultPath, relPath);
    const raw = readFileSync(absPath, 'utf-8');

    let fm: Record<string, unknown>;
    let content: string;
    try {
      const parsed = matter(raw);
      fm = parsed.data;
      content = parsed.content;
    } catch {
      fm = {};
      content = raw;
    }

    const title = (fm.title as string) ?? basename(relPath, '.md');

    this.store.upsertNode({
      id: relPath,
      title,
      content,
      frontmatter: fm,
    });
  }
}
