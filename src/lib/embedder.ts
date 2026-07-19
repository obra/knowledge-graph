import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { firstBodyParagraph } from './text.js';

const MODEL = 'Xenova/all-MiniLM-L6-v2';

export class Embedder {
  private extractor: FeatureExtractionPipeline | null = null;

  async init(): Promise<void> {
    this.extractor = await pipeline('feature-extraction', MODEL, {
      dtype: 'q8',
    }) as FeatureExtractionPipeline;
  }

  async embed(text: string): Promise<Float32Array> {
    if (!this.extractor) throw new Error('Embedder not initialized. Call init() first.');
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true,
    });
    return new Float32Array(output.tolist()[0] as number[]);
  }

  async dispose(): Promise<void> {
    if (this.extractor) {
      await this.extractor.dispose();
      this.extractor = null;
    }
  }

  static buildEmbeddingText(
    title: string,
    tags: string[],
    content: string,
  ): string {
    const firstParagraph = firstBodyParagraph(content).trim();
    const parts = [title];
    if (tags.length > 0) {
      parts.push(tags.join(', '));
    }
    if (firstParagraph) {
      parts.push(firstParagraph);
    }
    return parts.join('\n');
  }
}
