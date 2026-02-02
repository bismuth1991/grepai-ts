import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { ImportExtractorError } from './errors'

import { SupportedLanguage } from '.'

export class ImportExtractor extends Context.Tag(
  '@grepai/core/domain/import-extractor/ImportExtractor',
)<
  ImportExtractor,
  {
    extract: (input: {
      content: string
      language: SupportedLanguage
    }) => Effect.Effect<ReadonlyArray<string>, ImportExtractorError, never>
  }
>() {}
