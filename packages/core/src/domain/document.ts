import * as Schema from 'effect/Schema'

export const Document = Schema.Struct({
  filePath: Schema.String,
  hash: Schema.String,
  createdAt: Schema.Union(Schema.Date, Schema.DateFromSelf),
  updatedAt: Schema.Union(Schema.Date, Schema.DateFromSelf),
})
export type Document = typeof Document.Type
export type DocumentInsertInput = Omit<Document, 'createdAt' | 'updatedAt'>
