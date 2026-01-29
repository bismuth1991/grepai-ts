import * as Schema from 'effect/Schema'

export const Document = Schema.Struct({
  id: Schema.Number,
  filePath: Schema.String,
  hash: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
})
export type Document = typeof Document.Type
