import * as Effect from 'effect/Effect'
import Parser from 'tree-sitter'
import Typescript from 'tree-sitter-typescript'

import { SupportedLanguage } from '../../../domain'
import { AstParserError } from '../../../domain/errors'

export class AstParser extends Effect.Service<AstParser>()(
  '@grepai/core/internal/services/chunker-ast/ast-parser/AstParser',
  {
    sync: () => {
      const parse = Effect.fnUntraced(function* (input: {
        content: string
        language: SupportedLanguage
      }) {
        const { content, language } = input

        return yield* Effect.try({
          try: () => {
            const parser = new Parser()

            parser.reset()
            parser.setLanguage(languageMap[language])

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

export type { SyntaxNode } from 'tree-sitter'

const languageMap = {
  typescript: Typescript.typescript as Parser.Language,
  tsx: Typescript.tsx as Parser.Language,
} satisfies Record<SupportedLanguage, Parser.Language>
