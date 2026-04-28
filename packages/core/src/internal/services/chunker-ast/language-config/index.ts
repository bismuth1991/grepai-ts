import type { SyntaxNode } from '../ast-parser'

import { SupportedLanguage } from '../../../../domain'

import { java } from './java'
import { javascript } from './javascript'
import { json } from './json'
import { prisma } from './prisma'
import { tsx } from './tsx'
import { typescript } from './typescript'
import { yaml } from './yaml'

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
  java,
  yaml,
  prisma,
} satisfies Record<SupportedLanguage, ChunkerLanguageConfig>
