/**
 * Returns the first non-empty, non-heading paragraph in `content`.
 *
 * `gray-matter` leaves a leading newline after stripping the YAML
 * frontmatter, so the first paragraph from a naive `split('\n\n')` is often
 * `'\n# Title'` — which only looks like a heading once trimmed. Trimming
 * before the `#` check ensures the title line is correctly skipped in
 * favor of the actual body text.
 */
export function firstBodyParagraph(content: string): string {
  return (
    content.split(/\n\n+/).find(p => p.trim().length > 0 && !p.trim().startsWith('#')) ?? ''
  );
}
