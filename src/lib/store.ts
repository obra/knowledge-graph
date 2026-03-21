import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { ParsedNode, ParsedEdge, SearchResult } from './types.js';

export class Store {
  db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    sqliteVec.load(this.db);
    this.createSchema();
  }

  private createSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        frontmatter TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT ''
      );

      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);

      CREATE TABLE IF NOT EXISTS communities (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        node_ids TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS sync (
        path TEXT PRIMARY KEY,
        mtime INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts
        USING fts5(title, content, content='nodes', content_rowid='rowid');

      CREATE VIRTUAL TABLE IF NOT EXISTS nodes_vec
        USING vec0(embedding float[384]);
    `);
  }

  upsertNode(node: ParsedNode): void {
    // FTS5 content-sync tables require manual delete-before-reinsert.
    // We must fetch the ACTUAL old values for the FTS5 delete command.
    const existing = this.db.prepare(
      'SELECT rowid, title, content FROM nodes WHERE id = ?'
    ).get(node.id) as { rowid: number; title: string; content: string } | undefined;

    if (existing) {
      this.db.prepare(
        "INSERT INTO nodes_fts(nodes_fts, rowid, title, content) VALUES('delete', ?, ?, ?)"
      ).run(existing.rowid, existing.title, existing.content);
    }

    this.db.prepare(`
      INSERT INTO nodes (id, title, content, frontmatter)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        content = excluded.content,
        frontmatter = excluded.frontmatter
    `).run(node.id, node.title, node.content, JSON.stringify(node.frontmatter));

    const row = this.db.prepare(
      'SELECT rowid FROM nodes WHERE id = ?'
    ).get(node.id) as { rowid: number };

    this.db.prepare(
      'INSERT INTO nodes_fts(rowid, title, content) VALUES(?, ?, ?)'
    ).run(row.rowid, node.title, node.content);
  }

  getNode(id: string): (ParsedNode & { rowid: number }) | undefined {
    const row = this.db.prepare(
      'SELECT rowid, id, title, content, frontmatter FROM nodes WHERE id = ?'
    ).get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      frontmatter: JSON.parse(row.frontmatter),
      rowid: row.rowid,
    };
  }

  allNodeIds(): string[] {
    return this.db.prepare('SELECT id FROM nodes').all().map((r: any) => r.id);
  }

  insertEdge(edge: ParsedEdge): void {
    this.db.prepare(
      'INSERT INTO edges (source_id, target_id, context) VALUES (?, ?, ?)'
    ).run(edge.sourceId, edge.targetId, edge.context);
  }

  getEdgesFrom(nodeId: string): Array<ParsedEdge & { id: number }> {
    return this.db.prepare(
      'SELECT id, source_id, target_id, context FROM edges WHERE source_id = ?'
    ).all(nodeId).map((r: any) => ({
      id: r.id,
      sourceId: r.source_id,
      targetId: r.target_id,
      context: r.context,
    }));
  }

  getEdgesTo(nodeId: string): Array<ParsedEdge & { id: number }> {
    return this.db.prepare(
      'SELECT id, source_id, target_id, context FROM edges WHERE target_id = ?'
    ).all(nodeId).map((r: any) => ({
      id: r.id,
      sourceId: r.source_id,
      targetId: r.target_id,
      context: r.context,
    }));
  }

  deleteNode(id: string): void {
    // FTS5 delete requires actual old values, not empty strings
    const row = this.db.prepare(
      'SELECT rowid, title, content FROM nodes WHERE id = ?'
    ).get(id) as { rowid: number; title: string; content: string } | undefined;

    if (row) {
      this.db.prepare(
        "INSERT INTO nodes_fts(nodes_fts, rowid, title, content) VALUES('delete', ?, ?, ?)"
      ).run(row.rowid, row.title, row.content);
      // sqlite-vec requires BigInt rowids via better-sqlite3
      this.db.prepare('DELETE FROM nodes_vec WHERE rowid = ?').run(BigInt(row.rowid));
    }

    this.db.prepare('DELETE FROM nodes WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM edges WHERE source_id = ? OR target_id = ?').run(id, id);
    this.db.prepare('DELETE FROM sync WHERE path = ?').run(id);
  }

  deleteAllEdgesFrom(nodeId: string): void {
    this.db.prepare('DELETE FROM edges WHERE source_id = ?').run(nodeId);
  }

  searchFullText(query: string): SearchResult[] {
    return this.db.prepare(`
      SELECT n.id, n.title, rank
      FROM nodes_fts f
      JOIN nodes n ON n.rowid = f.rowid
      WHERE nodes_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `).all(query).map((r: any) => ({
      nodeId: r.id,
      title: r.title,
      score: -r.rank,
      excerpt: '',
    }));
  }

  upsertEmbedding(nodeId: string, embedding: Float32Array): void {
    const node = this.getNode(nodeId);
    if (!node) return;
    // sqlite-vec requires BigInt rowids via better-sqlite3
    this.db.prepare('DELETE FROM nodes_vec WHERE rowid = ?').run(BigInt(node.rowid));
    this.db.prepare(
      'INSERT INTO nodes_vec(rowid, embedding) VALUES (?, ?)'
    ).run(BigInt(node.rowid), Buffer.from(embedding.buffer));
  }

  searchVector(embedding: Float32Array, limit = 20): SearchResult[] {
    return this.db.prepare(`
      SELECT v.rowid, v.distance, n.id, n.title
      FROM nodes_vec v
      JOIN nodes n ON n.rowid = v.rowid
      WHERE embedding MATCH ? AND k = ?
      ORDER BY distance
    `).all(Buffer.from(embedding.buffer), limit).map((r: any) => ({
      nodeId: r.id,
      title: r.title,
      score: 1 - r.distance,
      excerpt: '',
    }));
  }

  upsertSync(path: string, mtime: number): void {
    this.db.prepare(`
      INSERT INTO sync (path, mtime, indexed_at) VALUES (?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET mtime = excluded.mtime, indexed_at = excluded.indexed_at
    `).run(path, mtime, Date.now());
  }

  getSyncMtime(path: string): number | undefined {
    const row = this.db.prepare(
      'SELECT mtime FROM sync WHERE path = ?'
    ).get(path) as { mtime: number } | undefined;
    return row?.mtime;
  }

  getAllSyncPaths(): Set<string> {
    return new Set(
      this.db.prepare('SELECT path FROM sync').all().map((r: any) => r.path)
    );
  }

  upsertCommunity(community: { id: number; label: string; summary: string; nodeIds: string[] }): void {
    this.db.prepare(`
      INSERT INTO communities (id, label, summary, node_ids) VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        summary = excluded.summary,
        node_ids = excluded.node_ids
    `).run(community.id, community.label, community.summary, JSON.stringify(community.nodeIds));
  }

  clearCommunities(): void {
    this.db.prepare('DELETE FROM communities').run();
  }

  getAllCommunities(): Array<{ id: number; label: string; summary: string; nodeIds: string[] }> {
    return this.db.prepare('SELECT * FROM communities').all().map((r: any) => ({
      id: r.id,
      label: r.label,
      summary: r.summary,
      nodeIds: JSON.parse(r.node_ids),
    }));
  }

  close(): void {
    this.db.close();
  }
}
