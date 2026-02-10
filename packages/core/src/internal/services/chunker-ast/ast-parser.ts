import * as Effect from 'effect/Effect'
import { Parser, Language } from 'web-tree-sitter'

import { SupportedLanguage } from '../../../domain'
import { AstParserError } from '../../../domain/errors'

export class AstParser extends Effect.Service<AstParser>()(
  '@grepai/core/internal/services/chunker-ast/ast-parser/AstParser',
  {
    sync: () => {
      let initialzed = false
      const languageCache: Map<SupportedLanguage, Language> = new Map()

      const parse = Effect.fnUntraced(function* (input: {
        content: string
        language: SupportedLanguage
      }) {
        const { content, language } = input

        return yield* Effect.tryPromise({
          try: async () => {
            if (!initialzed) {
              await Parser.init()
              initialzed = true
            }

            const parser = new Parser()

            parser.reset()

            parser.setLanguage(
              await (async () => {
                if (!languageCache.has(language)) {
                  languageCache.set(
                    language,
                    await Language.load(languageMap[language]),
                  )
                }
                return languageCache.get(language)!
              })(),
            )

            const tree = parser.parse(content)

            return tree
          },
          catch: (cause) => new AstParserError({ cause }),
        })
      })

      return {
        parse: parse,
      } as const
    },
  },
) {}

export type { Node as SyntaxNode } from 'web-tree-sitter'

const languageMap = {
  typescript: require.resolve('./tree-sitter-typescript.wasm'),
  tsx: require.resolve('./tree-sitter-tsx.wasm'),
} satisfies Record<SupportedLanguage, string>
