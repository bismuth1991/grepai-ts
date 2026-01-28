import * as Schema from 'effect/Schema'

export const Chunk = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  filePath: Schema.String,
  startLine: Schema.Number,
  endLine: Schema.Number,
  content: Schema.String,
  vector: Schema.Array(Schema.Number),
  hash: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})
export type Chunk = typeof Chunk.Type
