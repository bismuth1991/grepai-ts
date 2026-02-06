import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import {
  CodebaseScannerError,
  DocumentStorageError,
  SchemaValidationFailed,
} from './errors'

import { SupportedLanguage } from '.'

type File = {
  filePath: string
  content: string
  hash: string
  language: SupportedLanguage
}

export class CodebaseScanner extends Context.Tag(
  '@grepai/core/domain/codebase-scanner/CodebaseScanner',
)<
  CodebaseScanner,
  {
    scan: () => Effect.Effect<
      {
        new: ReadonlyArray<File>
        unchanged: ReadonlyArray<File>
        modified: ReadonlyArray<File>
        deleted: ReadonlyArray<Pick<File, 'filePath' | 'hash'>>
      },
      CodebaseScannerError | DocumentStorageError | SchemaValidationFailed,
      never
    >
  }
>() {}
