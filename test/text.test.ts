import { describe, it, expect } from 'vitest';
import { firstBodyParagraph } from '../src/lib/text.js';

describe('firstBodyParagraph', () => {
  it('returns the first non-empty, non-heading paragraph', () => {
    const content = '# Title\n\nFirst body paragraph.\n\nSecond paragraph.';
    expect(firstBodyParagraph(content)).toBe('First body paragraph.');
  });

  it('skips a leading heading even when preceded by a stray newline', () => {
    // gray-matter leaves a leading newline after stripping YAML frontmatter,
    // so the first split segment is '\n# Title', not '# Title'.
    const content = '\n# Title\n\nFirst body paragraph.\n\n## Section';
    expect(firstBodyParagraph(content)).toBe('First body paragraph.');
  });

  it('returns empty string when content has no body paragraph', () => {
    expect(firstBodyParagraph('\n# Title Only')).toBe('');
    expect(firstBodyParagraph('')).toBe('');
  });
});
