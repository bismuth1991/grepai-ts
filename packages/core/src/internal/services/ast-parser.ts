import { FileSystem, Path } from '@effect/platform'
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import Parser from 'tree-sitter'
import Typescrtipt from 'tree-sitter-typescript'

import { AstParserError, LanguageNotSupported } from '../../domain/errors'

export class AstParser extends Effect.Service<AstParser>()(
  '@grepai/core/internal/services/ast-parser/AstParser',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const languageConfig = yield* AstLanguageConfig

      const extractNodesForChunking = Effect.fnUntraced(
        function* (filePath: string) {
          const fileContent = yield* fs.readFileString(filePath)

          const fileExt = yield* Schema.decodeUnknown(LanguageExtension)(
            path.extname(filePath),
          )
          const { language, query } = languageConfig[fileExt]

          return yield* Effect.try({
            try: () => {
              const parser = new Parser()

              parser.reset()
              parser.setLanguage(language)

              const tree = parser.parse(fileContent)
              const parserQuery = new Parser.Query(parser.getLanguage(), query)

              return parserQuery
                .matches(tree.rootNode)
                .map(({ captures }) => captures)
            },
            catch: (cause) => new AstParserError({ cause }),
          })
        },
        Effect.catchTags({
          BadArgument: (cause) => new AstParserError({ cause }),
          SystemError: (cause) => new AstParserError({ cause }),
          ParseError: (cause) => new LanguageNotSupported({ cause }),
        }),
      )

      return {
        extractNodesForChunking,
      }
    }),
  },
) {}

export class AstLanguageConfig extends Effect.Service<AstLanguageConfig>()(
  '@grepai/core/internal/services/ast-parser/AstLanguageConfig',
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      const typescriptQuery = yield* fs.readFileString(
        path.resolve(import.meta.dirname, '../fs/ast-query/typescript.scm'),
      )

      return {
        '.ts': {
          query: typescriptQuery,
          language: Typescrtipt.typescript as Parser.Language,
        },
      } satisfies Record<
        LanguageExtension,
        {
          query: string
          language: Parser.Language
        }
      >
    }),
  },
) {}

const LanguageExtension = Schema.Literal('.ts')
type LanguageExtension = typeof LanguageExtension.Type
