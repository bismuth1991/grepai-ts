import * as Effect from 'effect/Effect'

export class EmbeddingNormalizer extends Effect.Service<EmbeddingNormalizer>()(
  '@grepai/core/internal/services/embedding-normalizer/EmbeddingNormalizer',
  {
    sync: () => ({
      normalize: (embedding: Array<number>) => {
        const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
        const normalized = embedding.map((v) => v / norm)

        return {
          norm,
          normalized,
        }
      },
    }),
  },
) {}
