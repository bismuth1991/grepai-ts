import * as Effect from 'effect/Effect'
import Parser from 'tree-sitter'
import Typescript from 'tree-sitter-typescript'

import { SupportedLanguage } from '../../domain'
import { AstParserError } from '../../domain/errors'

export class AstParser extends Effect.Service<AstParser>()(
  '@grepai/core/internal/services/ast-parser-v2/AstParser',
  {
    sync: () => {
      const parse = Effect.fnUntraced(function* (input: {
        content: string
        query: string
        language: SupportedLanguage
      }) {
        const { content, query, language } = input

        return yield* Effect.try({
          try: () => {
            const parser = new Parser()

            parser.reset()
            parser.setLanguage(languageMap[language])

            const tree = parser.parse(content)
            const parserQuery = new Parser.Query(parser.getLanguage(), query)

            return parserQuery
              .matches(tree.rootNode)
              .map(({ captures }) => captures)
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

const languageMap = {
  typescript: Typescript.typescript as Parser.Language,
  tsx: Typescript.tsx as Parser.Language,
} satisfies Record<SupportedLanguage, Parser.Language>
