import type { SyntaxNode } from '../ast-parser'

import { ChunkerLanguageConfig } from '.'

export const json: ChunkerLanguageConfig = {
  isClosingSyntax: (text: string) => /^[\s\]}]+$/.test(text),

  extractNodeName,

  wantedNodes: new Set(['pair']),

  scopeNodes: new Set(['object', 'array', 'pair']),

  importNodes: new Set([]),
}

function extractNodeName(node: SyntaxNode): string {
  if (node.type === 'pair') {
    const key = node.childForFieldName('key')
    if (key) {
      return stripQuotes(key.text)
    }
    return '<pair>'
  }

  if (node.type === 'object' || node.type === 'array') {
    let ancestor = node.parent
    while (ancestor) {
      if (ancestor.type === 'pair') {
        const key = ancestor.childForFieldName('key')
        if (key) {
          return stripQuotes(key.text)
        }
        break
      }
      ancestor = ancestor.parent
    }

    return node.type === 'object' ? '<object>' : '<array>'
  }

  return '<anonymous>'
}

function stripQuotes(text: string): string {
  if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
    return text.slice(1, -1)
  }
  return text
}
