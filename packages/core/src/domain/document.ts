import * as Schema from 'effect/Schema'

export const Document = Schema.Struct({
  filePath: Schema.String,
  projectId: Schema.String,
  hash: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})
export type Document = typeof Document.Type
