import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'

import { ChunkInsertInput } from './chunk'
import { ChunkerError, TokenCounterError } from './errors'

import { SupportedLanguage } from '.'

export class Chunker extends Context.Tag('@grepai/core/domain/chunker/Chunker')<
  Chunker,
  {
    chunk: (input: {
      filePath: string
      content: string
      language: SupportedLanguage
    }) => Effect.Effect<
      ReadonlyArray<ChunkInsertInput>,
      ChunkerError | TokenCounterError,
      never
    >
  }
>() {}
