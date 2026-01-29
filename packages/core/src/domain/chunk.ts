import * as Schema from 'effect/Schema'

import { Embedding } from './embedding'

export const Chunk = Schema.Struct({
  id: Schema.Number,
  chunkId: Schema.String,
  filePath: Schema.String,
  startLine: Schema.Number,
  endLine: Schema.Number,
  content: Schema.String,
  embedding: Embedding,
  hash: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})
export type Chunk = typeof Chunk.Type

export const ChunkInsertInput = Chunk.pipe(
  Schema.omit('id', 'createdAt', 'updatedAt'),
)
export type ChunkInsertInput = typeof ChunkInsertInput.Encoded
