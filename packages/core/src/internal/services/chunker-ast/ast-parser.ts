import { Path } from '@effect/platform'
import * as Effect from 'effect/Effect'
import { Parser, Language } from 'web-tree-sitter'

import { SupportedLanguage } from '../../../domain'
import { AstParserError } from '../../../domain/errors'

export class AstParser extends Effect.Service<AstParser>()(
  '@grepai/core/internal/services/chunker-ast/ast-parser/AstParser',
  {
    effect: Effect.gen(function* () {
      const path = yield* Path.Path

      yield* Effect.tryPromise({
        try: Parser.init,
        catch: (cause) => new AstParserError({ cause }),
      })

      const languageCache: Map<SupportedLanguage, Language> = new Map()

      const load = Effect.fnUntraced(function* (language: SupportedLanguage) {
        return yield* Effect.tryPromise({
          try: async () => {
            if (!languageCache.has(language)) {
              const languageModule = await Language.load(
                path.resolve(import.meta.dirname, languageMap[language]),
              )
              languageCache.set(language, languageModule)
            }
            return languageCache.get(language)!
          },
          catch: (cause) => new AstParserError({ cause }),
        })
      })

      const parse = Effect.fnUntraced(function* (input: {
        content: string
        language: SupportedLanguage
      }) {
        const { content, language } = input

        const languageModule = yield* load(language)

        return yield* Effect.try({
          try: () => {
            const parser = new Parser()

            parser.reset()
            parser.setLanguage(languageModule)

            return parser.parse(content)
          },
          catch: (cause) => new AstParserError({ cause }),
        })
      })

      return {
        parse: parse,
      } as const
    }),
  },
) {}

export type { Node as SyntaxNode } from 'web-tree-sitter'

const languageMap = {
  typescript: './tree-sitter-typescript.wasm',
  tsx: './tree-sitter-tsx.wasm',
  json: './tree-sitter-json.wasm',
} satisfies Record<SupportedLanguage, string>
