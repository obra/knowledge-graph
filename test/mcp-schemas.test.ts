import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toJSONSchema } from 'zod/v4-mini';

/**
 * Regression test for https://github.com/obra/knowledge-graph/issues/2
 *
 * Zod v4's toJSONSchema() crashes on z.record(z.unknown()) because
 * z.unknown() lacks the _zod metadata the serializer expects.
 * The MCP SDK calls toJSONSchema() on every tool schema during
 * tools/list, so this crash silently hides all tools from clients.
 */
describe('MCP tool schema serialization', () => {
  it('kg_create_node frontmatter schema serializes to JSON Schema', () => {
    // This is the exact schema used by kg_create_node in src/mcp/index.ts.
    // The original z.record(z.unknown()) crashed toJSONSchema in Zod v4.
    const schema = z.object({
      title: z.string(),
      directory: z.string().optional(),
      content: z.string(),
      frontmatter: z.record(z.string(), z.any()).optional(),
    });

    const jsonSchema = toJSONSchema(schema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toHaveProperty('frontmatter');
  });

  it('z.record(z.unknown()) would crash toJSONSchema (documents the bug)', () => {
    const brokenSchema = z.object({
      field: z.record(z.unknown()).optional(),
    });

    // This is the actual Zod v4 bug — z.unknown() lacks _zod metadata.
    // If this test starts passing, the upstream bug is fixed and the
    // workaround in index.ts could be reverted (but z.any() is fine too).
    expect(() => toJSONSchema(brokenSchema)).toThrow();
  });
});
