import * as Schema from 'effect/Schema'

import { Embedding } from './embedding'

export const ChunkEmbeddingInsertInput = Schema.Struct({
  chunkId: Schema.String,
  embedding: Embedding,
})
export type ChunkEmbeddingInsertInput = typeof ChunkEmbeddingInsertInput.Encoded

export const ChunkSearchResult = Schema.Struct({
  filePath: Schema.String,
  startLine: Schema.Number,
  endLine: Schema.Number,
})
export type ChunkSearchResult = typeof ChunkSearchResult.Type

export const ChunkInsertInput = Schema.Struct({
  id: Schema.String,
  filePath: Schema.String,
  startLine: Schema.Number,
  endLine: Schema.Number,
  content: Schema.String,
})
export type ChunkInsertInput = typeof ChunkInsertInput.Type
