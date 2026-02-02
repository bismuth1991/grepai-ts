import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { ExportExtractorError } from './errors'

import { SupportedLanguage } from '.'

export class ExportExtractor extends Context.Tag(
  '@grepai/core/domain/export-extractor/ExportExtractor',
)<
  ExportExtractor,
  {
    extract: (input: {
      content: string
      language: SupportedLanguage
    }) => Effect.Effect<ReadonlyArray<string>, ExportExtractorError, never>
  }
>() {}
