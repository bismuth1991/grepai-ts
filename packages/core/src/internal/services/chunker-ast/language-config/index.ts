import type { SyntaxNode } from '../ast-parser'

import { SupportedLanguage } from '../../../../domain'

import { javascript } from './javascript'
import { json } from './json'
import { tsx } from './tsx'
import { typescript } from './typescript'

export type ChunkerLanguageConfig = {
  isClosingSyntax: (text: string) => boolean
  wantedNodes: Set<string>
  scopeNodes: Set<string>
  importNodes: Set<string>
  extractNodeName: (node: SyntaxNode) => string
}

export const languageConfig = {
  typescript,
  tsx,
  json,
  javascript,
} satisfies Record<SupportedLanguage, ChunkerLanguageConfig>
