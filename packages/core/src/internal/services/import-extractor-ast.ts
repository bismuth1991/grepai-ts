import { FileSystem, Path } from '@effect/platform'
import * as Array from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'

import { SupportedLanguage } from '../../domain'
import { ImportExtractorError } from '../../domain/errors'
import { ImportExtractor } from '../../domain/import-extractor'

import { AstParser } from './ast-parser-v2'

export const ImportExtractorAst = Layer.effect(
  ImportExtractor,
  Effect.gen(function* () {
    const parser = yield* AstParser
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    return ImportExtractor.of({
      extract: Effect.fnUntraced(
        function* ({ content, language }) {
          const query = yield* fs.readFileString(
            path.resolve(import.meta.dirname, languageQueryPathMap[language]),
          )
          return yield* parser
            .parse({ content, language, query })
            .pipe(
              Effect.map(Array.map(Array.map((capture) => capture.node.text))),
              Effect.map(Array.flatten),
              Effect.map(Array.dedupe),
              Effect.flatMap(Schema.decode(Schema.Array(Schema.String))),
            )
        },
        Effect.catchTags({
          AstParserError: (cause) => new ImportExtractorError({ cause }),
          ParseError: (cause) => new ImportExtractorError({ cause }),
          BadArgument: (cause) => new ImportExtractorError({ cause }),
          SystemError: (cause) => new ImportExtractorError({ cause }),
        }),
      ),
    })
  }),
)

const languageQueryPathMap = {
  typescript: '../fs/ast-query/import-extractor-typescript.scm',
  tsx: '../fs/ast-query/import-extractor-typescript.scm',
} satisfies Record<SupportedLanguage, string>
