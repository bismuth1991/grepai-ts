import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { FileReaderError } from './errors'

export class FileReader extends Context.Tag(
  '@grepai/core/domain/file-reader/FileReader',
)<FileReader, {
  read: (input: {
    filePath: string
    offset?: number
    limit?: number
  }) => Effect.Effect<string, FileReaderError, never>
}>() {}
